/**
 * Unit tests for POST /api/auth/set-viewer-claim
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 */

const mockVerifyIdToken = jest.fn();
const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();

const mockAdminAuth = {
  verifyIdToken: mockVerifyIdToken,
  setCustomUserClaims: mockSetCustomUserClaims,
  getUser: mockGetUser,
};

const mockDocSet = jest.fn();
const mockDocGet = jest.fn();
const mockAdminDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      set: mockDocSet,
      get: mockDocGet,
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
    mockGetUser.mockResolvedValue({ customClaims: undefined });
    mockDocGet.mockResolvedValue({ exists: false, data: () => undefined });
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

  it('sets role claim to viewer for accounts without a role', async () => {
    const req = makeRequest({ idToken: 'valid-token' });
    await POST(req);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-viewer', { role: 'viewer' });
  });

  it('writes user profile to Firestore when none exists', async () => {
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

  it('does NOT downgrade an existing parent role', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { role: 'parent' } });
    const req = makeRequest({ idToken: 'valid-token' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('parent');
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('does NOT downgrade an existing child role', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { role: 'child' } });
    const req = makeRequest({ idToken: 'valid-token' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('merges instead of overwriting when a profile already exists', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ username: 'kalle' }) });
    const req = makeRequest({ idToken: 'valid-token' });
    await POST(req);
    expect(mockDocSet).toHaveBeenCalledWith({ role: 'viewer' }, { merge: true });
  });
});
