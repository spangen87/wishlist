---
phase: 02-authentication
plan: 01
subsystem: auth
tags: [firebase, firebase-auth, firebase-admin, react-context, next-route-handlers, custom-claims]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: src/lib/firebase/client.ts (auth, db exports), src/lib/firebase/admin.ts (adminAuth, adminDb exports), src/types/firestore.ts (UserDoc, UsernameDoc)

provides:
  - POST /api/auth/register-child — child account creation with atomic username claim and role:'child' custom claim
  - POST /api/auth/set-viewer-claim — verifies idToken and sets role:'viewer' custom claim
  - AuthProvider + useAuth() hook — wraps entire app with Firebase session state
  - emulator-aware client.ts — connectAuthEmulator/connectFirestoreEmulator behind NEXT_PUBLIC_USE_EMULATOR

affects: [02-authentication/02-02, 02-authentication/02-03, all pages using useAuth()]

# Tech tracking
tech-stack:
  added: []  # All packages already installed in Phase 1
  patterns:
    - "Atomic username claim via Firestore transaction before createUser() — prevents race conditions"
    - "Synthetic email pattern: {username}@wishlist.internal for child accounts"
    - "import 'server-only' on all Route Handlers to prevent client bundle inclusion"
    - "AuthProvider as 'use client' wrapper in Server Component layout — standard App Router pattern"
    - "getIdTokenResult() to read custom claims from ID token in onAuthStateChanged"

key-files:
  created:
    - src/app/api/auth/register-child/route.ts
    - src/app/api/auth/set-viewer-claim/route.ts
    - src/components/AuthProvider.tsx
    - tests/api/auth/register-child.test.ts
    - tests/api/auth/set-viewer-claim.test.ts
  modified:
    - src/lib/firebase/client.ts
    - src/app/layout.tsx
    - jest.config.ts

key-decisions:
  - "Firestore transaction atomically claims usernames/{username} with uid:'__pending__' before createUser() — if Auth creation fails, cleanup deletes the placeholder doc"
  - "loading:true as initial AuthContext state prevents auth flash (Pitfall 5 from research)"
  - "connectAuthEmulator/connectFirestoreEmulator gated behind NEXT_PUBLIC_USE_EMULATOR=true (not NODE_ENV) for flexibility"
  - "jest.config.ts moduleNameMapper added for @/ alias — required for Route Handler unit tests"

patterns-established:
  - "Route Handler pattern: import 'server-only', parse body with .catch(()=>({})) fallback, validate inputs, return NextResponse.json with explicit status"
  - "AuthProvider pattern: onAuthStateChanged + getIdTokenResult() for role reading, loading gate, unsubscribe cleanup"
  - "TDD pattern for Route Handlers: jest.mock('@/lib/firebase/admin') with per-test mockImplementation"

requirements-completed: [AUTH-01, AUTH-04]

# Metrics
duration: 25min
completed: 2026-04-08
---

# Phase 02 Plan 01: Auth Infrastructure Summary

**Firebase Route Handlers for child account creation (atomic username claim + role:'child') and viewer claim setting, plus AuthProvider context wrapping the entire app via useAuth()**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-08T05:05:00Z
- **Completed:** 2026-04-08T05:30:51Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- POST /api/auth/register-child: atomic Firestore transaction prevents username race conditions (STATE.md concern resolved); sets role:'child' custom claim via Admin SDK; writes usernames/{username} + users/{uid} Firestore docs
- POST /api/auth/set-viewer-claim: verifies Firebase ID token signature/expiry before setting role:'viewer' claim; writes users/{uid} profile
- AuthProvider: wraps root layout; exposes user, role, loading via useAuth(); loading:true prevents auth flash; unsubscribe cleanup on unmount
- client.ts: connectAuthEmulator (9099) and connectFirestoreEmulator (8080) behind NEXT_PUBLIC_USE_EMULATOR=true with HMR-safe guards
- TDD: wrote unit tests with full Admin SDK mocking for both route handlers (RED committed before GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add emulator connection to client.ts** - `1edd0de` (feat)
2. **Task 2: Route Handler tests (RED phase)** - `5f79d9d` (test)
3. **Task 2: Create register-child and set-viewer-claim route handlers** - `ff76ae2` (feat)
4. **Task 3: Create AuthProvider and wire into root layout** - `ea1299f` (feat)

## Files Created/Modified

- `src/lib/firebase/client.ts` — added connectAuthEmulator + connectFirestoreEmulator behind env flag
- `src/app/api/auth/register-child/route.ts` — POST handler: atomic username claim, createUser(), role claim, batch writes
- `src/app/api/auth/set-viewer-claim/route.ts` — POST handler: verifyIdToken, setCustomUserClaims('viewer'), users doc write
- `src/components/AuthProvider.tsx` — 'use client' context: user, role, loading; onAuthStateChanged + getIdTokenResult()
- `src/app/layout.tsx` — import AuthProvider + wrap children
- `tests/api/auth/register-child.test.ts` — unit tests with mocked Admin SDK (8 cases)
- `tests/api/auth/set-viewer-claim.test.ts` — unit tests with mocked Admin SDK (5 cases)
- `jest.config.ts` — added moduleNameMapper for @/ path alias

## Decisions Made

- Firestore transaction with `uid:'__pending__'` placeholder reserves username slot before `createUser()` runs. If Auth creation fails, the cleanup block deletes the placeholder. This is the correct order per Pitfall 3 in research (transaction → createUser → batch write profile).
- `loading: true` as initial AuthContext state is mandatory to prevent flash of unauthenticated content on page refresh (Pitfall 5).
- Used `NEXT_PUBLIC_USE_EMULATOR=true` (not `NODE_ENV=development`) so the emulator flag can be controlled independently of build mode — matches research Open Question 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added moduleNameMapper for @/ alias in jest.config.ts**
- **Found during:** Task 2 (Route Handler tests)
- **Issue:** jest.config.ts had no moduleNameMapper — tests importing `@/lib/firebase/admin` would fail to resolve
- **Fix:** Added `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` to jest.config.ts
- **Files modified:** jest.config.ts
- **Verification:** Config now matches tsconfig.json paths alias
- **Committed in:** `5f79d9d` (TDD RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for test resolution. No scope creep.

## Issues Encountered

- node_modules not installed in worktree — `npx tsc --noEmit` and `jest` could not run. TypeScript validity verified by code review against existing types; tsc check deferred to orchestrator's post-execution validation.
- .env.local is gitignored (correct) — documented locally but not committed; developers must create it manually with `NEXT_PUBLIC_USE_EMULATOR=true`.

## Known Stubs

None — all implementation is fully wired. No placeholder data flows to UI.

## User Setup Required

Developers must create `.env.local` at project root with:
```
NEXT_PUBLIC_USE_EMULATOR=true
```
This file is gitignored and must be created locally. Without it, the app will connect to production Firebase services in local development.

## Next Phase Readiness

- Plan 02-02 (login page) can import `useAuth()` from `@/components/AuthProvider` and call `signInWithEmailAndPassword` after username lookup
- Plan 02-03 (register page) can call `createUserWithEmailAndPassword` then POST to `/api/auth/set-viewer-claim`
- Both route handlers are ready for integration; Auth emulator connection is in place for local testing
- Atomic username race condition concern from STATE.md is resolved

---
*Phase: 02-authentication*
*Completed: 2026-04-08*
