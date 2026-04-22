# Concerns & Technical Debt
_Last updated: 2026-04-22_

## Summary

The codebase is well-structured for its scope — a small Firebase/Next.js wishlist app with clear separation between server-side Admin SDK routes and client-side Firestore listeners. Privacy boundaries (child cannot read purchase status) are correctly enforced in both Firestore rules and API routes, and the pattern of passing `idToken` in request bodies (rather than via cookies or Authorization headers on most mutation routes) is intentional and consistent. The main concerns are: (1) an overly permissive Firestore `create` rule on the wishlists collection, (2) unvalidated `productUrl`/`imageUrl` fields that enable stored XSS via `javascript:` URIs, (3) complete absence of rate limiting on any API route, (4) a test page left in production, (5) a fragile position-string fallback in the parent add-item route, and (6) several patterns of silent failure that hide errors from users. No secrets are hardcoded; dependency versions are all recent.

---

## Security Concerns

### 1. Overly Permissive Wishlist Create Rule
- **Risk:** Any authenticated user can create a wishlist document for any ID, including overwriting another user's `childUid` field (since `allow create` does not check that `request.auth.uid == wishlistId` or that the document doesn't exist).
- **File:** `firestore.rules` line 40
- **Current rule:** `allow create: if isAuthenticated();`
- **Impact:** An authenticated attacker could create a wishlist document with `childUid` pointing to a victim's UID and `viewerUids: [attacker_uid]`, granting themselves access to the victim's items subcollection. This bypasses the read gate on line 34–39, which relies on `resource.data.childUid` — but for a newly created document the attacker controls the data.
- **Fix:** Change to `allow create: if isAuthenticated() && request.auth.uid == request.resource.data.childUid && request.resource.data.viewerUids == [] && request.resource.data.parentUids == [];`

### 2. Unvalidated `productUrl` and `imageUrl` Allow Stored XSS
- **Risk:** Both `productUrl` and `imageUrl` are stored without URL scheme validation. An attacker with child or parent access can store `javascript:alert(1)` as a `productUrl`. This is rendered as an `<a href={item.productUrl}>` anchor without sanitisation.
- **Files:**
  - `src/components/wishlist/WishItemCard.tsx` line 233
  - `src/components/viewer/ViewerWishItemCard.tsx` line 71
  - `src/app/api/wishlist/add-item/route.ts` lines 70–71 (no scheme check)
- **Impact:** Any viewer opening the wishlist would execute attacker-controlled JavaScript in their browser session. The `imageUrl` field is rendered via `<img src={item.imageUrl}>` — no XSS vector there, but it can be used to exfiltrate user IP via pixel tracking.
- **Fix:** Validate that `productUrl` and `imageUrl` start with `https://` or `http://` server-side in the API route before writing to Firestore. On the client, additionally add `rel="noopener noreferrer"` (already present) and consider using a URL whitelist or scheme check before rendering as `href`.

### 3. Child Password Transmitted in Plain JSON to API Route
- **Risk:** The child account password is sent as a plain JSON string in the request body to `/api/auth/register-child`. While this is over HTTPS in production, this is a design that exposes the password to any logging middleware, server-side error reporting, or future request-body inspection.
- **File:** `src/components/onboarding/ChildAccountForm.tsx` lines 42–53; `src/app/api/auth/register-child/route.ts` lines 8–11
- **Impact:** Logging of request bodies (e.g. if a third-party APM were added) would capture plaintext passwords.
- **Recommendation:** Create child accounts by calling Firebase Auth directly from the client (same as viewer registration in `src/app/register/page.tsx`), then call a server route with only the idToken to write the username/profile docs.

### 4. No Rate Limiting on Any API Route
- **Risk:** All API routes under `src/app/api/` are unprotected against brute force and abuse.
- **Files:** All routes in `src/app/api/auth/register-child/route.ts`, `src/app/api/invite/redeem/route.ts`, etc.
- **Impact:**
  - `/api/auth/register-child` can be abused to enumerate username availability or create thousands of accounts.
  - `/api/invite/redeem` can be called rapidly to probe token values (though tokens are 48-hex cryptographically random, so practical risk is low).
- **Fix:** Add Vercel's Edge Middleware rate limiter, or use a simple in-memory counter with a sliding window for the registration and invite endpoints.

### 5. No Content-Security-Policy or Security Headers
- **Risk:** No middleware or `next.config.ts` security headers are configured.
- **Files:** `next.config.ts` (empty config), no `middleware.ts` exists at project root or `src/`.
- **Impact:** Without a CSP, XSS via the `productUrl` concern above (item 2) is more damaging. No `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers.
- **Fix:** Add security headers to `next.config.ts` via the `headers()` config function.

### 6. `idToken` Sent in Request Body (Not Authorization Header) on Most Mutation Routes
- **Note:** This is a deliberate, consistent pattern. However, some routes already use the `Authorization: Bearer` header pattern (`src/app/api/invite/current/route.ts` line 8), while all mutation routes embed `idToken` in the JSON body. This inconsistency means future logging of request bodies would capture tokens.
- **Files:** All POST routes except `src/app/api/invite/current/route.ts`
- **Risk:** Low in isolation (HTTPS), but inconsistent and body-logging could expose tokens.
- **Recommendation:** Standardise on `Authorization: Bearer` header for all routes.

---

## Performance Concerns

### 1. Dashboard Spawns an Unbounded Number of Firestore Listeners
- **Issue:** `src/app/dashboard/page.tsx` calls `subscribeToStats(wl.id)` inside the wishlist subscription callback for every wishlist (lines 84–85, 97–98). Each call opens two `onSnapshot` listeners (`items` + `purchaseStatus`). If a parent has 10 children, this spawns 20+ open listeners simultaneously. These listeners are never individually tracked for cleanup — the outer unsubscribers (`unsubParent`, `unsubViewer`) only clean up the two root listeners, not the per-wishlist stats listeners.
- **File:** `src/app/dashboard/page.tsx` lines 50–72, 78–109
- **Impact:** Memory leak and growing Firestore read cost as the wishlist collection grows. A parent with many children will see degraded dashboard performance over time.
- **Fix:** Track stats listener unsubscribers in a `Map<string, () => void>` and call them all in the cleanup function.

### 2. N+1 Firestore Reads for Display Name Resolution
- **Issue:** Both `src/app/dashboard/page.tsx` (line 42–48) and `src/app/viewer/[wishlistId]/page.tsx` (lines 46–58) fetch display names one-at-a-time per UID using `getDoc`. The dashboard fetches one name per wishlist; the viewer page fetches one name per `purchasedBy` UID as statuses arrive.
- **Impact:** A dashboard with 10 wishlists issues 10 sequential or parallel `getDoc` calls. Acceptable now, but will degrade if user base grows.
- **Fix:** Batch reads using `getDocs` with an `in` query (Firestore supports up to 30 in a single `in` query), or cache aggressively (already partially done via `fetchedNamesRef`).

### 3. Position String Appending in `add-item` Route Will Degrade Over Time
- **Issue:** `src/app/api/wishlist/add-item/route.ts` lines 57–63 computes append position with the fallback `resolvedPosition = itemsSnap.docs[0].data().position + '|z'`. Simple string concatenation is used instead of the `fractional-indexing` library (which is used for drag-and-drop reorders in `src/lib/firebase/wishlist.ts`). Repeated appending via this code path produces increasingly long strings (e.g. `a0|z|z|z|z|z...`), which diverges from the fractional index format used by the rest of the app.
- **File:** `src/app/api/wishlist/add-item/route.ts` line 59
- **Impact:** Items added by parents via the API may sort incorrectly relative to child-created items over time. Eventually the position strings become malformed for `generateKeyBetween`.
- **Fix:** Import `generateKeyBetween` from `fractional-indexing` and use `generateKeyBetween(lastPosition, null)` consistently, mirroring `src/lib/firebase/wishlist.ts` line 48.

### 4. Activity Log Pagination Opens Leak-Prone Subscriptions
- **Issue:** `loadMore()` in `src/app/viewer/[wishlistId]/activity/page.tsx` (lines 61–70) calls `subscribeToActivityLog` and immediately calls `unsub()` inside the callback, treating it as a one-shot read. This works but re-creates a real-time listener for each pagination call and relies on the callback firing exactly once before being unsubscribed. If a write happens between the subscription and the first delivery, the behaviour is undefined.
- **File:** `src/app/viewer/[wishlistId]/activity/page.tsx` lines 61–70
- **Fix:** Use `getDocs` (one-time read) for pagination instead of `onSnapshot`.

---

## Technical Debt

### 1. Test/Debug Page Left in Production Build
- **Issue:** `src/app/test/page.tsx` is a development proof-of-concept route for Firestore real-time listeners. It is routable at `/test` in production, has no auth guard, and contains a "Seed test document" button that writes to the `wishlists` collection.
- **File:** `src/app/test/page.tsx` line 1–127; comments on lines 14–19 state "it will be removed in a later phase."
- **Impact:** Exposes a debug interface in production. The seed button will fail in production due to Firestore rules, but the page is still accessible and shows internal implementation details.
- **Fix:** Delete `src/app/test/page.tsx`.

### 2. `updateWishlistTitle` Helper Is Dead Code
- **Issue:** `src/lib/firebase/wishlist.ts` lines 86–95 define `updateWishlistTitle` with a comment explaining it is "NOT used directly" and is "kept here for reference."
- **File:** `src/lib/firebase/wishlist.ts` lines 86–95
- **Fix:** Remove the function or add an `// @deprecated` comment if it may be reinstated.

### 3. `eslint-disable` Suppressions Hide Real Hook Dependency Issues
- **Issue:** Two `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions hide potentially real dependency bugs:
  - `src/app/dashboard/page.tsx` line 109: `fetchChildName` and `subscribeToStats` are listed as intentionally omitted. They are `useCallback`-wrapped but `subscribeToStats` is not actually stable — it closes over nothing but the function reference may change if the component re-renders before the subscription is set up.
  - `src/app/invite/[token]/page.tsx` line 150: `redeemToken` is referenced in the effect but omitted from deps; the function closes over `user` which changes.
- **Files:** `src/app/dashboard/page.tsx:109`, `src/app/invite/[token]/page.tsx:150`
- **Fix:** Investigate and resolve the underlying dependency issues rather than suppressing the lint rule.

### 4. `_settingsFrozen` Internal API Used in Firebase Client Init
- **Issue:** `src/lib/firebase/client.ts` line 35 uses `(db as any)._settingsFrozen` — an undocumented internal property of the Firestore client — to guard against calling `connectFirestoreEmulator` twice. This will silently break if the Firebase JS SDK removes or renames this property.
- **File:** `src/lib/firebase/client.ts` lines 33–37
- **Fix:** Track emulator connection state with a module-level boolean flag: `let emulatorConnected = false;` and guard both `connectAuthEmulator` and `connectFirestoreEmulator` with it.

### 5. Stale Test Assertions for `register-child` Route
- **Issue:** `tests/api/auth/register-child.test.ts` asserts `body.error === 'username and password required'` (lines 104, 111, 120) but the actual route returns `'username, password, and displayName required'` (added in a later phase). The test will pass only because the mock `createUser` is never reached — the test coincidentally passes despite checking a different error string.
- **File:** `tests/api/auth/register-child.test.ts` lines 104, 111, 120
- **Fix:** Update the expected error message strings to match the actual route response.

### 6. `WishItemCardProps.onEditStart` Is Declared But Never Used
- **Issue:** `src/components/wishlist/WishItemCard.tsx` line 11 declares `onEditStart?: () => void` in the props interface with the comment "optional, unused but kept for API compatibility." No caller passes this prop.
- **File:** `src/components/wishlist/WishItemCard.tsx` line 11
- **Fix:** Remove the prop if no callers use it.

### 7. `getOrCreateWishlist` in `src/lib/firebase/wishlist.ts` Is Orphaned
- **Issue:** `getOrCreateWishlist` (lines 11–22) creates a wishlist document from the client SDK. But wishlists are now created server-side in `src/app/api/auth/register-child/route.ts` (line 103). The client-side path may create a wishlist document with an incomplete schema (missing `parentUids`, missing `title`).
- **File:** `src/lib/firebase/wishlist.ts` lines 11–22; called from `src/app/wishlist/page.tsx` line 64
- **Impact:** If a child logs in before their server-side wishlist doc is created (race condition), the client creates a minimal document without `parentUids: []`, causing the Firestore rule `request.auth.uid in resource.data.parentUids` to throw if `parentUids` is absent.
- **Fix:** Remove `getOrCreateWishlist` and rely entirely on the server-created document. If needed, add a read-only check in `src/app/wishlist/page.tsx` that redirects to an error state if the wishlist doc does not exist.

---

## Dependency Risks

### 1. Firebase SDK Version Mismatch Risk
- `firebase` (client) is `^12.11.0` and `firebase-admin` (server) is `^13.7.0`. These are major version gaps that are currently stable but the `^` semver range allows minor/patch bumps automatically. No lockfile pinning concern since `package-lock.json` should be committed.
- The use of `_settingsFrozen` (see Technical Debt item 4) creates a specific breakage risk on any Firebase client SDK upgrade.

### 2. `--webpack` Flag Forces Legacy Bundler
- Both `dev` and `build` scripts use `--webpack` flag: `"dev": "next dev --webpack"`, `"build": "next build --webpack"`.
- **File:** `package.json` lines 6–7
- **Impact:** This disables Turbopack, which is the default and recommended bundler for Next.js 16. The flag signals a known compatibility issue that has not been resolved. Future Next.js versions may remove or change the `--webpack` flag semantics.
- **Fix:** Investigate what breaks with Turbopack (likely a Firebase SDK or dnd-kit bundling issue) and resolve it so the default bundler can be used.

### 3. `tsx` Used Ad-Hoc for Scripts
- `scripts/purge-orphans.ts`, `scripts/seed-emulator.ts` are run via `npx tsx` but `tsx` is not listed in `devDependencies`.
- **File:** `package.json` lines 13–14
- **Risk:** `npx tsx` will download whatever latest version is available at runtime, which may introduce breaking changes. `ts-node` IS listed as a devDependency (line 41) but is not used for these scripts.
- **Fix:** Add `tsx` to `devDependencies` and use `tsx` instead of `npx tsx`.

---

## Unfinished Work

### 1. `/src/app/offline` Directory Is Empty
- The directory `src/app/offline/` exists but contains no files. This suggests an offline fallback page was planned (consistent with the PWA manifest and the SW unregister script in `src/app/layout.tsx`) but was never implemented.
- **Impact:** If a service worker is somehow re-registered in the future, there is no offline page to serve.
- **Fix:** Either create `src/app/offline/page.tsx` or delete the empty directory.

### 2. Account Delete for Self Silently Fails
- `handleDeleteSelf` in `src/app/dashboard/page.tsx` lines 117–136 catches all errors and does nothing: `} catch { // Silent fail — could add toast in future phase }`.
- **Impact:** If account deletion fails (e.g. network error), the user receives no feedback and may believe the account was deleted when it was not.
- **Fix:** Show an error message on failure.

### 3. `age` Field Stored But Has No UI in v1.x
- `src/types/firestore.ts` line 56 notes: `age?: number; // Optional: stored for future use; no UI in v1.1`. The field is collected in `ChildAccountForm.tsx` and stored server-side, but no feature uses it.
- **Impact:** Collecting data with no purpose creates unnecessary data retention liability (relevant under GDPR for Swedish users).
- **Fix:** Either use the field for a feature or stop collecting and storing it.

### 4. `wishlist` Route in `src/app/wishlist/page.tsx` Has No `[wishlistId]` Page for Child
- The child's wishlist page only supports the logged-in child's own wishlist (derived from `user.uid`). There is no route for a child to view another wishlist. This is intentional by design but means the app cannot support a future feature where children share wishlists or view each other's lists without significant refactoring.

### 5. Parent Invite Token Not Revokable Separately
- `src/app/api/invite/regenerate/route.ts` only regenerates the viewer invite token. There is no API route to regenerate/revoke the `currentParentInviteToken`. A parent cannot invalidate a co-parent invite link once issued.
- **Files:** `src/app/api/invite/` directory
- **Fix:** Add a `/api/invite/regenerate-parent` endpoint mirroring `/api/invite/regenerate` but operating on `currentParentInviteToken`.

---

## Gaps & Unknowns

1. **No input length limits on any field.** `title`, `note`, `displayName`, `username` fields have no maximum length enforced either in Firestore rules or API routes. A user could store arbitrarily large strings, potentially causing oversized Firestore documents (1MB document limit).

2. **No Firestore index file committed.** There is no `firestore.indexes.json` in the project. The `viewerUids array-contains` and `parentUids array-contains` queries work without composite indexes, but if ordering is ever added to these queries, index creation would be required and may not be documented.

3. **`purchaseStatus` client-side write rule is too permissive.** `firestore.rules` line 54 allows any viewer/parent to write any field to `purchaseStatus/{itemId}`, including overwriting `purchasedBy` set by another viewer. The `mark-purchased` API route enforces `viewerUids.includes(uid)`, but a viewer who constructs a direct Firestore write can set `purchasedBy` to any UID, claim another viewer's purchase, or set it to the child's UID (which would reveal to the child that something was purchased). The server-side API also denormalises `viewerUids` into the status doc, but Firestore rules do not validate this matches the parent wishlist doc.

4. **No GDPR/data deletion audit trail.** Account deletion cascades via `adminDb.recursiveDelete` and batch deletes. However, activity log entries written by a deleted viewer remain in the wishlist's `activityLog` subcollection (the `viewerUid` field still references the deleted UID). This could be a data retention concern under GDPR if the app handles EU users (Swedish users are EU users).

5. **`src/app/manifest.ts` PWA icons are generated by script.** The `public/icons/icon-192.png` and `public/icons/icon-512.png` referenced in the manifest are generated by `scripts/generate-icons.ts`. It is unclear if these are committed to the repository or must be regenerated on each deploy. If not committed, builds on Vercel will serve a broken PWA manifest.
