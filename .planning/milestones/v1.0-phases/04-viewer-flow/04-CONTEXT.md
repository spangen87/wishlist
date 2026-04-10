# Phase 4: Viewer Flow - Context

**Gathered:** 2026-04-09 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

A viewer with a share link can join a child's wishlist, coordinate purchases with other viewers, and review an activity log — all without the child seeing any of it. Covers: share link generation/revocation, invite redemption flow, viewer wishlist UI (purchase marking + notes), activity log, and viewer dashboard.

</domain>

<decisions>
## Implementation Decisions

### Share Link Generation UI
- **D-01:** Share link is managed via a **settings/gear page** for the wishlist. A gear icon on the wishlist page leads to a settings page with a Sharing section: shows the current invite link, a copy button, a list of current viewers, and a "Regenerate link" button that invalidates the old token (sets `active: false` on the old `InviteDoc`, creates a new one).
- **D-02:** The settings route is `/wishlist/[wishlistId]/settings` (or equivalent). Accessible to child and parent/owner of the wishlist, not to viewers.

### Viewer Join Flow
- **D-03:** `/invite/[token]` is a **dedicated join page** — it shows the invite context ("You've been invited to join [child name]'s wishlist") with login and register options inline. No separate redirect to `/login`. After login/register on this page, the API route redeems the token and adds the visitor to `viewerUids`.
- **D-04:** If the visitor is already logged in and already a viewer, the page redirects them directly to the viewer wishlist. If already logged in but not yet a viewer, it redeems the token immediately.
- **D-05:** Token redemption happens via an API route + Admin SDK (roadmap constraint): `POST /api/invite/redeem` — validates token is `active`, adds `user.uid` to `viewerUids`, sets the `viewer` custom claim via Admin SDK.

### Viewer Wishlist Layout
- **D-06:** The viewer wishlist page uses the **same pastel card design** as the child's wishlist, but each card gains purchase overlays: a "Mark as purchased" button/checkbox and an expandable note field. The cards are otherwise visually identical to the child's cards.
- **D-07:** Route for the viewer's wishlist view: `/viewer/[wishlistId]` (distinct from the child's `/wishlist` route). A viewer who accesses `/wishlist` while logged in as a viewer role gets redirected to their dashboard, not the child's view.
- **D-08:** Each card shows: item title, price, productUrl, imageUrl thumbnail (same as child view), PLUS a "Mark purchased" toggle and a "Your note" section showing the current viewer's own note.
- **D-09:** Purchased items are visually distinguished (e.g., muted/strikethrough styling). Each purchased card shows who marked it (username or display name from `users/{uid}`).

### Purchase Marking UX
- **D-10:** A checkbox (or toggle button) on each card marks/unmarks the item as purchased. Toggle maps to `purchasedBy: user.uid` (set on mark, cleared on unmark). Only one viewer can be the purchaser per item — marking by a second viewer overwrites the first (last write wins, same as existing schema).
- **D-11:** The "Mark as purchased" action writes to `wishlists/{id}/purchaseStatus/{itemId}` — the privacy boundary subcollection that children cannot read.

### Notes (Per-Viewer)
- **D-12:** **Schema change from Phase 1:** `PurchaseStatusDoc.viewerNote: string` is replaced with `viewerNotes: Record<string, string>` — a map of `uid → note text`. Each viewer writes and reads only their own note. Other viewers' notes are visible too (for coordination).
- **D-13:** Note field: click-to-expand — a "Leave a note" link/button expands a text area for the current viewer's note. Collapsed by default when empty. When a note exists, it is shown inline (truncated if long, click to expand/edit).
- **D-14:** Other viewers' notes are displayed as read-only below the current viewer's own note field (e.g., "Anna: Buying this for Christmas").
- **D-15:** Update to `src/types/firestore.ts`: change `viewerNote?: string` to `viewerNotes?: Record<string, string>` in `PurchaseStatusDoc`.

### Activity Log
- **D-16:** Activity log is a **separate route**: `/viewer/[wishlistId]/activity`. A link in the viewer page header (e.g., "View activity") navigates to this page.
- **D-17:** Each log entry shows: viewer username, action ("marked purchased", "unmarked purchased", "added note"), item title, and timestamp. Ordered newest-first.
- **D-18:** Log entries are stored in `wishlists/{wishlistId}/activityLog/{entryId}` subcollection. Each entry: `{ viewerUid, action: string, itemId, itemTitle, timestamp }`. Written server-side when purchase status or notes change.

### Viewer Dashboard
- **D-19:** After login, a viewer is redirected to `/dashboard` (same route as the existing dashboard stub). For `role === 'viewer'`, the dashboard shows a **grid of wishlist cards** — one per wishlist they have access to.
- **D-20:** Each wishlist card in the grid shows: child's username/display name, total item count, number of items marked purchased, and a small thumbnail or placeholder. Clicking navigates to `/viewer/[wishlistId]`.
- **D-21:** The existing `/dashboard` stub is repurposed for viewer role. Child role users who land on `/dashboard` are redirected to `/wishlist`.

### Claude's Discretion
- Exact styling of purchased/unpurchased states on viewer cards
- Animation/transition for note expand/collapse
- Activity log pagination or infinite scroll
- Empty state for viewer dashboard (no wishlists yet)
- Error handling for invalid/expired invite tokens

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 4 success criteria (7 criteria, all must be met)
- `.planning/REQUIREMENTS.md` — SHARE-01, SHARE-02, SHARE-03, VIEW-01 through VIEW-07

### Schema & data model
- `src/types/firestore.ts` — `WishlistDoc` (viewerUids[]), `PurchaseStatusDoc` (viewerNote → viewerNotes), `InviteDoc` (token, active), `UserDoc` (role claims) — **D-15 requires updating PurchaseStatusDoc**
- `.planning/phases/01-foundation/01-CONTEXT.md` — Firestore collection hierarchy; share link redemption must use Admin SDK (not client SDK)

### Auth & API patterns
- `src/lib/firebase/admin.ts` — Admin SDK singleton; use for token redemption + setting viewer custom claim
- `src/lib/firebase/client.ts` — Client SDK; use for Firestore reads/writes in viewer UI
- `src/components/AuthProvider.tsx` — `useAuth()` provides `user`, `role`, `loading`; viewer role is `'viewer'`
- `src/app/api/auth/set-viewer-claim/` — Existing API route for setting viewer custom claim (Phase 2); reuse or extend for invite redemption

### Prior phase context
- `.planning/phases/03-child-wishlist/03-CONTEXT.md` — Card design, inline patterns, Tailwind conventions to match in viewer cards

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/AuthProvider.tsx` — `useAuth()` is ready with `user`, `role`, `loading`
- `src/components/wishlist/WishItemCard.tsx` — Existing card component to extend with purchase overlays (or use as visual reference for viewer card)
- `src/lib/firebase/admin.ts` — Admin SDK ready for invite redemption API route
- `src/app/api/auth/set-viewer-claim/` — Existing viewer claim API route (examine before creating new invite/redeem route)
- `src/app/dashboard/` — Dashboard stub to repurpose for viewer dashboard (D-19)
- `src/types/firestore.ts` — All types defined; `PurchaseStatusDoc` needs D-15 update

### Established Patterns
- App Router, TypeScript strict, `@/` path alias, Tailwind CSS
- Client components use `'use client'`; data fetching via Firestore SDK directly
- Auth redirect pattern: `useEffect` + `router.push(...)` on role check
- API routes use Admin SDK for privileged operations; never expose Admin SDK to client
- `onSnapshot` for real-time listeners (established in Phase 1, used in Phase 3)

### Integration Points
- `/invite/[token]` — new route for the join page (D-03)
- `/viewer/[wishlistId]` — new route for viewer's wishlist view (D-07)
- `/viewer/[wishlistId]/activity` — new route for activity log (D-16)
- `/dashboard` — repurposed for viewer grid, child redirected away (D-19, D-21)
- `/wishlist/[wishlistId]/settings` — new route for share link management (D-01, D-02)
- `wishlists/{id}/purchaseStatus/{itemId}` — viewer writes; child cannot read (Phase 1 rules)
- `wishlists/{id}/activityLog/{entryId}` — new subcollection for activity log (D-18)
- `invites/{token}` — API route reads/updates this for redemption + revocation

</code_context>

<specifics>
## Specific Ideas

- The join page (`/invite/[token]`) should feel welcoming — show the child's name and a clear call to action ("Join [child]'s wishlist"), with login and register options inline, not a cold redirect to `/login`.
- Viewer notes are per-viewer, not a shared thread — each person writes their own note. Other viewers' notes are read-only and displayed below for context.
- The viewer dashboard grid should look like a "My wishlists" screen — child name prominent, purchased count as a progress indicator.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 04-viewer-flow*
*Context gathered: 2026-04-09*
