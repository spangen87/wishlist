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
  duration: ~15min
  completed: 2026-04-09
  tasks: 2
  files: 5
requirements: [SHARE-01, SHARE-03, VIEW-06]
---

# Phase 04 Plan 05: Viewer Dashboard and Settings Summary

One-liner: Viewer multi-wishlist dashboard grid with real-time item/purchase counts, wishlist settings page with share link management (create, copy, regenerate), gear icon on child wishlist page, and role-based redirect guards completing the D-21 requirement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Viewer dashboard, WishlistDashboardCard, viewer redirect guard | 1df00fe | src/components/viewer/WishlistDashboardCard.tsx, src/app/dashboard/page.tsx, src/app/wishlist/page.tsx |
| 2 | Settings page and ShareLinkPanel | c29e04a | src/components/viewer/ShareLinkPanel.tsx, src/app/wishlist/[wishlistId]/settings/page.tsx, src/app/wishlist/page.tsx |

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

## Deviations from Plan

None — plan executed exactly as written.

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

Verification checks:
- WishlistDashboardCard Link to /viewer/${wishlist.id} — CONFIRMED
- grid grid-cols-1 sm:grid-cols-2 in dashboard — CONFIRMED (line 127)
- subscribeToViewerWishlists import in dashboard — CONFIRMED (line 8)
- "Inga önskelistor än" empty state — CONFIRMED (line 117)
- navigator.clipboard.writeText in ShareLinkPanel — CONFIRMED (line 68)
- use(params) in settings page — CONFIRMED (line 15)
- aria-label="Inställningar för önskelistan" in wishlist page — CONFIRMED (line 115)
- role === 'viewer' redirect in wishlist page — CONFIRMED (line 52)
- TypeScript: npx tsc --noEmit exits 0 — PASS
