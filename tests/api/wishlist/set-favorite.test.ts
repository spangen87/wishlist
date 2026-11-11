/**
 * Unit tests for POST /api/wishlist/set-favorite — parents changing favorites.
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 */

const mockVerifyIdToken = jest.fn();
const mockWishlistGet = jest.fn();
const mockItemGet = jest.fn();
const mockItemUpdate = jest.fn();
const mockFavoritesGet = jest.fn();

const mockAdminDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: mockWishlistGet,
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ get: mockItemGet, update: mockItemUpdate })),
        where: jest.fn(() => ({ get: mockFavoritesGet })),
      })),
    })),
  })),
};

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb,
  adminAuth: { verifyIdToken: mockVerifyIdToken },
}));

jest.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/wishlist/set-favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const valid = { idToken: 'tok', wishlistId: 'wl1', itemId: 'i1', isFavorite: true };

describe('POST /api/wishlist/set-favorite', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/wishlist/set-favorite/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });
    mockWishlistGet.mockResolvedValue({
      exists: true,
      data: () => ({ childUid: 'c1', parentUids: ['u1'], viewerUids: ['v1'] }),
    });
    mockItemGet.mockResolvedValue({ exists: true, data: () => ({ title: 'Thing' }) });
    mockFavoritesGet.mockResolvedValue({ size: 0 });
    mockItemUpdate.mockResolvedValue(undefined);
  });

  it('returns 400 when isFavorite is not a boolean', async () => {
    const res = await POST(makeRequest({ ...valid, isFavorite: 'yes' }));
    expect(res.status).toBe(400);
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad token'));
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a viewer who is not a parent', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'v1' });
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(403);
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the item does not exist', async () => {
    mockItemGet.mockResolvedValue({ exists: false });
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(404);
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it('lets a parent mark a wish as favorite', async () => {
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
    expect(mockItemUpdate).toHaveBeenCalledWith({ isFavorite: true });
  });

  it('returns 409 when the list already has the maximum number of favorites', async () => {
    mockFavoritesGet.mockResolvedValue({ size: 5 });
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(409);
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it('lets a parent remove a favorite even when the list is full', async () => {
    mockItemGet.mockResolvedValue({ exists: true, data: () => ({ isFavorite: true }) });
    mockFavoritesGet.mockResolvedValue({ size: 5 });
    const res = await POST(makeRequest({ ...valid, isFavorite: false }));
    expect(res.status).toBe(200);
    expect(mockItemUpdate).toHaveBeenCalledWith({ isFavorite: false });
  });
});
