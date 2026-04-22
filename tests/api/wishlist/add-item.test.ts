/**
 * Unit tests for POST /api/wishlist/add-item — URL scheme validation (SEC-02)
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 */

// --- Mocks must be hoisted before any imports that use them ---

const mockVerifyIdToken = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();

const mockItemDocRef = {
  id: 'mock-item-id',
  set: mockDocSet,
};

const mockAdminDb = {
  collection: jest.fn((collName: string) => ({
    doc: jest.fn((docId: string) => ({
      id: docId,
      get: mockDocGet,
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          })),
        })),
        doc: jest.fn(() => mockItemDocRef),
      })),
    })),
  })),
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
  return new NextRequest('http://localhost/api/wishlist/add-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/wishlist/add-item — URL scheme validation', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/wishlist/add-item/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: auth succeeds with uid 'u1'
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });

    // Default: wishlist exists and caller is a parent
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ parentUids: ['u1'], viewerUids: [] }),
    });

    // Default: item set succeeds
    mockDocSet.mockResolvedValue(undefined);
  });

  it('returns 400 when productUrl starts with javascript:', async () => {
    const req = makeRequest({
      idToken: 'tok',
      wishlistId: 'wl1',
      title: 'Thing',
      productUrl: 'javascript:alert(1)',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/productUrl must start with/);
  });

  it('returns 400 when imageUrl starts with data:', async () => {
    const req = makeRequest({
      idToken: 'tok',
      wishlistId: 'wl1',
      title: 'Thing',
      imageUrl: 'data:text/html,<script>x</script>',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/imageUrl must start with/);
  });

  it('does not reject productUrl starting with https://', async () => {
    const req = makeRequest({
      idToken: 'tok',
      wishlistId: 'wl1',
      title: 'Thing',
      productUrl: 'https://example.com',
    });
    const res = await POST(req);
    expect(res.status).not.toBe(400);
  });

  it('does not reject when productUrl is absent', async () => {
    const req = makeRequest({ idToken: 'tok', wishlistId: 'wl1', title: 'Thing' });
    const res = await POST(req);
    const body = await res.json();
    expect(body.error ?? '').not.toMatch(/must start with/);
  });
});
