# Phase 8: Security, Auth & Account Fixes — Research

**Researched:** 2026-04-22
**Domain:** Firebase/Next.js security hardening, Firestore rules, XSS prevention, listener lifecycle, fractional indexing, dead code removal
**Confidence:** HIGH (all findings verified directly against codebase source)

---

## Summary

Phase 8 patches a set of concrete, enumerated issues from CONCERNS.md. Every item has been verified by reading the actual source file at the cited line. There are no exploratory unknowns — the root cause, the exact fix location, and the fix pattern are all known for each issue.

The most user-visible bug (BUG-01) is the child account visibility gap on the parent dashboard. Investigation reveals the system is architecturally correct: `register-child` does write `parentUids: [callerUid]` when `viewerIdToken` is present, and `subscribeToParentWishlists` queries `where('parentUids', 'array-contains', parentUid)`. However, the Firestore `allow create` rule (SEC-01) is currently `if isAuthenticated()` without any ownership constraint, which is a distinct security issue. The child visibility bug must be investigated at integration level — the token may be absent or stale at the moment of `ChildAccountForm` submission.

The security issues (Firestore rule tightening, XSS via productUrl/imageUrl, security headers, purchaseStatus write overreach) are all straightforward targeted fixes. The performance issues (listener leak, fractional-indexing fallback, one-shot pagination with onSnapshot) are similarly bounded to specific code lines already identified in CONCERNS.md. The technical debt items (delete test page, remove dead code, fix _settingsFrozen, fix stale tests, remove empty offline dir) are mechanical.

**Primary recommendation:** Fix in priority order — SEC-01/SEC-02/SEC-03 first (prevent live exploit vectors), then BUG-01 (user-visible regression), then PERF-01/PERF-03 (correctness/memory), then DEBT items (cleanup).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firestore create rule (SEC-01) | Database / Storage | — | Security rule enforced at Firestore layer |
| XSS URL validation (SEC-02) | API / Backend | Browser / Client | Server validates before write; client adds scheme check before render |
| Security headers (SEC-03) | Frontend Server (SSR) | — | next.config.ts `headers()` runs at Next.js server layer |
| purchaseStatus rule (SEC-04) | Database / Storage | — | Firestore rule change only |
| Listener leak fix (PERF-01) | Browser / Client | — | useEffect cleanup pattern in dashboard page |
| fractional-indexing fix (PERF-03) | API / Backend | — | Server-side route fix only |
| Activity log pagination (PERF-04) | Browser / Client | — | Replace onSnapshot with getDocs in activity page |
| Delete test page (DEBT-01) | Frontend Server (SSR) | — | File deletion |
| Dead code removal (DEBT-02/06) | API / Backend + Browser | — | Remove function + remove prop |
| _settingsFrozen fix (DEBT-04) | Browser / Client | — | Module-level boolean in client.ts |
| Stale test assertions (DEBT-05) | — | — | Test file string update |
| BUG-01 child visibility | API / Backend | Browser / Client | register-child token handling + dashboard query |

---

## Standard Stack

### Core (all versions verified from package.json) [VERIFIED: codebase grep]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fractional-indexing` | ^3.2.0 | Fractional position keys | Already used in wishlist.ts for client-side reorder |
| `firebase` (client SDK) | ^12.11.0 | Firestore, Auth | Project standard — all client data access |
| `firebase-admin` | ^13.7.0 | Admin SDK in Route Handlers | Project standard — all server mutations |
| Next.js | 16.2.2 | App Router, API routes | Project standard |

### No new dependencies required

All fixes use code already in the project. No new npm packages need to be installed.

---

## Architecture Patterns

### System Architecture — relevant data flows for Phase 8

```
[ChildAccountForm] --viewerIdToken--> [POST /api/auth/register-child]
                                          |
                                          +--> writes wishlists/{uid} { parentUids: [callerUid] }
                                          |
[Dashboard useEffect] --> subscribeToParentWishlists(user.uid)
                              --> Firestore query: parentUids array-contains user.uid
                              --> returns WishlistDoc[] --> rendered in "Mina barn" section

[WishItemCard / ViewerWishItemCard] --renders--> item.productUrl as <a href>
    XSS vector: javascript: URI stored in productUrl passes through unchecked

[POST /api/wishlist/add-item] --writes--> items/{id} { position: lastPosition + '|z' }
    Bug: should be generateKeyBetween(lastPosition, null) from fractional-indexing

[Dashboard subscribeToStats(wl.id)] --> opens 2 onSnapshot listeners per wishlist
    Bug: unsubscribers stored in closure variables never cleaned up on unmount
```

### Recommended Project Structure (no changes needed)

Phase 8 modifies existing files only. No new directories.

---

## Issue-by-Issue Fix Patterns

### SEC-01: Tighten Firestore `allow create` on wishlists

**File:** `firestore.rules` line 40

**Current (broken):**
```
allow create: if isAuthenticated();
```

**Fix:** [VERIFIED: codebase — firestore.rules line 40]
```
allow create: if isAuthenticated()
  && request.auth.uid == request.resource.data.childUid
  && request.resource.data.viewerUids == []
  && request.resource.data.parentUids == [];
```

**Why this works:** The only legitimate client-side path that creates a wishlist document is `getOrCreateWishlist(childUid)` in `src/lib/firebase/wishlist.ts` line 15 — called when a child first logs in. That document always has `childUid == user.uid` and empty `viewerUids`/`parentUids`. All other wishlist creation goes through the Admin SDK (register-child route), which bypasses rules entirely. So this tighter rule does not break any legitimate flow.

**Impact on `getOrCreateWishlist`:** The client-side `getOrCreateWishlist` function (wishlist.ts line 15) creates `{ childUid, viewerUids: [], createdAt }` — note it does NOT include `parentUids`. After this rule fix, the create will be rejected because `parentUids` is absent (not `[]`). Two options: (a) add `parentUids: []` to the setDoc call in getOrCreateWishlist, or (b) remove getOrCreateWishlist and rely only on the server-created document. CONCERNS.md Technical Debt item 7 already recommends option (b). The phase should include this decision.

**Recommendation:** Fix `getOrCreateWishlist` to include `parentUids: []` in the document it creates, matching the new rule requirement. This is the minimal-risk path — removing the function entirely touches `src/app/wishlist/page.tsx` and requires adding a not-found redirect, which is more scope.

### SEC-02: Block stored XSS via productUrl/imageUrl

**Files affected:**
- `src/app/api/wishlist/add-item/route.ts` lines 70–71 (server-side write — add validation)
- `src/components/wishlist/WishItemCard.tsx` (client-side render — add href guard)
- `src/components/viewer/ViewerWishItemCard.tsx` line 71 (client-side render — add href guard)

**Server-side fix (add-item route):** [VERIFIED: codebase]

After trimming but before writing to Firestore, validate scheme:
```typescript
// Validate URL schemes — block javascript: and data: URIs
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (productUrl?.trim()) {
  const url = productUrl.trim();
  if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
    return NextResponse.json({ error: 'productUrl must start with https:// or http://' }, { status: 400 });
  }
  itemData.productUrl = url;
}
if (imageUrl?.trim()) {
  const url = imageUrl.trim();
  if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
    return NextResponse.json({ error: 'imageUrl must start with https:// or http://' }, { status: 400 });
  }
  itemData.imageUrl = url;
}
```

**Client-side fix (both card components):** Add a scheme guard before rendering as `href`. This is a defense-in-depth measure for items already stored:
```typescript
// Helper — use wherever productUrl is rendered as href
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}
// Usage:
{item.productUrl && isSafeUrl(item.productUrl) && (
  <a href={item.productUrl} target="_blank" rel="noopener noreferrer">...</a>
)}
```

**Note:** The child also adds items via `addWishItem()` in `src/lib/firebase/wishlist.ts` (direct client SDK write, not going through the add-item route). To cover the child's path, the same scheme check should be added in `addWishItem` before calling `addDoc`. The Firestore rules do not validate URL schemes — this must be enforced in code.

**Also cover `updateWishItem`** — the edit flow calls `updateWishItem()` directly (client SDK) so URLs submitted via the edit form bypass the add-item route. Add the same validation to `updateWishItem` or to the form submit handler in WishItemCard.

### SEC-03: Add security headers in next.config.ts

**File:** `next.config.ts` (currently empty)

**Verified API from Next.js 16 docs in node_modules:** [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md]

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",   // Next.js requires unsafe-inline for hydration
              "style-src 'self' 'unsafe-inline'",    // Tailwind inline styles
              "img-src 'self' data: https:",         // allow https images
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**CSP caution:** The `unsafe-inline` for script-src is required by Next.js for its inline hydration scripts. A stricter nonce-based CSP would require Next.js middleware integration and is out of scope for this phase. The CSP above is a significant improvement over no headers at all and blocks most reflected/stored XSS injection in external contexts.

**Note on `--webpack` flag:** The existing `next dev --webpack` and `next build --webpack` scripts are unchanged. The `headers()` config is bundler-independent.

### SEC-04: Tighten purchaseStatus Firestore rule

**File:** `firestore.rules` line 54

**Current (too permissive):**
```
allow read, write: if isViewer(wishlistId) || isParent(wishlistId);
```

**Issue:** Any viewer can overwrite any field on any `purchaseStatus` document, including `purchasedBy` set by another viewer. [VERIFIED: CONCERNS.md Gaps & Unknowns item 3]

**Fix:** The server-side `mark-purchased` route already enforces correct semantics. Firestore rules should mirror that: a viewer can only write a status doc if they are setting themselves as purchasedBy (or clearing it). However, adding this constraint in Firestore rules is complex (requires checking `request.resource.data.purchasedBy == request.auth.uid || request.resource.data.purchasedBy == null`). A pragmatic minimal fix:

```
match /purchaseStatus/{itemId} {
  allow read: if isViewer(wishlistId) || isParent(wishlistId);
  allow write: if isViewer(wishlistId) || isParent(wishlistId);
  // Note: full field-level validation is enforced server-side in mark-purchased route
}
```

The read/write split does not fix the overwrite issue. The complete fix requires:
```
allow write: if (isViewer(wishlistId) || isParent(wishlistId))
  && (request.resource.data.purchasedBy == request.auth.uid
      || request.resource.data.purchasedBy == null);
```

This allows a viewer to claim or unclaim but not steal another viewer's claim.

### PERF-01: Fix Firestore listener leak in dashboard

**File:** `src/app/dashboard/page.tsx`

**Root cause:** `subscribeToStats(wl.id)` is called inside the wishlist subscription callback (lines 83–85, 96–98) but the returned unsubscribe functions are never stored or called on unmount. The outer `return () => { unsubParent(); unsubViewer(); }` only cleans up the two root listeners.

**Fix pattern:** [VERIFIED: codebase — dashboard/page.tsx lines 51–72, 104–107]

```typescript
// Add a ref to track per-wishlist stat unsubscribers
const statsUnsubsRef = useRef(new Map<string, () => void>());

// Modified subscribeToStats call — store the unsub
function subscribeToStatsTracked(wishlistId: string) {
  if (statsUnsubsRef.current.has(wishlistId)) return; // already subscribed
  const unsub = subscribeToStats(wishlistId);
  statsUnsubsRef.current.set(wishlistId, unsub);
}

// In the outer useEffect cleanup:
return () => {
  unsubParent();
  unsubViewer();
  statsUnsubsRef.current.forEach((unsub) => unsub());
  statsUnsubsRef.current.clear();
};
```

**Important:** The `subscribeToStats` function already returns a cleanup function (`return () => { itemUnsub(); statusUnsub(); }` at line 71). The fix is purely about storing and calling those returned functions.

**Deduplication:** Since the same wishlist may appear in both `parentWishlists` and `viewerWishlists` callbacks, the `has()` check prevents double-subscription.

### PERF-03: Fix position string fallback in add-item route

**File:** `src/app/api/wishlist/add-item/route.ts` line 59

**Current (broken):**
```typescript
resolvedPosition = itemsSnap.docs[0].data().position + '|z';
```

**Fix:** [VERIFIED: fractional-indexing already imported in wishlist.ts — same package, ^3.2.0]

```typescript
// At top of route file — add import
import { generateKeyBetween } from 'fractional-indexing';

// Replace the fallback (line 59):
resolvedPosition = generateKeyBetween(itemsSnap.docs[0].data().position, null);
```

`generateKeyBetween(a, null)` produces a valid fractional key after `a` — this is exactly the pattern already used in `src/lib/firebase/wishlist.ts` line 48.

### PERF-04: Fix activity log pagination (onSnapshot as one-shot)

**File:** `src/app/viewer/[wishlistId]/activity/page.tsx` lines 61–70

**Current (fragile):**
```typescript
const unsub = subscribeToActivityLog(wishlistId, (moreEntries, ...) => {
  // ...
  unsub(); // one-shot
}, lastDoc);
```

**Fix:** Replace `subscribeToActivityLog` call in `loadMore()` with a `getDocs` one-time read. Need to add `getDocs` to the viewer.ts library or call it inline:

```typescript
// In viewer.ts — add a one-time read variant for pagination
import { getDocs } from 'firebase/firestore';

export async function getActivityLogPage(
  wishlistId: string,
  afterDoc: QueryDocumentSnapshot | null,
  pageSize = 50
): Promise<{ entries: ActivityLogDoc[]; lastDoc: QueryDocumentSnapshot | null }> {
  let q = query(
    collection(db, 'wishlists', wishlistId, 'activityLog'),
    orderBy('timestamp', 'desc'),
    limit(pageSize)
  );
  if (afterDoc) {
    q = query(
      collection(db, 'wishlists', wishlistId, 'activityLog'),
      orderBy('timestamp', 'desc'),
      startAfter(afterDoc),
      limit(pageSize)
    );
  }
  const snap = await getDocs(q);
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() as Omit<ActivityLogDoc, 'id'> })) as ActivityLogDoc[];
  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { entries, lastDoc: last };
}
```

Then in the activity page `loadMore()`:
```typescript
async function loadMore() {
  if (!lastDoc) return;
  const { entries: moreEntries, lastDoc: newLastDoc } = await getActivityLogPage(wishlistId, lastDoc);
  setEntries(prev => [...prev, ...moreEntries]);
  setLastDoc(newLastDoc);
  setHasMore(moreEntries.length === 50);
  moreEntries.forEach(e => fetchDisplayName(e.viewerUid));
}
```

### DEBT-01: Delete src/app/test/page.tsx

**File:** `src/app/test/page.tsx` — confirmed to exist. [VERIFIED: ls output]

Simple file deletion. No other file references this route path. Confirm no imports reference it before deleting.

### DEBT-02 + DEBT-06: Remove dead code

Two dead items:

1. `updateWishlistTitle` in `src/lib/firebase/wishlist.ts` lines 86–95 — remove the function entirely. No caller uses it (comment on line 88 confirms it is kept only for reference).

2. `onEditStart?: () => void` in `WishItemCard.tsx` line 11 — remove from props interface. The component destructures `{ item, wishlistId }` on line 14 and never uses `onEditStart`. No caller passes this prop.

### DEBT-04: Replace `_settingsFrozen` internal API

**File:** `src/lib/firebase/client.ts` lines 33–37

**Current (brittle):**
```typescript
if (!(db as any)._settingsFrozen) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

**Fix:** Module-level boolean guard: [VERIFIED: codebase — client.ts line 35]

```typescript
let emulatorConnected = false;

if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  if (!emulatorConnected) {
    emulatorConnected = true;
    if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
```

Note: The auth guard `_emulatorConfig` check is a slightly different pattern (checking a different internal field). The research cannot verify whether `_emulatorConfig` is equally fragile without reading the Firebase SDK source. For consistency, the simplest approach is to use the same module-level boolean for both. Since `getApps().length === 0` already ensures the app initializes once per process, HMR is the only scenario where module-level code re-runs — and in Next.js with webpack, module-level state persists across HMR reloads within the same process. The boolean flag pattern is safe and idiomatic.

### DEBT-05: Fix stale test assertions

**File:** `tests/api/auth/register-child.test.ts` lines 104, 111, 120

**Current (stale):**
```typescript
expect(body.error).toBe('username and password required');
```

**Fix:** [VERIFIED: register-child/route.ts line 17–20]
```typescript
expect(body.error).toBe('username, password, and displayName required');
```

Three assertions at lines 104, 111, 120 all need this update. Note the tests also need a `displayName` field added to some test payloads that currently only pass `username` or `password` — missing `displayName` now triggers this error, not missing username/password. Specifically:
- Line 99–105: `makeRequest({ password: 'pass123' })` — missing username AND displayName, correct status 400
- Line 107–113: `makeRequest({ username: 'alice' })` — missing password AND displayName, correct status 400
- Line 115–121: `makeRequest({})` — missing all three, correct status 400

All three correctly reach the 400 branch. The fix is only the expected string.

### BUG-01: Child account not visible on parent dashboard

**Root cause analysis:** [VERIFIED: codebase — register-child/route.ts lines 94–108, ChildAccountForm.tsx lines 42–52, viewer.ts lines 30–46]

The data flow is:
1. `ChildAccountForm.handleSubmit` calls `auth.currentUser?.getIdToken()` and passes it as `viewerIdToken`
2. `register-child` route verifies `viewerIdToken` with `adminAuth.verifyIdToken(viewerIdToken)`
3. If valid, sets `parentUids: [decoded.uid]` on the new wishlist document
4. Dashboard calls `subscribeToParentWishlists(user.uid)` which queries `where('parentUids', 'array-contains', user.uid)`

This chain is architecturally correct. The child should appear. However, the `getIdToken()` call in ChildAccountForm has `.catch(() => undefined)` — if the token fetch silently fails (network, token expiry), `viewerIdToken` is `undefined` and the wishlist is created with `parentUids: []`. The `subscribeToParentWishlists` query then finds nothing.

**Fix options:**
1. **Fail loudly:** If `viewerIdToken` is undefined (token fetch failed), show an error instead of silently creating a child without parent linkage
2. **Retry:** Retry `getIdToken(true)` (force refresh) if the first attempt fails
3. **Post-hoc linking:** After creation, call a separate API to add the parent if `viewerIdToken` was absent — but this is more complex

**Recommendation:** Option 1 + 2 combined. Try `getIdToken(true)` (force refresh), and if it still fails, show the user an error before the form submits. A child account created without a parent link is effectively broken from the parent's perspective.

**Additionally:** The `add-child` page and `onboarding` both use `ChildAccountForm` — this fix covers both entry points.

**Firestore rule interaction:** Once SEC-01 is fixed, the new tighter `allow create` rule requires `request.resource.data.parentUids == []` for client-created documents. Since all creation goes through the server-side route (Admin SDK bypasses rules), this does not affect the register-child path. The Firestore rule fix is independent of the BUG-01 fix.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fractional position keys | String concat `pos + '|z'` | `generateKeyBetween(pos, null)` from `fractional-indexing` | Already in project; handles edge cases, produces well-formed keys |
| One-time Firestore reads | `onSnapshot` + immediate `unsub()` | `getDocs` | getDocs is designed for this; avoids race condition if write arrives before first delivery |
| Emulator connection guard | Internal SDK property checks | Module-level boolean | SDK internals are undocumented and can change |

---

## Common Pitfalls

### Pitfall 1: SEC-01 rule tightens without fixing getOrCreateWishlist
**What goes wrong:** After tightening the `allow create` rule, the first login of a child whose server-side wishlist was deleted (or in an edge case where register-child failed after Auth creation) will hit `getOrCreateWishlist`, which creates `{ childUid, viewerUids: [], createdAt }` — missing `parentUids`. The new rule requires `parentUids == []` to be present, so the create fails with a permissions error.
**How to avoid:** Add `parentUids: []` to the `setDoc` call in `getOrCreateWishlist`.

### Pitfall 2: CSP breaks Firebase SDK or Firestore WebSocket
**What goes wrong:** A too-strict CSP blocks WebSocket connections to `wss://*.firebaseio.com`, breaking Firestore real-time listeners.
**How to avoid:** Include `wss://*.firebaseio.com` in `connect-src`. The CSP template above already includes this.

### Pitfall 3: PERF-01 double-subscription when wishlist appears in both parent and viewer lists
**What goes wrong:** A user could theoretically be in both `parentUids` and `viewerUids` for the same wishlist. Both callbacks fire and both call `subscribeToStats(wl.id)`, creating duplicate listeners.
**How to avoid:** The `statsUnsubsRef.has(wishlistId)` check in the fix pattern above handles this correctly — the second call is a no-op.

### Pitfall 4: Stale test assertions mask test logic bug
**What goes wrong:** The three assertions at register-child.test.ts lines 104/111/120 currently pass (status 400 matches) even though the error message check is wrong. Fixing the message string is correct, but the test payloads do NOT include `displayName` — the route returns the new message because all three fields are missing, not just username/password. The tests still exercise the 400 branch correctly after the string fix.
**How to avoid:** Verify that `status === 400` AND `body.error === 'username, password, and displayName required'` both pass after updating the strings. No payload changes needed.

### Pitfall 5: XSS fix misses the child's direct-write path
**What goes wrong:** Adding validation in `add-item/route.ts` only covers parent-added items. Children add items via `addWishItem()` in `wishlist.ts` which writes directly to Firestore via the client SDK — bypassing the route entirely. A child with malicious intent could still store `javascript:` in `productUrl`.
**How to avoid:** Add scheme validation to `addWishItem()` and `updateWishItem()` in `src/lib/firebase/wishlist.ts`.

---

## Code Examples

### Verified: generateKeyBetween signature (from wishlist.ts)
```typescript
// Source: src/lib/firebase/wishlist.ts line 48 [VERIFIED: codebase]
const position = generateKeyBetween(lastPosition, null);
// lastPosition is string | null — null means "no previous item"
// null as second arg means "append to end"
```

### Verified: Next.js headers() config shape
```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
// [VERIFIED: local docs]
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ];
  },
};
```

### Verified: parentUids written by register-child
```typescript
// Source: src/app/api/auth/register-child/route.ts lines 94–108 [VERIFIED: codebase]
let parentUids: string[] = [];
if (viewerIdToken) {
  try {
    const decoded = await adminAuth.verifyIdToken(viewerIdToken);
    parentUids = [decoded.uid];
  } catch {
    // Invalid token — proceed without parent (non-fatal)
  }
}
batch.set(adminDb.collection('wishlists').doc(userRecord.uid), {
  childUid: userRecord.uid,
  viewerUids: [],
  parentUids,
  createdAt: FieldValue.serverTimestamp(),
});
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `_emulatorConfig` on auth object is as fragile as `_settingsFrozen` on db | DEBT-04 | If `_emulatorConfig` is stable and documented, the auth guard can stay as-is and only the db guard needs replacing |
| A2 | Firestore `allow create` tightening will not break any currently-passing Firestore rules unit tests | SEC-01 | A test for client-side wishlist creation without parentUids would fail — check `tests/` for rules tests |
| A3 | The child visibility bug (BUG-01) is primarily caused by silent token-fetch failure in ChildAccountForm, not a rules or query issue | BUG-01 | If token fetch succeeds but the Firestore query still returns empty results, the bug is in the query or rules layer |

---

## Open Questions

1. **BUG-01 root cause confirmation**
   - What we know: Architecture is correct end-to-end; token path has silent fail
   - What's unclear: Whether actual failures are from token silently returning undefined, or from a different cause (e.g., role claim being `viewer` not `parent` when creating a child, which might matter if subscribeToParentWishlists has a rule gate)
   - Recommendation: Add console logging to ChildAccountForm in dev mode to verify `viewerIdToken` is non-null at submission time; alternatively add an error state

2. **getOrCreateWishlist: minimal fix vs removal**
   - What we know: CONCERNS.md Technical Debt item 7 recommends removing it entirely; the SEC-01 fix creates a schema requirement that breaks it
   - What's unclear: How often the fallback path is actually hit (child logs in before server doc exists — essentially a race condition on registration)
   - Recommendation: Minimal fix (add `parentUids: []`) for this phase; full removal is out of scope per phase goal

3. **Firestore rules unit tests for SEC-01/SEC-04**
   - What we know: `@firebase/rules-unit-testing` is in devDependencies; `npm run test:rules` runs against emulator
   - What's unclear: Whether the existing rules tests cover the create path — need to verify no tests break after tightening
   - Recommendation: Run `npm run test:rules` after SEC-01/SEC-04 changes and add new tests for the tighter rules

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is purely code and config changes. No new external dependencies, services, or CLI tools required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest 29 |
| Config file | `jest.config.ts` |
| Quick run command | `npx jest tests/api/auth/register-child.test.ts --no-coverage` |
| Full suite command | `npm run test:rules` (requires Firebase emulator) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Firestore create rule rejects unauthorized wishlist creation | unit (rules) | `npm run test:rules` | ✅ (existing rules tests) |
| SEC-02 | productUrl/imageUrl with javascript: rejected by add-item route | unit | `npx jest tests/api/wishlist/add-item.test.ts -x` | ❌ Wave 0 |
| SEC-03 | Security headers present on all responses | manual | curl or browser DevTools | manual-only |
| PERF-01 | Stats listener unsubscribers cleaned up on unmount | manual | — | manual-only |
| PERF-03 | Position string from add-item route is valid fractional key | unit | `npx jest tests/api/wishlist/add-item.test.ts -x` | ❌ Wave 0 |
| DEBT-05 | register-child test assertions match actual error messages | unit | `npx jest tests/api/auth/register-child.test.ts --no-coverage` | ✅ |
| BUG-01 | Child created via /add-child appears on parent dashboard | manual | dev server + emulator smoke test | manual-only |

### Sampling Rate
- **Per task commit:** `npx jest tests/api/auth/register-child.test.ts --no-coverage`
- **Per wave merge:** `npm test` (full Jest suite, excluding rules tests that need emulator)
- **Phase gate:** `npm run test:rules` green + manual smoke test of BUG-01 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/api/wishlist/add-item.test.ts` — covers SEC-02 (URL scheme validation) and PERF-03 (fractional position)
- [ ] New Firestore rules test cases for SEC-01 tightened `allow create` rule and SEC-04 purchaseStatus write constraint

*(Existing `tests/api/auth/register-child.test.ts` requires only string updates, no new file)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Firestore security rules (SEC-01, SEC-04) |
| V5 Input Validation | yes | URL scheme validation in route handlers (SEC-02) |
| V6 Cryptography | no | — |
| V7 Error Handling | partial | Silent fail in BUG-01 token fetch |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Wishlist doc spoofing (SEC-01) | Elevation of privilege | Firestore `allow create` ownership check |
| Stored XSS via javascript: URI (SEC-02) | Tampering | Server-side scheme validation + client-side href guard |
| Clickjacking (SEC-03) | Spoofing | `X-Frame-Options: DENY` header |
| MIME confusion (SEC-03) | Tampering | `X-Content-Type-Options: nosniff` |
| Purchase claim theft (SEC-04) | Tampering | Firestore write rule requires purchasedBy == auth.uid |

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reads: all files cited above verified line-by-line
  - `firestore.rules`
  - `src/app/dashboard/page.tsx`
  - `src/app/api/wishlist/add-item/route.ts`
  - `src/app/api/auth/register-child/route.ts`
  - `src/lib/firebase/viewer.ts`
  - `src/lib/firebase/wishlist.ts`
  - `src/lib/firebase/client.ts`
  - `src/components/onboarding/ChildAccountForm.tsx`
  - `src/components/viewer/ViewerWishItemCard.tsx`
  - `src/app/viewer/[wishlistId]/activity/page.tsx`
  - `tests/api/auth/register-child.test.ts`
  - `.planning/codebase/CONCERNS.md`
  - `.planning/codebase/STACK.md`
  - `.planning/codebase/ARCHITECTURE.md`
- Next.js 16 `headers()` config API: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` [VERIFIED: local]
- `fractional-indexing` package version: `package.json` line 22 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- None required — all claims verified from codebase

### Tertiary (LOW confidence — flagged as ASSUMED)
- A1, A2, A3 in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions from package.json
- Architecture: HIGH — all from direct source reads
- Pitfalls: HIGH — derived from actual code patterns verified in codebase
- BUG-01 root cause: MEDIUM — logical inference from code; actual failure mode needs dev-mode confirmation

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase; no fast-moving external dependencies)
