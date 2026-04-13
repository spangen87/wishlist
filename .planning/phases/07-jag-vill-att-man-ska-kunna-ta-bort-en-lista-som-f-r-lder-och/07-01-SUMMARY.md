---
phase: "07"
plan: "01"
subsystem: api
tags: [delete, cascade, admin-sdk, firestore, firebase-auth]
dependency_graph:
  requires:
    - firebase-admin adminDb.recursiveDelete
    - firebase-admin adminAuth.deleteUser
    - firebase-admin adminAuth.verifyIdToken
  provides:
    - DELETE /api/wishlist/[wishlistId]
    - DELETE /api/auth/user/[uid]
  affects:
    - wishlists collection (cascade delete)
    - users collection
    - usernames collection
    - invites collection
    - Firebase Auth users
tech_stack:
  added: []
  patterns:
    - Admin SDK idToken auth pattern (verifyIdToken → decoded.uid)
    - recursiveDelete for subcollection cascade
    - Firestore-before-Auth deletion ordering
    - FieldValue.arrayRemove for UID cleanup
key_files:
  created:
    - src/app/api/wishlist/[wishlistId]/route.ts
    - src/app/api/auth/user/[uid]/route.ts
  modified: []
decisions:
  - Firestore data always deleted before Auth user — recoverable if Auth delete fails; inverse creates permanent orphan
  - Wishlist delete: childUid owner OR parentUids member may delete (403 otherwise)
  - Child account delete: parentUids member only (403 otherwise)
  - Parent/viewer self-delete: decoded.uid === targetUid only (403 otherwise)
  - Auth deleteUser wrapped in try/catch swallowing auth/user-not-found (idempotent)
  - Wishlist parentUids fallback to users doc for child account delete (covers post-migration case)
metrics:
  duration: "~10 min"
  completed: "2026-04-13T18:16:49Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 07 Plan 01: Server-Side Cascade Delete API Routes Summary

**One-liner:** Admin SDK DELETE routes for wishlist cascade-delete and account cascade-delete with role-based authorization and safe Firestore-before-Auth ordering.

## What Was Built

Two Next.js App Router API Route Handlers implementing server-side cascade deletion:

**`DELETE /api/wishlist/[wishlistId]`** — Authenticates caller via idToken, checks that caller is either the child owner (`childUid`) or a parent (`parentUids`), then cascade-deletes the wishlist document and all subcollections (`items/`, `purchaseStatus/`, `activityLog/`) via `adminDb.recursiveDelete()`. Also batch-deletes any orphaned invite tokens in the `invites` collection referencing this wishlist.

**`DELETE /api/auth/user/[uid]`** — Handles two distinct flows:

- **Child role:** Caller must be in `parentUids` (403 otherwise). Sequence: `recursiveDelete` wishlist → batch-delete `users/{uid}` + `usernames/{username}` → batch-delete orphaned invites → `adminAuth.deleteUser()`.
- **Parent/viewer role:** Caller must be the target user themselves (403 otherwise). Sequence: `FieldValue.arrayRemove` their UID from all `parentUids`/`viewerUids` arrays across all wishlists → delete `users/{uid}` → `adminAuth.deleteUser()`.

Both routes wrap `adminAuth.deleteUser()` in a try/catch that swallows `auth/user-not-found`, making the Auth deletion idempotent.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 4eaa4df | feat(07-01): add DELETE /api/wishlist/[wishlistId] — cascade-delete wishlist |
| Task 2 | 2d6aeef | feat(07-01): add DELETE /api/auth/user/[uid] — cascade-delete user account |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

All mitigations from the STRIDE threat register were implemented:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-07-01 Spoofing | `adminAuth.verifyIdToken` on every request | Implemented |
| T-07-02 EoP wishlist | childUid or parentUids check before delete | Implemented |
| T-07-03 EoP child account delete | parentUids.includes check | Implemented |
| T-07-04 EoP parent/viewer self-delete | decoded.uid === targetUid | Implemented |
| T-07-06 Subcollection orphans | adminDb.recursiveDelete() | Implemented |
| T-07-09 Firestore/Auth ordering | Firestore deleted before Auth in all flows | Implemented |

T-07-05 (DoS, no rate limiting) and T-07-08 (audit trail) accepted per plan.

## Known Stubs

None.

## Threat Flags

None — no new trust boundaries introduced beyond those documented in the plan's threat model.

## Self-Check: PASSED

- `src/app/api/wishlist/[wishlistId]/route.ts` — FOUND
- `src/app/api/auth/user/[uid]/route.ts` — FOUND
- commit 4eaa4df — FOUND
- commit 2d6aeef — FOUND
- TypeScript `npx tsc --noEmit` — exits 0, no errors
