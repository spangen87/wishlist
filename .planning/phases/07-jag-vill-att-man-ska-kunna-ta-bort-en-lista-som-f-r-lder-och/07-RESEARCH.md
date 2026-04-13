# Phase 7: Delete Wishlist + Account Deletion + Cascade Data Cleanup - Research

**Researched:** 2026-04-13
**Domain:** Firebase Admin SDK (Auth + Firestore), Next.js App Router API Routes, data cascade deletion
**Confidence:** HIGH

---

## Summary

This phase has three distinct sub-problems: (1) letting a parent delete a child's wishlist document plus all its subcollections, (2) letting a parent delete a child account or delete their own account — which requires removing the Firebase Auth user and all Firestore documents associated with that UID, and (3) cleaning up orphaned data for users that were already deleted from Auth but whose Firestore documents were never removed.

The Firestore data model is fully understood from source inspection. There are no Cloud Functions in this project — all server operations run via Next.js API Route Handlers using the Admin SDK. That pattern continues for this phase. The `@google-cloud/firestore` package bundled with `firebase-admin@13.7.0` exposes `adminDb.recursiveDelete(ref)`, which handles subcollection cascade without manual enumeration. This is the correct tool for deleting wishlists. Account deletion uses `adminAuth.deleteUser(uid)` followed by a targeted Firestore batch that removes the known documents for that UID.

**Primary recommendation:** Implement three API Route Handlers — `DELETE /api/wishlist/[wishlistId]` (wishlist delete), `DELETE /api/auth/user/[uid]` (account delete), and `POST /api/admin/purge-orphans` (one-time/on-demand orphan cleanup). All three use Admin SDK with idToken-based auth verification matching the existing project pattern.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 7 yet (phase not yet discussed). Research covers the full scope described in the phase objective. The planner has full discretion.

---

## Data Model Inventory (from codebase inspection)

This is the complete map of all Firestore data owned by or referencing a user UID.

### Collections written at account creation time

| Collection path | Key field | Written where |
|----------------|-----------|---------------|
| `users/{uid}` | Document ID = uid | `register-child` route, `set-viewer-claim` route, `set-parent-claim` route, `invite/redeem` route |
| `usernames/{username}` | `uid` field | `register-child` route (child accounts only) |
| `wishlists/{uid}` | Document ID = childUid | `register-child` route (wishlist ID = child UID) |

### Subcollections under `wishlists/{wishlistId}`

| Subcollection path | Written where |
|-------------------|---------------|
| `wishlists/{id}/items/{itemId}` | `wishlist/add-item` route + client-side `addWishItem` helper |
| `wishlists/{id}/purchaseStatus/{itemId}` | `viewer/mark-purchased` route |
| `wishlists/{id}/activityLog/{entryId}` | `viewer/mark-purchased` route (Admin SDK batch) |

### UID references embedded inside other documents

| Location | Field | Notes |
|----------|-------|-------|
| `wishlists/{id}.viewerUids[]` | array of viewer UIDs | If a viewer account is deleted, their UID stays in this array until cleaned |
| `wishlists/{id}.parentUids[]` | array of parent UIDs | Same — parent UID stays until cleaned |
| `wishlists/{id}.childUid` | string | The entire wishlist belongs to this child |
| `invites/{token}.wishlistId` | string | Not a UID reference; token docs are separate |

### Invite documents

`invites/{token}` docs are **not** keyed by UID. They reference a `wishlistId`. When a wishlist is deleted, orphaned invite tokens remain but are harmless (they reference a non-existent wishlist and will 404 on redeem). Optionally clean them in the same operation.

### What "orphaned data" means (the user's problem)

When a user was deleted from Firebase Auth manually (via Console), the following were NOT automatically cleaned:
- `users/{uid}` — still exists
- `usernames/{username}` — still exists (for child accounts), blocking the username
- `wishlists/{uid}` — still exists (for child accounts), with all subcollections

[VERIFIED: firestore.rules, src/types/firestore.ts, all route handlers inspected in session]

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Installed Version | Purpose | Source |
|---------|-----------------|---------|--------|
| `firebase-admin` | 13.7.0 | `adminAuth.deleteUser()`, `adminDb.recursiveDelete()` | [VERIFIED: package.json] |
| `@google-cloud/firestore` | 7.11.6 | Bundled with firebase-admin; exposes `recursiveDelete()` | [VERIFIED: node_modules inspection] |
| `next` | 16.2.2 | App Router API Route Handlers | [VERIFIED: package.json] |
| `firebase` | 12.12.0 | Client-side `auth.currentUser.getIdToken()` for caller identity | [VERIFIED: package.json] |

**No new npm packages are needed for this phase.**

Current registry versions: `firebase-admin@13.8.0`, `firebase@12.12.0`. Project is one patch behind on firebase-admin and current on firebase. No upgrade required for this phase.

[VERIFIED: npm registry via npm view]

---

## Architecture Patterns

### Pattern 1: API Route Handler with idToken auth (established project pattern)

Every server mutation in this project follows the same shape. This phase MUST follow it.

```typescript
// Source: src/app/api/wishlist/update-title/route.ts (inspected in session)
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, ...payload } = body;

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorization check: verify caller has the right to perform action
  // ... then perform the operation
}
```

[VERIFIED: all existing route handlers follow this pattern]

### Pattern 2: Cascade-delete a wishlist document (subcollections)

Firestore client SDK `deleteDoc()` deletes only the root document — subcollections (`items`, `purchaseStatus`, `activityLog`) are left as orphans. The Admin SDK's `recursiveDelete()` handles the full tree.

```typescript
// Source: @google-cloud/firestore 7.11.6 (inspected node_modules in session)
// adminDb is the Firestore Admin SDK instance from @/lib/firebase/admin
import { adminDb } from '@/lib/firebase/admin';

const wishlistRef = adminDb.collection('wishlists').doc(wishlistId);
await adminDb.recursiveDelete(wishlistRef);
// Deletes: wishlists/{id} + items/* + purchaseStatus/* + activityLog/*
```

`recursiveDelete()` signature: `recursiveDelete(ref: DocumentReference | CollectionReference, bulkWriter?: BulkWriter): Promise<void>`

It uses `BulkWriter` internally (max 5000 pending ops, throttled). For a single wishlist this is well within limits.

[VERIFIED: node_modules/@google-cloud/firestore/build/src/index.js lines 1100-1132]

### Pattern 3: Delete a child account (full cascade)

When deleting a **child account**, the sequence is:

1. Read `users/{uid}` to get the `username` field (needed for `usernames/{username}` deletion)
2. Delete Firebase Auth user: `adminAuth.deleteUser(uid)`
3. Cascade-delete the wishlist + all subcollections: `adminDb.recursiveDelete(wishlistRef)`
4. Batch-delete remaining flat documents: `users/{uid}` and `usernames/{username}`
5. Clean up any `invites` docs referencing this wishlist (query by `wishlistId`)

```typescript
// Source: derived from seed-emulator.ts + register-child/route.ts patterns (inspected in session)
const userSnap = await adminDb.collection('users').doc(childUid).get();
const username: string | undefined = userSnap.data()?.username;

// Delete Auth user (idempotent — throws if already gone, wrap in try/catch)
await adminAuth.deleteUser(childUid);

// Cascade delete wishlist + all subcollections
const wishlistRef = adminDb.collection('wishlists').doc(childUid);
await adminDb.recursiveDelete(wishlistRef);

// Batch delete flat docs
const batch = adminDb.batch();
batch.delete(adminDb.collection('users').doc(childUid));
if (username) {
  batch.delete(adminDb.collection('usernames').doc(username));
}
await batch.commit();

// Clean up orphaned invites for this wishlist
const inviteSnap = await adminDb.collection('invites')
  .where('wishlistId', '==', childUid).get();
const inviteBatch = adminDb.batch();
inviteSnap.docs.forEach(d => inviteBatch.delete(d.ref));
await inviteBatch.commit();
```

[VERIFIED: data model from src/types/firestore.ts, register-child/route.ts, seed-emulator.ts]

### Pattern 4: Delete a parent/viewer account (self-delete)

When a **parent or viewer** deletes their own account:

1. Remove their UID from `viewerUids` / `parentUids` arrays in all wishlists they appear in
2. Delete `users/{uid}` Firestore document
3. Delete Firebase Auth user: `adminAuth.deleteUser(uid)`

There is no `usernames/` doc for parents/viewers (only child accounts use synthetic email + username mapping).

Finding all wishlists a parent appears in requires two queries:
- `wishlists` where `parentUids` array-contains `uid`
- `wishlists` where `viewerUids` array-contains `uid`

Then `FieldValue.arrayRemove(uid)` on each.

[VERIFIED: src/lib/firebase/viewer.ts shows exactly these query patterns already in use for subscriptions]

### Pattern 5: Orphan cleanup (one-time admin operation)

For users already deleted from Auth (the user's stated problem):

```typescript
// List all users/{uid} docs, try adminAuth.getUser(uid) for each,
// if auth/user-not-found → their data is orphaned → delete
const usersSnap = await adminDb.collection('users').get();
for (const userDoc of usersSnap.docs) {
  const uid = userDoc.id;
  try {
    await adminAuth.getUser(uid);
    // User still exists in Auth — skip
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/user-not-found') {
      // Orphan — clean up
      // Same cascade as Pattern 3 or 4 depending on role
    }
  }
}
```

This can be exposed as a protected API route (`POST /api/admin/purge-orphans`) that requires a secret header or admin UID, or run as a one-time Node.js script. Given the project has no Cloud Functions, a script similar to `scripts/seed-emulator.ts` is the lowest-friction option.

[VERIFIED: adminAuth.getUser() and error code pattern from base-auth.js inspected in session]

### Recommended New Routes

| Route | HTTP Method | Who calls it | Purpose |
|-------|-------------|-------------|---------|
| `src/app/api/wishlist/[wishlistId]/route.ts` | `DELETE` | Parent UI | Delete one wishlist + all subcollections |
| `src/app/api/auth/user/[uid]/route.ts` | `DELETE` | Parent UI (child delete) or settings (self-delete) | Delete Auth user + all Firestore data |
| `scripts/purge-orphans.ts` | CLI script | Admin (run once) | Clean up users deleted from Auth without Firestore cleanup |

### Recommended Project Structure Additions

```
src/app/api/
├── wishlist/
│   └── [wishlistId]/
│       └── route.ts        # DELETE: cascade-delete wishlist
├── auth/
│   └── user/
│       └── [uid]/
│           └── route.ts    # DELETE: delete account + all user data
scripts/
└── purge-orphans.ts        # One-time cleanup script (like seed-emulator.ts)
```

### UI Integration Points

- **Delete wishlist button:** Add to `/wishlist/[wishlistId]/settings/page.tsx` — already the settings page for both child owners and parents. A destructive confirmation button fits here.
- **Delete child account:** Add to `/wishlist/[wishlistId]/settings/page.tsx` under a "Danger zone" section — parent-only, shown when `accessType === 'parent'`.
- **Delete own account:** Add to a future `/settings` page OR to the dashboard page. The dashboard page at `src/app/dashboard/page.tsx` already has a logout button that could have a "Delete account" sibling.

[VERIFIED: settings page source inspected in session, dashboard page inspected in session]

### Anti-Patterns to Avoid

- **Client-side `deleteDoc()` on wishlist root:** Leaves subcollections (`items`, `purchaseStatus`, `activityLog`) as permanent orphans — use `adminDb.recursiveDelete()` instead.
- **Skipping idToken verification:** All existing routes verify the caller via `adminAuth.verifyIdToken(idToken)` — never skip this.
- **Deleting Auth user before Firestore data:** If the Firestore delete fails after Auth deletion, you get a partially-cleaned state. Delete Firestore data first, then Auth — or wrap in try/catch with explicit error reporting.
- **Calling `adminAuth.deleteUser()` without checking if the caller has the right:** A parent can only delete their own children's accounts. Verify `parentUids.includes(callerUid)` before deleting.
- **Using client Firestore SDK for the delete route:** Firestore rules `allow delete: if isOwner(wishlistId)` means the child (owner) can delete the root wishlist doc, but cannot delete the `activityLog` subcollection (`allow write: if false`). Admin SDK bypasses rules entirely — use it.

---

## Security: Who Can Delete What

| Action | Allowed callers | Firestore rule situation |
|--------|----------------|--------------------------|
| Delete wishlist (cascade) | Child owner OR parent | Rules allow child to `delete` the wishlist root; Admin SDK bypasses rules for subcollections. Use Admin SDK for the whole operation. |
| Delete child account | Parent only (in `parentUids`) | No Firestore rule governs this — enforced in API route logic only |
| Delete own (parent/viewer) account | The user themselves | Enforced via idToken: `decoded.uid === uid` |

**Authorization check for wishlist delete:**
```typescript
const data = wishlistSnap.data()!;
const callerIsOwner = data.childUid === decoded.uid;
const callerIsParent = (data.parentUids ?? []).includes(decoded.uid);
if (!callerIsOwner && !callerIsParent) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Authorization check for child account delete (parent only):**
```typescript
// wishlistId === childUid for child accounts
const data = wishlistSnap.data()!;
const callerIsParent = (data.parentUids ?? []).includes(decoded.uid);
if (!callerIsParent) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

[VERIFIED: firestore.rules, register-child/route.ts, update-title/route.ts patterns inspected in session]

---

## Runtime State Inventory

> This phase involves cascade deletion of Firestore state but NOT a rename/refactor. The orphan cleanup is data remediation, not a rename. This section answers the "what runtime state exists" question for the cleanup context.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `users/{uid}`, `usernames/{username}`, `wishlists/{uid}` + subcollections for users deleted from Auth | `purge-orphans.ts` script deletes them |
| Live service config | No external services reference user UIDs outside of Firebase | None |
| OS-registered state | None | None |
| Secrets/env vars | No rename — existing env vars unchanged | None |
| Build artifacts | None | None |

**Orphaned data root cause:** The app has no Auth deletion trigger (no Cloud Functions, no `onDelete` listener). When an admin deletes a user from Firebase Console, there is no server code to clean Firestore. This phase adds explicit deletion logic to API routes. The existing orphans require a one-time script.

[VERIFIED: firebase.json has no `functions` section; /functions directory does not exist]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| firebase-admin | All delete routes | Yes | 13.7.0 | — |
| @google-cloud/firestore (bundled) | `recursiveDelete()` | Yes | 7.11.6 | — |
| Firebase Auth emulator | Local testing | Yes | port 9099 per firebase.json | — |
| Firestore emulator | Local testing | Yes | port 8080 per firebase.json | — |
| npm run emulator | Integration tests | Yes | firebase-tools 15.13.0 | — |

No missing dependencies.

[VERIFIED: package.json, firebase.json inspected in session]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subcollection cascade delete | Manual `getDocs()` loop on each subcollection | `adminDb.recursiveDelete(ref)` | Handles arbitrarily deep nesting, uses BulkWriter with throttling, already in installed package |
| Auth user existence check during orphan scan | Custom REST call to Auth API | `adminAuth.getUser(uid)` catch `auth/user-not-found` | Standard Admin SDK pattern, handles all edge cases |
| Batch Firestore deletes | Serial `deleteDoc()` calls | `adminDb.batch()` | Atomic, one network round-trip for ≤500 docs |

---

## Common Pitfalls

### Pitfall 1: `deleteDoc()` on wishlist root leaves subcollections

**What goes wrong:** Client `deleteDoc(doc(db, 'wishlists', wishlistId))` deletes only the root document. The `items`, `purchaseStatus`, and `activityLog` subcollections remain permanently — they are never visible in queries but consume storage quota and block username re-use indirectly.

**Why it happens:** Firestore's "delete document" operation is document-only; subcollections are independent trees.

**How to avoid:** Always use `adminDb.recursiveDelete(wishlistRef)` from an API route. The client can never call this — it is Admin SDK only.

**Warning signs:** Firestore Console shows empty `wishlists/` collection but non-empty subcollection paths still appear under document IDs.

### Pitfall 2: Deleting Auth user before cleaning Firestore

**What goes wrong:** If `adminAuth.deleteUser(uid)` succeeds but the Firestore writes then fail, the Auth user is gone but all their Firestore data remains — permanently orphaned.

**Why it happens:** The two operations are not atomic.

**How to avoid:** Delete Firestore data first, then call `adminAuth.deleteUser(uid)`. If Firestore succeeds and Auth delete fails, the worst case is data is cleaned but the Auth user still exists — retry is safe.

### Pitfall 3: `adminAuth.deleteUser()` throws if user already deleted

**What goes wrong:** If a parent tries to delete a child account that was already deleted from Auth Console, the API route throws an uncaught error.

**Why it happens:** `deleteUser()` throws `auth/user-not-found` for missing UIDs.

**How to avoid:** Wrap `deleteUser` in try/catch, treat `auth/user-not-found` as success (idempotent delete).

**Code:**
```typescript
try {
  await adminAuth.deleteUser(uid);
} catch (err: unknown) {
  if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  // Already gone from Auth — proceed to clean Firestore
}
```

[VERIFIED: deleteUser implementation in base-auth.js inspected in session]

### Pitfall 4: Parent UID lingers in other wishlists' `parentUids` / `viewerUids` after self-delete

**What goes wrong:** If a parent deletes their own account, their UID stays in `parentUids` and `viewerUids` arrays of every wishlist they had access to. Those UIDs are then permanently stale — they don't cause errors but take up space.

**Why it happens:** The arrays are denormalized in Firestore; there is no referential integrity.

**How to avoid:** Before deleting the Auth user, query `wishlists` where `parentUids array-contains uid` and `wishlists` where `viewerUids array-contains uid`, then `FieldValue.arrayRemove(uid)` from each.

### Pitfall 5: Wishlist settings page has no destructive confirm — users can fat-finger delete

**What goes wrong:** A single click on "Delete" triggers irreversible cascade deletion with no undo.

**How to avoid:** Show a confirmation dialog or require typing the child's name before the delete proceeds. This is a UX requirement, not a backend concern, but must be planned.

### Pitfall 6: Orphan scan iterates all `users/` documents — could time out on large collections

**What goes wrong:** The purge-orphans script does `adminDb.collection('users').get()` which loads all user documents. If the collection grows large, this could hit memory limits or timeout.

**Why it happens:** No cursor-based pagination in the script.

**How to avoid:** For the current scale (small family app, tens of users), a full scan is safe. Add `.limit()` with cursor pagination if this becomes a concern at scale. Note this is a one-time remediation script, not an ongoing API.

---

## Code Examples

### Verified: cascade-delete wishlist API route shape

```typescript
// src/app/api/wishlist/[wishlistId]/route.ts
// Source: derived from update-title/route.ts + recursiveDelete inspected in session
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ wishlistId: string }> }
) {
  const { wishlistId } = await params;
  const body = await request.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = wishlistSnap.data()!;
  const callerIsOwner = data.childUid === decoded.uid;
  const callerIsParent = (data.parentUids ?? []).includes(decoded.uid);
  if (!callerIsOwner && !callerIsParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Cascade-delete wishlist + all subcollections (Admin SDK)
  await adminDb.recursiveDelete(adminDb.collection('wishlists').doc(wishlistId));

  // 2. Deactivate invite tokens for this wishlist
  const inviteSnap = await adminDb.collection('invites')
    .where('wishlistId', '==', wishlistId).get();
  if (!inviteSnap.empty) {
    const batch = adminDb.batch();
    inviteSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  return NextResponse.json({ ok: true });
}
```

### Verified: delete child account API route shape

```typescript
// src/app/api/auth/user/[uid]/route.ts
// Source: derived from register-child/route.ts + base-auth.js inspected in session
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: targetUid } = await params;
  const body = await request.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSelf = decoded.uid === targetUid;

  // Load user profile to determine role + username
  const userSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const userData = userSnap.data()!;
  const role: string = userData.role;
  const username: string | undefined = userData.username;

  if (role === 'child') {
    // Only a parent of this child's wishlist may delete the child account
    const wishlistSnap = await adminDb.collection('wishlists').doc(targetUid).get();
    const parentUids: string[] = wishlistSnap.exists ? (wishlistSnap.data()!.parentUids ?? []) : [];
    if (!parentUids.includes(decoded.uid)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete Firestore data first, then Auth (Pitfall 2)
    await adminDb.recursiveDelete(adminDb.collection('wishlists').doc(targetUid));
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('users').doc(targetUid));
    if (username) batch.delete(adminDb.collection('usernames').doc(username));
    await batch.commit();

    // Clean invite tokens
    const inviteSnap = await adminDb.collection('invites')
      .where('wishlistId', '==', targetUid).get();
    if (!inviteSnap.empty) {
      const inviteBatch = adminDb.batch();
      inviteSnap.docs.forEach(d => inviteBatch.delete(d.ref));
      await inviteBatch.commit();
    }
  } else {
    // Parent or viewer deleting themselves
    if (!isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Remove UID from all wishlists
    const { FieldValue } = await import('firebase-admin/firestore');
    const [parentLists, viewerLists] = await Promise.all([
      adminDb.collection('wishlists').where('parentUids', 'array-contains', targetUid).get(),
      adminDb.collection('wishlists').where('viewerUids', 'array-contains', targetUid).get(),
    ]);
    const removalBatch = adminDb.batch();
    parentLists.docs.forEach(d =>
      removalBatch.update(d.ref, { parentUids: FieldValue.arrayRemove(targetUid) }));
    viewerLists.docs.forEach(d =>
      removalBatch.update(d.ref, { viewerUids: FieldValue.arrayRemove(targetUid) }));
    removalBatch.delete(adminDb.collection('users').doc(targetUid));
    await removalBatch.commit();
  }

  // Delete Auth user (idempotent)
  try {
    await adminAuth.deleteUser(targetUid);
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  }

  return NextResponse.json({ ok: true });
}
```

### Verified: client-side call from settings page

```typescript
// Inside 'use client' component — same pattern as CoParentInviteSection
const idToken = await auth.currentUser?.getIdToken();
const res = await fetch(`/api/wishlist/${wishlistId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});
if (res.ok) router.push('/dashboard');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual subcollection enumeration + batch delete | `adminDb.recursiveDelete(ref)` | firebase-admin v9+ / @google-cloud/firestore v5+ | No custom traversal code needed |
| Cloud Functions `onDelete` trigger for cascade | Admin SDK route handler (this project has no Cloud Functions) | Design choice in this project | Cascade must be explicit in API route — cannot be a trigger |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Already in use in this project |

**No Cloud Functions:** The project has no `functions/` directory and `firebase.json` does not configure functions emulation. The established pattern is Next.js API Route Handlers with Admin SDK. This phase continues that pattern.

[VERIFIED: firebase.json, project root directory listing]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A parent/viewer can self-delete their own account from a settings page not yet built | Architecture Patterns | If the UI entry point is different, API route location may shift |
| A2 | Orphaned data cleanup is a one-time script, not an ongoing scheduled task | Common Pitfalls | If ongoing cleanup is needed, a Cloud Function trigger is more robust — but adds complexity |

---

## Open Questions

1. **Should wishlist delete also revoke the child's Auth account?**
   - What we know: Deleting a wishlist could leave the child account as an orphan with no wishlist
   - What's unclear: User intent — does "delete list" mean "delete the child" or just "reset the list"?
   - Recommendation: Treat them as separate operations. Delete wishlist (keep child auth). Delete account = delete everything.

2. **Can a parent delete their own account if they still have children?**
   - What we know: The parent's account is separate from the child's account
   - What's unclear: Should self-deletion be blocked if `parentWishlists.length > 0`?
   - Recommendation: Allow it — remove the parent from `parentUids` arrays. The child's account and wishlist remain intact.

3. **Should viewers be removable from a wishlist (without account deletion)?**
   - What we know: `viewerUids` is an array; removing a UID from it revokes access
   - What's unclear: Phase scope — is "remove viewer from list" in scope for Phase 7?
   - Recommendation: Out of scope for Phase 7; can be done in settings page Phase 8.

---

## Sources

### Primary (HIGH confidence)
- `src/types/firestore.ts` — complete data model, all collections and fields
- `src/app/api/auth/register-child/route.ts` — account creation + Firestore write pattern
- `src/app/api/wishlist/update-title/route.ts` — idToken auth pattern
- `src/app/api/invite/redeem/route.ts` — FieldValue.arrayUnion, wishlist update pattern
- `firestore.rules` — security rules, what client can/cannot delete
- `node_modules/@google-cloud/firestore/build/src/index.js` lines 1100-1132 — `recursiveDelete()` confirmed present and documented
- `node_modules/firebase-admin/lib/auth/base-auth.js` lines 337-395 — `deleteUser()` and `deleteUsers()` signatures
- `firebase.json` — confirms no Cloud Functions
- `package.json` — all installed versions

### Secondary (MEDIUM confidence)
- `scripts/seed-emulator.ts` — confirms script pattern for one-off admin operations, same shape as proposed `purge-orphans.ts`
- `src/app/wishlist/[wishlistId]/settings/page.tsx` — UI insertion point for delete actions

### Tertiary (LOW confidence — none)
No claims rely solely on training data without codebase verification.

---

## Metadata

**Confidence breakdown:**
- Data model inventory: HIGH — all collections verified by reading every route handler and type file
- `recursiveDelete` availability: HIGH — confirmed in installed node_modules
- Architecture pattern: HIGH — follows identical shape to all existing API routes
- Security logic: HIGH — derived directly from Firestore rules and existing authorization checks
- UI insertion points: HIGH — settings page and dashboard page both inspected

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack — firebase-admin, Next.js App Router patterns unlikely to change)
