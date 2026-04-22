---
plan: 08-01
phase: 08-security-auth-and-account-fixes
status: complete
completed: 2026-04-22
commits:
  - 57a8dda
  - 6fad943
requirements-covered:
  - SEC-01
  - SEC-03
  - DEBT-07
---

## Summary

Tightened Firestore security rules (SEC-01 + purchaseStatus) and added HTTP security headers (SEC-03). Fixed getOrCreateWishlist to include parentUids: [] so child first-login does not break under the new rule (DEBT-07).

## What Was Built

**Task 1 — Firestore rules (57a8dda):**
- Wishlist `allow create` now requires `auth.uid == request.resource.data.childUid` AND `viewerUids == []` AND `parentUids == []` — forged docs rejected
- purchaseStatus split into read/write; write requires `purchasedBy == auth.uid || purchasedBy == null` — claim theft blocked

**Task 2 — HTTP headers + wishlist fix (6fad943):**
- `next.config.ts`: `async headers()` injects X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, and a CSP including `wss://*.firebaseio.com` on all routes
- `src/lib/firebase/wishlist.ts`: `getOrCreateWishlist` setDoc now includes `parentUids: []` so new child docs satisfy the tightened create rule

## Key Files

- `firestore.rules` — tightened wishlist create + purchaseStatus write rules
- `next.config.ts` — security headers on all routes
- `src/lib/firebase/wishlist.ts` — getOrCreateWishlist with parentUids: []

## Deviations

None. All changes implemented exactly as specified in the plan.

## Self-Check: PASSED

- `grep "request.auth.uid == request.resource.data.childUid" firestore.rules` → match ✓
- `grep "request.resource.data.purchasedBy == request.auth.uid" firestore.rules` → match ✓
- `grep "parentUids: \[\]" src/lib/firebase/wishlist.ts` → match ✓
- `grep "X-Frame-Options" next.config.ts` → match ✓
- `grep "wss://\*\.firebaseio\.com" next.config.ts` → match ✓
- TypeScript (`npx tsc --noEmit --skipLibCheck`) → 0 errors ✓
