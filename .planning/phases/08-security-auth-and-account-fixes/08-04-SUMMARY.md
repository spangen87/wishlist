---
plan: 08-04
phase: 08-security-auth-and-account-fixes
status: complete
completed: 2026-04-22
commits:
  - bf612cb
  - 2590b29
requirements-covered:
  - DEBT-01
  - DEBT-02
  - DEBT-04
---

## Summary

Mechanical cleanup: deleted test/debug page and empty offline dir, replaced fragile `_settingsFrozen` emulator guard with a module-level boolean, removed dead `updateWishlistTitle` function and unused `onEditStart` prop, and fixed stale register-child test assertions. All 17 Jest tests now pass (excluding firestore.rules which requires an emulator).

## What Was Built

**Task 1 — File deletions + client.ts fix (bf612cb):**
- `src/app/test/page.tsx`: deleted — /test route no longer accessible in production (DEBT-01)
- `src/app/offline/`: directory removed (was empty and untracked by git)
- `client.ts`: `_settingsFrozen` internal SDK check replaced with `let emulatorConnected = false` module-level boolean guard — no longer depends on undocumented Firebase internals (DEBT-04)

**Task 2 — Dead code + test fixes (2590b29):**
- `wishlist.ts`: `updateWishlistTitle` function deleted — no callers found (DEBT-02)
- `WishItemCard.tsx`: `onEditStart?: () => void` removed from `WishItemCardProps` — no callers (DEBT-06)
- `register-child.test.ts`: error string assertions updated to `'username, password, and displayName required'`; success-path payloads now include `displayName` and `age` so they actually reach the route's success path — all 8 tests now pass

## Key Files

- `src/lib/firebase/client.ts` — emulator boolean guard
- `src/lib/firebase/wishlist.ts` — updateWishlistTitle removed
- `src/components/wishlist/WishItemCard.tsx` — onEditStart removed
- `tests/api/auth/register-child.test.ts` — corrected assertions + payloads

## Deviations

- Test payloads in register-child.test.ts also needed `age` added (not just `displayName`) — the route validates both fields. The plan mentioned only the error string, but the payloads were also stale. Fixed as part of the same task.

## Self-Check: PASSED

- `test ! -f src/app/test/page.tsx` → success ✓
- `test ! -d src/app/offline` → success ✓
- `grep -n "emulatorConnected" src/lib/firebase/client.ts` → 3 matches ✓
- `grep -c "_settingsFrozen" src/lib/firebase/client.ts` → 0 ✓
- `grep -c "updateWishlistTitle" src/lib/firebase/wishlist.ts` → 0 ✓
- `grep -c "onEditStart" src/components/wishlist/WishItemCard.tsx` → 0 ✓
- `grep -c "username and password required" tests/api/auth/register-child.test.ts` → 0 ✓
- `grep -c "username, password, and displayName required" tests/api/auth/register-child.test.ts` → 3 ✓
- `npx jest --no-coverage --testPathIgnorePatterns="firestore.rules"` → 17 passed ✓
