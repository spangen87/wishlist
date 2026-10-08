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

// Query results keyed by "collection:field=value" — a child's lists are found
// with where('childUid', '==', …).
type QueryDoc = { id: string; ref: DocMocks; data: () => Record<string, unknown> };
const mockQueryResults = new Map<string, QueryDoc[]>();
const mockBatchUpdate = jest.fn();

const mockAdminDb = {
  collection: jest.fn((col: string) => ({
    doc: jest.fn((id: string) => {
      // Mirror firebase-admin: an empty document path throws. Account-free
      // lists store childUid as '', so a mock that quietly accepted it would
      // hide the very crash this suite is meant to catch.
      if (!id) throw new Error('Document path must be a non-empty string');
      return docMocks(`${col}/${id}`);
    }),
    where: jest.fn((field: string, _op: string, value: unknown) => ({
      get: jest.fn(async () => ({ docs: mockQueryResults.get(`${col}:${field}=${value}`) ?? [] })),
    })),
  })),
  batch: jest.fn(() => ({ update: mockBatchUpdate, commit: jest.fn().mockResolvedValue(undefined) })),
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
    mockQueryResults.clear();

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

  it("removes a co-parent from the child's other lists too", async () => {
    mockQueryResults.set('wishlists:childUid=uid-child', [
      { id: 'wl-1', ref: docMocks('wishlists/wl-1'), data: () => ({ childUid: 'uid-child' }) },
      { id: 'list-xmas', ref: docMocks('wishlists/list-xmas'), data: () => ({ childUid: 'uid-child' }) },
    ]);
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-parent-a' });
    const res = await POST(
      makeRequest({ idToken: 't', wishlistId: 'wl-1', memberUid: 'uid-parent-b', memberType: 'parent' }),
    );
    expect(res.status).toBe(200);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(docMocks('wishlists/list-xmas'), {
      parentUids: { op: 'arrayRemove', v: ['uid-parent-b'] },
    });
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
  it('removes a co-handler from an account-free list, which has no child doc', async () => {
    // childUid is '' here — mirroring users/{childUid} would throw, and it used
    // to do so *after* the removal had committed, so the caller saw a failure
    // for a change that had already happened.
    docMocks('wishlists/wl-free').get.mockResolvedValue({
      exists: true,
      data: () => ({
        childUid: '',
        ownerUid: 'uid-parent-a',
        parentUids: ['uid-parent-a', 'uid-parent-b'],
        viewerUids: [],
      }),
    });
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-parent-a' });
    const res = await POST(
      makeRequest({
        idToken: 't',
        wishlistId: 'wl-free',
        memberUid: 'uid-parent-b',
        memberType: 'parent',
      }),
    );
    expect(res.status).toBe(200);
    expect(docMocks('wishlists/wl-free').update).toHaveBeenCalledWith({
      parentUids: { op: 'arrayRemove', v: ['uid-parent-b'] },
    });
  });
});
