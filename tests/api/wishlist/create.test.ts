/**
 * Unit tests for POST /api/wishlist/create — lists with no child account.
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 */

// --- Mocks must be hoisted before any imports that use them ---

const mockVerifyIdToken = jest.fn();
const mockWishlistSet = jest.fn();
const mockCount = jest.fn();
const mockUserGet = jest.fn();

let lastWishlistId = '';

const mockAdminDb = {
  collection: jest.fn((collName: string) => {
    if (collName === 'wishlists') {
      return {
        doc: jest.fn((docId?: string) => {
          if (docId === undefined) return { id: 'generated-id' };
          lastWishlistId = docId;
          return { id: docId, set: mockWishlistSet };
        }),
        where: jest.fn(() => ({ count: jest.fn(() => ({ get: mockCount })) })),
      };
    }
    // users
    return { doc: jest.fn(() => ({ get: mockUserGet })) };
  }),
};

const mockAdminAuth = {
  verifyIdToken: mockVerifyIdToken,
};

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb,
  adminAuth: mockAdminAuth,
}));

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
  },
}));

// --- Import handler under test ---
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/wishlist/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/wishlist/create', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/wishlist/create/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    lastWishlistId = '';
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1', role: 'parent' });
    mockCount.mockResolvedValue({ data: () => ({ count: 0 }) });
    mockUserGet.mockResolvedValue({ data: () => ({ role: 'parent' }) });
    mockWishlistSet.mockResolvedValue(undefined);
  });

  it('creates a list with no child account and the caller as its only parent', async () => {
    const res = await POST(makeRequest({ idToken: 'tok', title: '  Vårt bröllop  ' }));

    expect(res.status).toBe(201);
    expect(mockWishlistSet).toHaveBeenCalledTimes(1);
    const written = mockWishlistSet.mock.calls[0][0];
    expect(written).toMatchObject({
      childUid: '',
      ownerUid: 'u1',
      parentUids: ['u1'],
      viewerUids: [],
      title: 'Vårt bröllop',
      hidePurchases: false,
    });
    expect(written.occasion).toBeUndefined();
  });

  it('gives the list an ID that can never collide with a Firebase Auth UID', async () => {
    await POST(makeRequest({ idToken: 'tok', title: 'Dopet' }));
    // firestore.rules grants read when request.auth.uid == wishlistId, so the
    // ID must be outside the alphanumeric space Auth UIDs live in.
    expect(lastWishlistId).toBe('list-generated-id');
    expect(lastWishlistId).toMatch(/^list-/);
  });

  it('stores an occasion when one is supplied', async () => {
    const res = await POST(
      makeRequest({
        idToken: 'tok',
        title: 'Dopet',
        occasion: { name: '  Dop  ', date: '2026-09-12' },
      })
    );
    expect(res.status).toBe(201);
    expect(mockWishlistSet.mock.calls[0][0].occasion).toEqual({
      name: 'Dop',
      date: '2026-09-12',
    });
  });

  it('stores surprise mode when requested', async () => {
    await POST(makeRequest({ idToken: 'tok', title: 'Vårt bröllop', hidePurchases: true }));
    expect(mockWishlistSet.mock.calls[0][0].hidePurchases).toBe(true);
  });

  it('rejects a missing or blank title', async () => {
    expect((await POST(makeRequest({ idToken: 'tok' }))).status).toBe(400);
    expect((await POST(makeRequest({ idToken: 'tok', title: '   ' }))).status).toBe(400);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('rejects an over-long title', async () => {
    const res = await POST(makeRequest({ idToken: 'tok', title: 'a'.repeat(61) }));
    expect(res.status).toBe(400);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('rejects a malformed occasion', async () => {
    const badDate = await POST(
      makeRequest({ idToken: 'tok', title: 'Dopet', occasion: { name: 'Dop', date: '12/9/2026' } })
    );
    expect(badDate.status).toBe(400);

    const noName = await POST(
      makeRequest({ idToken: 'tok', title: 'Dopet', occasion: { name: ' ', date: '2026-09-12' } })
    );
    expect(noName.status).toBe(400);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('rejects an invalid session', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad token'));
    const res = await POST(makeRequest({ idToken: 'tok', title: 'Dopet' }));
    expect(res.status).toBe(401);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('refuses child accounts — they would be able to read their own purchases', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'child1', role: 'child' });
    const res = await POST(makeRequest({ idToken: 'tok', title: 'Min lista' }));
    expect(res.status).toBe(403);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('falls back to the users doc when the token claim has not propagated yet', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'child1' });
    mockUserGet.mockResolvedValue({ data: () => ({ role: 'child' }) });
    const res = await POST(makeRequest({ idToken: 'tok', title: 'Min lista' }));
    expect(res.status).toBe(403);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });

  it('refuses to go past the per-user list cap', async () => {
    mockCount.mockResolvedValue({ data: () => ({ count: 25 }) });
    const res = await POST(makeRequest({ idToken: 'tok', title: 'Ännu en lista' }));
    expect(res.status).toBe(409);
    expect(mockWishlistSet).not.toHaveBeenCalled();
  });
});
