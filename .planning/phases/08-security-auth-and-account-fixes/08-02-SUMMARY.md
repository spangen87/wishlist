---
plan: 08-02
phase: 08-security-auth-and-account-fixes
status: complete
completed: 2026-04-22
commits:
  - d806453
  - f3d7a02
requirements-covered:
  - SEC-02
---

## Summary

Blocked stored XSS via javascript:/data: URIs in productUrl and imageUrl fields. Added SAFE_URL_PREFIXES validation at the server-side add-item API route, the client-side addWishItem/updateWishItem write paths, and isSafeUrl render guards in both card components. All 4 TDD tests GREEN.

## What Was Built

**Task 1 — RED test scaffold (d806453):**
- `tests/api/wishlist/add-item.test.ts`: 4 tests covering javascript: and data: rejection, https:// acceptance, absent URL passthrough. Initially RED (2 failing) before production code.

**Task 2 — Production SEC-02 code (f3d7a02):**
- `src/app/api/wishlist/add-item/route.ts`: `SAFE_URL_PREFIXES` block returns 400 for unsafe productUrl/imageUrl before any Firestore write
- `src/lib/firebase/wishlist.ts`: `addWishItem` and `updateWishItem` both throw on unsafe URL schemes (child direct write path)
- `src/components/wishlist/WishItemCard.tsx`: `isSafeUrl()` helper at module scope; render guard on productUrl anchor; handleSave URL validation with Swedish error messages
- `src/components/viewer/ViewerWishItemCard.tsx`: `isSafeUrl()` helper + render guard on productUrl anchor

## Key Files

- `src/app/api/wishlist/add-item/route.ts` — server-side URL scheme gate
- `src/lib/firebase/wishlist.ts` — client-side URL scheme gate (addWishItem + updateWishItem)
- `src/components/wishlist/WishItemCard.tsx` — isSafeUrl render guard + handleSave validation
- `src/components/viewer/ViewerWishItemCard.tsx` — isSafeUrl render guard
- `tests/api/wishlist/add-item.test.ts` — 4 SEC-02 tests (all GREEN)

## Deviations

None. All changes implemented exactly as specified in the plan.

## Self-Check: PASSED

- `npx jest tests/api/wishlist/add-item.test.ts --no-coverage` → 4 passed ✓
- `grep "SAFE_URL_PREFIXES" src/app/api/wishlist/add-item/route.ts` → match ✓
- `grep "SAFE_URL_PREFIXES" src/lib/firebase/wishlist.ts` → match in addWishItem + updateWishItem ✓
- `grep "isSafeUrl" src/components/wishlist/WishItemCard.tsx` → match ✓
- `grep "isSafeUrl" src/components/viewer/ViewerWishItemCard.tsx` → match ✓
- TypeScript (`npx tsc --noEmit --skipLibCheck`) → 0 source errors ✓
