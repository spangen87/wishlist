---
phase: 04-viewer-flow
plan: 01
subsystem: data-layer
tags: [firestore, types, security-rules, api-routes, viewer]
dependency_graph:
  requires: []
  provides: [firestore-types-v2, activitylog-rules, invite-api, viewer-helpers]
  affects: [04-02, 04-03, 04-04, 04-05]
tech_stack:
  added: [crypto.randomBytes (Node built-in)]
  patterns: [Admin SDK batch write, onSnapshot subscription, array-contains query]
key_files:
  created:
    - src/app/api/invite/create/route.ts
    - src/app/api/invite/current/route.ts
    - src/app/api/invite/regenerate/route.ts
    - src/lib/firebase/viewer.ts
  modified:
    - src/types/firestore.ts
    - firestore.rules
decisions:
  - "currentInviteToken stored on wishlist doc to avoid composite index for invite lookup"
  - "regenerate uses Admin SDK batch to atomically invalidate old + create new token (T-04-03)"
  - "viewer.ts is client-side only — no server-only import; all three subscribe helpers return unsubscribe functions"
metrics:
  duration: ~15min
  completed: 2026-04-09
  tasks: 4
  files: 6
---

# Phase 04 Plan 01: Data Layer Foundation Summary

One-liner: Firestore types, activityLog security rule, three invite API routes with owner-only guards, and three client-side subscription helpers — all required before Phase 4 UI plans can build.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update firestore.ts types and add ActivityLogDoc | e17be01 | src/types/firestore.ts |
| 2 | Add activityLog Firestore security rule | e567b13 | firestore.rules |
| 3 | Implement invite API routes (create, current, regenerate) | 343cd49 | src/app/api/invite/create/route.ts, src/app/api/invite/current/route.ts, src/app/api/invite/regenerate/route.ts |
| 4 | Create viewer.ts Firestore helpers | 9a8c4ed | src/lib/firebase/viewer.ts |

## What Was Built

### Types (src/types/firestore.ts)
- Replaced `viewerNote?: string` with `viewerNotes?: Record<string, string>` in PurchaseStatusDoc — supports per-viewer notes keyed by UID
- Added `ActivityLogDoc` interface with `action: 'marked_purchased' | 'unmarked_purchased' | 'added_note'` union type and `timestamp: Timestamp`

### Security Rules (firestore.rules)
- Added `match /activityLog/{entryId}` block inside `match /wishlists/{wishlistId}`
- Viewer read only (`allow read: if isViewer(wishlistId)`)
- Client writes forbidden (`allow write: if false`) — Admin SDK bypasses rules

### Invite API Routes
- **POST /api/invite/create**: verifies idToken, checks `childUid === decoded.uid`, generates 48-char hex token via `randomBytes(24)`, writes InviteDoc, updates `currentInviteToken` on wishlist
- **GET /api/invite/current**: reads Authorization header for idToken, owner-only guard, returns active token or null
- **POST /api/invite/regenerate**: atomic batch — sets `active: false` on old token, creates new InviteDoc, updates wishlist `currentInviteToken`

### Viewer Helpers (src/lib/firebase/viewer.ts)
- `subscribeToViewerWishlists`: `array-contains` query on `viewerUids` field
- `subscribeToPurchaseStatus`: returns `Record<string, PurchaseStatusDoc>` for O(1) item merge
- `subscribeToActivityLog`: newest-first, 50/page, pagination via `afterDoc` parameter

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all helpers are fully wired to real Firestore collections.

## Threat Flags

No new security surface introduced beyond what is modeled in the plan's threat register.

## Self-Check: PASSED

Files created/exist:
- src/types/firestore.ts — FOUND (modified)
- firestore.rules — FOUND (modified)
- src/app/api/invite/create/route.ts — FOUND
- src/app/api/invite/current/route.ts — FOUND
- src/app/api/invite/regenerate/route.ts — FOUND
- src/lib/firebase/viewer.ts — FOUND

Commits verified:
- e17be01 — feat(04-01): update PurchaseStatusDoc and add ActivityLogDoc type
- e567b13 — feat(04-01): add activityLog subcollection security rule
- 343cd49 — feat(04-01): implement invite API routes (create, current, regenerate)
- 9a8c4ed — feat(04-01): create viewer.ts Firestore subscription helpers

TypeScript: npx tsc --noEmit exits 0 — PASS
