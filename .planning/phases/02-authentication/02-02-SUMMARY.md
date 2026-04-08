---
phase: 02-authentication
plan: 02
subsystem: auth
tags: [firebase-auth, client-components, login, register, username-login, viewer-registration, custom-claims]

# Dependency graph
requires:
  - phase: 02-authentication
    plan: 01
    provides: POST /api/auth/set-viewer-claim, AuthProvider + useAuth(), emulator-aware client.ts (auth + db exports)

provides:
  - /login page — child username+password login via signInWithEmailAndPassword with synthetic email derivation
  - /register page — viewer email+password registration with forced token refresh after claim is set

affects: [02-authentication/02-03, all protected pages that redirect to /login]

# Tech tracking
tech-stack:
  added: []  # No new packages — firebase client SDK already installed in Phase 1
  patterns:
    - "Username→email shim: derive ${usernameLower}@wishlist.internal client-side; never read from Firestore"
    - "Anti-enumeration: single generic error 'Username or password incorrect' for both missing username doc and wrong password"
    - "Forced token refresh after viewer claim: credential.user.getIdToken(true) called after set-viewer-claim returns 200"
    - "useRouter from next/navigation (App Router) — not next/router"
    - "finally block always clears loading state to prevent stuck spinner"

key-files:
  created:
    - src/app/login/page.tsx
    - src/app/register/page.tsx
  modified: []

key-decisions:
  - "Login page shows only username + password — no email field — AUTH-02 constraint"
  - "getIdToken(true) called on credential.user (method call) after set-viewer-claim 200 confirms claim was set — mitigates Pitfall 1 (stale cached token)"
  - "Username normalised to lowercase both before Firestore lookup and before synthetic email derivation — prevents case-sensitivity issues"
  - "Generic error message on login regardless of failure cause — anti-enumeration (T-02-08)"

# Metrics
duration: 10min
completed: 2026-04-08
---

# Phase 02 Plan 02: Login + Registration Pages Summary

**Client-side login page (child username+password with synthetic email shim) and viewer registration page (email+password with forced token refresh after claim is set)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-08T05:24:00Z
- **Completed:** 2026-04-08T05:34:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- /login page: child enters username + password; username normalised to lowercase; synthetic email derived as `${usernameLower}@wishlist.internal`; `getDoc` on `usernames/{username}` verifies existence before `signInWithEmailAndPassword`; generic error prevents username enumeration (T-02-08)
- /register page: viewer enters email + password; `createUserWithEmailAndPassword` creates account; ID token POSTed to `/api/auth/set-viewer-claim`; `credential.user.getIdToken(true)` forces token refresh so `role:'viewer'` claim is immediately readable (T-02-09 / Pitfall 1)
- Both pages: loading state disables button and shows feedback text; error displayed in `role="alert"` paragraph; redirect to `/dashboard` on success

## Task Commits

Each task was committed atomically:

1. **Task 1: Build login page (child username + password)** - `f9d951c` (feat)
2. **Task 2: Build viewer registration page** - `3524fff` (feat)

## Files Created/Modified

- `src/app/login/page.tsx` — 'use client'; username+password form; Firestore lookup + signInWithEmailAndPassword; anti-enumeration error
- `src/app/register/page.tsx` — 'use client'; email+password form; createUserWithEmailAndPassword + set-viewer-claim POST + forced token refresh

## Decisions Made

- Login page shows only `type="text"` (username) and `type="password"` — no `type="email"` field visible to child. AUTH-02 constraint.
- `getIdToken(true)` called after server confirms claim set (200 response from set-viewer-claim), not before. This is the correct order — claim must be persisted server-side before the client forces a refresh.
- Username case normalisation (`toLowerCase()`) applied before both the Firestore `getDoc` call and the synthetic email derivation. "ALICE", "Alice", "alice" all map to `alice@wishlist.internal`.

## Deviations from Plan

None — plan executed exactly as written. Both pages implement the specified behavior with all acceptance criteria passing.

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-02-08: Username enumeration | mitigated | Generic "Username or password incorrect" shown for both missing doc and wrong password |
| T-02-09: Stale claim token | mitigated | `credential.user.getIdToken(true)` forces refresh after set-viewer-claim returns 200 |
| T-02-10: Synthetic email guessing | accepted | Per plan — Firebase rate-limits repeated failures |
| T-02-11: Account creation flooding | accepted | Per plan — Firebase built-in rate limits |

## Known Stubs

None — both pages are fully wired to the Route Handlers and Firebase Auth from Plan 02-01. No placeholder data.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what was specified in the plan's threat model.

## Self-Check: PASSED

- `src/app/login/page.tsx` — exists (verified via grep and commit)
- `src/app/register/page.tsx` — exists (verified via grep and commit)
- Commit `f9d951c` — login page (feat(02-02))
- Commit `3524fff` — register page (feat(02-02))
- No `type="email"` on login page — confirmed
- `getIdToken.*true` in register page — confirmed
- `signInWithEmailAndPassword` in login page — confirmed
- `wishlist.internal` in login page — confirmed
- `getDoc` + `usernames` in login page — confirmed
- `set-viewer-claim` in register page — confirmed

---
*Phase: 02-authentication*
*Completed: 2026-04-08*
