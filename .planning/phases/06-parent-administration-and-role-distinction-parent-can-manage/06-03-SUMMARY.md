---
phase: 06-parent-administration-and-role-distinction-parent-can-manage
plan: "03"
subsystem: ui
tags: [firestore, react, dashboard, parent-role, real-time]

requires:
  - phase: 06-01
    provides: parentUids field on WishlistDoc, Firestore rules for parentUids queries

provides:
  - subscribeToParentWishlists function in viewer.ts querying wishlists where parentUids array-contains caller UID
  - ParentWishlistDashboardCard component with "Mitt barn" badge and settings link
  - Two-section dashboard layout — "Mina barn" (parent wishlists) and "Jag är inbjuden till" (viewer wishlists)

affects: [06-04, viewer-page, settings-page]

tech-stack:
  added: []
  patterns:
    - "Parallel Firestore subscriptions — both parentWishlists and viewerWishlists subscribe in same useEffect, unsubscribed together on cleanup"
    - "Separate loading booleans per subscription — parentDataLoading and viewerDataLoading combined via OR for overall loading"

key-files:
  created:
    - src/components/viewer/ParentWishlistDashboardCard.tsx
  modified:
    - src/lib/firebase/viewer.ts
    - src/app/dashboard/page.tsx

key-decisions:
  - "Both parent and viewer wishlists subscribed unconditionally when user exists (no role gate) — role check still gates child redirect only"
  - "ParentWishlistDashboardCard is a separate component (not extension of WishlistDashboardCard) to keep parent-specific affordances contained"

patterns-established:
  - "subscribeToParentWishlists: mirrors subscribeToViewerWishlists structure — only Firestore field name differs (parentUids vs viewerUids)"

requirements-completed: [D-08, D-09, D-10]

duration: 12min
completed: 2026-04-12
---

# Phase 06 Plan 03: Two-section dashboard with parent and viewer wishlist separation

**Two-section adult dashboard: parents see "Mina barn" with ParentWishlistDashboardCard (settings link + "Mitt barn" badge) and "Jag är inbjuden till" for viewer wishlists, both driven by parallel real-time Firestore subscriptions**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-12T00:00:00Z
- **Completed:** 2026-04-12T00:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `subscribeToParentWishlists` to `viewer.ts` — queries `wishlists` where `parentUids array-contains` caller UID, identical structure to `subscribeToViewerWishlists`
- Created `ParentWishlistDashboardCard` with "Mitt barn" badge, card body linking to `/viewer/[id]`, and settings link to `/wishlist/[id]/settings`
- Rebuilt `dashboard/page.tsx` with two-section layout — "Mina barn" and "Jag är inbjuden till" — both sections subscribe in parallel and show appropriate empty states

## Task Commits

1. **Task 1: Add subscribeToParentWishlists to viewer.ts** - `3a0444d` (feat)
2. **Task 2: Create ParentWishlistDashboardCard and rebuild dashboard** - `90aec07` (feat)

## Files Created/Modified

- `src/lib/firebase/viewer.ts` — Added `subscribeToParentWishlists` function (D-10)
- `src/components/viewer/ParentWishlistDashboardCard.tsx` — New card component with "Mitt barn" badge and Inställningar link (D-08)
- `src/app/dashboard/page.tsx` — Rebuilt with two-section layout, parallel subscriptions, separate loading state per subscription (D-08, D-09)

## Decisions Made

- Subscribed to both parent and viewer wishlists unconditionally when `user` exists — removing the `role === 'viewer'` gate allows parents and viewers to both see the two-section layout naturally (D-09).
- `ParentWishlistDashboardCard` created as a standalone component rather than extending `WishlistDashboardCard` — parent-specific affordances (badge, settings link, div container vs Link) are cleanly separated without prop conditionals in the existing card.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — both sections render real Firestore data via subscriptions. Empty states are shown when no wishlists exist, not placeholder content.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. The `subscribeToParentWishlists` query relies on Firestore security rules (Plan 01) to enforce server-side `parentUids` membership — client cannot enumerate wishlists it is not in. The settings link in `ParentWishlistDashboardCard` does not grant access; Plan 04 re-validates ownership server-side.

## Next Phase Readiness

- Dashboard two-section layout complete — parents land here after login and see their children and invited lists
- Plan 04 (settings page parent gate + parent invite link) can proceed — depends on `parentUids` field (Plan 01) and dashboard card settings link (this plan)
- No blockers

---
*Phase: 06-parent-administration-and-role-distinction-parent-can-manage*
*Completed: 2026-04-12*
