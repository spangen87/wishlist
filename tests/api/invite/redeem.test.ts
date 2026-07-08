/**
 * Unit tests for POST /api/invite/redeem
 *
 * Focus: role preservation (a parent/child redeeming a viewer link must NOT be
 * downgraded), child escalation via co-parent links, and single-use parent
 * invites. Isolated via jest.mock — no live Firebase emulator required.
 */

const mockVerifyIdToken = jest.fn();
const mockSetCustomUserClaims = jest.fn();

const mockAdminAuth = {
  verifyIdToken: mockVerifyIdToken,
  setCustomUserClaims: mockSetCustomUserClaims,
};

// Per-document mock registry keyed by "collection/docId"
type DocMocks = { get: jest.Mock; update: jest.Mock; set: jest.Mock };
const docRegistry = new Map<string, DocMocks>();

function docMocks(key: string): DocMocks {
  let entry = docRegistry.get(key);
  if (!entry) {
    entry = {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      update: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    docRegistry.set(key, entry);
  }
  return entry;
}

const mockAdminDb = {
  collection: jest.fn((col: string) => ({
    doc: jest.fn((id: string) => docMocks(`${col}/${id}`)),
  })),
};

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb,
  adminAuth: mockAdminAuth,
}));

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
    arrayUnion: jest.fn((...v: unknown[]) => ({ op: 'arrayUnion', v })),
    arrayRemove: jest.fn((...v: unknown[]) => ({ op: 'arrayRemove', v })),
    delete: jest.fn(() => ({ op: 'delete' })),
  },
}));

import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/invite/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setDoc(key: string, data: Record<string, unknown> | null) {
  docMocks(key).get.mockResolvedValue(
    data === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => data },
  );
}

describe('POST /api/invite/redeem', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/invite/redeem/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    docRegistry.clear();

    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller' });

    setDoc('invites/tok-viewer', { wishlistId: 'wl-1', active: true });
    setDoc('invites/tok-parent', { wishlistId: 'wl-1', active: true, type: 'parent' });
    setDoc('wishlists/wl-1', {
      childUid: 'uid-child-owner',
      parentUids: ['uid-existing-parent'],
      viewerUids: [],
    });
    setDoc('users/uid-caller', null);
  });

  it('rejects an inactive invite with 410', async () => {
    setDoc('invites/tok-viewer', { wishlistId: 'wl-1', active: false });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(410);
  });

  it('assigns viewer role to accounts without a role', async () => {
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-caller', { role: 'viewer' });
    expect(docMocks('wishlists/wl-1').update).toHaveBeenCalledWith({
      viewerUids: { op: 'arrayUnion', v: ['uid-caller'] },
    });
  });

  it('does NOT downgrade a parent redeeming a viewer link', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller', role: 'parent' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('does NOT downgrade a child redeeming a viewer link to a sibling list', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller', role: 'child' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('falls back to the users doc when the token claim is stale', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller' });
    setDoc('users/uid-caller', { role: 'parent' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('blocks a child account from redeeming a co-parent invite', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller', role: 'child' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-parent' }));
    expect(res.status).toBe(403);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(docMocks('wishlists/wl-1').update).not.toHaveBeenCalled();
  });

  it('upgrades a viewer to parent and burns the single-use parent invite', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller', role: 'viewer' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-parent' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wishlistRole).toBe('parent');

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-caller', { role: 'parent' });
    expect(docMocks('wishlists/wl-1').update).toHaveBeenCalledWith(
      expect.objectContaining({
        parentUids: { op: 'arrayUnion', v: ['uid-caller'] },
        viewerUids: { op: 'arrayRemove', v: ['uid-caller'] },
        currentParentInviteToken: { op: 'delete' },
      }),
    );
    expect(docMocks('invites/tok-parent').update).toHaveBeenCalledWith({ active: false });
  });

  it('keeps the parent claim untouched for an existing parent joining another list', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-caller', role: 'parent' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-parent' }));
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('blocks the child owner from joining their own wishlist', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-child-owner', role: 'child' });
    const res = await POST(makeRequest({ idToken: 't', token: 'tok-viewer' }));
    expect(res.status).toBe(409);
  });
});
