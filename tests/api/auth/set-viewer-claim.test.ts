/**
 * Unit tests for POST /api/auth/set-viewer-claim
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 */

const mockVerifyIdToken = jest.fn();
const mockSetCustomUserClaims = jest.fn();

const mockAdminAuth = {
  verifyIdToken: mockVerifyIdToken,
  setCustomUserClaims: mockSetCustomUserClaims,
};

const mockDocSet = jest.fn();
const mockAdminDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      set: mockDocSet,
    })),
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
  },
}));

import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/set-viewer-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/set-viewer-claim', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/auth/set-viewer-claim/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-viewer', email: 'viewer@example.com' });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
  });

  it('returns 400 when idToken is missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('idToken required');
  });

  it('returns 401 when idToken is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    const req = makeRequest({ idToken: 'bad-token' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid token');
  });

  it('returns 200 with ok:true on valid token', async () => {
    const req = makeRequest({ idToken: 'valid-token' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('sets role claim to viewer', async () => {
    const req = makeRequest({ idToken: 'valid-token' });
    await POST(req);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-viewer', { role: 'viewer' });
  });

  it('writes user profile to Firestore', async () => {
    const req = makeRequest({ idToken: 'valid-token' });
    await POST(req);
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'uid-viewer',
        email: 'viewer@example.com',
        role: 'viewer',
      }),
    );
  });
});
