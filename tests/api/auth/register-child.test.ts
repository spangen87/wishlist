/**
 * Unit tests for POST /api/auth/register-child
 *
 * Tests are isolated via jest.mock — no live Firebase emulator required.
 * The admin SDK calls are mocked at the module level.
 */

// --- Mocks must be hoisted before any imports that use them ---

const mockRunTransaction = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchDelete = jest.fn();
const mockDocDelete = jest.fn();
const mockDocGet = jest.fn();
const mockUsernameDocRef = {
  delete: mockDocDelete,
};

const mockBatch = {
  set: mockBatchSet,
  commit: mockBatchCommit,
};

const mockAdminDb = {
  runTransaction: mockRunTransaction,
  batch: jest.fn(() => mockBatch),
  collection: jest.fn((collName: string) => ({
    doc: jest.fn((docId: string) => ({
      ...mockUsernameDocRef,
      id: docId,
      // Reference used in batch.set calls
    })),
  })),
};

const mockCreateUser = jest.fn();
const mockSetCustomUserClaims = jest.fn();

const mockAdminAuth = {
  createUser: mockCreateUser,
  setCustomUserClaims: mockSetCustomUserClaims,
};

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb,
  adminAuth: mockAdminAuth,
}));

jest.mock('server-only', () => ({}));

// Mock FieldValue.serverTimestamp
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
  },
}));

// --- Now import the handler under test ---
import { NextRequest } from 'next/server';

// Helper to create a NextRequest with a JSON body
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register-child', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register-child', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/auth/register-child/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: transaction resolves (username available)
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const mockTx = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn(),
      };
      await fn(mockTx);
    });

    // Default: createUser succeeds
    mockCreateUser.mockResolvedValue({ uid: 'uid-alice' });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockBatchSet.mockReturnValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockDocDelete.mockResolvedValue(undefined);
  });

  it('returns 400 when username is missing', async () => {
    const req = makeRequest({ password: 'pass123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('username and password required');
  });

  it('returns 400 when password is missing', async () => {
    const req = makeRequest({ username: 'alice' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('username and password required');
  });

  it('returns 400 when body is empty', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('username and password required');
  });

  it('normalises username to lowercase before creating account', async () => {
    const req = makeRequest({ username: 'ALICE', password: 'pass123' });
    await POST(req);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@wishlist.internal' }),
    );
  });

  it('returns 201 with uid on success', async () => {
    const req = makeRequest({ username: 'alice', password: 'pass123' });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.uid).toBe('uid-alice');
  });

  it('sets role claim to child after creating user', async () => {
    const req = makeRequest({ username: 'alice', password: 'pass123' });
    await POST(req);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-alice', { role: 'child' });
  });

  it('returns 409 when username is already taken (transaction throws)', async () => {
    mockRunTransaction.mockRejectedValue(new Error('USERNAME_TAKEN'));
    const req = makeRequest({ username: 'alice', password: 'pass123' });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Username already taken');
  });

  it('returns 409 when Firebase Auth reports email-already-exists', async () => {
    mockCreateUser.mockRejectedValue({ code: 'auth/email-already-exists' });
    const req = makeRequest({ username: 'alice', password: 'pass123' });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Username already taken');
  });
});
