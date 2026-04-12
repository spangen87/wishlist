---
phase: 04-viewer-flow
plan: 03
subsystem: viewer-ui
tags: [viewer, purchase-toggle, real-time, api-route, components]
dependency_graph:
  requires: [04-01]
  provides: [viewer-wishlist-page, mark-purchased-api, viewer-card-components]
  affects: [04-04, 04-05]
tech_stack:
  added: []
  patterns: [Admin SDK batch write, parallel onSnapshot subscriptions, use(params) Next.js 16 pattern]
key_files:
  created:
    - src/app/api/viewer/mark-purchased/route.ts
    - src/components/viewer/PurchasedBadge.tsx
    - src/components/viewer/ViewerWishItemCard.tsx
    - src/app/viewer/[wishlistId]/page.tsx
  modified: []
decisions:
  - "idToken sent per-request from client (auth.currentUser?.getIdToken()) — never cached — ensures always fresh token"
  - "display name lookup cached in local Map state to avoid redundant Firestore reads within session"
  - "ViewerWishItemCard receives toggle callback from parent (not self-contained fetch) to keep component pure"
metrics:
  duration: ~15min
  completed: 2026-04-09
  tasks: 2
  files: 4
---

# Phase 04 Plan 03: Viewer Wishlist Page and Purchase Toggle Summary

One-liner: Viewer page at /viewer/[wishlistId] with parallel real-time subscriptions, ViewerWishItemCard with purchase toggle, PurchasedBadge, and mark-purchased API route that atomically writes purchaseStatus + activityLog via Admin SDK batch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement POST /api/viewer/mark-purchased and viewer components | f023ef4 | src/app/api/viewer/mark-purchased/route.ts, src/components/viewer/PurchasedBadge.tsx, src/components/viewer/ViewerWishItemCard.tsx |
| 2 | Build /viewer/[wishlistId] page | 7856c66 | src/app/viewer/[wishlistId]/page.tsx |

## What Was Built

### mark-purchased API Route (src/app/api/viewer/mark-purchased/route.ts)
- Verifies caller identity via `adminAuth.verifyIdToken(idToken)` (T-04-14)
- Checks caller is in `wishlistDoc.viewerUids` — returns 403 if not (T-04-15)
- Uses `adminDb.batch()` to atomically write purchaseStatus + activityLog (T-04-16)
- Mark: `batch.set(statusRef, { purchasedBy, purchasedAt: serverTimestamp() }, { merge: true })`
- Unmark: `batch.update(statusRef, { purchasedBy: FieldValue.delete(), purchasedAt: FieldValue.delete() })`
- Activity log always written: `action: 'marked_purchased' | 'unmarked_purchased'`

### PurchasedBadge (src/components/viewer/PurchasedBadge.tsx)
- Inline badge with italic text
- "Markerad som köpt av dig" for own purchase, "Köpt av [namn]" for others

### ViewerWishItemCard (src/components/viewer/ViewerWishItemCard.tsx)
- Title struck through (`line-through text-[#6B7280]`) when purchased
- Three toggle states: unchecked (white), own-checked (orange), other-checked (disabled opacity-50)
- `aria-label` pattern: "Markera [titel] som köpt" / "Avmarkera [titel]"
- Toggle disabled + cursor-not-allowed when another viewer has purchased
- Error feedback via role="alert" paragraph on toggle failure
- 64px thumbnail with fallback placeholder

### Viewer Page (src/app/viewer/[wishlistId]/page.tsx)
- Next.js 16 `use(params)` pattern for dynamic route params in client component
- Auth guards: unauthenticated → /login, role === 'child' → /wishlist (D-07, T-04-18)
- Parallel subscriptions: `subscribeToItems` + `subscribeToPurchaseStatus`
- Display name lookup from `users/{uid}` collection, cached in `Map<string, string>` state
- Link to `/viewer/${wishlistId}/activity` with text "Visa aktivitetslogg"
- `auth.currentUser?.getIdToken()` called per-toggle (fresh token, never cached)
- LoadingSkeleton shown while auth or data loading

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully wired to real Firestore data via subscriptions.

## Threat Flags

No new security surface introduced beyond what is modeled in the plan's threat register.

## Self-Check: PASSED

Files created:
- src/app/api/viewer/mark-purchased/route.ts — FOUND
- src/components/viewer/PurchasedBadge.tsx — FOUND
- src/components/viewer/ViewerWishItemCard.tsx — FOUND
- src/app/viewer/[wishlistId]/page.tsx — FOUND

Commits verified:
- f023ef4 — feat(04-03): implement mark-purchased API route and viewer card components
- 7856c66 — feat(04-03): build /viewer/[wishlistId] page with real-time subscriptions

TypeScript: npx tsc --noEmit exits 0 — PASS

Verification checks:
- adminDb.batch() — CONFIRMED in mark-purchased route
- aria-label pattern — CONFIRMED in ViewerWishItemCard
- role === 'child' redirect guard — CONFIRMED in page
- subscribeToPurchaseStatus + subscribeToItems — CONFIRMED in page
