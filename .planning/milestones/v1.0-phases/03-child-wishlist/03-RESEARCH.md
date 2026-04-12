# Phase 3: Child Wishlist - Research

**Researched:** 2026-04-09
**Domain:** Firestore CRUD, fractional indexing, @dnd-kit drag-and-drop, Next.js 16 App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** After login, child is redirected directly to `/wishlist` — the current dashboard stub will be repurposed or bypassed for child-role users.
- **D-02:** Route `/wishlist` shows the logged-in child's own wishlist (auth-based). Firestore lookup: `wishlists` where `childUid == user.uid`.
- **D-03:** Adding a new item uses an **inline expanded form** — no modal, no navigation.
- **D-04:** All fields available in add form: title (required), productUrl, imageUrl, note, price.
- **D-05:** Cards are **wide/detailed** — all fields visible directly in list view.
- **D-06:** Cards display `imageUrl` as a 64×64 thumbnail; placeholder rectangle when absent.
- **D-07:** Editing is **inline** — clicking a card turns fields into editable inputs; Save / Cancel buttons.
- **D-08:** Delete from inline-edit state with inline "Are you sure?" confirmation — no modal.
- **D-09:** Drag handle is **always visible** on each card (grip icon on left or right edge).
- **D-10:** Fractional indexing via `fractional-indexing` npm package. One Firestore write per reorder (update only the moved item's `position`).
- **D-11:** Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable`.
- **D-12:** Child view reads ONLY from `wishlists/{id}/items` — never touches `purchaseStatus`.
- **D-13:** No purchased indicator, buyer name, or viewer notes in child's view.
- **D-14:** Child-friendly empty state: illustration (emoji), encouraging message, prominent CTA.
- **D-15:** Responsive: single-column card list on 375px mobile and 768px tablet. Touch drag works on mobile.

### Claude's Discretion

- Exact color scheme and pastel tones (constrained by UI-01; Phase 3 establishes tokens for Phase 5 to refine)
- Fractional index initialization strategy (midpoint between 0 and 1 for first item)
- Specific animation/transition on card expand/collapse
- Form validation error display style
- Skeleton loading state design

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 3 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WISH-01 | Child can add a wish item with title (required) | Firestore `addDoc` to `wishlists/{id}/items`; inline AddItemForm component |
| WISH-02 | Child can add a product URL to a wish item | Optional `productUrl` field in WishItemDoc; `<input type="url">` in form |
| WISH-03 | Child can add an image via URL | Optional `imageUrl` field; `<img>` thumbnail with fallback placeholder |
| WISH-04 | Child can add a note | Optional `note` field; `<textarea>` in form |
| WISH-05 | Child can add approximate price | Optional `price: number` field; `<input type="number">` |
| WISH-06 | Child can edit and delete their own items | Inline edit state on card; `updateDoc` / `deleteDoc`; inline delete confirmation |
| WISH-07 | Child can reorder items via drag-and-drop | `@dnd-kit/sortable` + `fractional-indexing`; one `updateDoc` write on `onDragEnd` |
| WISH-08 | Child's view does NOT show purchased/bought status | Client code never queries `purchaseStatus` subcollection; Firestore rules already deny read |
| UI-02 | Responsive layout on mobile and tablet | `max-w-2xl mx-auto`, `px-4` on mobile, Tailwind responsive classes; `TouchSensor` for mobile drag |
</phase_requirements>

---

## Summary

Phase 3 delivers the entire child-facing wishlist experience. The data model and Firestore security rules are already in place from Phase 1 — `wishlists/{id}/items` is readable/writable by the owner child, and `purchaseStatus` is blocked from the child at the rules level. The main implementation work is:

1. **Wishlist bootstrap:** The `register-child` route does NOT create a `wishlists` document. Phase 3 must detect a missing wishlist document and create it (with `childUid`, empty `viewerUids`, `createdAt`) on first load or first item add.

2. **CRUD UI:** Inline add form, inline editing on cards, inline delete confirmation — all on a single `/wishlist` page. No modals, no navigation. Components are hand-built from Tailwind primitives (no shadcn, no component library).

3. **Drag-and-drop ordering:** `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0, neither of which is installed yet. The `fractional-indexing` v3.2.0 package also needs installing. On `onDragEnd`, compute new position string with `generateKeyBetween` and call `updateDoc` on only the moved item — one write.

4. **Post-login routing:** The login page currently redirects to `/dashboard`. Phase 3 must change child-role users to be redirected to `/wishlist`. The dashboard stub can remain for viewer-role users.

**Primary recommendation:** Install the three missing packages first, then implement in this order: (1) wishlist bootstrap + real-time listener, (2) item CRUD, (3) drag-and-drop, (4) post-login redirect.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | DnD sensor/context layer | Peer dep required by @dnd-kit/sortable |
| @dnd-kit/sortable | 10.0.0 | Sortable list abstraction | Locked decision D-11; modern, accessible, touch-native |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers (CSS.Transform.toString) | Required to apply transform style from useSortable |
| fractional-indexing | 3.2.0 | Position string generation | Locked decision D-10; one write per reorder |
| firebase (already installed) | ^12.11.0 | Firestore CRUD + real-time listeners | Already in project |

[VERIFIED: npm registry — versions confirmed via `npm view` on 2026-04-09]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss (already installed) | ^4 | All styling | All UI components in this phase |
| react (already installed) | 19.2.4 | Component framework | All client components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/sortable | react-beautiful-dnd | react-beautiful-dnd is unmaintained; dnd-kit is locked (D-11) |
| fractional-indexing | integer position + O(n) writes | Integer positions require updating all items after the insertion point; fractional-indexing is locked (D-10) |
| inline forms | modals | Modals are explicitly locked out (D-03, D-07) |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities fractional-indexing
```

**Version verification:** All versions confirmed against npm registry on 2026-04-09.
[VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── wishlist/
│       └── page.tsx              # /wishlist route — WishlistPage
├── components/
│   ├── wishlist/
│   │   ├── WishItemCard.tsx      # Card in read mode
│   │   ├── WishItemCard.edit.tsx # OR: edit mode as internal state of WishItemCard
│   │   ├── AddItemForm.tsx       # Inline add form
│   │   ├── EmptyState.tsx        # Empty state illustration + CTA
│   │   ├── LoadingSkeleton.tsx   # 3-card pulse skeleton
│   │   └── DragHandle.tsx        # Reusable grip icon SVG
│   └── AuthProvider.tsx          # Already exists
└── lib/
    └── firebase/
        ├── client.ts             # Already exists (db, auth exports)
        └── wishlist.ts           # NEW: Firestore helpers (getOrCreateWishlist, addItem, updateItem, deleteItem, updatePosition)
```

### Pattern 1: Wishlist Bootstrap (get-or-create)
**What:** `wishlists` doc keyed by child UID does not exist until explicitly created. Phase 3 must create it on first access.
**When to use:** In the real-time listener setup hook, before attaching the `onSnapshot`.

```typescript
// Source: codebase (register-child route does NOT create wishlists doc)
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

async function getOrCreateWishlist(childUid: string): Promise<string> {
  const q = query(
    collection(db, 'wishlists'),
    where('childUid', '==', childUid)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  // First-time: create the wishlist doc
  const ref = await addDoc(collection(db, 'wishlists'), {
    childUid,
    viewerUids: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
```

**WARNING — Firestore rules check:** The `allow create: if isAuthenticated()` rule on `/wishlists/{wishlistId}` permits this. [VERIFIED: firestore.rules in codebase]

### Pattern 2: Real-Time Items Listener (ordered by position)
**What:** Subscribe to `wishlists/{id}/items` ordered by `position` string. Returns unsubscribe fn for cleanup.
**When to use:** In a `useEffect` inside the WishlistPage (or a custom hook `useWishlistItems`).

```typescript
// Source: Firebase JS SDK v12 — onSnapshot + query
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { WishItemDoc } from '@/types/firestore';

function subscribeToItems(
  wishlistId: string,
  onItems: (items: WishItemDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'wishlists', wishlistId, 'items'),
    orderBy('position')
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WishItemDoc));
    onItems(items);
  });
}
```

### Pattern 3: Fractional Indexing for Position
**What:** Use `generateKeyBetween` to compute the position for the moved item after a drag.
**When to use:** Inside `onDragEnd` handler in the sortable list component.

```typescript
// Source: fractional-indexing v3.2.0 README (rocicorp/fractional-indexing)
import { generateKeyBetween } from 'fractional-indexing';

// First item ever added (empty list):
const position = generateKeyBetween(null, null); // "a0"

// Append after last item (prevPosition = last item's position):
const position = generateKeyBetween(prevPosition, null); // e.g. "a1"

// Prepend before first item:
const position = generateKeyBetween(null, firstPosition); // e.g. "Zz"

// Insert between two items (after index i, before index i+1):
const position = generateKeyBetween(
  items[i].position,
  items[i + 1]?.position ?? null
);
```

**One write per reorder:**
```typescript
// onDragEnd: only updateDoc on the moved item
import { doc, updateDoc } from 'firebase/firestore';

await updateDoc(
  doc(db, 'wishlists', wishlistId, 'items', movedItemId),
  { position: newPosition }
);
```
[VERIFIED: fractional-indexing README — generateKeyBetween(a, b) signature confirmed]

### Pattern 4: @dnd-kit/sortable — Drag Handle Setup
**What:** Attach `setNodeRef` to the card container, `setActivatorNodeRef` + `listeners` to the drag handle button only. This restricts drag activation to the handle rather than the entire card.
**When to use:** In WishItemCard component.

```typescript
// Source: dndkit.com/presets/sortable/usesortable (official docs)
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function WishItemCard({ id }: { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* Drag handle — ONLY this element activates drag */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        aria-label="Dra för att ändra ordning"
        style={{ touchAction: 'none' }} // Required for touch devices
      >
        {/* grip SVG */}
      </button>
      {/* Card content — NOT draggable */}
    </div>
  );
}
```

**CRITICAL:** `touch-action: none` must be applied to the drag handle element (not the whole card). This prevents the browser from intercepting touch scroll events during drag initiation. Applying it to the whole card would break page scrolling on mobile.
[VERIFIED: dndkit.com — pointer sensor docs confirm touch-action recommendation]

### Pattern 5: DndContext + SortableContext + Sensors Setup
**What:** Configure PointerSensor and TouchSensor with appropriate activation constraints.

```typescript
// Source: dndkit.com official docs + UI-SPEC DragAndDropList section
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,      // 250ms hold before drag starts (matches UI-SPEC)
      tolerance: 8,    // 8px movement tolerance during delay
    },
  })
);

// In JSX:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
    {items.map(item => <WishItemCard key={item.id} {...item} />)}
  </SortableContext>
  <DragOverlay>
    {activeItem ? <WishItemCard {...activeItem} isOverlay /> : null}
  </DragOverlay>
</DndContext>
```

### Pattern 6: Post-Login Redirect for Child Role
**What:** The login page currently redirects to `/dashboard` for all users. Child role must go to `/wishlist`.
**When to use:** In the login page's `handleSubmit` success branch.

```typescript
// Current code in src/app/login/page.tsx line 37:
router.push('/dashboard');

// Phase 3 change — role-aware redirect:
// After signInWithEmailAndPassword succeeds, get the role from token:
const idTokenResult = await result.user.getIdTokenResult();
const role = idTokenResult.claims['role'];
router.push(role === 'child' ? '/wishlist' : '/dashboard');
```

**Alternative approach:** Let the `/dashboard` page detect child role and immediately redirect to `/wishlist`. Either works — the login page approach is cleaner since auth is resolved right there.

### Recommended Project Structure (revised — what needs creating)

Files to **create**:
- `src/app/wishlist/page.tsx` — the `/wishlist` route
- `src/components/wishlist/WishItemCard.tsx`
- `src/components/wishlist/AddItemForm.tsx`
- `src/components/wishlist/EmptyState.tsx`
- `src/components/wishlist/LoadingSkeleton.tsx`
- `src/lib/firebase/wishlist.ts` — Firestore helper functions

Files to **modify**:
- `src/app/login/page.tsx` — role-aware redirect (line 37)
- `src/app/dashboard/page.tsx` — optionally redirect child-role users to `/wishlist`

### Anti-Patterns to Avoid
- **Do not query `purchaseStatus`:** The privacy guarantee (WISH-08) is enforced by Firestore rules AND must be enforced in client code — never call `getDoc` or `onSnapshot` on `purchaseStatus` subcollection paths in any child-facing component.
- **Do not read `id` from Firestore document data:** `WishItemDoc` has an `id` field, but Firestore document snapshots store it as `doc.id` (not in `data()`). Spread `{ id: d.id, ...d.data() }` as shown in Pattern 2.
- **Do not call `generateKeyBetween` with equal bounds:** If two items have the same `position` string (shouldn't happen but could from a data bug), `generateKeyBetween(x, x)` throws. Sort defensively and skip the update if positions are already equal.
- **Do not use `getDocs` for the wishlist subscription:** Use `onSnapshot` for real-time updates (SYNC-01 from Phase 1 is about real-time).
- **Do not use integer positions + O(n) writes:** Fractional indexing is locked (D-10).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop ordering | Custom mouse/touch event handlers | `@dnd-kit/sortable` | Touch event normalization, keyboard accessibility, DragOverlay ghosting are very hard to get right |
| Fractional position strings | Custom midpoint string algorithm | `fractional-indexing` | Edge cases in string ordering (character sets, overflow) are subtle and well-documented in the library |
| CSS transform during drag | Manual `translateX/Y` | `CSS.Transform.toString(transform)` from `@dnd-kit/utilities` | dnd-kit transform includes scale; manual translate loses that |
| Real-time Firestore subscription | Polling with `getDocs` | `onSnapshot` | Polling creates unnecessary reads and delays; onSnapshot is the canonical real-time pattern |

**Key insight:** Drag-and-drop with touch support and accessibility is notoriously tricky. The 8 activation constraints, touch-action CSS, DragOverlay, and focus management are all handled by dnd-kit — reproducing them manually is not worth the cost.

---

## Common Pitfalls

### Pitfall 1: Wishlist Document Does Not Exist
**What goes wrong:** The first time a child visits `/wishlist`, no `wishlists` document exists for their UID (the `register-child` API route only creates `users` and `usernames` docs). The Firestore query returns empty, the real-time listener has no document to subscribe to, and items can never be added.
**Why it happens:** Phase 2 deliberately kept account creation minimal; wishlist creation belongs in Phase 3.
**How to avoid:** Implement `getOrCreateWishlist(childUid)` (Pattern 1) as the first step in the WishlistPage load sequence. The Firestore rule `allow create: if isAuthenticated()` permits this.
**Warning signs:** Empty wishlist screen with no AddItemForm appearing even after clicking CTA; Firestore console shows no documents under `wishlists/`.

### Pitfall 2: touch-action Breaking Mobile Scroll
**What goes wrong:** Applying `touch-action: none` to the entire card (not just the drag handle) prevents the user from scrolling the wishlist on mobile.
**Why it happens:** dnd-kit docs recommend `touch-action: none` on draggable elements to prevent scroll conflicts. Misreading this as "apply to the card" breaks scrolling.
**How to avoid:** Apply `style={{ touchAction: 'none' }}` ONLY to the drag handle `<button>`, not the card wrapper.
**Warning signs:** On mobile, can't scroll the wishlist; page scroll is stuck.

### Pitfall 3: `generateKeyBetween` Throws on Equal Bounds
**What goes wrong:** `generateKeyBetween('a0', 'a0')` throws `"a < b required"`.
**Why it happens:** Duplicate `position` values in Firestore (data inconsistency from a race condition or earlier manual test data).
**How to avoid:** Sort items by `position` string before computing new positions in `onDragEnd`. Add a guard: if `items[i].position === items[i+1].position`, skip the update and log a warning.
**Warning signs:** Console error `"a < b required"` on drag.

### Pitfall 4: Stale DnD State After Firestore Update
**What goes wrong:** After a reorder, the Firestore `onSnapshot` fires and re-renders the list in its Firestore-persisted order. If the local `items` state was already reordered optimistically, the order jumps back and forth briefly.
**Why it happens:** Race between optimistic local state update and the Firestore write confirmation.
**How to avoid:** Do NOT optimistically update local order. Instead, rely entirely on the `onSnapshot` callback to update the list order. The Firestore write is fast enough (<200ms on emulator) that the user will not notice.
**Warning signs:** Items visually "bounce" after a drag-and-drop completes.

### Pitfall 5: `id` Field Missing from WishItemDoc
**What goes wrong:** `WishItemDoc.id` is declared in `src/types/firestore.ts` but Firestore does not store `id` in the document data — it is only on the `DocumentSnapshot.id` property. Accessing `doc.data().id` returns `undefined`.
**Why it happens:** Developers expect document data to include all fields from the interface, but `id` is metadata on the snapshot, not stored data.
**How to avoid:** Always spread as `{ id: d.id, ...d.data() as Omit<WishItemDoc, 'id'> }` when converting a Firestore snapshot to `WishItemDoc`.
**Warning signs:** `WishItemCard` receives `id: undefined`; dnd-kit throws on `undefined` sortable id.

### Pitfall 6: Login Redirect Still Goes to `/dashboard` for Child
**What goes wrong:** After Phase 3 is complete, a child logs in and lands on the `/dashboard` stub (which shows email/role and a logout button) instead of `/wishlist`.
**Why it happens:** `login/page.tsx` line 37 has `router.push('/dashboard')` hardcoded.
**How to avoid:** Implement role-aware redirect in the login success handler (Pattern 6). This is a Phase 3 task, not a Phase 4 task.
**Warning signs:** Child logs in, sees dashboard stub with email/role text instead of wishlist.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Adding an Item to Firestore
```typescript
// Source: Firebase JS SDK — addDoc
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { generateKeyBetween } from 'fractional-indexing';

async function addWishItem(
  wishlistId: string,
  title: string,
  lastPosition: string | null
) {
  const position = generateKeyBetween(lastPosition, null); // append after last
  await addDoc(collection(db, 'wishlists', wishlistId, 'items'), {
    title,
    position,
    createdAt: serverTimestamp(),
  });
}
```

### Updating an Item
```typescript
// Source: Firebase JS SDK — updateDoc
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

async function updateWishItem(
  wishlistId: string,
  itemId: string,
  changes: Partial<Omit<WishItemDoc, 'id' | 'createdAt'>>
) {
  await updateDoc(doc(db, 'wishlists', wishlistId, 'items', itemId), changes);
}
```

### Deleting an Item
```typescript
// Source: Firebase JS SDK — deleteDoc
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

async function deleteWishItem(wishlistId: string, itemId: string) {
  await deleteDoc(doc(db, 'wishlists', wishlistId, 'items', itemId));
}
```

### Auth Guard Pattern (from existing dashboard — reuse exactly)
```typescript
// Source: src/app/dashboard/page.tsx (existing pattern)
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function WishlistPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <LoadingSkeleton />;
  if (!user) return null;
  // ... rest of page
}
```

### Tailwind CSS — Color Tokens Setup
```typescript
// Source: 03-UI-SPEC.md — Color section
// These must be CSS custom properties so Phase 5 can update them in one place.
// In globals.css (add to :root):
// --color-bg: #FFF9F5;
// --color-card: #FFF0E8;
// --color-accent: #F97316;
// --color-border: #E5D5CC;
// --color-text: #171717;
// --color-muted: #6B7280;
//
// In components, use Tailwind arbitrary values that reference these:
// bg-[#FFF9F5], bg-[#FFF0E8], text-[#F97316], border-[#E5D5CC]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (Next.js) | `proxy.ts` (Next.js 16) | Next.js 16.0.0 | The existing `proxy.ts` in this project is correct; `middleware` is deprecated in Next.js 16 |
| `params` as sync prop in page.tsx | `params` as `Promise<{...}>` | Next.js 15.0.0-RC | This phase uses a Client Component page (`'use client'`) with no `params`, so no impact |
| `getDocs` for all Firestore reads | `onSnapshot` for real-time | Established pattern | Real-time listener is required (SYNC-01); use `onSnapshot` everywhere |

**Deprecated/outdated:**
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16. Project already uses correct `proxy.ts`. Do NOT create a `middleware.ts` file.
- `react-beautiful-dnd`: Unmaintained, not to be used. Project is locked to `@dnd-kit`.
- `sensor` import from `@dnd-kit/core` legacy versions: v6 API uses `useSensor`/`useSensors` hooks. This is the current pattern.

---

## Critical Discovery: Wishlist Creation Gap

The `register-child` route (`src/app/api/auth/register-child/route.ts`) creates:
- Firebase Auth account
- `usernames/{username}` doc
- `users/{uid}` doc

It does NOT create a `wishlists` document. [VERIFIED: codebase read of register-child/route.ts]

Phase 3 must handle this. The `getOrCreateWishlist(childUid)` helper (Pattern 1 above) is the correct solution. This is a race condition surface: if two tabs open simultaneously, both might try to create the wishlist doc. Since the Firestore `addDoc` generates a random ID, two simultaneous calls would create two wishlist documents for the same child. This must be addressed with either:

1. **Preferred:** Use `setDoc` with a deterministic ID (e.g., the child's UID as the wishlist document ID) + `{ merge: false }` — then a second concurrent write is a no-op if we check existence first, or use `{ merge: true }` which is idempotent.
2. **Alternative:** `addDoc` is fine if we query first and only create when the query returns empty (acceptable race window — a child is unlikely to open two tabs simultaneously on first login).

**Recommendation:** Use `setDoc(doc(db, 'wishlists', childUid), { ... }, { merge: true })` with the child's UID as the wishlist document ID. This is deterministic, idempotent, and avoids double-document risk. It also simplifies the Firestore lookup from a `query(where('childUid', '==', uid))` to a direct `getDoc(doc(db, 'wishlists', uid))`.

**Firestore rule check:** `allow create: if isAuthenticated()` on `wishlists/{wishlistId}` permits this from the client. [VERIFIED: firestore.rules]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Yes | (project already running) | — |
| npm | Package install | Yes | (project already running) | — |
| @dnd-kit/core | Drag-and-drop (WISH-07) | Not installed | 6.3.1 (latest) | None — must install |
| @dnd-kit/sortable | Drag-and-drop (WISH-07) | Not installed | 10.0.0 (latest) | None — must install |
| @dnd-kit/utilities | CSS transforms | Not installed | 3.2.2 (latest) | None — must install |
| fractional-indexing | Position ordering (WISH-07) | Not installed | 3.2.0 (latest) | None — must install |
| Firebase emulators | Auth + Firestore | Configured (package.json `emulator` script) | (existing config) | — |

**Missing dependencies with no fallback:**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing` — all four must be installed in Wave 0 (first plan) before any drag-and-drop or position code can be written.

[VERIFIED: npm view — versions confirmed 2026-04-09]
[VERIFIED: package.json — these packages absent from dependencies]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `setDoc(doc(db, 'wishlists', childUid), ...)` uses the child's UID as the wishlist document ID — simpler than `addDoc` + query | Critical Discovery | If Phase 4 viewer code assumes wishlist ID != child UID, it would need updating. Low risk — Phase 4 hasn't started. |
| A2 | Firestore rules `allow create: if isAuthenticated()` permits client-side wishlist creation | Critical Discovery | Already verified in firestore.rules — [ASSUMED] only about whether a rule change is needed. It is NOT needed. |
| A3 | The login page redirect change (dashboard → wishlist for child role) is the correct place for role-aware routing | Architecture Patterns | If viewer-role users also need different post-login routes in future, the dashboard redirect approach (checking role in dashboard useEffect) would be more centralized. Low risk for Phase 3. |

**If this table is empty:** N/A — three assumptions logged above. A2 is actually VERIFIED; only A1 and A3 carry real uncertainty.

---

## Open Questions

1. **Wishlist document ID strategy**
   - What we know: `register-child` does not create it; client must create on first access
   - What's unclear: Should wishlist ID = child UID (deterministic) or a Firestore-generated ID (random)
   - Recommendation: Use child UID as wishlist document ID (deterministic, idempotent `setDoc`, simpler query in Phase 4)

2. **Dashboard behavior for child-role users after Phase 3**
   - What we know: Dashboard currently shows email + role + logout for all roles
   - What's unclear: Should `/dashboard` redirect child → `/wishlist`, or should login do the redirect?
   - Recommendation: Handle in the login page success handler (role-aware redirect). The dashboard can also add a child-role redirect as a safety net.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2 handled auth) | — |
| V3 Session Management | No (Phase 2 handled sessions) | — |
| V4 Access Control | YES — critical | Firestore rules (already in place); client code must not query `purchaseStatus` |
| V5 Input Validation | YES | Title: required, non-empty; price: min=0, numeric; URLs: type="url" HTML5 + no server-side execution |
| V6 Cryptography | No | No encryption needed for wish items |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Child reads `purchaseStatus` via browser DevTools console | Information Disclosure | Firestore security rules deny read at DB layer; client code never requests it |
| Viewer writes to `wishlists/{id}/items` impersonating child | Tampering | `allow write: if isOwner(wishlistId)` — only the child UID can write items |
| Malicious image URL (XSS via `javascript:` protocol) | XSS | Use `<img src={imageUrl}>` — browsers do not execute `javascript:` in `src`. Additional: validate URL format client-side with `type="url"` input; never use `dangerouslySetInnerHTML` |
| Unlimited wishlist items (storage abuse) | Denial of Service | Out of scope for Phase 3 — no item count limit required by requirements |
| Product URL opens external site | Spoofing | Use `<a href={productUrl} target="_blank" rel="noopener noreferrer">` — `noopener` prevents reverse tabnapping |

**Privacy guarantee verification:** After Phase 3, a child can open browser DevTools → Network → inspect Firestore REST calls. They will see requests to `wishlists/{id}/items` but NOT to `purchaseStatus` — because the client code never requests it AND the Firestore rules deny it even if they try manually. Both layers must be verified in end-to-end testing.

---

## Sources

### Primary (HIGH confidence)
- Codebase (`src/app/api/auth/register-child/route.ts`) — confirmed wishlist doc is NOT created in Phase 2
- Codebase (`firestore.rules`) — confirmed `allow create: if isAuthenticated()` on wishlists; confirmed `purchaseStatus` denied to child
- Codebase (`src/types/firestore.ts`) — confirmed WishItemDoc and WishlistDoc interfaces
- Codebase (`package.json`) — confirmed @dnd-kit and fractional-indexing are NOT installed
- npm registry (`npm view @dnd-kit/core version`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing`) — confirmed latest versions
- Next.js docs (`node_modules/next/dist/docs/01-app/`) — confirmed proxy.ts, page.tsx, useRouter API for Next.js 16
- fractional-indexing README (rocicorp/fractional-indexing) — confirmed `generateKeyBetween(a, b)` API and null inputs for first/last item

### Secondary (MEDIUM confidence)
- dndkit.com/presets/sortable/usesortable — confirmed `useSortable` return values: `setNodeRef`, `setActivatorNodeRef`, `listeners`, `transform`, `transition`, `isDragging`
- dndkit.com/api-documentation/sensors/pointer — confirmed `TouchSensor` delay/tolerance constraint pattern; `touch-action: none` recommendation

### Tertiary (LOW confidence)
- None — all critical claims verified from codebase or official sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry
- Architecture: HIGH — based on verified codebase state and official library docs
- Pitfalls: HIGH — most derived from direct codebase inspection (register-child gap is a verified fact)
- dnd-kit API: MEDIUM-HIGH — useSortable API confirmed from official docs; DragOverlay/sensor setup confirmed from official docs

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable libraries; fractional-indexing and dnd-kit APIs change infrequently)
