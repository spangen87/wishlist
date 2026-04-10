# Phase 4: Viewer Flow - Research

**Researched:** 2026-04-09
**Domain:** Firebase Firestore/Admin SDK, Next.js 16 App Router, viewer coordination UX
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Share Link Generation UI**
- D-01: Share link is managed via a settings/gear page for the wishlist. A gear icon on the wishlist page leads to a settings page with a Sharing section: shows the current invite link, a copy button, a list of current viewers, and a "Regenerate link" button that invalidates the old token (sets `active: false` on the old `InviteDoc`, creates a new one).
- D-02: The settings route is `/wishlist/[wishlistId]/settings` (or equivalent). Accessible to child and parent/owner of the wishlist, not to viewers.

**Viewer Join Flow**
- D-03: `/invite/[token]` is a dedicated join page — it shows the invite context ("You've been invited to join [child name]'s wishlist") with login and register options inline. No separate redirect to `/login`. After login/register on this page, the API route redeems the token and adds the visitor to `viewerUids`.
- D-04: If the visitor is already logged in and already a viewer, the page redirects them directly to the viewer wishlist. If already logged in but not yet viewer, it redeems the token immediately.
- D-05: Token redemption happens via an API route + Admin SDK (roadmap constraint): `POST /api/invite/redeem` — validates token is `active`, adds `user.uid` to `viewerUids`, sets the `viewer` custom claim via Admin SDK.

**Viewer Wishlist Layout**
- D-06: The viewer wishlist page uses the same pastel card design as the child's wishlist, but each card gains purchase overlays: a "Mark as purchased" button/checkbox and an expandable note field.
- D-07: Route for the viewer's wishlist view: `/viewer/[wishlistId]` (distinct from the child's `/wishlist` route). A viewer who accesses `/wishlist` while logged in as a viewer role gets redirected to their dashboard, not the child's view.
- D-08: Each card shows: item title, price, productUrl, imageUrl thumbnail (same as child view), PLUS a "Mark purchased" toggle and a "Your note" section showing the current viewer's own note.
- D-09: Purchased items are visually distinguished (e.g., muted/strikethrough styling). Each purchased card shows who marked it (username or display name from `users/{uid}`).

**Purchase Marking UX**
- D-10: A checkbox (or toggle button) on each card marks/unmarks the item as purchased. Toggle maps to `purchasedBy: user.uid` (set on mark, cleared on unmark). Only one viewer can be the purchaser per item — marking by a second viewer overwrites the first (last write wins).
- D-11: The "Mark as purchased" action writes to `wishlists/{id}/purchaseStatus/{itemId}` — the privacy boundary subcollection that children cannot read.

**Notes (Per-Viewer)**
- D-12: Schema change from Phase 1: `PurchaseStatusDoc.viewerNote: string` is replaced with `viewerNotes: Record<string, string>` — a map of `uid → note text`. Each viewer writes and reads only their own note. Other viewers' notes are visible too.
- D-13: Note field: click-to-expand — a "Leave a note" link/button expands a text area for the current viewer's note. Collapsed by default when empty. When a note exists, it is shown inline (truncated if long, click to expand/edit).
- D-14: Other viewers' notes are displayed as read-only below the current viewer's own note field.
- D-15: Update to `src/types/firestore.ts`: change `viewerNote?: string` to `viewerNotes?: Record<string, string>` in `PurchaseStatusDoc`.

**Activity Log**
- D-16: Activity log is a separate route: `/viewer/[wishlistId]/activity`. A link in the viewer page header navigates to this page.
- D-17: Each log entry shows: viewer username, action ("marked purchased", "unmarked purchased", "added note"), item title, and timestamp. Ordered newest-first.
- D-18: Log entries are stored in `wishlists/{wishlistId}/activityLog/{entryId}` subcollection. Each entry: `{ viewerUid, action: string, itemId, itemTitle, timestamp }`. Written server-side when purchase status or notes change.

**Viewer Dashboard**
- D-19: After login, a viewer is redirected to `/dashboard`. For `role === 'viewer'`, the dashboard shows a grid of wishlist cards — one per wishlist they have access to.
- D-20: Each wishlist card in the grid shows: child's username/display name, total item count, number of items marked purchased, and a small thumbnail or placeholder. Clicking navigates to `/viewer/[wishlistId]`.
- D-21: The existing `/dashboard` stub is repurposed for viewer role. Child role users who land on `/dashboard` are redirected to `/wishlist`.

### Claude's Discretion
- Exact styling of purchased/unpurchased states on viewer cards
- Animation/transition for note expand/collapse
- Activity log pagination or infinite scroll
- Empty state for viewer dashboard (no wishlists yet)
- Error handling for invalid/expired invite tokens

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 4 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHARE-01 | Barn/förälder kan generera en delningslänk för barnets önskelista | Settings page + API route to create InviteDoc with random token |
| SHARE-02 | Vem som helst med delningslänken kan gå med som betraktare (kräver konto) | `/invite/[token]` join page + `POST /api/invite/redeem` Admin SDK route |
| SHARE-03 | Delningslänk kan återkallas (länken slutar fungera) | Regenerate sets `active: false` on old InviteDoc, creates new one |
| VIEW-01 | Betraktare kan se barnets fullständiga önskelista | `/viewer/[wishlistId]` reads `items` subcollection via client SDK + `onSnapshot` |
| VIEW-02 | Betraktare kan markera ett önskemål som köpt (med sitt namn) | Write to `purchaseStatus/{itemId}` with `purchasedBy: uid` — client SDK |
| VIEW-03 | Betraktare kan avmarkera köpt-status på ett önskemål | Delete or clear `purchasedBy` field in `purchaseStatus/{itemId}` |
| VIEW-04 | Betraktare kan lämna en anteckning (synlig för andra betraktare, ej barnet) | Write to `purchaseStatus/{itemId}.viewerNotes[uid]` — stays in privacy-boundary subcollection |
| VIEW-05 | Betraktare ser vilka önskemål som är markerade som köpta och av vem | Read `purchaseStatus` + `users/{uid}` for display names in viewer card |
| VIEW-06 | Betraktare kan hantera flera barns önskelistor från samma konto | Dashboard queries all wishlists where `viewerUids` contains `user.uid` |
| VIEW-07 | Aktivitetslogg visar vad varje betraktare gjort | `activityLog` subcollection; written server-side via API routes when purchase/note changes |
</phase_requirements>

---

## Summary

Phase 4 builds the entire viewer-side of the wishlist app on a well-established foundation. Phases 1–3 have already set the irreversible architectural decisions: `purchaseStatus` is a separate subcollection (child cannot read), `invites/{token}` is Admin-SDK-only, `viewerUids[]` is the access-control array on each wishlist doc, and the custom claim `role: 'viewer'` is in the ID token. Phase 4 connects all these pieces into working UI flows.

The biggest new surface is the invite redemption API route (`POST /api/invite/redeem`). This is the only server-side path that touches the `invites` collection and adds a UID to `viewerUids`. It follows the exact same pattern as the existing `set-viewer-claim` route: verify ID token with Admin Auth, write to Firestore with Admin Firestore. The client never reads the `invites` collection (enforced by rules `allow read, write: if false`).

The second major concern is the activity log. D-18 says entries are "written server-side when purchase status or notes change." This means purchase marking and note updates must go through API routes (not direct client writes) so the server can atomically write the log entry. This is a significant architectural constraint: the client cannot write directly to `purchaseStatus` and also write the activity log atomically. Either use API routes for all viewer mutations, or use Firestore batched writes (client SDK allows batching purchaseStatus + activityLog as long as both are writable by the viewer — but activityLog subcollection is not yet in the rules).

**Primary recommendation:** Route all viewer mutations (mark purchased, unmark purchased, update note) through API route handlers that use Admin SDK batch writes to update `purchaseStatus` and append to `activityLog` atomically. This eliminates the class of bugs where the log entry is written but the status update fails (or vice versa), and keeps the activity log trustworthy.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase | 12.11.0 | Client SDK — reads items, purchaseStatus, activityLog | Already installed, `onSnapshot` established in Phase 1 |
| firebase-admin | 13.7.0 | Admin SDK — invite redemption, claim setting, batch writes | Already installed, used in Phase 2 routes |
| next | 16.2.2 | App Router — dynamic routes, API route handlers | Already installed, all patterns established |
| react | 19.2.4 | Client components, `use()` for async params | Already installed |

[VERIFIED: /Users/spangen87/Documents/GitHub/wishlist/package.json]

### No new packages required for Phase 4

All functionality is achievable with the existing stack. The note auto-save on blur, purchased toggle, activity log pagination (50 entries + "show more"), and dashboard grid are all standard React + Tailwind + Firestore patterns already established in the project.

**Installation:** None — no new packages.

---

## Architecture Patterns

### Recommended Project Structure (new files for Phase 4)

```
src/
├── app/
│   ├── invite/
│   │   └── [token]/
│   │       └── page.tsx              # Join page (D-03)
│   ├── viewer/
│   │   └── [wishlistId]/
│   │       ├── page.tsx              # Viewer wishlist (D-07)
│   │       └── activity/
│   │           └── page.tsx          # Activity log (D-16)
│   ├── wishlist/
│   │   └── [wishlistId]/
│   │       └── settings/
│   │           └── page.tsx          # Settings + share link (D-01, D-02)
│   ├── dashboard/
│   │   └── page.tsx                  # REPURPOSED — viewer grid (D-19)
│   └── api/
│       └── invite/
│           ├── create/
│           │   └── route.ts          # POST — create InviteDoc (SHARE-01)
│           ├── redeem/
│           │   └── route.ts          # POST — redeem token, add viewer (SHARE-02, D-05)
│           └── regenerate/
│               └── route.ts          # POST — revoke old, create new (SHARE-03)
│       └── viewer/
│           ├── mark-purchased/
│           │   └── route.ts          # POST — write purchaseStatus + activityLog
│           └── update-note/
│               └── route.ts          # POST — write viewerNotes + activityLog
├── components/
│   └── viewer/
│       ├── ViewerWishItemCard.tsx    # Card with purchase toggle + note field (D-06, D-08)
│       ├── PurchasedBadge.tsx        # "Köpt av [namn]" badge (D-09)
│       ├── ViewerNoteField.tsx       # Click-to-expand textarea (D-13)
│       ├── OtherViewerNotes.tsx      # Read-only other notes (D-14)
│       ├── WishlistDashboardCard.tsx # Viewer dashboard grid card (D-20)
│       ├── ActivityLogEntry.tsx      # Single log row (D-17)
│       └── ShareLinkPanel.tsx        # Settings page sharing section (D-01)
├── lib/
│   └── firebase/
│       └── viewer.ts                 # Client-side Firestore helpers for viewer reads
└── types/
    └── firestore.ts                  # UPDATE: viewerNote → viewerNotes (D-15)
```

### Pattern 1: Dynamic Route Params in Client Components (Next.js 16)

In Next.js 16, `params` is a Promise in both server and client components.
[VERIFIED: /Users/spangen87/Documents/GitHub/wishlist/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md]

**Client component page with dynamic segment:**
```typescript
// src/app/viewer/[wishlistId]/page.tsx
'use client';
import { use } from 'react';

export default function ViewerWishlistPage({
  params,
}: {
  params: Promise<{ wishlistId: string }>;
}) {
  const { wishlistId } = use(params);
  // use wishlistId in hooks / effects
}
```

**API route handler with dynamic segment:**
```typescript
// src/app/api/invite/redeem/route.ts
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // ...
}
```

[VERIFIED: /Users/spangen87/Documents/GitHub/wishlist/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md]

### Pattern 2: Invite Redemption API Route

This is the critical new API route. It must:
1. Verify the caller's ID token (Admin Auth)
2. Read the `invites/{token}` doc (Admin Firestore — client rules deny this)
3. Validate `active === true`
4. Atomically: add `uid` to `wishlists/{wishlistId}.viewerUids` + set custom claim `role: 'viewer'`

```typescript
// src/app/api/invite/redeem/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const { idToken, token } = await request.json().catch(() => ({}));

  // 1. Verify caller identity
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Read invite — Admin SDK only (client rules: allow read, write: if false)
  const inviteRef = adminDb.collection('invites').doc(token);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
  }

  const invite = inviteSnap.data()!;
  if (!invite.active) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
  }

  const { wishlistId } = invite;
  const { uid } = decoded;

  // 3. Add viewer to wishlist + set claim atomically (best-effort — claim separate)
  await adminDb.collection('wishlists').doc(wishlistId).update({
    viewerUids: FieldValue.arrayUnion(uid),
  });

  await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });

  // 4. Ensure user profile exists with viewer role
  await adminDb.collection('users').doc(uid).set(
    { role: 'viewer' },
    { merge: true }
  );

  return NextResponse.json({ ok: true, wishlistId });
}
```

[ASSUMED] The pattern above follows existing API route conventions from `set-viewer-claim/route.ts` and `register-child/route.ts`. Admin SDK batch is not required here since `viewerUids` and the custom claim are independent operations (claim failure doesn't corrupt Firestore state).

### Pattern 3: Viewer Mutation Routes with Activity Log

Purchase marking and note updates must write to both `purchaseStatus` and `activityLog` atomically. Admin SDK batch write is the right tool:

```typescript
// src/app/api/viewer/mark-purchased/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const { idToken, wishlistId, itemId, itemTitle, purchased } = await request.json();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;
  const batch = adminDb.batch();

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  if (purchased) {
    batch.set(statusRef, {
      itemId,
      viewerUids: [],       // populated separately if needed by rules
      purchasedBy: uid,
      purchasedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    batch.update(statusRef, {
      purchasedBy: FieldValue.delete(),
      purchasedAt: FieldValue.delete(),
    });
  }

  const logRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('activityLog').doc();

  batch.set(logRef, {
    viewerUid: uid,
    action: purchased ? 'marked_purchased' : 'unmarked_purchased',
    itemId,
    itemTitle,
    timestamp: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return NextResponse.json({ ok: true });
}
```

[ASSUMED] This API-route-for-mutations approach is a deliberate departure from the client-direct-write pattern used in Phase 3. It is required because the activity log must be trustworthy and the child must never access it.

### Pattern 4: Share Link Generation

```typescript
// src/app/api/invite/create/route.ts — generates a new InviteDoc
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';  // Node.js built-in

export async function POST(request: NextRequest) {
  const { idToken, wishlistId } = await request.json();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller owns this wishlist
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists || wishlistSnap.data()!.childUid !== decoded.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = randomBytes(24).toString('hex');   // 48 hex chars = sufficient entropy

  await adminDb.collection('invites').doc(token).set({
    wishlistId,
    token,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ token });
}
```

[ASSUMED] `crypto.randomBytes` is available in Next.js 16 API routes (Node.js runtime). The token is stored as the document ID for O(1) lookup at redemption time.

### Pattern 5: Token Regeneration

```typescript
// POST /api/invite/regenerate
// 1. Find existing active invite for wishlistId
// 2. Set active: false on old InviteDoc
// 3. Create new InviteDoc (calls same logic as /create)
// Both writes in a batch for atomicity (SHARE-03: old link must immediately stop working)
```

Finding the current active invite requires a query: `adminDb.collection('invites').where('wishlistId', '==', wishlistId).where('active', '==', true)`. This requires a composite index unless Firestore creates it automatically for equality filters on two fields.

**Pitfall:** Composite index may need to be created in Firestore console or `firestore.indexes.json`. Add this to the plan as a task.

[ASSUMED] Firestore requires a composite index for multi-field `where` queries when both fields have equality conditions and the collection is not trivially small. In practice, for a small app this may work without an index, but it is safer to add one.

### Pattern 6: Firestore Rules — New Subcollections

The `activityLog` subcollection needs a security rule. Viewers must be able to read it; the child must not. The rule mirrors `purchaseStatus`:

```javascript
// Add to firestore.rules:
match /wishlists/{wishlistId}/activityLog/{entryId} {
  allow read: if isViewer(wishlistId);
  allow write: if false;  // Admin SDK only (via API routes)
}
```

The settings page reads the `invites` collection to display the current token — but the current rules are `allow read, write: if false`. The settings page needs the current invite token to display the share URL. Options:
- **Option A (recommended):** Settings page calls a `GET /api/invite/current?wishlistId=X` API route that reads the invite with Admin SDK and returns only the token string — no raw InviteDoc exposure.
- **Option B:** Store the current token in the `WishlistDoc` itself (denormalize). But this breaks the Admin-SDK-only constraint since the wishlist doc IS client-readable.

**Recommendation:** Option A. Add `GET /api/invite/current` route.

[ASSUMED] Option A is consistent with the established pattern that "client SDK never reads invites collection."

### Pattern 7: Viewer Dashboard — Querying Multiple Wishlists

A viewer can be on multiple wishlists. The dashboard must show all of them.

```typescript
// src/lib/firebase/viewer.ts
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { WishlistDoc } from '@/types/firestore';

export function subscribeToViewerWishlists(
  viewerUid: string,
  onWishlists: (wishlists: WishlistDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'wishlists'),
    where('viewerUids', 'array-contains', viewerUid)
  );
  return onSnapshot(q, (snap) => {
    const lists = snap.docs.map((d) => ({
      id: d.id,
      ...d.data() as Omit<WishlistDoc, 'id'>,
    }));
    onWishlists(lists);
  });
}
```

[VERIFIED: Firestore `array-contains` operator is the standard way to query "documents where an array field contains a specific value." The current Firestore rules already allow `isViewer` to read the wishlist doc, so this query will work without additional rules.]

The `array-contains` query requires a single-field index (automatically created by Firestore). No composite index needed for this query alone.

### Pattern 8: Auth Token Refresh After Redemption

After `POST /api/invite/redeem` sets the viewer custom claim, the client must force-refresh the ID token before making further authenticated requests — otherwise cached tokens won't include the new claim. This is the same pitfall fixed in Phase 2 (`register` route).

```typescript
// In invite/[token]/page.tsx, after successful redemption:
await auth.currentUser?.getIdToken(/* forceRefresh = */ true);
router.push(`/viewer/${wishlistId}`);
```

[VERIFIED: This pattern is already documented in `src/app/register/page.tsx` — line `await credential.user.getIdToken(/* forceRefresh = */ true)`]

### Pattern 9: `purchaseStatus` Reads in Viewer UI

The viewer wishlist page needs to display both items and their purchase status. These are two parallel subscriptions:

```typescript
// Subscribe to items (already in wishlist.ts)
const unsubItems = subscribeToItems(wishlistId, setItems);

// Subscribe to purchaseStatus — new helper in viewer.ts
const unsubStatus = subscribeToPurchaseStatus(wishlistId, setStatuses);

// Merge in component: items.map(item => ({ ...item, status: statuses[item.id] }))
```

`purchaseStatus` docs use the `itemId` as document ID, making the merge O(n) dictionary lookup.

### Anti-Patterns to Avoid

- **Direct client writes to `activityLog`:** The activity log must be append-only from the server. If a client writes directly, a malicious viewer could forge log entries or delete them. Always write log entries through API routes.
- **Storing the invite token in the wishlist doc:** The invite token is in `invites/` (Admin-SDK-only). Denormalizing it into the wishlist doc (which is client-readable) would expose it to child accounts.
- **Reading `users/{uid}` for every viewer in the list:** To show "Köpt av Anna" in the viewer card, fetch the `users/{purchasedByUid}` doc once and cache locally. Don't re-fetch on every render.
- **Not forcing token refresh after invite redemption:** Without `getIdToken(true)`, the viewer role claim won't be available immediately and Firestore rules will deny the next read.
- **Using `use params` in a server component without `await`:** In Next.js 16, `params` is a Promise in server components too — must `await params` or use `use(params)` in client components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure random token generation | Custom UUID or Math.random() string | `crypto.randomBytes(24).toString('hex')` (Node.js built-in) | Cryptographically secure, available in API routes |
| Atomic multi-document write | Sequential `updateDoc` calls | Firestore Admin batch write (`adminDb.batch()`) | Guarantees both purchaseStatus + activityLog are written or neither is |
| Array membership update | Read-modify-write on `viewerUids` | `FieldValue.arrayUnion(uid)` | Atomic, no race condition if two invites redeemed simultaneously |
| Display name lookup | Custom cache | Single `getDoc(users/{uid})` call, store result in component state Map | Simple, correct — user profiles rarely change during a session |
| Clipboard copy | `document.execCommand('copy')` | `navigator.clipboard.writeText(text)` | Modern API, async, works in HTTPS context |

**Key insight:** The most dangerous hand-roll in this phase is implementing activity logging with client-side writes. The moment a client can write to `activityLog`, the log becomes untrustworthy. Keep it server-only.

---

## Common Pitfalls

### Pitfall 1: Firestore Rules Missing for `activityLog`

**What goes wrong:** The `activityLog` subcollection is written via Admin SDK (bypasses rules), but clients need to READ it for the activity log page. Without an explicit rule, client reads will be denied.

**Why it happens:** Forgetting to add rules for new subcollections — Firestore denies all reads by default.

**How to avoid:** Add the rule in `firestore.rules` BEFORE implementing the activity log page. The rule must allow viewers to read, child to not read, and forbid client writes.

**Warning signs:** `PERMISSION_DENIED` errors in browser console when loading the activity log page.

### Pitfall 2: Token Refresh Not Forced After Redemption

**What goes wrong:** After the invite redemption API call sets `role: 'viewer'` custom claim, the client's cached ID token still has the old claims (possibly no role at all). The next Firestore `onSnapshot` call fails with `PERMISSION_DENIED` because `isViewer()` evaluates the token claims.

**Why it happens:** Firebase client SDK caches ID tokens for ~1 hour. Custom claim changes don't invalidate the cache automatically.

**How to avoid:** Always call `auth.currentUser.getIdToken(true)` after the API route sets a new custom claim. Already done in Phase 2 registration; same pattern here.

**Warning signs:** Redirect to viewer wishlist page immediately gets `PERMISSION_DENIED`, even though the API returned `{ ok: true }`.

### Pitfall 3: Settings Page Cannot Read `invites` Collection

**What goes wrong:** The settings page needs to display the current share link (token). The `invites` collection has `allow read, write: if false`. A naive implementation that tries to read the invite from the client will always fail.

**Why it happens:** The Admin-SDK-only rule is intentional (roadmap constraint), but the settings page still needs the token value.

**How to avoid:** Add `GET /api/invite/current?wishlistId=X` API route that reads with Admin SDK and returns the token string. The settings page fetches this on mount.

**Warning signs:** Settings page never shows the invite link, no console error (because the read is never attempted — or silent fail).

### Pitfall 4: Composite Index for Regenerate Query

**What goes wrong:** `POST /api/invite/regenerate` queries `invites` where `wishlistId == X AND active == true`. Without a Firestore composite index, this throws `FAILED_PRECONDITION` with a link to create the index.

**Why it happens:** Firestore requires composite indexes for queries with multiple `where` clauses on different fields.

**How to avoid:** Add the index to `firestore.indexes.json` or create it via the Firestore console before deployment. Alternatively, restructure the query: store the current active token ID in the wishlist doc so the regenerate route does a direct document lookup instead of a query.

**Warning signs:** API route returns 500; server logs show `FAILED_PRECONDITION: The query requires an index`.

**Alternative approach:** Store `currentInviteToken: string` field on the `WishlistDoc`. The settings page reads the wishlist doc (already allowed), gets the token, and the API can look it up directly. This avoids the composite index entirely. The tradeoff: regeneration must update `WishlistDoc.currentInviteToken` atomically with the InviteDoc creation.

### Pitfall 5: `purchaseStatus` Doc May Not Exist

**What goes wrong:** When the viewer wishlist page subscribes to `purchaseStatus`, items that have never been marked purchased won't have a `purchaseStatus` document. The merge logic must handle missing status docs gracefully (treat as "not purchased, no notes").

**Why it happens:** Firestore is sparse — documents only exist when explicitly written.

**How to avoid:** When subscribing to `purchaseStatus`, use `onSnapshot` on the subcollection (not individual docs). If no doc exists for an item, the status is implicitly "unpurchased, no notes." Map by `itemId` using a Record type with undefined entries.

### Pitfall 6: Note Auto-Save Race Condition

**What goes wrong:** Viewer types a note, blurs the field, and immediately blurs again (or two blurs fire rapidly). Two concurrent `POST /api/viewer/update-note` calls execute, and the second one overwrites the first with stale content.

**Why it happens:** `onBlur` fires synchronously; if the first API call is slow, a second blur on the same element fires another request.

**How to avoid:** Debounce the auto-save: use a 500ms debounce on the blur handler, or track an `isSaving` flag that prevents a second request while one is in-flight. Since the update writes to a specific `uid` key in `viewerNotes`, last-write-wins is acceptable — but tracking in-flight state avoids unnecessary double writes.

### Pitfall 7: Viewer Accessing `/wishlist` Route

**What goes wrong:** A viewer who navigates to `/wishlist` sees the child's wishlist page (which doesn't check role — it only checks authentication). This is a UX problem (wrong view) not a security problem (child's items are not sensitive), but still needs handling.

**Why it happens:** The current `/wishlist/page.tsx` only guards on `!user`, not on `role`.

**How to avoid:** Add a role guard to `/wishlist/page.tsx`: if `role === 'viewer'`, redirect to `/dashboard`. (D-21 requires this.) Add this as a task in the plan.

---

## Code Examples

### Existing patterns to reuse verbatim

**Real-time subscription pattern (established Phase 1, used Phase 3):**
```typescript
// src/lib/firebase/wishlist.ts — subscribeToItems
export function subscribeToItems(
  wishlistId: string,
  onItems: (items: WishItemDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'wishlists', wishlistId, 'items'),
    orderBy('position')
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data() as Omit<WishItemDoc, 'id'>,
    }));
    onItems(items);
  });
}
```
[VERIFIED: src/lib/firebase/wishlist.ts]

**API route auth verification pattern (established Phase 2):**
```typescript
// Reuse this exact pattern in all Phase 4 API routes
const { idToken } = body;
let decoded;
try {
  decoded = await adminAuth.verifyIdToken(idToken);
} catch {
  return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
}
```
[VERIFIED: src/app/api/auth/set-viewer-claim/route.ts]

**FieldValue.arrayUnion for viewerUids:**
```typescript
await adminDb.collection('wishlists').doc(wishlistId).update({
  viewerUids: FieldValue.arrayUnion(uid),
});
```
[ASSUMED — standard Firestore Admin SDK pattern, consistent with existing FieldValue.serverTimestamp() usage in codebase]

**Client component auth redirect (established Phase 2, Phase 3):**
```typescript
useEffect(() => {
  if (!loading && !user) router.push('/login');
}, [loading, user, router]);

useEffect(() => {
  if (!loading && user && role !== 'viewer') router.push('/dashboard');
}, [loading, user, role, router]);
```
[VERIFIED: src/app/dashboard/page.tsx and src/app/wishlist/page.tsx — same pattern]

### New patterns for Phase 4

**Firestore `array-contains` query:**
```typescript
const q = query(
  collection(db, 'wishlists'),
  where('viewerUids', 'array-contains', viewerUid)
);
```

**Clipboard write (copy link button):**
```typescript
async function handleCopyLink(text: string) {
  await navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

**FieldValue.delete() for clearing purchasedBy on unmark:**
```typescript
import { FieldValue } from 'firebase-admin/firestore';
batch.update(statusRef, {
  purchasedBy: FieldValue.delete(),
  purchasedAt: FieldValue.delete(),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` is synchronous in Next.js route components | `params` is a `Promise<{...}>`, must use `await params` (server) or `use(params)` (client) | Next.js 15+ | All new dynamic route pages need this pattern |
| `context.params` direct access in route handlers | `const { token } = await params` in route handler second argument | Next.js 15+ | Route handlers with dynamic segments need `await params` |

[VERIFIED: /Users/spangen87/Documents/GitHub/wishlist/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md and route.md]

**Deprecated/outdated in this project's context:**
- `PurchaseStatusDoc.viewerNote?: string`: Replaced by `viewerNotes?: Record<string, string>` in this phase (D-15). The old field name must be removed from `src/types/firestore.ts`.

---

## Firestore Rules Changes Required

Current rules that need updating for Phase 4:

```javascript
// CURRENT (Phase 1-3 rules — missing activityLog)
// NEEDED additions:

// Activity log: viewer-read, Admin-write-only
match /wishlists/{wishlistId}/activityLog/{entryId} {
  allow read: if isViewer(wishlistId);
  allow write: if false;  // Admin SDK only
}

// purchaseStatus: already correct — allow read, write: if isViewer(wishlistId)
// No change needed there.

// wishlists root: viewers need to read the wishlist doc to get childUid for display name
// Current rule already covers this: isViewer(wishlistId) can read wishlists/{wishlistId}
// No change needed.
```

The existing `purchaseStatus` rule (`allow read, write: if isViewer(wishlistId)`) allows client writes. Phase 4's plan routes mutations through API routes for the activity log. The Firestore rules still allow direct client writes to `purchaseStatus` — this is acceptable because the client is already authenticated as a viewer, and the only downside is a missing log entry if a client bypasses the API. For v1, this is an acceptable tradeoff. The activity log write is via Admin SDK from the API route; the purchaseStatus write can be via Admin SDK too (from the same batch) making direct client writes irrelevant.

**Recommendation:** Route ALL purchaseStatus writes through the API for consistency and to make the log trustworthy.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all Phase 4 functionality uses already-verified tools: Node.js crypto built-in, existing Firebase SDK, existing Admin SDK)

---

## Validation Architecture

`nyquist_validation: false` in config — section omitted per instructions.

---

## Security Domain

`security_enforcement` not explicitly set — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Admin `verifyIdToken` in all API routes |
| V3 Session Management | yes | ID token forced refresh after custom claim change (`getIdToken(true)`) |
| V4 Access Control | yes | `isViewer(wishlistId)` Firestore rule; ownership check in `/api/invite/create` |
| V5 Input Validation | yes | Validate `token`, `wishlistId`, `itemId` are non-empty strings in API routes; `purchased` is boolean |
| V6 Cryptography | yes | `crypto.randomBytes(24)` for token — never Math.random() |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged invite redemption (replay old token) | Spoofing | Check `active === true` before redeeming; set `active: false` (NOT done in current plan — SHARE-03 handles revocation but not single-use tokens) |
| IDOR on `/viewer/[wishlistId]` | Elevation of privilege | `isViewer(wishlistId)` Firestore rule blocks non-viewers; client also checks role |
| Log tampering | Tampering | `activityLog` write rule: `allow write: if false` — Admin SDK only |
| Token enumeration | Information disclosure | Token is 48 hex chars (192 bits) — brute-force infeasible |
| Child reads purchaseStatus via direct Firestore SDK | Information disclosure | Rule: `allow read, write: if isViewer(wishlistId)` — child UID not in `viewerUids` |
| Viewer forges "marked purchased" log entries | Tampering | Route mutations through API routes; Admin SDK writes to activityLog |
| Settings page exposed to viewers | Elevation of privilege | Settings route guards: redirect if `role === 'viewer'` (D-02) |

**Note on single-use tokens:** Current design allows a token to be redeemed multiple times (one token → multiple viewers). This is intentional (share with family, not a one-time link). SHARE-03 (revocation) invalidates via `active: false`, not via single-use mechanics. This is a valid design choice, not a security flaw.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | API-route-for-mutations approach is correct for activity log atomicity | Architecture Patterns §3 | If Firestore batch writes from client are used instead, rules must allow activityLog client writes, which weakens log trustworthiness |
| A2 | `crypto.randomBytes` is available in Next.js 16 API routes (Node.js runtime) | Architecture Patterns §4 | If Edge runtime is used instead of Node.js runtime, `crypto.randomBytes` is unavailable — but no Edge runtime is configured in this project |
| A3 | Composite index needed for `where('wishlistId','==',x).where('active','==',true)` on invites | Common Pitfalls §4 | If Firestore auto-creates the index, no action needed. Safer to add `firestore.indexes.json` entry proactively |
| A4 | FieldValue.arrayUnion is appropriate for adding to viewerUids | Code Examples | If two invites redeemed simultaneously, arrayUnion handles concurrency correctly — this is documented Firestore behavior but not verified against Admin SDK 13.x docs specifically |
| A5 | Settings page should use `GET /api/invite/current` rather than denormalizing token to wishlist doc | Architecture Patterns §6 | Either approach works; the alternative (store currentInviteToken in wishlist doc) avoids one API call but requires updating WishlistDoc type |

---

## Open Questions (RESOLVED)

1. **Single-use vs. multi-use invite tokens**
   - What we know: current design is multi-use (anyone with the link can join until revoked)
   - What's unclear: whether the owner wants to limit redemptions (e.g., only family members)
   - Recommendation: Implement multi-use as designed (D-03, D-04, D-05); single-use can be added in v2
   - RESOLVED: Implement multi-use tokens per D-03/D-04/D-05; plan 04-02 implements this

2. **Where does the gear icon live on the child's wishlist page?**
   - What we know: D-01 says "a gear icon on the wishlist page leads to a settings page"
   - What's unclear: exact placement in `/wishlist/page.tsx` header
   - Recommendation: Add gear icon to the top-right of the wishlist page header (same row as the "Din önskelista" heading); plan should include updating `src/app/wishlist/page.tsx` to add this link
   - RESOLVED: Gear icon placed top-right of wishlist header with `aria-label="Inställningar för önskelistan"`; plan 04-05 implements this

3. **Should `purchaseStatus` write still be allowed from client SDK?**
   - What we know: current Firestore rules allow viewer client writes to purchaseStatus; plan routes through API for log atomicity
   - What's unclear: whether to tighten the rule to `allow write: if false` (Admin only) now
   - Recommendation: Leave client write rule in place for now; tightening would require changing ALL purchaseStatus writes to go through API routes — acceptable v1 tradeoff
   - RESOLVED: Leave client write rule as-is (v1 tradeoff); plan 04-01 preserves existing rule

---

## Sources

### Primary (HIGH confidence)
- `src/types/firestore.ts` — All Firestore schema types verified
- `src/lib/firebase/admin.ts` — Admin SDK singleton pattern verified
- `src/app/api/auth/set-viewer-claim/route.ts` — API route auth pattern verified
- `src/app/api/auth/register-child/route.ts` — Transaction + Admin SDK pattern verified
- `src/lib/firebase/wishlist.ts` — onSnapshot subscription pattern verified
- `src/app/wishlist/page.tsx` — Role redirect pattern verified
- `src/app/dashboard/page.tsx` — Dashboard stub to repurpose verified
- `src/components/wishlist/WishItemCard.tsx` — Card component visual pattern verified
- `firestore.rules` — All existing security rules verified
- `package.json` — All installed packages and versions verified
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — `params` as Promise, `use(params)` in client components
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route handler dynamic params pattern, `await params`
- `.planning/phases/04-viewer-flow/04-UI-SPEC.md` — Full component inventory, interaction contracts, copywriting verified

### Secondary (MEDIUM confidence)
- `.planning/phases/04-viewer-flow/04-CONTEXT.md` — All decisions D-01 through D-21 verified as locked
- `.planning/STATE.md` — Phase 3 complete, patterns established

### Tertiary (LOW confidence — [ASSUMED])
- Composite index requirement for `where('wishlistId').where('active')` query on `invites` (A3)
- FieldValue.arrayUnion concurrency behavior in Admin SDK 13.x (A4)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json, no new installs needed
- Architecture: HIGH for patterns derived from existing code; MEDIUM for new API route design (ASSUMED)
- Pitfalls: HIGH for token refresh and rules pitfalls (verified by Phase 2 pattern); MEDIUM for composite index pitfall (ASSUMED)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack, no fast-moving dependencies)
