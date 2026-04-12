---
phase: 06-parent-administration-and-role-distinction-parent-can-manage
plan: 02
subsystem: invite-api
tags: [parent-invite, redeem, custom-claims, firestore, api-routes]
dependency_graph:
  requires: [06-01-parentUids-field, 06-01-invite-type-field]
  provides: [create-for-parent-route, redeem-parent-invite, parent-claim-upgrade]
  affects: [src/app/api/invite/redeem/route.ts, src/app/api/invite/create-for-parent/route.ts]
tech_stack:
  added: []
  patterns: [invite-type-dispatch, arrayUnion-parentUids, setCustomUserClaims-upgrade]
key_files:
  created:
    - src/app/api/invite/create-for-parent/route.ts
  modified:
    - src/app/api/invite/redeem/route.ts
decisions:
  - inviteType read from server-side invite doc (not request body) — client cannot self-select parent role (T-06-02-03)
  - Default inviteType to 'viewer' when type field absent — backward compatible with pre-D-11 invite docs
  - Parent claim upgrade (setCustomUserClaims) always sets 'parent' even if redeemer was previously 'viewer' (D-12)
metrics:
  duration: ~10min
  completed: 2026-04-12
  tasks: 2
  files: 2
---

# Phase 06 Plan 02: Parent Invite System — Create and Redeem Routes

**One-liner:** POST /api/invite/create-for-parent issues parent invite tokens (gated on parentUids membership); extended redeem route dispatches on invite.type to write parentUids[] and upgrade claims to 'parent'.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /api/invite/create-for-parent route | 7ddfb67 | src/app/api/invite/create-for-parent/route.ts |
| 2 | Extend /api/invite/redeem to handle parent invite type | 2c273df | src/app/api/invite/redeem/route.ts |

## What Was Built

- **POST /api/invite/create-for-parent**: New route that generates a parent invite token. Auth gate: caller must be in `parentUids[]` — non-parents get 403. Idempotent: returns existing active token if `currentParentInviteToken` is set. Writes invite doc with `type: 'parent'` and 192-bit hex token.

- **Extended redeem route**: Reads `invite.type` from the server-side invite document; dispatches to parent or viewer branch accordingly. Parent branch: arrayUnion uid into `parentUids`, upgrades claim to `role: 'parent'` (even if previously viewer), upserts user profile. Viewer branch: unchanged (D-02, D-06 preserved). Missing type defaults to 'viewer' for backward compatibility.

## STRIDE Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-06-02-01: Non-parent creating parent invite | `data.parentUids.includes(decoded.uid)` gate — 403 |
| T-06-02-02: Token brute force | randomBytes(24).toString('hex') = 192 bits entropy |
| T-06-02-03: Client self-selecting parent type | inviteType read from server-side doc, not request body |
| T-06-02-04: Child redeeming parent invite | `childUid === uid` block applies before both branches |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both routes are fully wired. `currentParentInviteToken` is now written by the create-for-parent route. Settings UI (Plan 04) will call this route.

## Threat Flags

No new security surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- src/app/api/invite/create-for-parent/route.ts: EXISTS
- src/app/api/invite/redeem/route.ts: EXISTS (modified)
- Commit 7ddfb67: verified in git log
- Commit 2c273df: verified in git log
- TypeScript: npx tsc --noEmit exits 0
- Verification checks 1-5: all PASSED
