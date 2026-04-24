# Phase 9: B-05: Reservation status — Jag tänker köpa detta - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A viewer or parent can signal reservation intent on a wish item — "Jag tänker köpa detta" — to prevent double-buying. Reservation is a separate, lighter state than "marked as purchased". It lives in the existing `purchaseStatus` privacy subcollection so the child never sees it. The child's wishlist view is entirely unaffected.

</domain>

<decisions>
## Implementation Decisions

### Reservation vs purchase relationship
- **D-01:** Reservation ("Jag tänker köpa detta") and marking as purchased ("Markera som köpt") are **two separate, independent actions**. A viewer can reserve without buying, buy without reserving, or reserve and then buy.
- **D-02:** **Only one reservation at a time per item.** First to reserve locks the item for reservation — others see it as reserved and the button is disabled for them.
- **D-03:** When the reserver marks the item as purchased, the reservation is **automatically cleared** in the same API call. No manual cleanup needed.
- **D-04:** If someone other than the reserver marks as purchased, the reservation stays until the reserver explicitly removes it or it is left as-is (edge case — acceptable for now).

### Data model
- **D-05:** Add `reservedBy?: string` field to `PurchaseStatusDoc` in `src/types/firestore.ts`. Stores the UID of the viewer who reserved. `undefined` / absent = not reserved.
- **D-06:** No new subcollection or document needed — reservation is a field on the existing `purchaseStatus/{itemId}` document, exactly like `purchasedBy`.
- **D-07:** New API route: `POST /api/viewer/reserve-item` — mirrors `mark-purchased` route pattern. Verifies caller is in `viewerUids` or `parentUids`, then sets or clears `reservedBy` on the `purchaseStatus` doc. Admin SDK batch also writes activity log entry.

### Privacy and visibility
- **D-08:** Child sees **nothing** — reservation lives in `purchaseStatus` subcollection which the child cannot read (enforced by Firestore rules from Phase 1/8). No change to child's wishlist view.
- **D-09:** Viewers and parents see **who reserved**: e.g., "Reserverad av Anna". Reserver's display name is resolved the same way as `purchasedBy` (look up `users/{uid}`, use `username ?? email ?? uid`).
- **D-10:** A viewer who is **not** the reserver sees the badge "Reserverad av [namn]" and the reserve button is **disabled** (same pattern as `isOthersPurchase` for the purchase button).
- **D-11:** The reserver themselves sees their own reservation as active (button toggled on) and can un-reserve by clicking again.

### UI placement on ViewerWishItemCard
- **D-12:** "Jag tänker köpa detta" is a **separate button placed above** the existing "Markera som köpt" button on the card. Two distinct actions with clear hierarchy: intent → confirmed purchase.
- **D-13:** Button states for the reserve button:
  - Not reserved, current user: "Jag tänker köpa detta" (white/border style, active)
  - Reserved by current user: "Du tänker köpa detta" (orange filled, active/togglable)
  - Reserved by someone else: "Reserverad av [namn]" (disabled, muted style) — matches `isOthersPurchase` pattern on the purchase button
- **D-14:** When an item is both reserved (by current user) and purchased (by current user), only the purchase state is visually dominant — the reserve button is hidden/irrelevant since purchase auto-cleared the reservation (D-03).

### Reservation lifecycle
- **D-15:** Un-reserving uses the **same toggle button** — clicking "Du tänker köpa detta" removes the reservation. Symmetrical with the purchase toggle.
- **D-16:** Reservation events are **logged to the activity log** with new action types: `'reserved'` and `'unreserved'`. Consistent with existing `marked_purchased` / `unmarked_purchased` pattern.
- **D-17:** `ActivityLogDoc.action` type in `src/types/firestore.ts` must be extended: add `'reserved' | 'unreserved'` to the union.

### Claude's Discretion
- Exact visual styling of the reserve button in each state (specific Tailwind classes, keeping the pastel palette)
- Whether to show both reserve and purchase buttons when an item is already purchased by someone else (probably hide reserve button when item is purchased)
- Animation/transition on state change
- Error handling copy for edge cases (reservation stolen while UI is stale, network error)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data model
- `src/types/firestore.ts` — `PurchaseStatusDoc` (add `reservedBy?: string`), `ActivityLogDoc` (extend action union with `'reserved' | 'unreserved'`), `WishlistDoc` (viewerUids, parentUids — for access checks)

### Existing viewer infrastructure (mirror these patterns exactly)
- `src/app/api/viewer/mark-purchased/route.ts` — Pattern for the new `reserve-item` API route: idToken verification, viewerUids/parentUids access check, Admin SDK batch write, activity log entry
- `src/app/api/viewer/update-note/route.ts` — Secondary reference for viewer API route pattern
- `src/components/viewer/ViewerWishItemCard.tsx` — Component to extend with reserve button (D-12 to D-14); existing `isOthersPurchase` logic is the direct model for the reserve disabled state
- `src/app/viewer/[wishlistId]/page.tsx` — Viewer page orchestrating `onTogglePurchased` and `onUpdateNote` callbacks; add `onToggleReserved` here
- `src/components/viewer/PurchasedBadge.tsx` — Reference for how to render "Reserverad av [namn]" badge

### Firestore rules
- `firestore.rules` — `purchaseStatus` rules must be checked/updated to allow `reservedBy` writes from viewerUids/parentUids; child read-deny must cover new field automatically (it's the same doc)

### Prior phase context
- `.planning/phases/04-viewer-flow/04-CONTEXT.md` — Original purchaseStatus design, PurchasedBadge pattern, activity log structure
- `.planning/phases/08-security-auth-and-account-fixes/08-01-PLAN.md` — Firestore rules tightening; any rule changes must not regress SEC-01

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ViewerWishItemCard` — Add reserve button directly here; `isOthersPurchase` / `isPurchased` logic is the exact model for `isOtherReservation` / `isOwnReservation`
- `PurchasedBadge` — Reuse or clone for a `ReservationBadge` ("Reserverad av [namn]")
- `mark-purchased` route — Copy as the base for `reserve-item`; same auth check, same batch+activity-log pattern
- `displayNames` map in viewer page — Already fetches UIDs → display names for `purchasedBy`; extend to also fetch for `reservedBy`

### Established Patterns
- Viewer actions: `page.tsx` holds `idToken` fetch + `fetch('/api/...')`, passes callbacks as props to card component
- Activity log: Admin SDK batch with `FieldValue.serverTimestamp()`, action strings from `ActivityLogDoc` union
- Access check: `viewerUids.includes(uid) || parentUids.includes(uid)` — copy verbatim
- Pastel card palette: `bg-[#FFF0E8]` / `border-[#E5D5CC]` / orange `#F97316` for active/selected state

### Integration Points
- `PurchaseStatusDoc` gets a new optional `reservedBy?: string` field — no migration needed (Firestore is schemaless; existing docs without the field are simply "not reserved")
- `ActivityLogDoc.action` union extended — no migration; existing log entries are unaffected
- `src/app/viewer/[wishlistId]/activity/page.tsx` — Activity log display; must render new `'reserved'` / `'unreserved'` action types with appropriate Swedish text

</code_context>

<specifics>
## Specific Ideas

- The reserve button should feel lighter/softer than the purchase button — it's an intent, not a commitment. Consider a dashed border or softer color in the default state.
- "Jag tänker köpa detta" is the exact Swedish phrase for the button label (from the phase name).
- The feature is specifically designed to prevent awkward "we both bought the same thing" situations at birthdays — the UX should make it easy to see at a glance what's coordinated.

</specifics>

<deferred>
## Deferred Ideas

- Reservation expiry / auto-release after N days — keep for future phase if coordination problems arise
- Push notifications when someone reserves an item you were also looking at — v2
- "Köp-lista" / coordinated shopping view aggregating all reserved items across wishlists — v2

</deferred>

---

*Phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta*
*Context gathered: 2026-04-24*
