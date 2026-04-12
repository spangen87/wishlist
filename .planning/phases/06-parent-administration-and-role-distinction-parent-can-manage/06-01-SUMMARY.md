---
phase: 06-parent-administration-and-role-distinction-parent-can-manage
plan: 01
subsystem: auth-data-model
tags: [firestore-types, custom-claims, firestore-rules, parent-role]
dependency_graph:
  requires: []
  provides: [parentUids-field, set-parent-claim-route, isParent-firestore-rule]
  affects: [register-child-route, firestore-rules, register-page]
tech_stack:
  added: []
  patterns: [admin-sdk-claim-setting, parentUids-array-membership]
key_files:
  created:
    - src/app/api/auth/set-parent-claim/route.ts
  modified:
    - src/types/firestore.ts
    - src/app/api/auth/register-child/route.ts
    - firestore.rules
    - src/app/register/page.tsx
decisions:
  - parentUids[] controls admin access per-wishlist; the 'parent' custom claim is used only for routing/dashboard layout (D-03)
  - viewerUids defaults to [] on new child wishlists; only parentUids populated from viewerIdToken
metrics:
  duration: ~15min
  completed: 2026-04-12
  tasks: 4
  files: 5
---

# Phase 06 Plan 01: Parent Role Foundation — Types, Claims, and Firestore Rules

**One-liner:** Added parentUids[] to WishlistDoc, created set-parent-claim route, updated register-child to write parentUids, and extended Firestore rules with isParent() helper granting per-document admin access.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Firestore TypeScript types | 30dac6c | src/types/firestore.ts |
| 2 | Create /api/auth/set-parent-claim route | 95e2f4f | src/app/api/auth/set-parent-claim/route.ts |
| 3 | Update register-child + Firestore rules | d8fdcdb | src/app/api/auth/register-child/route.ts, firestore.rules |
| 4 | Wire /register to set-parent-claim | 4ebce5d | src/app/register/page.tsx |

## What Was Built

- **WishlistDoc** now has `parentUids: string[]`, `currentInviteToken?: string`, `currentParentInviteToken?: string`
- **InviteDoc** now has `type: 'parent' | 'viewer'` discriminator
- **POST /api/auth/set-parent-claim**: mirrors set-viewer-claim, sets `role: 'parent'` custom claim and writes users/{uid} profile
- **register-child route**: adds caller to `parentUids[]` (was `viewerUids[]`); new wishlists have `viewerUids: []`
- **firestore.rules**: `isParent(wishlistId)` helper; wishlist read rule includes `parentUids` membership; items read/write grant access to parents

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields are structurally complete. `currentParentInviteToken` added to type but not yet written by any route; that is intentional — it will be populated in a later Phase 06 plan when parent invite link generation is implemented.

## Threat Flags

No new security surface introduced beyond what the threat model covers. All mitigations from the plan's STRIDE register are implemented:
- T-06-01-01: set-parent-claim verifies idToken via adminAuth before setting claim
- T-06-01-02: register-child decodes viewerIdToken via adminAuth; invalid tokens caught non-fatally
- T-06-01-03: Firestore read rule uses `resource.data.parentUids` membership check
- T-06-01-04: isParent() uses get() for per-document membership evaluation in subcollection rules

## Self-Check: PASSED

All 5 files verified present. All 4 task commits verified in git log.
