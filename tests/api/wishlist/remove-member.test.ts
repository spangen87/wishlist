/**
 * Unit tests for POST /api/wishlist/remove-member
 *
 * Isolated via jest.mock — no live Firebase emulator required.
 */

const mockVerifyIdToken = jest.fn();

const mockAdminAuth = {
  verifyIdToken: mockVerifyIdToken,
};

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
    arrayRemove: jest.fn((...v: unknown[]) => ({ op: 'arrayRemove', v })),
  },
}));

import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/wishlist/remove-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/wishlist/remove-member', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/wishlist/remove-member/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    docRegistry.clear();

    docMocks('wishlists/wl-1').get.mockResolvedValue({
      exists: true,
      data: () => ({
        childUid: 'uid-child',
        parentUids: ['uid-parent-a', 'uid-parent-b'],
        viewerUids: ['uid-viewer-1'],
      }),
    });
  });

  it('returns 400 for a bad memberType', async () => {
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'x', memberType: 'admin' }),
    );
    expect(res.status).toBe(400);
  });

  it('lets a parent remove a viewer', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-parent-a' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-viewer-1', memberType: 'viewer' }),
    );
    expect(res.status).toBe(200);
    expect(docMocks('wishlists/wl-1').update).toHaveBeenCalledWith({
      viewerUids: { op: 'arrayRemove', v: ['uid-viewer-1'] },
    });
  });

  it('lets the child owner remove a viewer', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-child' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-viewer-1', memberType: 'viewer' }),
    );
    expect(res.status).toBe(200);
  });

  it('forbids an unrelated user from removing a viewer', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-stranger' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-viewer-1', memberType: 'viewer' }),
    );
    expect(res.status).toBe(403);
  });

  it('lets a parent remove a co-parent and syncs the users doc', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-parent-a' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-parent-b', memberType: 'parent' }),
    );
    expect(res.status).toBe(200);
    expect(docMocks('wishlists/wl-1').update).toHaveBeenCalledWith({
      parentUids: { op: 'arrayRemove', v: ['uid-parent-b'] },
    });
    expect(docMocks('users/uid-child').set).toHaveBeenCalledWith(
      { parentUids: { op: 'arrayRemove', v: ['uid-parent-b'] } },
      { merge: true },
    );
  });

  it('forbids the child from removing a parent', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-child' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-parent-b', memberType: 'parent' }),
    );
    expect(res.status).toBe(403);
    expect(docMocks('wishlists/wl-1').update).not.toHaveBeenCalled();
  });

  it('forbids a parent from removing themselves', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-parent-a' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-parent-a', memberType: 'parent' }),
    );
    expect(res.status).toBe(409);
    expect(docMocks('wishlists/wl-1').update).not.toHaveBeenCalled();
  });
});
