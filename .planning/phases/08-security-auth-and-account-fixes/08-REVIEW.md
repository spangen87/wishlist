---
phase: 08-security-auth-and-account-fixes
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - firestore.rules
  - next.config.ts
  - src/app/api/wishlist/add-item/route.ts
  - src/app/dashboard/page.tsx
  - src/app/viewer/[wishlistId]/activity/page.tsx
  - src/components/onboarding/ChildAccountForm.tsx
  - src/components/viewer/ViewerWishItemCard.tsx
  - src/components/wishlist/WishItemCard.tsx
  - src/lib/firebase/client.ts
  - src/lib/firebase/viewer.ts
  - src/lib/firebase/wishlist.ts
  - tests/api/auth/register-child.test.ts
  - tests/api/wishlist/add-item.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 08 delivers meaningful security improvements: Firestore rule tightening (wishlist create ownership, purchaseStatus write constraint), HTTP security headers, and XSS URL-scheme validation across the API route and client libraries. The implementation is generally sound. No critical vulnerabilities were found.

Three warnings require attention before merging:

1. `activity/page.tsx` has a `useCallback` dependency bug that causes the activity log listener to re-subscribe on every display-name resolution — a live subscription leak.
2. `dashboard/page.tsx` calls `getIdToken()` without force-refresh on the account-deletion path, silently passing a potentially stale token that results in a hard-to-diagnose 401 — inconsistent with the `getIdToken(true)` fix applied elsewhere in this phase.
3. `wishlist.ts`'s `updateWishItem` passes `undefined` values to Firestore `updateDoc`, which may silently delete fields rather than leave them unchanged depending on SDK serialisation behaviour.

---

## Warnings

### WR-01: `useCallback` captures stale `displayNames` — activity log re-subscribes on every name fetch

**File:** `src/app/viewer/[wishlistId]/activity/page.tsx:33-59`

**Issue:** `fetchDisplayName` is memoised with `useCallback` and lists `displayNames` in its dependency array (line 45). Every time a new display name is resolved and written to state, `displayNames` changes, producing a new `fetchDisplayName` reference. Because `fetchDisplayName` is listed as a dependency of the `useEffect` that calls `subscribeToActivityLog` (line 59), the subscription is torn down and re-created on every name resolution. For a list of 50 entries this means up to 50 consecutive re-subscriptions, each triggering another round of name fetches.

The deduplication guard `if (displayNames.has(uid)) return;` only partially mitigates this: the guard checks the Map captured at the time the callback was created, which may lag behind the current state, causing redundant Firestore reads.

**Fix:** Use a stable ref for the "already fetched" set (as `dashboard/page.tsx` does with `fetchedNamesRef`) and remove `displayNames` from the `useCallback` dependency array:

```tsx
const fetchedNamesRef = useRef(new Set<string>());

const fetchDisplayName = useCallback(async (uid: string) => {
  if (fetchedNamesRef.current.has(uid)) return;
  fetchedNamesRef.current.add(uid);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      const name: string = data.username ?? data.email ?? uid;
      setDisplayNames((prev) => new Map(prev).set(uid, name));
    }
  } catch {
    // silent — fallback to uid
  }
}, []); // no deps — uses ref, not state
```

Remove `fetchDisplayName` from the `useEffect` dependency array (add the same eslint-disable comment pattern used in `dashboard/page.tsx` line 118).

---

### WR-02: `getIdToken()` without force-refresh on account deletion path

**File:** `src/app/dashboard/page.tsx:134`

**Issue:** The `handleDeleteSelf` function calls `auth.currentUser?.getIdToken()` (no arguments), which returns a cached token that may be up to an hour stale. The delete endpoint performs server-side token verification; a stale token will cause a 401 that is silently swallowed by the empty `catch` block (line 143). The user sees no feedback and their account is not deleted.

This is directly inconsistent with the stated phase goal "getIdToken(true) for loud token failure" — `ChildAccountForm.tsx` (line 44) correctly uses `getIdToken(true)` and surfaces a user-visible error. The same pattern should be applied here.

**Fix:**
```tsx
// line 134 — before
const idToken = await auth.currentUser?.getIdToken();

// after
let idToken: string | undefined;
try {
  idToken = await auth.currentUser?.getIdToken(true);
} catch {
  // Surface error to user — silent fail hides token expiry
  alert('Sessionen har gått ut. Logga ut och logga in igen.');
  return;
}
```

The empty outer `catch` at line 143 should also surface an error to the user (a toast or `alert`) so failures are not invisible.

---

### WR-03: `updateWishItem` passes `undefined` fields to Firestore `updateDoc` — may silently delete data

**File:** `src/lib/firebase/wishlist.ts:66-78`

**Issue:** `updateWishItem` accepts a `Partial<...>` `changes` object and passes it directly to `updateDoc`. When the caller (e.g. `WishItemCard.tsx` line 86-92) sets `productUrl: undefined` or `imageUrl: undefined` to clear a field, the Firestore JS SDK (v9+) does **not** treat `undefined` as `FieldValue.deleteField()` by default — the behaviour depends on whether `ignoreUndefinedProperties` is set in the Firestore initialisation config. Without that setting, passing `undefined` for a field in `updateDoc` is silently dropped and the existing field value is preserved, which is the opposite of what the caller intends (clearing the URL).

Concretely: a user who removes a product URL in the edit form will appear to see it gone (optimistic UI) but the value will persist in Firestore and reappear on next page load.

**Fix:** Strip `undefined` values before the Firestore write, using explicit `FieldValue.deleteField()` for fields the caller wants cleared:

```ts
import { updateDoc, doc, deleteField } from 'firebase/firestore';

export async function updateWishItem(
  wishlistId: string,
  itemId: string,
  changes: Partial<Omit<WishItemDoc, 'id' | 'createdAt' | 'position'>>
): Promise<void> {
  // ... URL validation ...

  // Convert undefined to deleteField() so clearing a field actually persists
  const firestoreChanges: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    firestoreChanges[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(doc(db, 'wishlists', wishlistId, 'items', itemId), firestoreChanges);
}
```

---

## Info

### IN-01: `console.warn` left in production path

**File:** `src/lib/firebase/wishlist.ts:94`

**Issue:** `console.warn('[wishlist] Skipping reorder — adjacent positions are equal:', prevPos)` logs to the browser console in production. This leaks implementation detail and adds noise.

**Fix:** Remove the `console.warn` call entirely, or wrap it in a dev-only guard:
```ts
if (process.env.NODE_ENV !== 'production') {
  console.warn('[wishlist] Skipping reorder — adjacent positions are equal:', prevPos);
}
```

---

### IN-02: `<img>` used instead of `next/image` in two card components

**File:** `src/components/viewer/ViewerWishItemCard.tsx:136` and `src/components/wishlist/WishItemCard.tsx:265`

**Issue:** Both components render product thumbnails with a plain `<img>` tag. Next.js recommends `next/image` for automatic optimisation, lazy loading, and to avoid layout shifts. The project's skill guidance (`SKILL.md` for the nextjs skill) flags this as a code quality convention.

**Fix:** Replace both instances with `<Image>` from `next/image`:
```tsx
import Image from 'next/image';
// ...
<Image
  src={item.imageUrl}
  alt={item.title}
  width={64}
  height={64}
  className="w-16 h-16 rounded-md object-cover"
/>
```
Remote image domains must be added to `next.config.ts` under `images.remotePatterns`.

---

### IN-03: `price` not validated as non-negative in add-item route

**File:** `src/app/api/wishlist/add-item/route.ts:93`

**Issue:** The route accepts any numeric `price` value, including negative numbers. A parent could submit `price: -500`, which would be stored and displayed to the child.

**Fix:**
```ts
if (typeof price === 'number' && !isNaN(price) && price >= 0) itemData.price = price;
```

---

### IN-04: Weak positive assertions in add-item tests

**File:** `tests/api/wishlist/add-item.test.ts:117-133`

**Issue:** The two "happy path" tests use negative assertions (`not.toBe(400)`, `not.toMatch(/must start with/)`) rather than asserting the expected success status. A route that returns 500 or 403 would pass these tests undetected.

**Fix:**
```ts
// line 124 — replace:
expect(res.status).not.toBe(400);
// with:
expect(res.status).toBe(201);

// line 131-133 — replace the body check:
const body = await res.json();
expect(body.ok).toBe(true);
```

---

### IN-05: Duplicate `firebase/auth` import statements in client.ts

**File:** `src/lib/firebase/client.ts:3-4`

**Issue:** `getAuth` and `connectAuthEmulator` are each imported in separate `import` statements from `'firebase/auth'`. This is a style inconsistency that can confuse readers.

**Fix:** Merge into a single import:
```ts
import { getAuth, connectAuthEmulator } from 'firebase/auth';
```

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
