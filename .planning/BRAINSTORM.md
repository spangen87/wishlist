# App Improvements Brainstorm

*Generated: 2026-04-24 — post Phase 8, pre v1.1 planning*

## Context

v1.0 shipped with core wishlist functionality. Phase 8 (security/cleanup) is complete.
The app serves families with school-age children: **child owns the list, parents and relatives coordinate purchases without spoiling surprises.**

---

## Priority 1 — High Value, Low Complexity

### B-01: Occasion/event with date

**Problem:** Relatives have no idea when the birthday or Christmas is. They find the list but don't know the deadline.
**Proposal:** Add an optional `occasion` field to the wishlist: name ("Birthday", "Christmas", "Easter") + date. Show it prominently in the viewer page header and on the dashboard card.
**Data:** Add `occasion?: { name: string; date: string }` to `wishlists/{id}`.
**Who sets it:** Child or parent from the wishlist settings page.
**Impact:** Reduces "when is the birthday again?" messages to parents. High signal/noise for relatives.

---

### B-02: Item priority / favorites

**Problem:** A 40-item wishlist is overwhelming. Relatives don't know which items the child actually cares most about.
**Proposal:** Child can mark up to 5 items as "favorites" (star icon on item card). Viewer page shows a "Favoriter" section at top, then the full list.
**Data:** Add `isFavorite?: boolean` to `items/{id}`.
**Who sets it:** Child only (from the wishlist editor).
**Impact:** Guides purchase decisions without removing child autonomy over full list.

---

### B-03: Display item image in cards

**Problem:** `imageUrl` is stored on every item but never rendered in either the child's wishlist editor or the viewer item cards. The field is wasted.
**Proposal:** Render `imageUrl` as a thumbnail (left-aligned, 64×64, `object-cover`) in both `WishItemCard` and `ViewerWishItemCard`. Fall back to a placeholder icon if absent.
**Impact:** Quick win — the data is already there. Makes the list feel alive and easier to scan.

---

### B-04: Price summary for parents/viewers

**Problem:** A wishlist may total 3 000 kr but parents coordinate by individual item. No one sees the big picture.
**Proposal:** In the viewer page footer (and on the dashboard card), show:
- Total list value (sum of all items with price)
- Remaining uncovered value (items without purchasedBy)
- Covered value (items with purchasedBy)
**Data:** Computed client-side from existing `price` and `purchaseStatus` data.
**Impact:** Helps parents set realistic expectations and avoid overspending.

---

### B-05: "Reserving" pre-purchase status

**Problem:** Two relatives buy the same item because neither wanted to commit before the occasion. The current binary (purchased / not) doesn't allow soft coordination.
**Proposal:** Add a "Jag tänker köpa detta" (I'm planning to buy this) state per viewer, separate from the final "Köpt" state. Visible to other viewers but not the child. Shown with a different badge color.
**Data:** Add `reservedBy?: string` (uid) to `purchaseStatus/{itemId}`. Only one reserver at a time; viewer can unclaim.
**Privacy:** Same subcollection — already hidden from child at Firestore rules layer.
**Impact:** Solves the coordination problem without requiring communication outside the app.

---

## Priority 2 — Medium Value, Medium Complexity

### B-06: Multiple wishlists per child (occasion-based)

**Problem:** A child has a birthday in March and Christmas in December. The current model supports only one wishlist per child.
**Proposal:** Allow creating multiple wishlists per child, each with a name and optional occasion/date. Dashboard shows each separately. The child picks which list to edit from a list selector.
**Data:** Multiple `wishlists` documents per `childUid` (already structurally supported — the Firestore model has no unique constraint on childUid).
**Complexity:** Medium — requires changes to dashboard, child editor, and settings page.

---

### B-07: Email notifications (digest)

**Problem:** Parents don't know when the child has updated the wishlist; child doesn't know when something is purchased (and thus shouldn't re-request it).
**Proposal:**
- Viewer/parent: daily digest email when new items are added to any of their children's lists
- Parent only: notification when a viewer marks an item purchased (to avoid double-buying)
**Out of scope for now:** Push notifications (PWA), in-app real-time notification center.
**Complexity:** Requires a Firebase Cloud Functions or Resend/SendGrid integration — significant infrastructure add.

---

### B-08: Wishlist archiving

**Problem:** After a birthday passes, the wishlist is either deleted (permanent) or left active (clutters dashboard). There's no middle ground.
**Proposal:** Archive action on a wishlist — removes it from active dashboard view but keeps it readable via a collapsed "Arkiv" section or dedicated `/archive` page.
**Data:** Add `archivedAt?: Timestamp` to `wishlists/{id}`. Firestore queries filter `where('archivedAt', '==', null)` by default.

---

### B-09: Child can mark items "received"

**Problem:** After the occasion, the child has no way to acknowledge gifts or update the list to reflect what they got.
**Proposal:** After parent marks a wishlist as "occasion passed", child can see which items were purchased (the privacy veil lifts) and mark items as "Fått!" (received). Optional thank-you note shown to parents.
**Complexity:** Requires a new app state/mode for post-occasion wishlists.

---

## Priority 3 — Nice to Have

### B-10: Export wishlist as PDF or image

**Problem:** Grandparents who don't use smartphones can't access the share link.
**Proposal:** Generate a printable PDF or shareable image (PNG) of the wishlist. No purchase coordination — just a gift ideas sheet.
**Complexity:** Requires a headless PDF library (e.g., `@react-pdf/renderer`) or screenshot API.

---

### B-11: Item categories / tags

**Problem:** Long wishlists are hard to scan for a specific type of item (toy, book, clothing, experience).
**Proposal:** Optional category tag per item chosen from a preset list. Viewer page can filter by category.

---

### B-12: Group purchase coordination

**Problem:** An expensive item (e.g., a bicycle, 3 000 kr) is beyond one relative's budget.
**Proposal:** Viewer marks an item as "Klappjakt" (group gift) and invites co-buyers. Each contributor can note their share. Final "Köpt" only set when organizer confirms.
**Complexity:** High — new invite/coordination flow.

---

## Out of Scope (Reconfirmed)

| Idea | Why out of scope |
|------|-----------------|
| PIN-coded parent mode within child account | Separate accounts with invite is cleaner — already decided |
| Native iOS/Android app | PWA covers the need |
| Marketplace integrations (Amazon, etc.) | Adds complexity, risk of lock-in |
| AI-generated gift suggestions | Scope creep; not core to the coordination problem |
| Paid tier / subscriptions | App is free for now |

---

## Recommended v1.1 Scope

Ship B-01 through B-05 as a cohesive "v1.1 — Better coordination" release:

| ID | Feature | Effort |
|----|---------|--------|
| B-01 | Occasion + date on wishlist | S |
| B-02 | Item favorites (child) | S |
| B-03 | Image thumbnails in cards | XS |
| B-04 | Price summary for viewers | S |
| B-05 | "Reserving" pre-purchase status | M |

These five improvements close the most common friction points without requiring new infrastructure or architectural changes.
