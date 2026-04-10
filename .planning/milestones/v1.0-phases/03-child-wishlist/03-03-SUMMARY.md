---
phase: 03-child-wishlist
plan: 03
subsystem: ui
tags: [wishlist, dnd-kit, drag-and-drop, inline-edit, delete-confirmation, react, firestore]

# Dependency graph
requires:
  - phase: 03-child-wishlist
    plan: 02
    provides: WishItemCard read-mode with drag handle stub; WishlistPage with item list; @dnd-kit packages installed

provides:
  - src/components/wishlist/WishItemCard.tsx — Full card with read mode, inline edit mode (5 fields), inline delete confirmation, useSortable drag integration
  - src/app/wishlist/page.tsx — DndContext + SortableContext wrapper with onDragEnd calling updateItemPosition; DragOverlay ghost card

affects:
  - 04-viewer (viewer page will reuse WishItemCard read-mode pattern; drag is child-only so viewer gets read-only version)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSortable with setActivatorNodeRef — drag handle only activates drag, not whole card; touchAction:none on handle button only"
    - "Inline edit mode: local React state toggles between read and edit layout; form initializes from item props on entry"
    - "Inline delete confirmation: showDeleteConfirm boolean replaces modal — no portal, no dialog element"
    - "DragOverlay renders WishItemCard clone at opacity-90 rotate-1 — same component, no purchaseStatus exposure"
    - "onDragEnd uses remaining[] (items minus dragged item) to compute prevPos/nextPos for fractional index insert"
    - "No optimistic local reorder — onSnapshot reflects new order after updateItemPosition write"

key-files:
  created: []
  modified:
    - src/components/wishlist/WishItemCard.tsx
    - src/app/wishlist/page.tsx

key-decisions:
  - "touchAction:none applied to drag handle button only — NOT the card wrapper. Prevents mobile scroll breakage (RESEARCH.md Pitfall 2)"
  - "No optimistic reorder in handleDragEnd — Firestore onSnapshot delivers the authoritative order after write, avoiding visual flicker from double-update"
  - "DragOverlay renders full WishItemCard component (not a simplified ghost) — consistent visual identity during drag"
  - "remaining[] adjacency computation excludes the dragged item before calculating prevPos/nextPos — avoids equal-bounds edge case"

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 03 Plan 03: WishItemCard Inline Edit, Delete Confirmation, and Drag-and-Drop Reordering Summary

**Full wishlist management UX: inline edit mode with 5 fields, inline delete confirmation without a modal, and drag-and-drop reordering via dnd-kit with fractional indexing and one Firestore write per drag.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T10:34:51Z
- **Completed:** 2026-04-09T10:36:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote `WishItemCard` to support three internal states: read mode, edit mode (5 labeled inputs with Swedish validation), and inline delete confirmation ("Är du säker?" with Ja/Nej buttons — no modal)
- Wired `useSortable` with `setActivatorNodeRef` so only the grip handle activates drag; `touchAction:none` is exclusively on the handle button (not card wrapper) preserving mobile scroll
- Card animates with `CSS.Transform.toString(transform)` and drops to `opacity: 0.4` while being dragged
- Rewrote `WishlistPage` to wrap the item list in `DndContext` + `SortableContext` with `closestCenter` collision detection
- Added `TouchSensor` with `delay: 250` ms and `tolerance: 8` px for touch drag activation
- Added `DragOverlay` rendering a ghost `WishItemCard` at 90% opacity with 1deg rotation during active drag
- `handleDragEnd` computes fractional index neighbors from `remaining[]` (items minus dragged item), calls `updateItemPosition` once, and does NOT optimistically update local state — `onSnapshot` reflects the new order

## Task Commits

1. **Task 1: WishItemCard inline edit, delete confirmation, useSortable** - `d70dd1c` (feat)
2. **Task 2: DndContext + SortableContext + DragOverlay in WishlistPage** - `e23e8fd` (feat)

## Files Created/Modified

- `src/components/wishlist/WishItemCard.tsx` — Full card: read mode, edit mode (5 inputs), inline delete confirmation, useSortable drag handle; no purchaseStatus
- `src/app/wishlist/page.tsx` — DndContext/SortableContext/DragOverlay wiring; TouchSensor 250ms/8px; updateItemPosition in onDragEnd; no setItems in handleDragEnd

## Decisions Made

- `touchAction:none` on drag handle button only — prevents dnd-kit from intercepting page scroll on mobile (RESEARCH.md Pitfall 2)
- No optimistic reorder — `onSnapshot` delivers authoritative order post-write, avoiding visual double-update
- `remaining[]` adjacency computation (excluding dragged item) used to calculate `prevPos`/`nextPos` — guards against equal-bounds edge case in `generateKeyBetween`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all stubs from Plan 02 (drag handle stub, onEditStart no-op) are fully resolved in this plan.

## Threat Flags

No new threat surface beyond plan threat model. T-03-10 through T-03-14 mitigations implemented:
- `updateWishItem` / `deleteWishItem` / `updateItemPosition` rely on Firestore rules requiring `request.auth.uid == resource.data.childUid`
- `DragOverlay` renders same `WishItemCard` — no `purchaseStatus` exposure
- `type="url"` on imageUrl/productUrl inputs — no dangerouslySetInnerHTML

## Self-Check: PASSED

Files exist:
- src/components/wishlist/WishItemCard.tsx — FOUND
- src/app/wishlist/page.tsx — FOUND

Commits exist:
- d70dd1c — feat(03-03): WishItemCard inline edit, delete confirmation, useSortable — FOUND
- e23e8fd — feat(03-03): DndContext + SortableContext + DragOverlay in WishlistPage — FOUND

TypeScript: `npx tsc --noEmit` exits 0 — PASSED
