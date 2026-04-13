---
phase: 07-jag-vill-att-man-ska-kunna-ta-bort-en-lista-som-f-r-lder-och
plan: "02"
subsystem: infra
tags: [firebase-admin, firestore, firebase-auth, cli-script, orphan-cleanup]

# Dependency graph
requires:
  - phase: 07-01
    provides: "DELETE /api/auth/user/[uid] cascade logic — parentUids fallback field needed by that route"
provides:
  - "One-time CLI script to purge orphaned Firestore data for users deleted from Firebase Auth"
  - "Phase A: parentUids sync from wishlists/{childUid} to users/{childUid} docs"
  - "Phase B: full users/ collection scan detecting auth/user-not-found orphans"
  - "Child orphan cleanup: recursive wishlist delete, users/{uid} + usernames/{username} batch delete, invite token cleanup"
  - "Parent/viewer orphan cleanup: arrayRemove from parentUids/viewerUids, delete users/{uid}"
affects: [07-03, account-deletion, orphan-remediation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin CLI script pattern: env vars set before imports, initializeApp with getApps guard"
    - "Two-phase orphan cleanup: sync first (Phase A), then scan-and-delete (Phase B)"
    - "Idempotent cleanup: getUser check before delete, batch operations, summary count output"

key-files:
  created:
    - scripts/purge-orphans.ts
  modified:
    - package.json

key-decisions:
  - "Script defaults to emulator (safe) — production use requires explicit removal of emulator env vars"
  - "Phase A runs before Phase B to ensure parentUids fallback field exists on user docs before any wishlist deletion"
  - "Full users/ collection scan accepted at current family-app scale (Pitfall 6 from RESEARCH.md)"
  - "recursiveDelete used for child wishlist cascade — handles items/, purchaseStatus/, activityLog/ subcollections"

patterns-established:
  - "Admin cleanup scripts live in scripts/ and use the same emulator env var header as seed-emulator.ts"

requirements-completed: [DEL-04]

# Metrics
duration: 10min
completed: 2026-04-13
---

# Phase 07 Plan 02: Purge Orphans Script Summary

**Admin CLI script using firebase-admin to detect and delete orphaned Firestore data for users removed from Firebase Auth without cascade cleanup**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-13T18:06:00Z
- **Completed:** 2026-04-13T18:16:25Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `scripts/purge-orphans.ts` — two-phase orphan cleanup script for remediating manually deleted Firebase Auth users whose Firestore data was left behind
- Phase A syncs `parentUids` from `wishlists/{childUid}` to `users/{childUid}` docs using batch `set` with `merge: true` so the `DELETE /api/auth/user/[uid]` route can still authorize parent-initiated deletion after wishlist removal
- Phase B scans the entire `users/` collection, catches `auth/user-not-found` to identify orphans, and cleans up by role: recursive wishlist delete + batch user/username delete for children; `FieldValue.arrayRemove` from wishlist arrays + user doc delete for parents/viewers
- Registered as `npm run purge-orphans` in `package.json`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/purge-orphans.ts — orphan detection and cleanup** - `46d4693` (feat)

## Files Created/Modified

- `scripts/purge-orphans.ts` — Two-phase orphan cleanup script: Phase A parentUids sync, Phase B scan + delete by role
- `package.json` — Added `"purge-orphans": "tsx scripts/purge-orphans.ts"` to scripts

## Decisions Made

- Script defaults to emulator (safe default): emulator env vars are set at the top with a clear comment instructing how to remove them for production use. Wrong env = emulator is the safe fallback.
- Phase A must run before Phase B to ensure the parentUids fallback field is populated on user docs before any wishlist deletion occurs — this is required by `DELETE /api/auth/user/[uid]` route authorization.
- Full `users/` collection scan accepted at current family-app scale per RESEARCH.md Pitfall 6 note.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — the script is fully wired with real firebase-admin operations. No hardcoded empty values or placeholder data.

## Threat Flags

None — this is a CLI-only admin script with no web-accessible attack surface. The threat model (T-07-10 through T-07-13) was reviewed and all threats are accepted or mitigated by the emulator-default approach.

## User Setup Required

None for emulator usage. For production cleanup:
1. Set `GOOGLE_APPLICATION_CREDENTIALS` env var to a service account JSON with Firestore and Auth admin permissions
2. Remove the three emulator env var lines at the top of `scripts/purge-orphans.ts`
3. Run `npx tsx scripts/purge-orphans.ts > purge-log.txt` to capture the deletion audit trail

## Next Phase Readiness

- Orphan cleanup script is complete and registered
- Phase 07-03 (account deletion cascade) can proceed independently
- This script is intended as a one-time remediation tool — the proper fix for ongoing cleanup is the cascade-delete API routes in 07-01 and 07-03

---
*Phase: 07-jag-vill-att-man-ska-kunna-ta-bort-en-lista-som-f-r-lder-och*
*Completed: 2026-04-13*
