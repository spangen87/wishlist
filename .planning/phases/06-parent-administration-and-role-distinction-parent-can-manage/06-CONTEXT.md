# Phase 6: Parent administration and role distinction - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A parent who has created child accounts can manage each child's wishlist directly: add wish items on the child's behalf, rename the wishlist, manage the viewer share link, and generate a parent invite link for a co-parent. The app also distinguishes the parent role from anhörig (relatives who joined via share link): parents are tracked in a new `parentUids[]` field on the wishlist document and see a distinct dashboard layout with management actions. Relatives (viewerUids) see the same viewer experience as today.

A user can simultaneously be a parent of their own child AND a viewer/anhörig of another child's wishlist — this is the central design constraint that shapes all decisions below.

</domain>

<decisions>
## Implementation Decisions

### Role assignment — account level
- **D-01:** Anyone who self-registers at `/register` gets `role: 'parent'` (not `role: 'viewer'`). The `set-viewer-claim` route must be updated (or a new `set-parent-claim` route created) to set the `parent` custom claim instead of `viewer`.
- **D-02:** Relatives who join via a share link keep `role: 'viewer'`. The claim set during invite redemption (`/api/invite/redeem`) stays `viewer` — no change to that flow.
- **D-03:** The `parent` role claim does NOT grant any extra global Firestore access. It is used only to: (a) gate access to `/add-child` and `/onboarding` (only parents can create child accounts), and (b) drive dashboard layout. Actual wishlist admin rights come from `parentUids[]` on the specific wishlist document.

### Data model — WishlistDoc
- **D-04:** Add `parentUids: string[]` to `WishlistDoc` in `src/types/firestore.ts`. This field tracks who has admin/parent-level access to this wishlist.
- **D-05:** When a parent creates a child account via `/api/auth/register-child`, their UID goes into `parentUids[]` (not `viewerUids[]`). The existing `viewerIdToken` parameter in that route is repurposed — if provided, the decoded UID is added to `parentUids`, not `viewerUids`.
- **D-06:** `viewerUids[]` remains for relatives/anhörig only — users who joined via the viewer share link. No change to how viewer invite redemption writes to `viewerUids`.
- **D-07:** `parentUids[]` can have multiple entries — a second parent can be added via a parent invite link (see D-11 below).

### Dashboard — /dashboard layout
- **D-08:** `/dashboard` handles all adult roles. The page shows two sections based on which lists the user has access to:
  - **"Mina barn"** section: wishlists where `user.uid` is in `parentUids[]`. Each card shows the child's name, item count, purchased count, AND management actions (rename button, link to settings/share).
  - **"Jag är inbjuden till"** section: wishlists where `user.uid` is in `viewerUids[]`. These cards look and behave exactly as today (no management actions).
  - If a user has no entries in either section, show an appropriate empty state for each.
- **D-09:** Auth redirect: `role === 'parent'` → `/dashboard` (same route as viewer). The dashboard page reads both `parentUids`-bearing wishlists and `viewerUids`-bearing wishlists and renders the two-section layout.
- **D-10:** The existing viewer dashboard query (`subscribeToViewerWishlists` in `src/lib/firebase/viewer.ts`) needs a companion query for parent wishlists. A new `subscribeToParentWishlists` function queries `wishlists` where `parentUids array-contains user.uid`.

### Parent invite link (second parent)
- **D-11:** The settings page generates a **parent invite link** (separate from the viewer share link). This is a new invite type in the `invites/{token}` collection — add `type: 'parent' | 'viewer'` field to `InviteDoc`.
- **D-12:** Redeeming a parent invite link adds the user's UID to `parentUids[]` (instead of `viewerUids[]`) and sets `role: 'parent'` custom claim if the user currently has `role: 'viewer'`. The redemption API route (`/api/invite/redeem`) must handle the `type` field to determine which array to update.
- **D-13:** Parent invite links are managed (copy/regenerate) in the same settings page as the viewer share link — a new "Co-förälder" section.

### Viewer page — parent sees extra controls
- **D-14:** The `/viewer/[wishlistId]` page checks if `user.uid` is in `parentUids[]` (read from the wishlist document). If yes, it renders parent-only controls:
  - An **"Lägg till önskemål"** button/form above the item list — opens the same AddItemForm as on the child's wishlist page
  - A **rename field** for the wishlist title (inline editable or a modal)
  - A **settings link** to `/wishlist/[wishlistId]/settings`
- **D-15:** Relatives (viewerUids only) see none of these controls — the page is identical to today.
- **D-16:** The auth guard on `/viewer/[wishlistId]` currently allows any non-child. No change needed — parents land here via the dashboard card link.

### Settings page — parent access
- **D-17:** The settings page at `/wishlist/[wishlistId]/settings` currently gates on `data.childUid === user.uid`. Update the gate to: `user.uid === data.childUid OR data.parentUids.includes(user.uid)`.
- **D-18:** Settings page shows both link types:
  - Existing viewer share link section (copy + regenerate)
  - New "Co-förälder" section: parent invite link (copy + regenerate separately)
  - Viewer list (existing — shows who has joined as anhörig)
- **D-19:** Back navigation from settings: when accessed by a parent, "← Tillbaka" links to `/viewer/[wishlistId]` (not `/wishlist` which is the child's page).

### Adding items as parent — API route
- **D-20:** A new `/api/wishlist/add-item` API route handles item creation. It verifies the caller's UID is in `parentUids[]` of the target wishlist (using Admin SDK), then writes to `wishlists/{wishlistId}/items/` with the same schema as child-created items (`WishItemDoc`).
- **D-21:** The item is written with the same fields as child-created items. The `createdAt` timestamp is server-set. No `createdBy` field is added in this phase — items are indistinguishable from child-created items by design (the item appears as if the child added it).
- **D-22:** Firestore rules must be updated to allow parent role users to write to `wishlists/{wishlistId}/items/` when their UID is in `parentUids[]`. (The API route uses Admin SDK and bypasses client rules, but the child's direct client SDK writes also need to continue working.)

### Renaming wishlist as parent
- **D-23:** The existing `/api/wishlist/update-title` route is extended: currently it verifies `childUid === caller UID`. Update to also accept callers whose UID is in `parentUids[]`.
- **D-24:** The rename UI on the viewer page is a simple inline edit of the wishlist title — tap the title, it becomes an input, save on blur or Enter key.

### Claude's Discretion
- Exact visual design of the "Mina barn" vs "Jag är inbjuden till" sections on the dashboard (card style, section headers, spacing)
- Whether the "Lägg till önskemål" form on the viewer page is inline or a slide-up panel
- Animation/transition for the inline rename field on the viewer page
- Empty state copy for each dashboard section
- Error handling UX when a parent invite link is expired or already redeemed

</decisions>

<specifics>
## Specific Ideas

- The two-section dashboard is the key user-facing change: parents see their own children separately from lists they've been invited to as relatives. "Mina barn" and "Jag är inbjuden till" are natural Swedish labels.
- When a parent adds an item on behalf of the child, it should feel seamless — the item appears in the child's list just like any other item. No "added by parent" badge in v1.1.
- The parent invite link and viewer share link should be visually distinct in the settings page — parents and relatives have very different access levels and users should understand the difference.
- A user who registers as a parent but has not yet created a child account should see a clear CTA in their dashboard to get started (e.g., "Du har inga barn tillagda ännu. Lägg till ett barn →").

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data model and types
- `src/types/firestore.ts` — All Firestore document interfaces. D-04 requires adding `parentUids: string[]` to `WishlistDoc`. D-11 requires adding `type: 'parent' | 'viewer'` to `InviteDoc`.

### Auth and role claims
- `src/app/api/auth/set-viewer-claim/route.ts` — Current viewer claim setter. D-01 requires a parallel parent claim setter (new route or update this one).
- `src/app/api/auth/register-child/route.ts` — Child account creation. D-05 requires changing the `viewerIdToken` handling to write to `parentUids` instead of `viewerUids`.
- `src/components/AuthProvider.tsx` — `useAuth()` provides `user`, `role`, `loading`. Role-based redirect logic lives here and in page components.

### Invite system
- `src/app/api/invite/redeem/route.ts` — Current invite redemption (adds to `viewerUids`, sets `viewer` claim). D-12 requires handling `type: 'parent'` invites.
- `src/app/api/invite/create-for-child/route.ts` — Viewer invite creation. Reference for how to create the new parent invite type.

### Dashboard
- `src/app/dashboard/page.tsx` — Current dashboard. D-08/D-09 require adding a parent section and querying `parentUids`-bearing wishlists.
- `src/lib/firebase/viewer.ts` — `subscribeToViewerWishlists` query. D-10 requires a companion `subscribeToParentWishlists` function.
- `src/components/viewer/WishlistDashboardCard.tsx` — Existing card component. Parent cards ("Mina barn") need management action affordances.

### Viewer page (parent controls)
- `src/app/viewer/[wishlistId]/page.tsx` — Current viewer wishlist page. D-14 requires parent-conditional controls (add item, rename, settings link).
- `src/components/wishlist/AddItemForm.tsx` — Existing add item form. Reuse on the viewer page for the parent "Lägg till önskemål" feature.
- `src/app/api/wishlist/update-title/route.ts` — Wishlist rename API. D-23 requires extending the auth check to include `parentUids`.

### Settings page
- `src/app/wishlist/[wishlistId]/settings/page.tsx` — Current settings page. D-17/D-18 require updating the ownership gate and adding the parent invite link section.
- `src/components/viewer/ShareLinkPanel.tsx` — Existing share link component. Reference for how to build the parent invite link panel.

### Prior phase context
- `.planning/phases/01-onboarding-flow-child-account-creation-and-swedish-localizat/01-CONTEXT.md` — Established auth patterns, form layout, Swedish terminology
- `.planning/phases/04-viewer-flow/04-CONTEXT.md` — Invite redemption flow, viewer dashboard decisions, card design

### No external specs
No ADRs or design docs — all requirements are captured in decisions above and PROJECT.md / ROADMAP.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddItemForm` (`src/components/wishlist/AddItemForm.tsx`): Existing add item form used on the child's wishlist page. Reuse as-is on the viewer page for parent "Lägg till önskemål" — parent submits to the new `/api/wishlist/add-item` API route instead of writing directly to Firestore.
- `ShareLinkPanel` (`src/components/viewer/ShareLinkPanel.tsx`): Existing share link panel. Reference/extend for the parent invite link panel in settings.
- `WishlistDashboardCard` (`src/components/viewer/WishlistDashboardCard.tsx`): Existing card in viewer dashboard. Extend or create a variant with management action buttons for the "Mina barn" section.
- `subscribeToViewerWishlists` (`src/lib/firebase/viewer.ts`): Existing Firestore listener for wishlists where `viewerUids array-contains uid`. The companion `subscribeToParentWishlists` follows the same pattern querying `parentUids`.
- `useAuth()` from `AuthProvider`: Provides `user`, `role`, `loading` — pattern used in every page.

### Established Patterns
- Page layout: `<main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">` — use for dashboard sections
- Form pattern: controlled inputs with `useState`, `onSubmit` handler, inline Swedish error display
- Role-based redirect: `useEffect` on `[loading, user, role, router]`
- API routes: Admin SDK for privileged operations (verify token, check parentUids, write Firestore), never expose Admin SDK to client
- `onSnapshot` for real-time listeners — established in Phase 3 and 4
- Swedish UI: all user-facing strings in Swedish (see Phase 1 CONTEXT.md for terminology)

### Integration Points
- `src/app/register/page.tsx` → calls `set-viewer-claim` → must call `set-parent-claim` (or updated route) after D-01
- `src/app/api/auth/register-child/route.ts` → writes `viewerUids` → must write `parentUids` after D-05
- `src/app/dashboard/page.tsx` → needs two Firestore subscriptions (parentUids + viewerUids) and two-section render
- `src/app/viewer/[wishlistId]/page.tsx` → needs `parentUids` membership check to show/hide parent controls
- `src/app/wishlist/[wishlistId]/settings/page.tsx` → ownership gate update + parent invite link section
- `src/app/api/wishlist/update-title/route.ts` → auth check extension for parentUids
- New: `src/app/api/wishlist/add-item/route.ts` → parent item creation via Admin SDK
- New: `src/app/api/invite/create-for-parent/route.ts` → parent invite token creation
- Firestore rules: add `parentUids` array check for item writes and settings reads

</code_context>

<deferred>
## Deferred Ideas

- Drag-and-drop reordering of child items by the parent — same UX as child's wishlist drag-and-drop; defer to a future phase
- Parent ability to delete items from the child's wishlist — not discussed, keep for v1.2
- Parent ability to mark items as purchased (acting as a viewer) — parents can already do this via viewerUids; no change needed in this phase
- Push notifications when child adds a new item — v2
- Parent-to-child messaging or notes — v2

</deferred>

---

*Phase: 06-parent-administration-and-role-distinction-parent-can-manage*
*Context gathered: 2026-04-12*
