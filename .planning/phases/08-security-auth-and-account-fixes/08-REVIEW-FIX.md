---
phase: 08-security-auth-and-account-fixes
fixed_at: 2026-04-22T00:00:00Z
review_path: .planning/phases/08-security-auth-and-account-fixes/08-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-04-22
**Source review:** .planning/phases/08-security-auth-and-account-fixes/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `useCallback` captures stale `displayNames` — activity log re-subscribes on every name fetch

**Files modified:** `src/app/viewer/[wishlistId]/activity/page.tsx`
**Commit:** 2b3124f
**Applied fix:** Added `useRef` import and declared `fetchedNamesRef = useRef(new Set<string>())`. Replaced the `displayNames.has(uid)` state-based guard with `fetchedNamesRef.current.has(uid)` so the deduplication set is stable across renders. Changed `useCallback` deps from `[displayNames]` to `[]`. Removed `fetchDisplayName` from the `useEffect` dependency array and added an `eslint-disable-next-line react-hooks/exhaustive-deps` comment matching the pattern used in `dashboard/page.tsx`.

---

### WR-02: `getIdToken()` without force-refresh on account deletion path

**Files modified:** `src/app/dashboard/page.tsx`
**Commit:** 3877839
**Applied fix:** Extracted the token fetch into its own `try/catch` block that calls `auth.currentUser?.getIdToken(true)` (force-refresh). On token failure the user receives an `alert` explaining the session has expired and the function returns early. The outer `catch` that previously silently swallowed delete failures now surfaces an `alert` to the user.

---

### WR-03: `updateWishItem` passes `undefined` fields to Firestore `updateDoc` — may silently delete data

**Files modified:** `src/lib/firebase/wishlist.ts`
**Commit:** 43938ce
**Applied fix:** Added `deleteField` to the `firebase/firestore` import. Before calling `updateDoc`, the function now iterates `Object.entries(changes)` and builds a `firestoreChanges` record where any `undefined` value is replaced with `deleteField()`. This ensures that callers who set a field to `undefined` (e.g. clearing a product URL) produce an actual Firestore field deletion rather than a silent no-op.

---

_Fixed: 2026-04-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
