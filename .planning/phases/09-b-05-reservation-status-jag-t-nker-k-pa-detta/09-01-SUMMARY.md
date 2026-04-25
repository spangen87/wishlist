---
phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta
plan: 01
subsystem: api
tags: [firestore, firebase-admin, nextjs, route-handler, firestore-rules, typescript]

# Dependency graph
requires:
  - phase: 08-security-auth-and-account-fixes
    provides: tightened purchaseStatus rules and existing mark-purchased route pattern
  - phase: 04-viewer-flow
    provides: original purchaseStatus subcollection design and activity log structure
provides:
  - "PurchaseStatusDoc.reservedBy?: string field on existing purchaseStatus/{itemId} doc"
  - "ActivityLogDoc.action union extended with 'reserved' | 'unreserved'"
  - "POST /api/viewer/reserve-item API route: idempotent reserve/un-reserve with 409 conflict on double-reservation"
  - "mark-purchased auto-clears caller's reservation on purchase (D-03)"
  - "firestore.rules defense-in-depth: reservedBy write must match request.auth.uid"
affects: [09-02 viewer UI wiring, future coordination/notification phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reserve/un-reserve via Admin SDK batch.set({merge: true}) with FieldValue.delete() for clear"
    - "Conflict detection: pre-batch read of existing doc to detect another UID's reservation → 409"
    - "Activity log entry written in same batch as status update (atomic log + mutation)"

key-files:
  created:
    - "src/app/api/viewer/reserve-item/route.ts"
  modified:
    - "src/types/firestore.ts"
    - "src/app/api/viewer/mark-purchased/route.ts"
    - "firestore.rules"

key-decisions:
  - "Mirrored mark-purchased route structure verbatim to preserve project AGENTS.md directive: follow existing patterns over memorized Next.js APIs"
  - "Conflict check is non-atomic read-then-write — acceptable per D-02 (eventual consistency, no distributed lock)"
  - "Defense-in-depth rule added even though Admin SDK writes bypass rules — protects against any hypothetical direct client-SDK write"
  - "Ignored vercel-functions observability suggestion: adding divergent instrumentation in one route would contradict the codebase-wide pattern; observability is out of scope for this plan"

patterns-established:
  - "Reservation field pattern: reservedBy lives on purchaseStatus/{itemId} alongside purchasedBy — child cannot read (same privacy boundary)"
  - "Auto-clear pattern: mutually-related state fields cleaned up in-batch via FieldValue.delete() inside batch.set merge"
  - "409 conflict pattern for first-come-first-served coordination: pre-read doc, compare to caller uid, reject before batch"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-16, D-17]

# Metrics
duration: 2min
completed: 2026-04-24
---

# Phase 09 Plan 01: Reservation backend — types, route, rules Summary

**`reservedBy` field on purchaseStatus docs, new `/api/viewer/reserve-item` route with 409 conflict detection, auto-clear on purchase via `FieldValue.delete()`, and defense-in-depth Firestore rule**

## Performance

- **Duration:** ~2 min 13s
- **Started:** 2026-04-24T21:45:54Z
- **Completed:** 2026-04-24T21:48:07Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Extended `PurchaseStatusDoc` and `ActivityLogDoc` types with reservation fields — the interface boundary Plan 09-02 depends on
- Created `POST /api/viewer/reserve-item` mirroring the `mark-purchased` route pattern: Admin SDK auth + access check + batch write with activity log
- Implemented D-02 (single reservation per item) via pre-batch conflict read returning 409 on another user's reservation
- Implemented D-03 (auto-clear own reservation on purchase) with a single `FieldValue.delete()` addition to the `mark-purchased` purchased branch
- Firestore rules updated with `reservedBy` write validation (defense-in-depth) without regressing SEC-01 or the child privacy boundary

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Firestore type definitions** — `98890fa` (feat)
2. **Task 2: Create reserve-item route + patch mark-purchased** — `1662f4a` (feat)
3. **Task 3: Update Firestore rules with reservedBy defense-in-depth** — `00cf369` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP will be committed in the final docs commit)

## Files Created/Modified
- `src/app/api/viewer/reserve-item/route.ts` (created) — POST handler that sets `reservedBy: uid` (reserve) or `FieldValue.delete()` (un-reserve), writes activity log in same batch, returns 409 on conflict
- `src/types/firestore.ts` (modified) — `PurchaseStatusDoc.reservedBy?: string`; `ActivityLogDoc.action` union + `'reserved' | 'unreserved'`
- `src/app/api/viewer/mark-purchased/route.ts` (modified) — purchased branch now includes `reservedBy: FieldValue.delete()` (D-03)
- `firestore.rules` (modified) — purchaseStatus write rule validates `reservedBy == request.auth.uid` (or absent / null)

## Decisions Made
- **Mirror the analog verbatim.** Per project AGENTS.md, the `mark-purchased/route.ts` existing pattern was the source of truth — auth, access check, batch+activityLog shape copied without structural changes.
- **409 before batch, no distributed lock.** The conflict check is a pre-read of `purchaseStatus/{itemId}.reservedBy` then compared to caller uid — matches plan's threat register T-09-06 (accept eventual consistency for coordination feature).
- **Defense-in-depth rule kept minimal.** Extended only the existing `purchaseStatus` write rule with one extra clause; no new rules, no changes to the child-deny boundary, no changes to `activityLog` or any other collection.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed in order with acceptance criteria satisfied on first verification run.

## Issues Encountered

- **Pre-existing `.next/types/*` TypeScript errors** (references to a removed `src/app/test/page.js`, duplicate `routes.d 2.ts` / `cache-life.d 2.ts` files). These are stale generated artifacts, not caused by this plan's changes, and are out of scope (deviation rule boundary). Filtered out of verification via `grep -v "^\.next/"`; source tree TS is clean. Recommend a separate `rm -rf .next` / clean build in a future maintenance plan.
- **Hook suggestions for `vercel-functions` observability instrumentation** on both route files. Evaluated and rejected: adding divergent logging only to the new route would contradict AGENTS.md's "mirror existing patterns" directive. A codebase-wide observability strategy belongs in a dedicated plan, not this backend-contract plan.
- **Read-before-edit hook reminders** fired on files already read in-session. Benign — edits succeeded and the hook is advisory.

## User Setup Required

None — no external service configuration required. Firestore rules must be deployed (`firebase deploy --only firestore:rules`) for the defense-in-depth clause to take effect in production, but this is standard Firestore rules deployment.

## Next Phase Readiness

Plan 09-02 (Wave 2, frontend) can proceed now:
- Type changes are committed and compile clean — `PurchaseStatusDoc.reservedBy` and the extended `ActivityLogDoc.action` union are available for import
- `POST /api/viewer/reserve-item` endpoint is callable with `{ idToken, wishlistId, itemId, itemTitle, reserve }` body and will return 409 on conflict (so UI can map 409 → "Någon annan har redan reserverat detta.")
- `mark-purchased` already clears the reservation field, so the UI doesn't need to make a second call when the reserver confirms the purchase

No blockers for 09-02.

## Self-Check: PASSED

- FOUND: src/app/api/viewer/reserve-item/route.ts
- FOUND: src/types/firestore.ts (reservedBy line 39; action union line 48)
- FOUND: src/app/api/viewer/mark-purchased/route.ts (reservedBy: FieldValue.delete() line 53)
- FOUND: firestore.rules (reservedBy clause lines 66-68)
- FOUND commit: 98890fa
- FOUND commit: 1662f4a
- FOUND commit: 00cf369

---
*Phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta*
*Completed: 2026-04-24*
