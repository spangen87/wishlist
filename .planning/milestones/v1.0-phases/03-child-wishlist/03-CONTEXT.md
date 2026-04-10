# Phase 3: Child Wishlist - Context

**Gathered:** 2026-04-09 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

A logged-in child can build and manage their wishlist — adding items with full details, reordering via drag-and-drop, editing and deleting — and their view never reveals purchase status. This is the first real UI phase: wishlist CRUD + ordering + privacy enforcement. No viewer-side features (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Routing & Navigation
- **D-01:** After login, a child is redirected directly to `/wishlist` — no intermediate dashboard. The current dashboard stub will be repurposed or bypassed for child-role users.
- **D-02:** Route `/wishlist` shows the logged-in child's own wishlist (auth-based, not a wishlist ID in the URL). Firestore lookup: `wishlists` where `childUid == user.uid`.

### Add Item UX
- **D-03:** Adding a new item uses an **inline expanded form** — a button (e.g., "+ Lägg till önskemål") at the top or bottom of the list that expands to reveal the input fields in place. No modal, no navigation.
- **D-04:** All fields are available in the add form: title (required), productUrl, imageUrl, note, price. Title is the only required field; saving without the others is allowed.

### Item Card Layout
- **D-05:** Cards are **wide/detailed** — all fields are visible directly in list view without opening anything. Title, price, productUrl, imageUrl (as thumbnail if set), and note all rendered on the card.
- **D-06:** Cards display the imageUrl as a thumbnail image when present. If missing, show a placeholder area.

### Editing & Deletion
- **D-07:** Editing is **inline** — clicking/tapping a card turns its fields into editable inputs. No modal, no navigation. Confirm with a Save button; cancel with a Cancel/Undo.
- **D-08:** Delete is accessible from the inline-edit state (e.g., a Delete button that appears when editing). Confirm before delete (simple "Are you sure?" inline, not a modal).

### Drag-and-Drop Reorder
- **D-09:** Drag handle is **always visible** on each card — a grip icon (⠿ or ≡) on the left or right edge. This is the primary reorder mechanism on both desktop and mobile touch.
- **D-10:** Fractional indexing for `position` field: use the `fractional-indexing` npm package (already implied by the schema's `position: string` field). Exactly one Firestore write per reorder (update only the moved item's `position`).
- **D-11:** Drag-and-drop library: `@dnd-kit/core` + `@dnd-kit/sortable` — modern, accessible, touch-native, no deprecated dependencies.

### Privacy Enforcement
- **D-12:** The child's wishlist view reads ONLY from `wishlists/{id}/items` — never touches `purchaseStatus` subcollection. This is already enforced at the Firestore rules level (Phase 1), but the client code must also not request that data.
- **D-13:** No "purchased" indicator, no buyer name, no viewer notes rendered anywhere in the child's view.

### Empty State
- **D-14:** When the wishlist has no items, show a **child-friendly empty state** with an illustration (inline SVG or simple emoji-based art), an encouraging message (e.g., "Din lista är tom — vad önskar du dig?"), and a prominent CTA button to add the first item.

### Responsiveness
- **D-15:** Layout is responsive: single-column card list on 375px mobile, same layout on 768px tablet (cards may be slightly wider). Drag handles must work with touch events on mobile.

### Claude's Discretion
- Exact color scheme and pastel tones (constrained by UI-01: pastel, gender-neutral, child-friendly)
- Fractional index initialization strategy (midpoint between 0 and 1 for first item)
- Specific animation/transition on card expand/collapse
- Form validation error display style
- Skeleton loading state design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 criteria, all must be met)
- `.planning/REQUIREMENTS.md` — WISH-01 through WISH-08, UI-02 (all mapped to this phase)

### Schema & data model
- `src/types/firestore.ts` — `WishItemDoc` (title, productUrl, imageUrl, note, price, position), `WishlistDoc` — these types are canonical; do not redefine them

### Auth context
- `src/components/AuthProvider.tsx` — provides `useAuth()` hook with `user`, `role`, `loading`
- `src/lib/firebase/client.ts` — Firebase client SDK singleton; use this for all Firestore operations in client components

### Prior phase decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — Firestore collection hierarchy, SDK split pattern, path aliases

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/AuthProvider.tsx` — `useAuth()` hook is ready; provides `user.uid` needed for Firestore queries
- `src/lib/firebase/client.ts` — Firestore instance exportable from here (add `db` export if not already present)
- `src/types/firestore.ts` — `WishItemDoc` and `WishlistDoc` types already defined; use them directly

### Established Patterns
- App Router (`src/app/`), TypeScript strict, `@/` path alias — all established in Phase 1
- Client components use `'use client'` directive; data fetching via Firestore SDK directly (no API routes for reads)
- Auth redirect pattern: `useEffect` + `router.push('/login')` when `!loading && !user` (see dashboard page)
- Tailwind CSS for all styling (established in Phase 1)

### Integration Points
- `/wishlist` route will be the primary post-login destination for child-role users
- Phase 1 Firestore rules already deny child UID access to `purchaseStatus` — child CRUD in this phase only touches `items` subcollection
- Phase 4 (Viewer Flow) will read `items` and `purchaseStatus`; don't add purchase fields to items

</code_context>

<specifics>
## Specific Ideas

- Drag handle always visible — a grip icon on each card edge (not hidden behind long-press)
- Empty state should feel encouraging and age-appropriate, not clinical
- Inline form and inline editing preferred throughout — the child should not leave the wishlist page to manage their items

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 03-child-wishlist*
*Context gathered: 2026-04-09*
