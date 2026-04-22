# Testing Patterns
_Last updated: 2026-04-22_

## Summary
Testing is split across two distinct strategies: unit tests for API route handlers (Jest + ts-jest, no emulator required) and integration tests for Firestore security rules (Jest + `@firebase/rules-unit-testing`, requires a live Firebase emulator). All test files live under `tests/` at the project root. There are no component tests, no e2e tests, and no CI pipeline. Test coverage is not measured or enforced. The unit tests mock Firebase Admin SDK modules at the jest module level before any imports.

## Testing Frameworks and Tools

**Runner:** Jest 29 via `ts-jest`
- Config: `jest.config.ts`
- Transform: `ts-jest` with `{ strict: true }` tsconfig override
- Test environment: `node`
- Path alias: `@/*` → `<rootDir>/src/*` (mirrors `tsconfig.json`)

**Assertion library:** Jest built-in (`expect`)

**Firestore rules testing:** `@firebase/rules-unit-testing` 5.x
- Uses `initializeTestEnvironment` with a live local emulator on `127.0.0.1:8080`
- `assertFails` / `assertSucceeds` wrappers for rule assertions

**Run commands:**
```bash
npm run test:rules    # Runs Jest against tests/ using firebase emulators:exec (Firestore only)
npx jest tests/       # Run all tests directly (emulator must be running separately for rules tests)
```

There is no `npm test` script. The `test:rules` script starts the Firestore emulator, runs Jest, then stops it.

## Test File Organization

**Location:** All tests live under `/tests/` at the project root — not co-located with source files.

**Structure:**
```
tests/
├── firestore.rules         # Firestore rules file loaded by rules tests
├── firestore.rules.test.ts # Integration tests for Firestore security rules
└── api/
    └── auth/
        ├── set-viewer-claim.test.ts   # Unit tests for POST /api/auth/set-viewer-claim
        └── register-child.test.ts     # Unit tests for POST /api/auth/register-child
```

**Naming:** Test files match the route or module under test using kebab-case with `.test.ts` suffix.

**Jest match pattern:** `**/tests/**/*.test.ts` — only picks up `.test.ts` files under `tests/`.

## Types of Tests Present

**Unit tests (API route handlers):**
- `tests/api/auth/set-viewer-claim.test.ts` — 5 test cases
- `tests/api/auth/register-child.test.ts` — 9 test cases
- Fully isolated via `jest.mock` — no emulator, no network calls
- Cover: input validation (400), auth token verification (401), conflict detection (409), success (200/201), side-effect verification (custom claims, Firestore writes)

**Integration tests (Firestore security rules):**
- `tests/firestore.rules.test.ts` — 14 test cases
- Requires Firebase emulator running locally
- Covers the privacy boundary between child/viewer roles on `purchaseStatus`, `items`, `activityLog` subcollections, and `invites` collection

**E2E tests:** None present.

**Component tests:** None present.

## Test Structure Patterns

**Suite organization:**
```ts
describe('POST /api/auth/set-viewer-claim', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/auth/set-viewer-claim/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // set up default mock return values
  });

  it('returns 400 when idToken is missing', async () => { ... });
});
```

**Key pattern:** The route handler is imported dynamically inside `beforeAll` — after `jest.mock` calls have been hoisted. This ensures the module loads with mocked dependencies already in place.

**Firestore rules suite:**
```ts
describe('Firestore Security Rules — Privacy Boundary', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({ ... });
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // seed test data bypassing rules (simulates Admin SDK)
    });
  });

  afterEach(async () => { await testEnv.clearFirestore(); });
  afterAll(async () => { await testEnv.cleanup(); });

  it('DENY: child UID cannot read purchaseStatus subcollection', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    await assertFails(getDoc(statusRef));
  });
});
```

Test case names prefix with `ALLOW:` or `DENY:` to make the intended access control decision explicit.

## Mocking Patterns

All mocking is done at the Jest module level using `jest.mock`. Mocks are declared before any imports that depend on them (hoisted by Jest's transform).

**Firebase Admin SDK mock pattern:**
```ts
const mockVerifyIdToken = jest.fn();
const mockSetCustomUserClaims = jest.fn();

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
```

**`server-only` sentinel** is always mocked to a no-op — it would throw in a Jest (non-Next.js) environment otherwise.

**`FieldValue.serverTimestamp`** is mocked to return the string `'MOCK_TIMESTAMP'` for deterministic assertions.

**`mockAdminDb` structure** mirrors the chained Firestore Admin API:
```ts
const mockAdminDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({ set: mockDocSet })),
  })),
};
```

**Resetting between tests:** `jest.clearAllMocks()` called in `beforeEach` — resets call counts and return values, then default mock behaviors are re-applied.

**Helper for request construction:**
```ts
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/set-viewer-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```
Each test file defines its own `makeRequest` helper targeting the specific route URL.

## Coverage

- No coverage thresholds configured in `jest.config.ts`
- No coverage collection script in `package.json`
- Coverage is not measured or reported as part of any workflow

## CI Pipeline

No `.github/workflows/` directory exists. There is no automated CI pipeline. Tests are run locally only.

## What Is NOT Tested (Gaps)

- **Client components** — no tests for `WishItemCard`, `AuthProvider`, `AddItemForm`, or any component under `src/components/`
- **Most API routes** — only 2 of ~12 route handlers have unit tests. Untested routes include: `invite/create`, `invite/create-for-child`, `invite/create-for-parent`, `invite/redeem`, `invite/regenerate`, `invite/current`, `viewer/update-note`, `wishlist/add-item`, `wishlist/update-title`, `wishlist/[wishlistId]`, `auth/set-parent-claim`, `auth/user/[uid]`
- **Client-side Firebase library functions** — `src/lib/firebase/wishlist.ts`, `src/lib/firebase/viewer.ts`, `src/lib/firebase/client.ts` have no tests
- **Page-level logic** — `dashboard/page.tsx`, `wishlist/page.tsx`, and other pages contain non-trivial data-fetching and routing logic with no test coverage
- **Firestore rules for wishlists root collection** — `tests/firestore.rules.test.ts` covers subcollections and `invites` but does not test read/write rules on the top-level `wishlists` document or `users` collection
- **Error paths in untested routes** — transaction rollback, cleanup on partial failure, and concurrent request handling are only tested for `register-child`

## Gaps & Unknowns

- `firestore.rules` file referenced in `tests/firestore.rules.test.ts` at `tests/firestore.rules` — the content was not read during this analysis; it is assumed to match the rules deployed to the emulator.
- It is unclear whether tests pass in CI or are run before merging PRs — no evidence of enforcement was found.
- The `test:rules` script requires Firebase emulator to be available; no documentation on required emulator version or setup steps exists at the repo root.
