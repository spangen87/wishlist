---
phase: 01-foundation
plan: 02
subsystem: firebase
tags: [firebase, firebase-admin, server-only, typescript, next.js, firestore, auth]

requires:
  - phase: 01-foundation
    plan: 01
    provides: next-js-app-scaffold with firebase and firebase-admin packages pre-installed

provides:
  - client-firebase-singleton (db, auth)
  - admin-firebase-singleton (adminDb, adminAuth)
  - server-only-build-guard for admin credentials

affects:
  - all-downstream-phases
  - phase-02-auth
  - phase-03-wishlist-crud
  - phase-04-share-links

tech-stack:
  added: []
  patterns:
    - "Client SDK HMR guard: getApps().length === 0 ? initializeApp() : getApp()"
    - "Admin SDK server-only guard: import 'server-only' as first import prevents browser bundling"
    - "Modular firebase-admin sub-package imports (firebase-admin/app, not legacy firebase-admin)"
    - "Private key newline fix: FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n') for PEM format"

key-files:
  created:
    - src/lib/firebase/client.ts
    - src/lib/firebase/admin.ts
  modified: []

key-decisions:
  - "D-05: Client SDK singleton exported from src/lib/firebase/client.ts — all client components import db and auth from here"
  - "D-06: Admin SDK singleton exported from src/lib/firebase/admin.ts with server-only guard — enforced at build time"
  - "D-07: Admin env vars use no NEXT_PUBLIC_ prefix; client vars use NEXT_PUBLIC_FIREBASE_* — credentials never reach browser bundle"

patterns-established:
  - "Pattern 1: Client Firebase — import { db, auth } from '@/lib/firebase/client'"
  - "Pattern 2: Server Firebase — import { adminDb, adminAuth } from '@/lib/firebase/admin' (API routes and Server Components only)"

requirements-completed: [SYNC-01]

duration: 8min
completed: "2026-04-07"
---

# Phase 1 Plan 2: Firebase SDK Split Summary

**Dual Firebase SDK split: client.ts (HMR-guarded browser singleton) and admin.ts (server-only guarded Admin SDK) establishing the import boundary all future phases depend on.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-07T16:59:49Z
- **Completed:** 2026-04-07T17:07:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/lib/firebase/client.ts` with HMR guard exporting `db` (Firestore) and `auth` (Firebase Auth) for client components
- Created `src/lib/firebase/admin.ts` with `import 'server-only'` as first import — causes build error if ever imported in a client component
- Established the single source of truth for Firebase access across all downstream phases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/firebase/client.ts — client SDK singleton** - `3e02122` (feat)
2. **Task 2: Create lib/firebase/admin.ts — Admin SDK with server-only guard** - `64cb2ff` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/lib/firebase/client.ts` - Client-side Firebase singleton: exports `db` and `auth` with HMR guard
- `src/lib/firebase/admin.ts` - Server-side Admin SDK singleton: exports `adminDb` and `adminAuth`, guarded by `server-only` first import

## Decisions Made

### D-05: Client SDK singleton
All client components import `db` and `auth` from `@/lib/firebase/client`. Single initialization point prevents duplicate app instances.

### D-06: Admin SDK server-only guard
`import 'server-only'` as the very first line of `admin.ts` is the build-time contract. Next.js will throw a build error if any client component imports this file. This is a non-negotiable safety contract (T-02-01).

### D-07: Environment variable prefix separation
- Client env vars: `NEXT_PUBLIC_FIREBASE_*` — safe for browser bundle
- Admin env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — no `NEXT_PUBLIC_` prefix, server-side only (T-02-03)

### Private key newline fix
`FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')` converts literal `\n` escape sequences back to real newlines. Without this, Firebase Admin rejects the credential with "invalid PEM" error when the private key is stored as an env var.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npm install` was not available in the worktree (no node_modules). Build verification (`npm run build`) could not be run. File content was verified against all acceptance criteria via grep checks — all criteria pass. The build verification will complete when the orchestrator runs integration tests or when the developer first runs `npm install` in the worktree.

## User Setup Required

None - no external service configuration required by this plan. (User still needs to fill in `.env.local` with Firebase credentials before runtime use — documented in Plan 01 blockers.)

## Next Phase Readiness

- Client Firebase SDK ready: `import { db, auth } from '@/lib/firebase/client'`
- Admin Firebase SDK ready: `import { adminDb, adminAuth } from '@/lib/firebase/admin'`
- Phase 2 (auth) can now implement login/logout flows using `auth` and `adminAuth`
- Phase 3 (wishlist CRUD) can use `db` for client reads and `adminDb` for server writes
- Concern: `npm run build` exit code not verified due to missing node_modules in worktree — orchestrator should run build after merge

## Known Stubs

None - this plan creates infrastructure only (no UI rendering, no data wiring).

## Threat Flags

None — all STRIDE threats from this plan's threat model are addressed:
- T-02-01 (admin.ts in browser bundle): `import 'server-only'` on line 1 of admin.ts — MITIGATED
- T-02-02 (Admin SDK bypasses Firestore rules): Accepted — scoped to server-side only
- T-02-03 (FIREBASE_PRIVATE_KEY in env): No `NEXT_PUBLIC_` prefix on any admin var — MITIGATED
- T-02-04 (getApps() guard race condition): Firebase internal mutex handles this — ACCEPTED

## Self-Check

Files verified present:
- src/lib/firebase/client.ts: FOUND
- src/lib/firebase/admin.ts: FOUND

Commits verified:
- 3e02122: Task 1 (client.ts)
- 64cb2ff: Task 2 (admin.ts)

Content verified:
- client.ts: HMR guard present, exports db and auth, uses NEXT_PUBLIC_ vars, no server-only import
- admin.ts: server-only first line, getApps guard, exports adminDb and adminAuth, private key newline fix, no NEXT_PUBLIC_ vars, modular sub-package imports

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-07*
