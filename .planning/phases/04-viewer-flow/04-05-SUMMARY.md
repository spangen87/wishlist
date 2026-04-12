---
phase: 04-viewer-flow
plan: 05
subsystem: viewer-dashboard-and-settings
tags: [viewer, dashboard, settings, share-link, components]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides: [viewer-dashboard-grid, wishlist-dashboard-card, settings-page, share-link-panel]
  affects: []
tech_stack:
  added: []
  patterns: [parallel onSnapshot subscriptions for stats, use(params) Next.js 16, navigator.clipboard.writeText, inline regenerate confirmation]
key_files:
  created:
    - src/components/viewer/WishlistDashboardCard.tsx
    - src/components/viewer/ShareLinkPanel.tsx
    - src/app/wishlist/[wishlistId]/settings/page.tsx
  modified:
    - src/app/dashboard/page.tsx
    - src/app/wishlist/page.tsx
decisions:
  - "Dashboard uses parallel onSnapshot subscriptions (items + purchaseStatus) per wishlist for real-time stats without composite queries"
  - "fetchChildName uses useCallback with childNames in deps — stable reference, prevents re-fetch on every render"
  - "Settings page redirects non-owners (data.childUid !== user.uid) to /dashboard — T-04-27 mitigated"
  - "ShareLinkPanel handles all API calls internally — parent only passes pre-resolved viewer list"
metrics:
  duration: ~30min
  completed: 2026-04-09
  tasks: 3
  files: 9
requirements: [SHARE-01, SHARE-03, VIEW-06]
---

# Phase 04 Plan 05: Viewer Dashboard and Settings Summary

One-liner: Viewer multi-wishlist dashboard grid with real-time item/purchase counts, wishlist settings page with share link management (create, copy, regenerate), gear icon on child wishlist page, role-based redirect guards completing D-21, plus 4 UAT-discovered bugs fixed (FieldPath for nested writes, self-invite guard, Firestore rules for collection queries and user reads, and viewer nav link).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Viewer dashboard, WishlistDashboardCard, viewer redirect guard | 1df00fe | src/components/viewer/WishlistDashboardCard.tsx, src/app/dashboard/page.tsx, src/app/wishlist/page.tsx |
| 2 | Settings page and ShareLinkPanel | c29e04a | src/components/viewer/ShareLinkPanel.tsx, src/app/wishlist/[wishlistId]/settings/page.tsx, src/app/wishlist/page.tsx |
| 3 | Checkpoint: E2E viewer flow UAT — 7 flows verified, 4 bugs fixed | af30bf6 | firestore.rules, src/app/api/invite/redeem/route.ts, src/app/api/viewer/update-note/route.ts, src/app/viewer/[wishlistId]/page.tsx |

## What Was Built

### WishlistDashboardCard (src/components/viewer/WishlistDashboardCard.tsx)
- Renders as a Next.js `<Link>` to `/viewer/${wishlist.id}` — entire card is clickable
- Child name at `text-xl font-semibold text-[#171717]`
- Counts line: "X önskemål · Y av Z köpta" in `text-sm text-[#6B7280]`
- Soft peach card: `bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm hover:shadow-md`

### Dashboard Page (src/app/dashboard/page.tsx)
- Replaced old email/role stub with role-aware layout
- `viewer` role: subscribes via `subscribeToViewerWishlists`, shows CSS grid (`grid-cols-1 sm:grid-cols-2`)
- Per-wishlist stats via parallel `onSnapshot` on `items` and `purchaseStatus` subcollections
- Child name resolved from `users/{childUid}` doc, cached in `Map<string, string>` state
- Empty state: "Inga önskelistor än" heading + explanation copy (VIEW-06)
- `child` role → redirects to `/wishlist` (D-21)
- No auth → redirects to `/login`

### Wishlist Page (src/app/wishlist/page.tsx)
- Added `role` to `useAuth()` destructuring
- New `useEffect` guard: `role === 'viewer'` → redirects to `/dashboard` (D-21, D-07)
- Gear icon `<a>` link with `aria-label="Inställningar för önskelistan"` in header next to "Din önskelista" heading

### ShareLinkPanel (src/components/viewer/ShareLinkPanel.tsx)
- Fetches current active token from `GET /api/invite/current` on mount
- No active token: shows "Skapa delningslänk" button → calls `POST /api/invite/create`
- Active token: read-only input with invite URL + "Kopiera länk" accent button
- Copy success: label changes to "Kopierat!" for 2 seconds via `setTimeout` (D-11)
- Regenerate: outline-style button (not accent) → inline confirmation with `role="alert"`
- Confirmation: "Gamla länken slutar fungera. Fortsätt?" + "Ja, generera ny länk" (DC2626 red) + "Avbryt"
- Viewer list: "Betraktare (X)" subheading, rendered when `viewers.length > 0`

### Settings Page (src/app/wishlist/[wishlistId]/settings/page.tsx)
- Client component using `use(params)` for Next.js 16 dynamic params
- Auth guard: unauthenticated → `/login`
- Ownership guard: `data.childUid !== user.uid` → `/dashboard` (T-04-27)
- Resolves viewer display names from `users/{uid}` docs in parallel via `Promise.all`
- Renders `<ShareLinkPanel wishlistId={wishlistId} viewers={viewers} />`
- Back link: "← Tillbaka till önskelistan" → `/wishlist`

## UAT Verification (Task 3 Checkpoint)

User tested 7 E2E flows and approved. Minor observations:
- **OtherViewerNotes shows email as display name for viewer accounts** — acceptable behavior; viewer accounts use email as their display name string.
- **Self-invite guard returns 409** — invite page surfaces this with a user-facing message. Working as designed.

## Post-Checkpoint Bug Fixes (af30bf6)

Four bugs were discovered during UAT and fixed:

**1. [Rule 1 - Bug] update-note: FieldPath required for nested viewerNotes write**
- **Found during:** UAT flow 4 (viewer leaves a note)
- **Issue:** Using a dotted-path string key with `set+merge` stores a literal field named `"viewerNotes.uid"` rather than writing into the nested `viewerNotes` map. Notes were not appearing in `ViewerWishItemCard`.
- **Fix:** Switched to `new FieldPath('viewerNotes', uid)` in `update-note/route.ts` so the write correctly targets the nested path.
- **Files modified:** `src/app/api/viewer/update-note/route.ts`
- **Committed in:** af30bf6

**2. [Rule 2 - Missing Critical] redeem: self-invite guard (409 if childUid === caller uid)**
- **Found during:** UAT flow testing self-invite scenario
- **Issue:** A child could redeem their own invite link, adding themselves as a viewer of their own wishlist.
- **Fix:** Added guard in `POST /api/invite/redeem` — returns 409 if `childUid === caller uid`. Invite page surfaces this with a message.
- **Files modified:** `src/app/api/invite/redeem/route.ts`
- **Committed in:** af30bf6

**3. [Rule 1 - Bug] firestore.rules: use resource.data for collection query; allow authenticated user reads**
- **Found during:** UAT flow 1 (viewer dashboard loading)
- **Issue 1:** `isViewer()` and `isOwner()` helpers used `get()` which Firestore rejects for collection queries — viewer dashboard returning no wishlists.
- **Issue 2:** `users/{uid}` collection was not readable by authenticated users — viewers could not resolve child display names (showed UID instead of name).
- **Fix:** Rewrote wishlist read rule to use `resource.data` directly for collection queries; added `allow read: if request.auth != null` to the users collection rule.
- **Files modified:** `firestore.rules`
- **Committed in:** af30bf6

**4. [Rule 2 - Missing Critical] viewer page: "← Mina önskelistor" nav link added**
- **Found during:** UAT flow 2 (viewer navigating back from wishlist view)
- **Issue:** Viewer had no navigation path back to their dashboard from `/viewer/[wishlistId]`.
- **Fix:** Added "← Mina önskelistor" link to `/dashboard` in the viewer page header.
- **Files modified:** `src/app/viewer/[wishlistId]/page.tsx`
- **Committed in:** af30bf6

---

**Total deviations:** 4 auto-fixed post-UAT (2 bugs, 2 missing critical)
**Impact on plan:** All fixes necessary for correctness and usability. No scope creep.

## Deviations from Plan (Pre-UAT)

None — Tasks 1 and 2 executed exactly as written.

## Known Stubs

None — all components are wired to real API routes and Firestore data.

## Threat Flags

No new security surface beyond the plan's threat register. T-04-27 (settings page non-owner redirect) and T-04-28 (GET /api/invite/current bearer token) are mitigated as designed.

## Self-Check: PASSED

Files created/exist:
- src/components/viewer/WishlistDashboardCard.tsx — FOUND
- src/components/viewer/ShareLinkPanel.tsx — FOUND
- src/app/wishlist/[wishlistId]/settings/page.tsx — FOUND

Files modified:
- src/app/dashboard/page.tsx — FOUND (subscribeToViewerWishlists + grid layout)
- src/app/wishlist/page.tsx — FOUND (role guard + gear icon)

Commits verified:
- 1df00fe — feat(04-05): viewer dashboard grid, WishlistDashboardCard, viewer redirect guard
- c29e04a — feat(04-05): settings page, ShareLinkPanel, gear icon on wishlist page
- af30bf6 — fix(04-05): resolve 4 UAT issues from viewer flow verification

Post-UAT fix files verified:
- firestore.rules — FOUND (resource.data direct rule + users authenticated read)
- src/app/api/invite/redeem/route.ts — FOUND (self-invite 409 guard)
- src/app/api/viewer/update-note/route.ts — FOUND (FieldPath for nested write)
- src/app/viewer/[wishlistId]/page.tsx — FOUND ("← Mina önskelistor" nav link)

Verification checks:
- WishlistDashboardCard Link to /viewer/${wishlist.id} — CONFIRMED
- grid grid-cols-1 sm:grid-cols-2 in dashboard — CONFIRMED (line 127)
- subscribeToViewerWishlists import in dashboard — CONFIRMED (line 8)
- "Inga önskelistor än" empty state — CONFIRMED (line 117)
- navigator.clipboard.writeText in ShareLinkPanel — CONFIRMED (line 68)
- use(params) in settings page — CONFIRMED (line 15)
- aria-label="Inställningar för önskelistan" in wishlist page — CONFIRMED (line 115)
- role === 'viewer' redirect in wishlist page — CONFIRMED (line 52)
- UAT: 7 flows tested and approved by user — CONFIRMED
- TypeScript: npx tsc --noEmit exits 0 — PASS
