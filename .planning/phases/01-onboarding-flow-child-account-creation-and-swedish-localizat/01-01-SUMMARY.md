---
phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
plan: 01
subsystem: api-types
tags: [firestore-types, admin-sdk, api-routes, auth]
dependency_graph:
  requires: []
  provides:
    - WishlistDoc.title field
    - UserDoc.displayName and age fields
    - updateWishlistTitle client helper
    - POST /api/wishlist/update-title
    - POST /api/invite/create-for-child
  affects:
    - src/app/onboarding (consumed by Plan 02)
tech_stack:
  added: []
  patterns:
    - Admin SDK bypass for viewer writes to owner-only Firestore collections
    - Idempotent invite token creation with existing-token check
key_files:
  created:
    - src/app/api/wishlist/update-title/route.ts
    - src/app/api/invite/create-for-child/route.ts
  modified:
    - src/types/firestore.ts
    - src/lib/firebase/wishlist.ts
decisions:
  - Viewer auth check uses isOwner OR isViewer (not just childUid === decoded.uid) — allows parent session from onboarding to call these routes
  - create-for-child checks for existing active invite token before creating a new one (idempotent — safe to call multiple times)
  - updateWishlistTitle client helper retained in wishlist.ts for reference even though it cannot be called by viewers (Firestore rules block it); Step 2 calls the API route instead
metrics:
  duration: ~10 min
  completed: 2026-04-12
  tasks_completed: 2
  files_modified: 4
---

# Phase 01 Plan 01: Type Extensions and Admin SDK Routes Summary

**One-liner:** Extended WishlistDoc/UserDoc types and created two Admin SDK API routes (update-title, create-for-child) needed by the onboarding wizard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Firestore types (WishlistDoc + UserDoc) | c179375 | src/types/firestore.ts |
| 2 | Add updateWishlistTitle helper + Admin SDK API routes | ea063a2 | src/lib/firebase/wishlist.ts, src/app/api/wishlist/update-title/route.ts, src/app/api/invite/create-for-child/route.ts |

## What Was Built

### Type Extensions (src/types/firestore.ts)

- `WishlistDoc.title?: string` — optional parent-given wishlist name (e.g. "Elsas önskelista")
- `UserDoc.displayName?: string` — optional human-readable child name shown in dashboard
- `UserDoc.age?: number` — stored for future use, no UI in v1.1

### updateWishlistTitle Helper (src/lib/firebase/wishlist.ts)

Reference export kept in wishlist.ts. Not called directly from viewer sessions (Firestore rules block viewer writes to wishlist docs). The onboarding Step 2 calls `/api/wishlist/update-title` instead.

### POST /api/wishlist/update-title

- Verifies `idToken` via `adminAuth.verifyIdToken`
- Checks caller is `isOwner` (childUid) OR `isViewer` (in viewerUids)
- Trims title and rejects empty string (400)
- Writes `title` field via Admin SDK (bypasses Firestore rules)
- Returns `{ ok: true }`

### POST /api/invite/create-for-child

- Verifies `idToken` via `adminAuth.verifyIdToken`
- Checks caller is `isOwner` OR `isViewer`
- Idempotent: checks `currentInviteToken` on wishlist doc; if active invite already exists, returns it
- Otherwise generates 48-char hex token, writes to `invites/{token}`, updates `wishlists/{id}.currentInviteToken`
- Returns `{ token }`

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-01-01 | adminAuth.verifyIdToken + isOwner/isViewer check in update-title |
| T-01-02 | adminAuth.verifyIdToken + isOwner/isViewer check in create-for-child |
| T-01-03 | title.trim() + empty check returns 400 in update-title |
| T-01-05 | verifyIdToken catch block returns 401 in both routes |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. No UI wiring in this plan (types and API routes only). Plan 02 will wire these endpoints.

## Self-Check

- [x] `src/types/firestore.ts` — title, displayName, age fields present: VERIFIED
- [x] `src/lib/firebase/wishlist.ts` — updateWishlistTitle exported: VERIFIED
- [x] `src/app/api/wishlist/update-title/route.ts` — exists, imports server-only, verifyIdToken: VERIFIED
- [x] `src/app/api/invite/create-for-child/route.ts` — exists, imports server-only, verifyIdToken: VERIFIED
- [x] `npx tsc --noEmit` — exits 0: VERIFIED
- [x] Task 1 commit c179375: VERIFIED
- [x] Task 2 commit ea063a2: VERIFIED

## Self-Check: PASSED
