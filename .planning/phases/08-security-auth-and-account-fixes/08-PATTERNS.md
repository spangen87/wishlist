# Phase 8: Security, Auth & Account Fixes - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 11 modified + 2 deleted
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `firestore.rules` | config | request-response | `firestore.rules` (self) | self |
| `src/app/api/wishlist/add-item/route.ts` | route | request-response | `src/app/api/wishlist/add-item/route.ts` (self) | self |
| `src/lib/firebase/wishlist.ts` | service | CRUD | `src/lib/firebase/viewer.ts` | role-match |
| `src/components/wishlist/WishItemCard.tsx` | component | request-response | `src/components/viewer/ViewerWishItemCard.tsx` | exact |
| `src/components/viewer/ViewerWishItemCard.tsx` | component | request-response | `src/components/wishlist/WishItemCard.tsx` | exact |
| `src/app/dashboard/page.tsx` | component | event-driven | `src/app/dashboard/page.tsx` (self) | self |
| `src/app/viewer/[wishlistId]/activity/page.tsx` | component | CRUD | `src/app/viewer/[wishlistId]/activity/page.tsx` (self) | self |
| `next.config.ts` | config | — | `next.config.ts` (self) | self |
| `src/lib/firebase/client.ts` | utility | — | `src/lib/firebase/client.ts` (self) | self |
| `tests/api/auth/register-child.test.ts` | test | — | `tests/api/auth/register-child.test.ts` (self) | self |
| `src/components/onboarding/ChildAccountForm.tsx` | component | request-response | `src/components/wishlist/WishItemCard.tsx` | role-match |
| `src/app/test/page.tsx` | — | — | DELETE — no pattern needed | — |
| `src/app/offline/` | — | — | DELETE — no pattern needed | — |

---

## Pattern Assignments

### `firestore.rules` (config, SEC-01 + SEC-04)

**Analog:** self — read existing rule structure before patching

**Existing helper pattern** (lines 6–26):
```
function isAuthenticated() {
  return request.auth != null;
}
function isOwner(wishlistId) { ... }
function isViewer(wishlistId) { ... }
function isParent(wishlistId) { ... }
```

**SEC-01: Current broken rule** (line 40):
```
allow create: if isAuthenticated();
```

**SEC-01: Replace with — ownership + empty-arrays constraint:**
```
allow create: if isAuthenticated()
  && request.auth.uid == request.resource.data.childUid
  && request.resource.data.viewerUids == []
  && request.resource.data.parentUids == [];
```

**SEC-04: Current too-permissive purchaseStatus rule** (line 54):
```
allow read, write: if isViewer(wishlistId) || isParent(wishlistId);
```

**SEC-04: Replace with — split read/write and add purchasedBy constraint:**
```
match /purchaseStatus/{itemId} {
  allow read: if isViewer(wishlistId) || isParent(wishlistId);
  allow write: if (isViewer(wishlistId) || isParent(wishlistId))
    && (request.resource.data.purchasedBy == request.auth.uid
        || request.resource.data.purchasedBy == null);
}
```

**Companion fix required:** `src/lib/firebase/wishlist.ts` `getOrCreateWishlist` must add `parentUids: []` to its `setDoc` call so the tightened SEC-01 rule is satisfied for the client-created path. See wishlist.ts pattern below.

---

### `src/app/api/wishlist/add-item/route.ts` (route, request-response)

**Analog:** self

**Existing imports pattern** (lines 1–4):
```typescript
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
```

**PERF-03: Add import at top** (after existing imports):
```typescript
import { generateKeyBetween } from 'fractional-indexing';
```

**PERF-03: Replace broken position fallback** (line 59):
```typescript
// BEFORE:
resolvedPosition = itemsSnap.docs[0].data().position + '|z';

// AFTER — mirrors wishlist.ts line 48:
resolvedPosition = generateKeyBetween(itemsSnap.docs[0].data().position, null);
```

**SEC-02: URL scheme validation block** — insert after line 68 (`const itemData: Record<string, unknown> = {`) but before writing optional fields (lines 70–71). Pattern copies the existing trim-before-write style:
```typescript
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (productUrl?.trim()) {
  const url = productUrl.trim();
  if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
    return NextResponse.json(
      { error: 'productUrl must start with https:// or http://' },
      { status: 400 }
    );
  }
  itemData.productUrl = url;
}
if (imageUrl?.trim()) {
  const url = imageUrl.trim();
  if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
    return NextResponse.json(
      { error: 'imageUrl must start with https:// or http://' },
      { status: 400 }
    );
  }
  itemData.imageUrl = url;
}
```

**Note:** After adding the URL blocks above, remove the original lines 70–71 (`if (productUrl?.trim()) itemData.productUrl = productUrl.trim();` and `if (imageUrl?.trim()) itemData.imageUrl = imageUrl.trim();`) since they are replaced by the validated versions.

---

### `src/lib/firebase/wishlist.ts` (service, CRUD)

**Analog:** `src/lib/firebase/viewer.ts` for query/subscription patterns; self for mutation patterns.

**Existing import pattern** (lines 1–7):
```typescript
import {
  doc, setDoc, getDoc, collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { generateKeyBetween } from 'fractional-indexing';
import { db } from '@/lib/firebase/client';
import type { WishItemDoc } from '@/types/firestore';
```

**SEC-01 companion fix: `getOrCreateWishlist`** (lines 15–21) — add `parentUids: []` to setDoc call:
```typescript
// BEFORE (line 15–19):
await setDoc(ref, {
  childUid,
  viewerUids: [],
  createdAt: serverTimestamp(),
}, { merge: true });

// AFTER:
await setDoc(ref, {
  childUid,
  viewerUids: [],
  parentUids: [],
  createdAt: serverTimestamp(),
}, { merge: true });
```

**SEC-02: Add URL validation to `addWishItem`** (before `addDoc` call, line 49). Pattern mirrors the route handler's validation block:
```typescript
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (fields.productUrl && !SAFE_URL_PREFIXES.some(p => fields.productUrl!.startsWith(p))) {
  throw new Error('productUrl must start with https:// or http://');
}
if (fields.imageUrl && !SAFE_URL_PREFIXES.some(p => fields.imageUrl!.startsWith(p))) {
  throw new Error('imageUrl must start with https:// or http://');
}
```

**SEC-02: Add URL validation to `updateWishItem`** (before `updateDoc` call, line 62). Same pattern:
```typescript
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (changes.productUrl && !SAFE_URL_PREFIXES.some(p => changes.productUrl!.startsWith(p))) {
  throw new Error('productUrl must start with https:// or http://');
}
if (changes.imageUrl && !SAFE_URL_PREFIXES.some(p => changes.imageUrl!.startsWith(p))) {
  throw new Error('imageUrl must start with https:// or http://');
}
```

**DEBT-02: Remove dead function** (lines 86–95) — delete `updateWishlistTitle` entirely (the comment on line 88 already marks it as not used directly).

---

### `src/components/wishlist/WishItemCard.tsx` (component, request-response)

**Analog:** `src/components/viewer/ViewerWishItemCard.tsx` — identical role/data-flow

**DEBT-06: Remove unused prop from interface** (line 11):
```typescript
// BEFORE:
interface WishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  onEditStart?: () => void; // optional, unused but kept for API compatibility
}

// AFTER:
interface WishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
}
```

**SEC-02: Client-side href guard** — replace the bare `productUrl` anchor (lines 231–239) with a guarded render. Copy pattern from ViewerWishItemCard (line 69–78) but add scheme check:
```typescript
// Helper — add near top of file (module scope, before component):
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

// Replace in read-mode JSX (was lines 231–239):
{item.productUrl && isSafeUrl(item.productUrl) && (
  <a
    href={item.productUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-gray-500 truncate block max-w-full hover:underline"
  >
    {item.productUrl}
  </a>
)}
```

**SEC-02: Add URL validation in `handleSave`** (before calling `updateWishItem`, currently line 77). Mirror the guard from wishlist.ts client path:
```typescript
// In handleSave, after trimming, before updateWishItem:
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (changes.productUrl && !SAFE_URL_PREFIXES.some(p => changes.productUrl!.startsWith(p))) {
  setEditSaveError('Länken måste börja med https:// eller http://');
  setEditSaving(false);
  return;
}
if (changes.imageUrl && !SAFE_URL_PREFIXES.some(p => changes.imageUrl!.startsWith(p))) {
  setEditSaveError('Bildlänken måste börja med https:// eller http://');
  setEditSaving(false);
  return;
}
```

---

### `src/components/viewer/ViewerWishItemCard.tsx` (component, request-response)

**Analog:** `src/components/wishlist/WishItemCard.tsx` — identical role/data-flow

**SEC-02: Client-side href guard** — replace the bare `productUrl` anchor (lines 70–78) with a guarded render. Use the same `isSafeUrl` helper:
```typescript
// Helper — add near top of file (module scope, before component):
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

// Replace in JSX (was lines 69–78):
{item.productUrl && isSafeUrl(item.productUrl) && (
  <a
    href={item.productUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-[#6B7280] truncate block max-w-full hover:underline"
  >
    {item.productUrl}
  </a>
)}
```

---

### `src/app/dashboard/page.tsx` (component, event-driven)

**Analog:** self

**Existing import pattern** (lines 1–11):
```typescript
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToViewerWishlists, subscribeToParentWishlists } from '@/lib/firebase/viewer';
...
```

**PERF-01: Add stats unsub tracking ref** — insert after the existing `fetchedNamesRef` ref declaration (line 28):
```typescript
// Track per-wishlist stats listener unsubscribers — prevents leak on unmount
const statsUnsubsRef = useRef(new Map<string, () => void>());
```

**PERF-01: Replace bare `subscribeToStats` calls inside the useEffect** (lines 85 and 98). Create a tracked wrapper that deduplicates and records unsubscribers. The wrapper must be defined inside or outside the useEffect — placing inside is simplest since `subscribeToStats` is already stable via `useCallback`:
```typescript
// In the useEffect body, before the subscribeToParentWishlists call (before line 78):
function subscribeToStatsTracked(wishlistId: string) {
  if (statsUnsubsRef.current.has(wishlistId)) return;
  const unsub = subscribeToStats(wishlistId);
  statsUnsubsRef.current.set(wishlistId, unsub);
}
```

**PERF-01: Replace the two `subscribeToStats(wl.id)` calls** at lines 85 and 98 with:
```typescript
subscribeToStatsTracked(wl.id);
```

**PERF-01: Extend the cleanup return** (currently lines 104–107) to include all per-wishlist unsubs:
```typescript
// BEFORE:
return () => {
  unsubParent();
  unsubViewer();
};

// AFTER:
return () => {
  unsubParent();
  unsubViewer();
  statsUnsubsRef.current.forEach((unsub) => unsub());
  statsUnsubsRef.current.clear();
};
```

**BUG-01: Fix silent token failure in `handleDeleteSelf`** — the same silent-fail pattern in the form submission. The BUG-01 fix is in `ChildAccountForm.tsx` not here, but the dashboard's `handleDeleteSelf` (lines 117–136) already uses `getIdToken()` without a loud failure. Leave dashboard's deletion as-is; the token-fail fix is isolated to ChildAccountForm.

---

### `src/app/viewer/[wishlistId]/activity/page.tsx` (component, CRUD)

**Analog:** self

**Existing import pattern** (lines 1–10):
```typescript
'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToActivityLog } from '@/lib/firebase/viewer';
...
```

**PERF-04: Replace `subscribeToActivityLog` import** with a new `getActivityLogPage` function (to be added to `src/lib/firebase/viewer.ts`). Update import line:
```typescript
// BEFORE:
import { subscribeToActivityLog } from '@/lib/firebase/viewer';

// AFTER:
import { subscribeToActivityLog, getActivityLogPage } from '@/lib/firebase/viewer';
```

**PERF-04: Replace the `loadMore` function** (lines 61–71) — swap the one-shot `onSnapshot` pattern for `getDocs` via `getActivityLogPage`:
```typescript
// BEFORE (lines 61–71):
function loadMore() {
  if (!lastDoc) return;
  const unsub = subscribeToActivityLog(wishlistId, (moreEntries, newLastDoc) => {
    setEntries((prev) => [...prev, ...moreEntries]);
    setLastDoc(newLastDoc);
    setHasMore(moreEntries.length === 50);
    moreEntries.forEach((e) => fetchDisplayName(e.viewerUid));
    unsub();
  }, lastDoc);
}

// AFTER — async, uses getDocs-based helper:
async function loadMore() {
  if (!lastDoc) return;
  const { entries: moreEntries, lastDoc: newLastDoc } = await getActivityLogPage(wishlistId, lastDoc);
  setEntries((prev) => [...prev, ...moreEntries]);
  setLastDoc(newLastDoc);
  setHasMore(moreEntries.length === 50);
  moreEntries.forEach((e) => fetchDisplayName(e.viewerUid));
}
```

**New function to add in `src/lib/firebase/viewer.ts`** — copy the query-building pattern from existing `subscribeToActivityLog` (lines 69–95) but use `getDocs`:
```typescript
// Add after subscribeToActivityLog in viewer.ts
import { getDocs } from 'firebase/firestore'; // add to existing import block

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
  const entries = snap.docs.map((d) => ({
    id: d.id,
    ...d.data() as Omit<ActivityLogDoc, 'id'>,
  })) as ActivityLogDoc[];
  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { entries, lastDoc: last };
}
```

---

### `next.config.ts` (config, SEC-03)

**Analog:** self (currently empty shell)

**Existing structure** (lines 1–7):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

**SEC-03: Replace entirely with headers() config:**
```typescript
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
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
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

**Note:** The `--webpack` flag in `package.json` dev/build scripts is unchanged. The `headers()` function is bundler-independent. Do not add or modify any scripts in this phase.

---

### `src/lib/firebase/client.ts` (utility, DEBT-04)

**Analog:** self

**Existing emulator guard pattern** (lines 25–38):
```typescript
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  if (!(db as any)._settingsFrozen) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
```

**DEBT-04: Replace internal-API guard with module-level boolean** — add boolean before the `if` block and use it for both connectors:
```typescript
// Add at module scope, after the `export const auth = getAuth(app);` line:
let emulatorConnected = false;

// Replace the entire emulator if-block:
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  if (!emulatorConnected) {
    emulatorConnected = true;
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
```

**Note:** Remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment on the original line 34 since `(db as any)` is no longer used.

---

### `tests/api/auth/register-child.test.ts` (test, DEBT-05)

**Analog:** self

**Existing stale assertions** (lines 104, 111, 120):
```typescript
expect(body.error).toBe('username and password required');
```

**DEBT-05: Update all three occurrences** to match current route response (verified against `register-child/route.ts` line 17–20):
```typescript
expect(body.error).toBe('username, password, and displayName required');
```

All three test cases at lines 99–105, 107–113, and 115–121 correctly send payloads that are missing fields and reach the 400 branch. Only the expected string changes — no payload changes needed.

---

### `src/components/onboarding/ChildAccountForm.tsx` (component, request-response)

**Analog:** `src/components/wishlist/WishItemCard.tsx` — same form-submit with error state pattern

**Existing error state pattern** (lines 14–15, 130–132):
```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
// ...
{error && (
  <p role="alert" className="text-[#DC2626] text-sm">{error}</p>
)}
```

**BUG-01: Fix silent token failure** — replace line 42:
```typescript
// BEFORE (line 42):
const viewerIdToken = await auth.currentUser?.getIdToken().catch(() => undefined);

// AFTER — force-refresh token; fail loudly if token is unavailable:
let viewerIdToken: string | undefined;
try {
  viewerIdToken = await auth.currentUser?.getIdToken(true);
} catch {
  setError('Sessionen har gått ut. Logga ut och logga in igen, sedan försök skapa barnkontot.');
  setLoading(false);
  return;
}
```

**Pattern reference:** The `setError` + early `return` guard pattern is already used at lines 22–38 for client-side validation. The token-fetch error follows the same shape. The `role="alert"` error paragraph at line 130 already displays whatever is in `error` state — no JSX changes needed.

---

## Shared Patterns

### URL Scheme Validation
**Source:** `src/app/api/wishlist/add-item/route.ts` (new code for SEC-02)
**Apply to:** `add-item/route.ts`, `src/lib/firebase/wishlist.ts` (`addWishItem`, `updateWishItem`), `WishItemCard.tsx` (`handleSave`), `ViewerWishItemCard.tsx` (render guard)

Canonical form for server-side (throws or returns error response):
```typescript
const SAFE_URL_PREFIXES = ['https://', 'http://'];
if (url && !SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
  // server: return NextResponse.json({ error: '...' }, { status: 400 });
  // client lib: throw new Error('...');
  // component: setEditSaveError('...'); return;
}
```

Canonical form for client render guard (defense-in-depth):
```typescript
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}
{item.productUrl && isSafeUrl(item.productUrl) && <a href={item.productUrl} ...>}
```

### Error State Pattern (Client Components)
**Source:** `src/components/onboarding/ChildAccountForm.tsx` lines 14, 130–132
**Apply to:** All client form components (`WishItemCard.tsx`, `ChildAccountForm.tsx`)
```typescript
const [error, setError] = useState<string | null>(null);
// ...
{error && <p role="alert" className="text-[#DC2626] text-sm">{error}</p>}
```

### Firestore Listener Cleanup (useRef Map)
**Source:** `src/app/dashboard/page.tsx` (new pattern for PERF-01)
**Apply to:** Any page that opens per-item Firestore listeners inside a parent subscription callback
```typescript
const subMapRef = useRef(new Map<string, () => void>());
// On new item: if (!subMapRef.current.has(id)) { subMapRef.current.set(id, subscribe(id)); }
// In useEffect cleanup: subMapRef.current.forEach(unsub => unsub()); subMapRef.current.clear();
```

### getDocs One-Shot Read (replacing onSnapshot + immediate unsub)
**Source:** `src/lib/firebase/viewer.ts` — `subscribeToActivityLog` query structure (lines 69–95), converted to `getDocs`
**Apply to:** `src/app/viewer/[wishlistId]/activity/page.tsx` `loadMore()`, and the new `getActivityLogPage` in `viewer.ts`
```typescript
// Copy query construction from subscribeToActivityLog, swap onSnapshot for getDocs:
const snap = await getDocs(q);
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() as Omit<T, 'id'> })) as T[];
```

### Module-Level Boolean Emulator Guard
**Source:** `src/lib/firebase/client.ts` (new pattern for DEBT-04)
**Apply to:** `client.ts` only
```typescript
let emulatorConnected = false;
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  if (!emulatorConnected) {
    emulatorConnected = true;
    connectAuthEmulator(...);
    connectFirestoreEmulator(...);
  }
}
```

---

## Files to Delete

| File/Directory | Reason | Pattern Needed |
|----------------|---------|----------------|
| `src/app/test/page.tsx` | DEBT-01: debug page left in production, no auth guard | None — simple deletion |
| `src/app/offline/` | DEBT — empty directory, no files | None — simple deletion |

Confirm before deleting `src/app/test/page.tsx`: verify no other file imports from `@/app/test/` or references `/test` route programmatically. The RESEARCH.md confirms no references exist.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/firebase/`, `src/components/`, `src/app/dashboard/`, `src/app/viewer/`, `tests/api/`, `firestore.rules`, `next.config.ts`
**Files read:** 11 source files
**Pattern extraction date:** 2026-04-22
