---
phase: 03-child-wishlist
plan: 02
subsystem: ui
tags: [wishlist, react, firestore, real-time, tailwind, accessibility]

# Dependency graph
requires:
  - phase: 03-child-wishlist
    plan: 01
    provides: wishlist.ts Firestore helpers (getOrCreateWishlist, subscribeToItems, addWishItem); @dnd-kit packages installed

provides:
  - src/app/wishlist/page.tsx — WishlistPage with auth guard, real-time listener, and child component composition
  - src/components/wishlist/WishItemCard.tsx — Read-mode card with all fields, drag handle stub, Redigera trigger
  - src/components/wishlist/AddItemForm.tsx — Inline add form with 5 fields and Swedish validation
  - src/components/wishlist/EmptyState.tsx — Child-friendly empty state with star emoji and CTA
  - src/components/wishlist/LoadingSkeleton.tsx — 3-card animate-pulse skeleton
  - src/app/globals.css — CSS custom property color tokens added to :root block

affects:
  - 03-03 (drag-and-drop — WishItemCard has drag handle stub ready for useSortable integration)
  - 04-viewer (viewer page will reuse WishItemCard read-mode rendering pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WishlistPage uses useRef for wishlistId to avoid stale closure in cleanup function"
    - "useEffect for auth guard separated from useEffect for data bootstrap — matches dashboard pattern"
    - "AddItemForm uses conditional spread to only include defined optional fields in Firestore write"
    - "WishItemCard drag handle button has touchAction:none inline style — not applied to card wrapper (dnd-kit requirement)"

key-files:
  created:
    - src/app/wishlist/page.tsx
    - src/components/wishlist/WishItemCard.tsx
    - src/components/wishlist/AddItemForm.tsx
    - src/components/wishlist/EmptyState.tsx
    - src/components/wishlist/LoadingSkeleton.tsx
  modified:
    - src/app/globals.css

key-decisions:
  - "wishlistIdRef used alongside wishlistId state — ref avoids stale closure in useEffect cleanup; state triggers re-render"
  - "WishItemCard renders placeholder div (not img) when imageUrl is absent — avoids broken image icon"
  - "AddItemForm price state typed as number | '' — empty string avoids controlled-uncontrolled input warning on number fields"

# Metrics
duration: 10min
completed: 2026-04-09
---

# Phase 03 Plan 02: Wishlist UI — WishlistPage, cards, add form, empty state, loading skeleton

**Real-time wishlist page with read-mode item cards, inline add form with Swedish validation, empty state, and pulse skeleton — complete read+add child experience on mobile and tablet.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-09T10:30:00Z
- **Completed:** 2026-04-09T10:40:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added CSS custom property color tokens (`--color-bg`, `--color-card`, `--color-accent`, etc.) to globals.css `:root` block
- Created `WishlistPage` with auth guard, `getOrCreateWishlist` bootstrap, `subscribeToItems` real-time listener, and conditional rendering (loading → empty state → list + add button)
- Created `LoadingSkeleton` with 3 animate-pulse cards displayed while Firestore resolves
- Created `WishItemCard` in read mode: all 5 fields visible, 64×64 thumbnail or placeholder div, drag handle stub with `touchAction:none`, `Redigera` button, `rel="noopener noreferrer"` on product URL anchor
- Created `AddItemForm`: 5 labeled fields, Swedish inline validation ("Titel krävs", "Något gick fel"), `addWishItem` integration, save/cancel buttons with minimum touch target
- Created `EmptyState`: star emoji illustration, "Din lista är tom" heading, encouraging body copy, and CTA button

## Task Commits

1. **Task 1: Color tokens, WishlistPage, and LoadingSkeleton** - `c265ed9` (feat)
2. **Task 2: WishItemCard, AddItemForm, and EmptyState** - `5f25610` (feat)

## Files Created/Modified

- `src/app/globals.css` — 8 CSS custom property color tokens added to existing `:root` block
- `src/app/wishlist/page.tsx` — WishlistPage: auth guard, wishlist bootstrap, real-time subscription, conditional layout
- `src/components/wishlist/LoadingSkeleton.tsx` — 3 pulse skeleton cards
- `src/components/wishlist/WishItemCard.tsx` — Read-mode card; no purchaseStatus, no buyer name
- `src/components/wishlist/AddItemForm.tsx` — Inline add form; Swedish labels and error messages
- `src/components/wishlist/EmptyState.tsx` — Empty state with ⭐ and Swedish copy

## Decisions Made

- `wishlistIdRef` used alongside `wishlistId` state: ref holds the value for cleanup function closure safety; state drives re-renders
- Price input typed as `number | ''` to prevent React controlled/uncontrolled warning on `type="number"` inputs
- Placeholder `<div>` rendered instead of broken `<img>` when `imageUrl` is absent

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `WishItemCard.onEditStart` prop accepts a callback but the drag handle button does nothing on click (it only has touchAction:none inline style). Both will be wired in Plan 03 with `useSortable` from @dnd-kit.
- `WishlistPage` passes `onEditStart={() => {}}` (no-op) to each card — Plan 03 will replace this with inline edit mode.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat model. All T-03-05 through T-03-09 mitigations implemented as specified:
- No `purchaseStatus` fields rendered anywhere in wishlist components
- `rel="noopener noreferrer"` on all external anchor tags
- `type="number" min="0"` on price input

## Self-Check: PASSED

Files exist:
- src/app/wishlist/page.tsx — FOUND
- src/components/wishlist/WishItemCard.tsx — FOUND
- src/components/wishlist/AddItemForm.tsx — FOUND
- src/components/wishlist/EmptyState.tsx — FOUND
- src/components/wishlist/LoadingSkeleton.tsx — FOUND
- src/app/globals.css (modified) — FOUND

Commits exist:
- c265ed9 — feat(03-02): color tokens, WishlistPage, and LoadingSkeleton — FOUND
- 5f25610 — feat(03-02): WishItemCard, AddItemForm, and EmptyState — FOUND

TypeScript: `npx tsc --noEmit` exits 0 — PASSED
