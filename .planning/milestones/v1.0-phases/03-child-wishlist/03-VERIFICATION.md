---
phase: 03-child-wishlist
verified: 2026-04-09T12:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Child can add, edit, delete, and reorder wish items end-to-end"
    expected: "All CRUD operations work in browser; real-time updates appear without page refresh; deleted item disappears immediately"
    why_human: "Requires Firebase emulator running + dev server; Firestore onSnapshot cannot be verified programmatically"
  - test: "Drag-and-drop reorder persists after page refresh"
    expected: "After dragging item to new position and refreshing, the order is preserved (fractional index written to Firestore)"
    why_human: "Requires live Firestore write and re-read; cannot verify without running emulator"
  - test: "Child's wishlist view never reveals purchaseStatus in browser DevTools"
    expected: "Firestore response for wishlists/{uid}/items contains no purchaseStatus fields; no network request to purchaseStatus subcollection is made"
    why_human: "Requires live browser DevTools inspection to confirm no purchaseStatus subcollection reads are attempted"
  - test: "Touch drag activates after 250ms hold without breaking page scroll"
    expected: "On a mobile device (or Chrome DevTools mobile simulation), a short tap does not start drag; a 250ms+ hold activates drag; vertical page scroll still works"
    why_human: "Touch sensor behavior requires real touch interaction; cannot verify with static code analysis"
  - test: "Layout is usable at 375px and 768px"
    expected: "Single-column list, readable cards, add form, empty state all render correctly at both breakpoints"
    why_human: "Responsive layout requires visual browser verification"
---

# Phase 3: Child Wishlist Verification Report

**Phase Goal:** A logged-in child can build and manage their wishlist — adding items with full details, reordering via drag-and-drop, editing and deleting — and their view never reveals purchase status
**Verified:** 2026-04-09T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Firestore helpers exist for wishlist bootstrap, item CRUD, and position update | VERIFIED | `src/lib/firebase/wishlist.ts` exports all 6 functions: getOrCreateWishlist, subscribeToItems, addWishItem, updateWishItem, deleteWishItem, updateItemPosition |
| 2 | Child logging in is redirected to /wishlist, not /dashboard | VERIFIED | `src/app/login/page.tsx` line 38: `router.push(role === 'child' ? '/wishlist' : '/dashboard')` |
| 3 | Dashboard redirects child-role users to /wishlist as a safety net | VERIFIED | `src/app/dashboard/page.tsx` lines 20-24: useEffect with `role === 'child'` guard calling `router.push('/wishlist')` |
| 4 | Child navigating to /wishlist sees their wish items in real-time (onSnapshot) | VERIFIED | `src/app/wishlist/page.tsx` wires `subscribeToItems` in useEffect; `setItems(newItems)` is called from onSnapshot callback |
| 5 | Child can add, edit, and delete items with all 5 fields | VERIFIED | AddItemForm calls `addWishItem`; WishItemCard edit mode calls `updateWishItem`; delete confirmation calls `deleteWishItem` |
| 6 | Cards can be dragged via grip handle to reorder; one Firestore write fires per drag | VERIFIED | WishlistPage DndContext wires `handleDragEnd` → `updateItemPosition`; no `setItems` inside `handleDragEnd` |
| 7 | No purchaseStatus data is accessed or rendered anywhere | VERIFIED | grep of src/lib/firebase/wishlist.ts, src/app/wishlist/, src/components/wishlist/ returns zero matches; only comment in src/types/firestore.ts |
| 8 | Layout is single-column, max-w-2xl, with responsive padding | VERIFIED | WishlistPage: `max-w-2xl mx-auto px-4 sm:px-6`; LoadingSkeleton matches; components use Tailwind mobile-first classes |
| 9 | Empty state and loading skeleton render correctly | VERIFIED | EmptyState: ⭐ emoji, "Din lista är tom" heading, CTA button; LoadingSkeleton: 3 `animate-pulse` cards |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/firebase/wishlist.ts` | 6 Firestore helpers | VERIFIED | All 6 exported; uses child UID as doc ID with `merge: true`; `orderBy('position')` subscription |
| `src/app/login/page.tsx` | Role-aware post-login redirect | VERIFIED | `getIdTokenResult` + conditional `router.push` at line 38 |
| `src/app/dashboard/page.tsx` | Child-role safety-net redirect | VERIFIED | Second useEffect with `role === 'child'` → `/wishlist` |
| `src/app/wishlist/page.tsx` | WishlistPage with auth guard, real-time listener, DndContext | VERIFIED | Full implementation with DndContext, SortableContext, DragOverlay, TouchSensor(250ms/8px) |
| `src/components/wishlist/WishItemCard.tsx` | Full card: read, edit, delete-confirm, useSortable | VERIFIED | useSortable with setActivatorNodeRef; touchAction:none on handle only; inline edit form with 5 fields; "Är du säker?" confirm |
| `src/components/wishlist/AddItemForm.tsx` | Inline add form with validation | VERIFIED | 5 fields, Swedish labels, "Titel krävs" error, `addWishItem` call |
| `src/components/wishlist/EmptyState.tsx` | Empty state with illustration and CTA | VERIFIED | ⭐, "Din lista är tom", "Vad önskar du dig?", CTA button |
| `src/components/wishlist/LoadingSkeleton.tsx` | 3-card pulse skeleton | VERIFIED | `[0, 1, 2].map` with `animate-pulse` |
| `src/app/globals.css` | CSS custom property color tokens | VERIFIED | `--color-bg: #FFF9F5`, `--color-card: #FFF0E8`, `--color-accent: #F97316` in :root |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/login/page.tsx` | `/wishlist` | `getIdTokenResult` claims | WIRED | Line 36-38: `getIdTokenResult()` → role check → `router.push` |
| `src/lib/firebase/wishlist.ts` | `wishlists/{childUid}/items` | `onSnapshot` with `orderBy('position')` | WIRED | Line 29-39: query with `orderBy('position')`, onSnapshot callback |
| `src/app/wishlist/page.tsx` | `src/lib/firebase/wishlist.ts` | `getOrCreateWishlist + subscribeToItems` imports | WIRED | Lines 5, 55, 58 |
| `src/components/wishlist/AddItemForm.tsx` | `src/lib/firebase/wishlist.ts` | `addWishItem` call on submit | WIRED | Line 3 import; line 31 call in handleSubmit |
| `src/app/wishlist/page.tsx (DndContext.onDragEnd)` | `src/lib/firebase/wishlist.ts (updateItemPosition)` | `handleDragEnd` → `updateItemPosition` | WIRED | Line 5 import; line 91 call in handleDragEnd |
| `src/components/wishlist/WishItemCard.tsx (edit save)` | `src/lib/firebase/wishlist.ts (updateWishItem)` | `handleSave` calling `updateWishItem` | WIRED | Line 5 import; line 77 call |
| `src/components/wishlist/WishItemCard.tsx (delete confirm)` | `src/lib/firebase/wishlist.ts (deleteWishItem)` | `handleConfirmDelete` calling `deleteWishItem` | WIRED | Line 5 import; line 89 call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `src/app/wishlist/page.tsx` | `items` (WishItemDoc[]) | `subscribeToItems` → `onSnapshot` → Firestore `wishlists/{uid}/items` | Yes — live Firestore collection | FLOWING |
| `src/components/wishlist/WishItemCard.tsx` | `item` prop | Passed from WishlistPage items array | Real Firestore documents | FLOWING |
| `src/components/wishlist/AddItemForm.tsx` | Form state → `addWishItem` | User input → Firestore write | Real write, real Firestore | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires Firebase emulators running; no standalone runnable entry point for these checks without dev server + auth context.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WISH-01 | 03-01, 03-02 | Barn kan lägga till ett önskemål med titel (obligatorisk) | SATISFIED | AddItemForm: title field required, "Titel krävs" validation, `addWishItem` call |
| WISH-02 | 03-01, 03-02 | Barn kan lägga till länk till produkt | SATISFIED | AddItemForm: productUrl field; WishItemCard renders `item.productUrl` |
| WISH-03 | 03-01, 03-02 | Barn kan lägga till bild via URL | SATISFIED | AddItemForm: imageUrl field; WishItemCard renders 64×64 thumbnail or placeholder div |
| WISH-04 | 03-01, 03-02 | Barn kan lägga till anteckning | SATISFIED | AddItemForm: note textarea; WishItemCard renders `item.note` with `line-clamp-3` |
| WISH-05 | 03-01, 03-02 | Barn kan ange ungefärligt pris | SATISFIED | AddItemForm: price number input; WishItemCard renders `~{item.price} kr` |
| WISH-06 | 03-03 | Barn kan redigera och ta bort egna önskemål | SATISFIED | WishItemCard: inline edit mode with 5 fields (updateWishItem); inline delete confirm (deleteWishItem) |
| WISH-07 | 03-03 | Barn kan ändra ordning via drag-and-drop | SATISFIED (human needed) | DndContext/SortableContext/DragOverlay wired; updateItemPosition called in onDragEnd; requires live test |
| WISH-08 | 03-01, 03-02, 03-03 | Barnets vy visar INTE vilka önskemål som är avbockade/köpta | SATISFIED | Zero purchaseStatus references in wishlist.ts, wishlist/page.tsx, WishItemCard, AddItemForm; purchaseStatus is in separate subcollection |
| UI-02 | 03-02, 03-03 | Responsiv layout på mobiltelefon och surfplatta | SATISFIED (human needed) | max-w-2xl, px-4 sm:px-6, min-h-[44px] touch targets; visual confirmation needed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/wishlist/page.tsx` | 86 | `const insertAt = newIndex > oldIndex ? newIndex : newIndex` — redundant ternary, both branches identical | Info | No functional impact — simplifies to `insertAt = newIndex`. Drag ordering is correct for all cases verified manually. Code smell only. |

### Human Verification Required

#### 1. End-to-end CRUD and real-time sync

**Test:** Start Firebase emulators (`npm run emulator`) and dev server (`npm run dev`). Log in as a child user. Add 3 wish items with different field combinations. Verify all items appear in the list without page refresh.
**Expected:** Items appear immediately after submit; form closes; list updates in real-time
**Why human:** Requires Firebase emulator + browser; Firestore onSnapshot cannot be verified statically

#### 2. Drag-and-drop order persistence

**Test:** With emulators running, drag an item to a new position. Refresh the page.
**Expected:** The item remains in its new position after refresh (fractional index was written to Firestore)
**Why human:** Requires live Firestore write and page reload to confirm persistence

#### 3. Purchase status isolation in DevTools

**Test:** With Chrome DevTools Network tab open, navigate to /wishlist as a child user.
**Expected:** No network requests to `purchaseStatus` subcollection; Firestore reads are limited to `wishlists/{uid}/items`
**Why human:** Requires browser DevTools inspection of live Firestore requests

#### 4. Touch drag activation (250ms delay, scroll preserved)

**Test:** On Chrome DevTools mobile simulation (375px), hold a drag handle for < 200ms (should not drag), then hold 300ms+ (should drag). Also verify vertical page scroll still works by swiping up/down on non-handle areas.
**Expected:** Short tap does not initiate drag; 250ms+ hold initiates drag; page scrolls normally elsewhere
**Why human:** Touch sensor behavior requires real or simulated touch input

#### 5. Responsive layout at 375px and 768px

**Test:** View /wishlist at 375px and 768px viewport widths in browser DevTools.
**Expected:** Single-column list, readable card layout, add form fields stack correctly, empty state centered; no horizontal overflow
**Why human:** Visual rendering requires browser inspection

### Gaps Summary

No blocking gaps found. All 9 observable truths are verified at code level. All 9 requirements (WISH-01 through WISH-08, UI-02) have implementation evidence in the codebase.

The only outstanding items are 5 behavioral verifications that require a running dev server and browser. These are normal for a UI-heavy phase and do not indicate implementation defects.

One non-blocking code smell: the redundant ternary in `handleDragEnd` (`insertAt = newIndex > oldIndex ? newIndex : newIndex`) is harmless — manual trace confirms correct adjacency computation for all drag directions.

---

_Verified: 2026-04-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
