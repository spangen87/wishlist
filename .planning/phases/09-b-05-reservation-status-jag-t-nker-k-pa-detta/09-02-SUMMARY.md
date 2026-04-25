---
phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, firebase-client, typescript, swedish-copy]

# Dependency graph
requires:
  - phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta
    provides: "PurchaseStatusDoc.reservedBy, /api/viewer/reserve-item route with 409 conflict, mark-purchased D-03 auto-clear, extended ActivityLogDoc.action union"
provides:
  - "Reserve button UI with 4 states (default dashed, own orange filled, other disabled, hidden when purchased)"
  - "Reservation badge 'Reserverad av {namn}' shown when another viewer reserved"
  - "handleToggleReserved callback in viewer page wired to POST /api/viewer/reserve-item with 409 detection"
  - "displayNames map now resolves reservedBy UIDs alongside purchasedBy UIDs"
  - "ActivityLogEntry formatAction handles 'reserved' and 'unreserved' action types with Swedish copy"
affects: [future coordination/notification phases, any activity-log consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "409 conflict surfaced client-side: page appends ' 409' to Error.message; card detects substring to choose specific copy"
    - "Dashed-border button variant: 'intent not commitment' visual convention for the reserve state vs solid-border purchase button"
    - "Inline reservation badge: single <span> mirroring PurchasedBadge's typographic style (text-sm italic muted) — no new component file needed"

key-files:
  created: []
  modified:
    - "src/components/viewer/ViewerWishItemCard.tsx"
    - "src/app/viewer/[wishlistId]/page.tsx"
    - "src/components/viewer/ActivityLogEntry.tsx"

key-decisions:
  - "Mirrored existing purchase-button JSX structure verbatim (same class composition, same 3-state ternary, same error element) per AGENTS.md pattern-mirroring directive"
  - "409 error transport via Error.message suffix instead of a new error class — zero new abstractions; card-side substring check is 1 line of code"
  - "Inline <span> badge instead of a new ReservationBadge component — PurchasedBadge's complexity (isCurrentUser variant) isn't needed since own-reservation uses the orange button state as its indicator"
  - "fetchDisplayName called unconditionally for every reservedBy in the subscription callback — relies on existing displayNames.has() early-exit for deduplication"

patterns-established:
  - "Client-side conflict detection: server appends ' 409' to thrown Error.message so lower components can branch on it without re-plumbing Response.status"
  - "Dashed border as visual signal for 'intent' (reserve) distinct from solid border for 'commit' (purchase) in the same card action stack"
  - "Reservation badge hidden when isOwnReservation: orange-filled button is the visual indicator for own state, badge only appears for other-reservation state"

requirements-completed: [D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16]

# Metrics
duration: 3min
completed: 2026-04-24
---

# Phase 09 Plan 02: Reservation frontend — viewer card + page + activity log Summary

**Reserve button with 4 states (default dashed, own orange, other disabled, hidden when purchased), inline reservation badge, 409-aware handleToggleReserved on the viewer page, and Swedish activity-log copy for 'reserved'/'unreserved' action types**

## Performance

- **Duration:** ~2 min 46s
- **Started:** 2026-04-24T21:51:44Z
- **Completed:** 2026-04-24T21:54:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ViewerWishItemCard` now renders a reserve button above the purchase button with correct Tailwind classes per UI-SPEC in all three active states (default dashed, own orange filled, other disabled/muted) and is hidden entirely when `isPurchased` (D-14)
- Reservation badge `Reserverad av {namn}` renders inline under the title when another viewer has reserved the item (D-10)
- 409 conflict response from `/api/viewer/reserve-item` is surfaced to the user with exact Swedish copy `"Någon annan har redan reserverat detta."` via the page → card error-transport convention
- `handleToggleReserved` posts the correct body shape (`{ idToken, wishlistId, itemId, itemTitle, reserve }`) to the existing Plan-01 route and `displayNames` resolution now covers `reservedBy` UIDs as well as `purchasedBy`
- Activity log renders the new action types in Swedish: `"{namn} reserverade "{itemTitle}""` and `"{namn} avbokade sin reservation på "{itemTitle}""`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ViewerWishItemCard with reserve button and reservation badge** — `6584b95` (feat)
2. **Task 2: Wire page orchestrator and extend ActivityLogEntry** — `4099293` (feat)

**Plan metadata:** this SUMMARY + STATE/ROADMAP updates will be committed in a subsequent docs commit.

## Files Created/Modified
- `src/components/viewer/ViewerWishItemCard.tsx` (modified) — new props `onToggleReserved` + `reserverName`, local `reserving`/`reserveError` state, derivations `isReserved`/`isOwnReservation`/`isOtherReservation`, async `handleToggleReserve` with 409 substring detection, reservation badge + reserve button JSX placed between `PurchasedBadge` and the existing purchase button, `{!isPurchased && …}` wrapper to hide on purchase
- `src/app/viewer/[wishlistId]/page.tsx` (modified) — new `handleToggleReserved` mirroring `handleTogglePurchased` but against `/api/viewer/reserve-item` and appending ` 409` to the thrown Error.message on conflict; extended `subscribeToPurchaseStatus` callback with `if (s.reservedBy) fetchDisplayName(s.reservedBy)`; new `onToggleReserved` + `reserverName` props on the `ViewerWishItemCard` JSX
- `src/components/viewer/ActivityLogEntry.tsx` (modified) — added `case 'reserved'` and `case 'unreserved'` to the `formatAction` switch, before the `default` fallback

## Decisions Made
- **Mirror the purchase button exactly.** Per AGENTS.md, the existing purchase button is the source of truth — same className base, same 3-state ternary shape, same error-display element. The only deviation the plan prescribes is `border-dashed` on the default state (UI-SPEC dimension 2 visual intent).
- **409 transport via Error.message suffix.** Rather than introduce a custom error class or change the callback signature, the page appends ` 409` to the thrown Error.message when `res.status === 409`; the card checks `msg.includes('409') || msg.includes('Already reserved')`. Zero new abstractions, one line of code in each direction.
- **Inline `<span>` badge, not a new component.** `PurchasedBadge` has an `isCurrentUser` variant for "Markerad som köpt av dig" vs "Köpt av X". Reservation doesn't need that because the orange-filled button state is the own-reservation indicator — the badge only renders in `isOtherReservation` state, which is a single copy variant. One `<span className="text-sm text-[#6B7280] italic">` is sufficient.
- **No optimistic UI state beyond the `reserving` disabled flag.** Matches the existing `toggling` pattern — the Firestore subscription in the parent page provides the ground-truth update once the server round-trip completes.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in order, all acceptance criteria satisfied on first verification pass, no deviation rules triggered.

## Issues Encountered

- **PreToolUse Read-before-edit advisory reminders fired repeatedly during the session.** All files had been read in the same session before each edit and the edits succeeded as confirmed by the tool responses. These are advisory hooks, not hard gates — benign.
- **Vercel plugin skill suggestions (`react-best-practices`, `next-cache-components`).** Evaluated and declined per AGENTS.md directive: the plan and `09-PATTERNS.md` explicitly prescribe mirroring existing codebase patterns over applying memorized React/Next.js APIs. `page.tsx` is a `'use client'` component (cache-components skill does not apply), and the mirrored JSX/hook patterns in `ViewerWishItemCard` are already the codebase-established convention. Applying divergent patterns to one new feature would contradict the project's pattern-mirroring rule.
- **Pre-existing `.next/types/*` TypeScript errors** (references to a removed `src/app/test/page.js`, duplicate `routes.d 2.ts` / `cache-life.d 2.ts` files). Same stale generated artifacts flagged in `09-01-SUMMARY.md`. Not caused by this plan's changes, out of scope per deviation rule scope boundary, filtered from verification. Recommend a separate `rm -rf .next` maintenance plan.

## User Setup Required

None — the frontend wires to the existing `/api/viewer/reserve-item` route (Plan 01) which uses the same `adminAuth.verifyIdToken` / `adminDb` infrastructure already deployed. Firestore rules from Plan 01 are sufficient (defense-in-depth `reservedBy` clause already committed). No environment variables, no external services, no dashboard changes.

## Next Phase Readiness

All P0 requirements (D-09 through D-16) are implemented and compile clean. End-to-end smoke test steps from the plan's `<verification>` section can be executed now:
1. Open the viewer page as Viewer A — reserve button should render in State 1 (dashed border, "Jag tänker köpa detta")
2. Click reserve — button switches to State 2 (orange filled, "Du tänker köpa detta")
3. Open same page as Viewer B — button should render in State 3 (disabled, "Reserverad av [Viewer A]") and the inline badge should appear under the title
4. As Viewer A mark the item as purchased — reserve button disappears (D-14), reservation auto-clears (D-03 from Plan 01)
5. Activity log page should show Swedish-language entries for `reserved` and `unreserved` actions

No blockers for subsequent phases. The feature is fully functional end-to-end given Plan 01's backend is already merged on this branch.

## Self-Check: PASSED

- FOUND: src/components/viewer/ViewerWishItemCard.tsx (isOwnReservation L48, isOtherReservation L49, handleToggleReserve L64, border-dashed L142, "Jag tänker köpa detta" L149, "Du tänker köpa detta" L148, "Någon annan har redan reserverat detta." in handleToggleReserve)
- FOUND: src/app/viewer/[wishlistId]/page.tsx (handleToggleReserved L119, reserve-item L127, s.reservedBy L89, reserverName L334, onToggleReserved={handleToggleReserved} L328, res.status === 409 L136)
- FOUND: src/components/viewer/ActivityLogEntry.tsx (case 'reserved' L21, "reserverade" L22, case 'unreserved' L23, "avbokade sin reservation" L24)
- FOUND commit: 6584b95 (Task 1)
- FOUND commit: 4099293 (Task 2)

---
*Phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta*
*Completed: 2026-04-24*
