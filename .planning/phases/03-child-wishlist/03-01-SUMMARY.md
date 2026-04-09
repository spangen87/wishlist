---
phase: 03-child-wishlist
plan: 01
subsystem: database
tags: [firestore, firebase, fractional-indexing, dnd-kit, routing, react]

# Dependency graph
requires:
  - phase: 02-authentication
    provides: Firebase Auth with role claims; auth/login page; dashboard stub; useAuth hook
  - phase: 01-foundation
    provides: Firestore rules (wishlists/{id}/items writable by child; purchaseStatus denied to child); db/auth exports from client.ts; WishItemDoc/WishlistDoc types

provides:
  - src/lib/firebase/wishlist.ts — 6 Firestore helper functions covering full wishlist data lifecycle
  - Role-aware post-login redirect (child → /wishlist, others → /dashboard)
  - Dashboard child-role safety net redirect to /wishlist
  - @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, fractional-indexing installed

affects:
  - 03-02 (wishlist page UI — imports all 6 helpers from wishlist.ts)
  - 03-03 (drag-and-drop — uses @dnd-kit packages installed here)
  - 04-viewer (share link flow — relies on wishlist doc keyed by child UID)

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
    - "fractional-indexing@3.2.0"
  patterns:
    - "Wishlist doc uses child UID as document ID (deterministic, idempotent setDoc merge:true)"
    - "Real-time Firestore subscription via onSnapshot with orderBy('position')"
    - "updateItemPosition guards against equal fractional-index bounds before calling generateKeyBetween"
    - "Role-aware redirect via getIdTokenResult claims after signInWithEmailAndPassword"

key-files:
  created:
    - src/lib/firebase/wishlist.ts
  modified:
    - src/app/login/page.tsx
    - src/app/dashboard/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Wishlist document ID = child UID (not Firestore addDoc random ID) — deterministic, idempotent, simplifies Phase 4 viewer lookup"
  - "setDoc with merge:true ensures concurrent first-access calls are a no-op (no duplicate wishlist docs)"
  - "Role read from getIdTokenResult token claims (not Firestore query) — synchronous to auth state, available immediately after sign-in"

patterns-established:
  - "Pattern: WishItemDoc snapshots spread as { id: d.id, ...d.data() as Omit<WishItemDoc, 'id'> } — id is snapshot metadata, not doc data"
  - "Pattern: updateItemPosition skips write when prevPos === nextPos (guards against generateKeyBetween equal-bounds throw)"

requirements-completed:
  - WISH-01
  - WISH-02
  - WISH-03
  - WISH-04
  - WISH-05
  - WISH-08

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 03 Plan 01: Wishlist Data Layer and Routing Summary

**Six Firestore helpers for wishlist CRUD with fractional-index ordering, plus role-aware child redirect on login — data layer and routing foundation for Phase 3 UI plans.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T10:28:01Z
- **Completed:** 2026-04-09T10:30:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed all four Phase 3 packages: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, fractional-indexing
- Created `src/lib/firebase/wishlist.ts` with 6 exported functions covering full wishlist lifecycle (get-or-create, real-time subscription, add, update, delete, reorder)
- Updated login to redirect child-role users to `/wishlist` (reading role from ID token claims post-sign-in)
- Added dashboard safety-net useEffect that redirects child-role users who land there to `/wishlist`

## Task Commits

1. **Task 1: Install packages and create wishlist Firestore helpers** - `4474f09` (feat)
2. **Task 2: Role-aware login redirect and dashboard safety net** - `df121ae` (feat)

## Files Created/Modified

- `src/lib/firebase/wishlist.ts` — All 6 Firestore helper exports; no purchaseStatus references; orderBy('position') subscription
- `src/app/login/page.tsx` — Role-aware redirect: child → /wishlist, others → /dashboard via getIdTokenResult claims
- `src/app/dashboard/page.tsx` — Safety-net useEffect redirecting child role to /wishlist
- `package.json` — Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, fractional-indexing
- `package-lock.json` — Updated lock file

## Decisions Made

- Used child UID as wishlist document ID (not addDoc random ID) — idempotent with setDoc merge:true, avoids duplicate-wishlist race condition on simultaneous first-access
- Role sourced from `getIdTokenResult().claims` rather than a Firestore user doc read — available synchronously from Firebase Auth state immediately after sign-in, no extra round-trip

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 6 Firestore helpers ready for import in `03-02` wishlist page UI
- @dnd-kit packages installed and available for `03-03` drag-and-drop implementation
- Child routing fully wired: login → /wishlist, dashboard → /wishlist (safety net)
- No blockers for subsequent plans

---
*Phase: 03-child-wishlist*
*Completed: 2026-04-09*
