---
plan: 08-03
phase: 08-security-auth-and-account-fixes
status: complete
completed: 2026-04-22
commits:
  - 29fdab3
  - e15b079
requirements-covered:
  - BUG-01
  - PERF-01
  - PERF-03
---

## Summary

Fixed four correctness/performance issues: BUG-01 (silent token failure causing orphaned child accounts), PERF-01 (unbounded dashboard Firestore listener leak), PERF-03 (broken fractional position string), PERF-04 (fragile onSnapshot+unsub race in activity pagination).

## What Was Built

**Task 1 — BUG-01 + PERF-03 (29fdab3):**
- `ChildAccountForm.tsx`: `getIdToken(true)` force-refreshes token; catch block shows Swedish error message and blocks form submission — prevents child accounts being created without parent link
- `add-item/route.ts`: import `generateKeyBetween`; replace `position + '|z'` with `generateKeyBetween(lastPos, null)` for valid fractional keys
- `add-item.test.ts`: mock `fractional-indexing` (ESM package not transformable by ts-jest) — tests remain 4/4 GREEN

**Task 2 — PERF-01 + PERF-04 (e15b079):**
- `dashboard/page.tsx`: `statsUnsubsRef = useRef(new Map())` tracks all per-wishlist stats unsubscribers; `subscribeToStatsTracked()` deduplicates by id; cleanup `return` calls `statsUnsubsRef.current.forEach(unsub => unsub())` on unmount
- `viewer.ts`: exported `getActivityLogPage()` using `getDocs` for one-shot paginated reads (no persistent listener)
- `activity/page.tsx`: `loadMore()` now async, calls `getActivityLogPage()` instead of `onSnapshot+unsub()` race

## Key Files

- `src/components/onboarding/ChildAccountForm.tsx` — loud token failure (BUG-01)
- `src/app/api/wishlist/add-item/route.ts` — fractional position fix (PERF-03)
- `src/app/dashboard/page.tsx` — listener leak fix (PERF-01)
- `src/lib/firebase/viewer.ts` — getActivityLogPage (PERF-04)
- `src/app/viewer/[wishlistId]/activity/page.tsx` — loadMore using getDocs (PERF-04)

## Deviations

- `add-item.test.ts` required an additional `jest.mock('fractional-indexing')` to handle the ESM package — not mentioned in the plan but necessary to keep tests GREEN after adding the import.

## Self-Check: PASSED

- `grep "getIdToken(true)" src/components/onboarding/ChildAccountForm.tsx` → match ✓
- `grep -c "catch(() => undefined)" src/components/onboarding/ChildAccountForm.tsx` → 0 ✓
- `grep "generateKeyBetween" src/app/api/wishlist/add-item/route.ts` → match ✓
- `grep "statsUnsubsRef" src/app/dashboard/page.tsx` → 4 matches (decl + check + set + forEach + clear) ✓
- `grep "getActivityLogPage" src/lib/firebase/viewer.ts` → match ✓
- `grep -rn "getActivityLogPage" src/app/viewer/` → match in activity/page.tsx ✓
- TypeScript (`npx tsc --noEmit --skipLibCheck`) → 0 source errors ✓
- `npx jest tests/api/wishlist/add-item.test.ts --no-coverage` → 4 passed ✓
