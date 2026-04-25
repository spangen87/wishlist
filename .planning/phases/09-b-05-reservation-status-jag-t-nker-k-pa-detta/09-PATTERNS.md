# Phase 9: B-05 Reservation Status — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/viewer/reserve-item/route.ts` | route handler | request-response | `src/app/api/viewer/mark-purchased/route.ts` | exact |
| `src/types/firestore.ts` | type definitions | — | self (modify) | exact |
| `src/components/viewer/ViewerWishItemCard.tsx` | component | event-driven | self (modify) | exact |
| `src/app/viewer/[wishlistId]/page.tsx` | page / orchestrator | request-response | self (modify) | exact |
| `src/components/viewer/ActivityLogEntry.tsx` | component | transform | self (modify) | exact |
| `firestore.rules` | config / security | — | self (modify) | exact |

---

## Pattern Assignments

### `src/app/api/viewer/reserve-item/route.ts` (new route handler, request-response)

**Analog:** `src/app/api/viewer/mark-purchased/route.ts`

**Imports pattern** (lines 1–4):
```typescript
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
```

**Request body shape** (lines 6–16):
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, itemTitle, reserve } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      itemTitle?: string;
      reserve?: boolean;   // true = reserve, false = un-reserve
    };

  if (!idToken || !wishlistId || !itemId || itemTitle === undefined || reserve === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
```

**Auth + access check pattern** (lines 21–39):
```typescript
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const viewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  const parentUids: string[] = wishlistSnap.data()!.parentUids ?? [];
  if (!viewerUids.includes(uid) && !parentUids.includes(uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
```

**Reservation conflict check** (new — insert after access check, before batch):
```typescript
  // Enforce "only one reservation at a time" (D-02)
  const existingSnap = await adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId).get();
  const existingReservedBy: string | undefined = existingSnap.data()?.reservedBy;

  if (reserve && existingReservedBy && existingReservedBy !== uid) {
    return NextResponse.json({ error: 'Already reserved by another user' }, { status: 409 });
  }
```

**Batch write pattern** (lines 41–73 of analog, adapted for reservedBy):
```typescript
  const batch = adminDb.batch();

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  if (reserve) {
    batch.set(statusRef, {
      itemId,
      viewerUids,
      reservedBy: uid,
    }, { merge: true });
  } else {
    batch.update(statusRef, {
      reservedBy: FieldValue.delete(),
    });
  }

  const logRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('activityLog').doc();

  batch.set(logRef, {
    viewerUid: uid,
    action: reserve ? 'reserved' : 'unreserved',
    itemId,
    itemTitle,
    timestamp: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return NextResponse.json({ ok: true });
```

**Auto-clear reservation when purchasing** — the `mark-purchased` route (analog lines 47–53) must also clear `reservedBy` when `purchased === true` AND `purchasedBy === uid` (D-03). Add to the `purchased` branch:
```typescript
  if (purchased) {
    batch.set(statusRef, {
      itemId,
      viewerUids,
      purchasedBy: uid,
      purchasedAt: FieldValue.serverTimestamp(),
      reservedBy: FieldValue.delete(),   // D-03: auto-clear own reservation on purchase
    }, { merge: true });
  }
```

---

### `src/types/firestore.ts` (modify — type definitions)

**Analog:** self

**Current `PurchaseStatusDoc`** (lines 34–40):
```typescript
export interface PurchaseStatusDoc {
  itemId: string;
  viewerUids: string[];
  purchasedBy?: string;
  purchasedAt?: Timestamp;
  viewerNotes?: Record<string, string>;
}
```

**Required addition — `reservedBy` field** (D-05):
```typescript
export interface PurchaseStatusDoc {
  itemId: string;
  viewerUids: string[];
  purchasedBy?: string;
  purchasedAt?: Timestamp;
  reservedBy?: string;          // UID of viewer who reserved; absent = not reserved (D-05)
  viewerNotes?: Record<string, string>;
}
```

**Current `ActivityLogDoc`** (lines 45–51):
```typescript
export interface ActivityLogDoc {
  viewerUid: string;
  action: 'marked_purchased' | 'unmarked_purchased' | 'added_note';
  itemId: string;
  itemTitle: string;
  timestamp: Timestamp;
}
```

**Required addition — action union** (D-17):
```typescript
export interface ActivityLogDoc {
  viewerUid: string;
  action: 'marked_purchased' | 'unmarked_purchased' | 'added_note' | 'reserved' | 'unreserved';
  itemId: string;
  itemTitle: string;
  timestamp: Timestamp;
}
```

---

### `src/components/viewer/ViewerWishItemCard.tsx` (modify — component)

**Analog:** self

**Current props interface** (lines 12–22):
```typescript
interface ViewerWishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  status: PurchaseStatusDoc | undefined;
  currentUid: string;
  onTogglePurchased: (itemId: string, itemTitle: string, purchased: boolean) => Promise<void>;
  onUpdateNote: (itemId: string, itemTitle: string, note: string) => Promise<void>;
  purchaserName?: string;
  otherViewerNotes: Array<{ uid: string; displayName: string; note: string }>;
}
```

**Add to props interface** — new prop for reservation (mirrors `purchaserName`):
```typescript
  onToggleReserved: (itemId: string, itemTitle: string, reserve: boolean) => Promise<void>;
  reserverName?: string;  // resolved display name for status.reservedBy (pre-fetched by parent)
```

**Existing purchase state derivation** (lines 37–39 — model for reservation state):
```typescript
  const isPurchased = !!status?.purchasedBy;
  const isOwnPurchase = status?.purchasedBy === currentUid;
  const isOthersPurchase = isPurchased && !isOwnPurchase;
```

**New reservation state derivation** (mirror pattern exactly):
```typescript
  const isReserved = !!status?.reservedBy;
  const isOwnReservation = status?.reservedBy === currentUid;
  const isOtherReservation = isReserved && !isOwnReservation;
```

**Existing `toggling` state pattern** (lines 33–34 — model for `reserving` state):
```typescript
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
```

**New reservation state** (mirror exactly):
```typescript
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
```

**Existing `handleToggle` async function** (lines 41–52 — model for `handleToggleReserve`):
```typescript
  async function handleToggle() {
    if (isOthersPurchase) return;
    setToggling(true);
    setToggleError(null);
    try {
      await onTogglePurchased(item.id, item.title, !isPurchased);
    } catch {
      setToggleError('Något gick fel. Försök igen.');
    } finally {
      setToggling(false);
    }
  }
```

**New `handleToggleReserve`** (409 handling is an additional concern):
```typescript
  async function handleToggleReserve() {
    if (isOtherReservation) return;
    setReserving(true);
    setReserveError(null);
    try {
      await onToggleReserved(item.id, item.title, !isOwnReservation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409') || msg.includes('Already reserved')) {
        setReserveError('Någon annan har redan reserverat detta.');
      } else {
        setReserveError('Något gick fel. Försök igen.');
      }
    } finally {
      setReserving(false);
    }
  }
```

**Existing purchase button JSX** (lines 91–116 — model for reserve button; note 3-state class pattern):
```tsx
<button
  onClick={handleToggle}
  disabled={toggling || isOthersPurchase}
  aria-label={isPurchased ? `Avmarkera ${item.title}` : `Markera ${item.title} som köpt`}
  className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors border ${
    isOthersPurchase
      ? 'opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]'
      : isPurchased
      ? 'bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white'
      : 'bg-white hover:bg-[#FFF0E8] border-[#E5D5CC] text-[#171717]'
  } disabled:opacity-50`}
>
```

**New reserve button JSX** (place ABOVE purchase button; hidden when `isPurchased`):
```tsx
{!isPurchased && (
  <button
    onClick={handleToggleReserve}
    disabled={reserving || isOtherReservation}
    aria-label={
      isOtherReservation
        ? `Reserverad av ${reserverName ?? '...'}`
        : isOwnReservation
        ? `Avboka reservation för ${item.title}`
        : `Reservera ${item.title}`
    }
    className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors border ${
      isOtherReservation
        ? 'opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]'
        : isOwnReservation
        ? 'bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white'
        : 'border-dashed border-[#E5D5CC] bg-white hover:bg-[#FFF0E8] text-[#171717]'
    } disabled:opacity-50`}
  >
    {isOtherReservation
      ? `Reserverad av ${reserverName ?? '...'}`
      : isOwnReservation
      ? 'Du tänker köpa detta'
      : 'Jag tänker köpa detta'}
  </button>
)}
{reserveError && (
  <p role="alert" className="text-[#DC2626] text-sm mt-1">{reserveError}</p>
)}
```

**Existing error display** (line 118–120 — model for `reserveError`):
```tsx
{toggleError && (
  <p role="alert" className="text-[#DC2626] text-sm mt-1">{toggleError}</p>
)}
```

**Existing `PurchasedBadge` usage** (lines 86–88 — model for `ReservationBadge`):
```tsx
{isPurchased && purchaserName && (
  <PurchasedBadge purchaserName={purchaserName} isCurrentUser={isOwnPurchase} />
)}
```

**New reservation badge** (shown only when another user reserved — `isOtherReservation`):
```tsx
{isOtherReservation && reserverName && (
  <span className="text-sm text-[#6B7280] italic">
    Reserverad av {reserverName}
  </span>
)}
```

---

### `src/app/viewer/[wishlistId]/page.tsx` (modify — orchestrator page)

**Analog:** self

**Existing `handleTogglePurchased`** (lines 98–116 — exact model for `handleToggleReserved`):
```typescript
  async function handleTogglePurchased(
    itemId: string,
    itemTitle: string,
    purchased: boolean
  ) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch('/api/viewer/mark-purchased', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, wishlistId, itemId, itemTitle, purchased }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'API error');
    }
  }
```

**New `handleToggleReserved`** (mirror exactly, different endpoint and field name):
```typescript
  async function handleToggleReserved(
    itemId: string,
    itemTitle: string,
    reserve: boolean
  ) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch('/api/viewer/reserve-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, wishlistId, itemId, itemTitle, reserve }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body.error ?? 'API error') + (res.status === 409 ? ' 409' : ''));
    }
  }
```

**Existing `fetchDisplayName` + `displayNames` map** (lines 47–59, 86–89):
```typescript
  const fetchDisplayName = useCallback(async (uid: string) => {
    if (displayNames.has(uid)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.username ?? data.email ?? uid;
        setDisplayNames((prev) => new Map(prev).set(uid, name));
      }
    } catch { /* Silently fail */ }
  }, [displayNames]);

  // Inside subscribeToPurchaseStatus callback:
  Object.values(newStatuses).forEach((s) => {
    if (s.purchasedBy) fetchDisplayName(s.purchasedBy);
  });
```

**Extend the status subscription callback** to also fetch `reservedBy` UIDs:
```typescript
  Object.values(newStatuses).forEach((s) => {
    if (s.purchasedBy) fetchDisplayName(s.purchasedBy);
    if (s.reservedBy) fetchDisplayName(s.reservedBy);   // NEW
  });
```

**Existing `renderCard` with `purchaserName` prop** (lines 295–322 — model for `reserverName`):
```tsx
<ViewerWishItemCard
  ...
  purchaserName={
    statusDoc?.purchasedBy
      ? displayNames.get(statusDoc.purchasedBy) ?? '...'
      : undefined
  }
  ...
/>
```

**Add `reserverName` prop** (same pattern):
```tsx
  reserverName={
    statusDoc?.reservedBy
      ? displayNames.get(statusDoc.reservedBy) ?? '...'
      : undefined
  }
  onToggleReserved={handleToggleReserved}
```

---

### `src/components/viewer/ActivityLogEntry.tsx` (modify — component)

**Analog:** self

**Current `formatAction` switch** (lines 9–24):
```typescript
function formatAction(
  action: ActivityLogDoc['action'],
  viewerName: string,
  itemTitle: string
): string {
  switch (action) {
    case 'marked_purchased':
      return `${viewerName} markerade "${itemTitle}" som köpt`;
    case 'unmarked_purchased':
      return `${viewerName} avmarkerade "${itemTitle}"`;
    case 'added_note':
      return `${viewerName} lämnade en anteckning på "${itemTitle}"`;
    default:
      return `${viewerName} utförde en åtgärd på "${itemTitle}"`;
  }
}
```

**Add two new cases** (D-16 + UI-SPEC activity log copy):
```typescript
    case 'reserved':
      return `${viewerName} reserverade "${itemTitle}"`;
    case 'unreserved':
      return `${viewerName} avbokade sin reservation på "${itemTitle}"`;
```

---

### `firestore.rules` (modify — security config)

**Analog:** self

**Current `purchaseStatus` write rule** (lines 62–65):
```
match /purchaseStatus/{itemId} {
  allow read: if isViewer(wishlistId) || isParent(wishlistId);
  allow write: if (isViewer(wishlistId) || isParent(wishlistId))
    && (request.resource.data.purchasedBy == request.auth.uid
        || request.resource.data.purchasedBy == null);
}
```

**Problem:** The current write rule validates `purchasedBy` but not `reservedBy`. Since all writes go through the Admin SDK (which bypasses client rules), this may be acceptable as-is. However, if the rule must be updated for defense-in-depth to also validate `reservedBy`:

```
match /purchaseStatus/{itemId} {
  allow read: if isViewer(wishlistId) || isParent(wishlistId);
  allow write: if (isViewer(wishlistId) || isParent(wishlistId))
    && (request.resource.data.purchasedBy == request.auth.uid
        || request.resource.data.purchasedBy == null)
    && (
        !('reservedBy' in request.resource.data)
        || request.resource.data.reservedBy == request.auth.uid
        || request.resource.data.reservedBy == null
    );
}
```

**Important:** Because `reserve-item/route.ts` uses Admin SDK (`adminDb`), it bypasses Firestore rules entirely. The rule update is defense-in-depth only — verify the existing `mark-purchased` route uses `adminDb` (confirmed: line 3 of analog imports `adminAuth, adminDb`). No rule change is strictly required; planner should decide based on security posture.

**Child privacy** (lines 60–65 comment): The `purchaseStatus` subcollection is already blocked from child reads by the existing rule (`isViewer || isParent` — child UID is in neither). The `reservedBy` field lives on the same document, so child privacy is automatically preserved with no rule change.

---

## Shared Patterns

### Authentication + Access Check
**Source:** `src/app/api/viewer/mark-purchased/route.ts` lines 21–39
**Apply to:** `reserve-item/route.ts`
```typescript
let decoded;
try {
  decoded = await adminAuth.verifyIdToken(idToken);
} catch {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const { uid } = decoded;
const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
if (!wishlistSnap.exists) {
  return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
}
const viewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
const parentUids: string[] = wishlistSnap.data()!.parentUids ?? [];
if (!viewerUids.includes(uid) && !parentUids.includes(uid)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Admin SDK Batch + Activity Log
**Source:** `src/app/api/viewer/mark-purchased/route.ts` lines 41–74
**Apply to:** `reserve-item/route.ts`
- Always use `adminDb.batch()`, never client SDK for writes
- Activity log entry: `{ viewerUid, action, itemId, itemTitle, timestamp: FieldValue.serverTimestamp() }`
- Commit with `await batch.commit()`

### Button 3-State Class Pattern
**Source:** `src/components/viewer/ViewerWishItemCard.tsx` lines 91–116
**Apply to:** reserve button in `ViewerWishItemCard.tsx`
- Base classes (all states): `mt-3 flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors border`
- Other's action (disabled): `opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]`
- Own active action (filled): `bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white`
- Default (no action): `bg-white hover:bg-[#FFF0E8] border-[#E5D5CC] text-[#171717]`
- Reserve-specific default: add `border-dashed` to default state to convey "intent" (UI-SPEC)

### Error Display
**Source:** `src/components/viewer/ViewerWishItemCard.tsx` line 118–120
**Apply to:** reserve button error in `ViewerWishItemCard.tsx`
```tsx
<p role="alert" className="text-[#DC2626] text-sm mt-1">{error}</p>
```

### Display Name Resolution
**Source:** `src/app/viewer/[wishlistId]/page.tsx` lines 47–59
**Apply to:** `reservedBy` UID in `page.tsx` subscription callback
- Uses `displayNames` Map (already in page state)
- Call `fetchDisplayName(s.reservedBy)` alongside existing `fetchDisplayName(s.purchasedBy)` call
- Pass resolved name as `reserverName={displayNames.get(statusDoc.reservedBy) ?? '...'}` prop

### Optimistic Loading Pattern
**Source:** `src/components/viewer/ViewerWishItemCard.tsx` lines 33–51
**Apply to:** reservation state in `ViewerWishItemCard.tsx`
- `const [reserving, setReserving] = useState(false)` — disables button during API call
- `const [reserveError, setReserveError] = useState<string | null>(null)` — inline error
- No spinner/skeleton — `disabled` state during call is sufficient (existing pattern)

### Badge (Italic Muted Text)
**Source:** `src/components/viewer/PurchasedBadge.tsx` lines 8–13
**Apply to:** reservation badge inline in `ViewerWishItemCard.tsx`
```tsx
<span className="text-sm text-[#6B7280] italic">
  Reserverad av {reserverName}
</span>
```
Note: The reservation badge is an inline `<span>`, not a separate component file — it is simpler than `PurchasedBadge` (no `isCurrentUser` variant needed: own reservation uses the button state, not a badge).

---

## No Analog Found

None — all files have exact analogs in the existing codebase.

---

## File List Summary

Files to create:
1. `src/app/api/viewer/reserve-item/route.ts` — new API route (copy from `mark-purchased/route.ts`)

Files to modify:
2. `src/types/firestore.ts` — add `reservedBy?: string` to `PurchaseStatusDoc`; extend `ActivityLogDoc.action` union
3. `src/components/viewer/ViewerWishItemCard.tsx` — add reserve button + reservation state + badge
4. `src/app/viewer/[wishlistId]/page.tsx` — add `handleToggleReserved`, extend status subscription, pass new props
5. `src/components/viewer/ActivityLogEntry.tsx` — add `'reserved'` and `'unreserved'` cases to `formatAction`
6. `src/app/api/viewer/mark-purchased/route.ts` — add `reservedBy: FieldValue.delete()` to the `purchased` branch (D-03)
7. `firestore.rules` — optional defense-in-depth rule update for `reservedBy` write validation

---

## Metadata

**Analog search scope:** `src/app/api/viewer/`, `src/components/viewer/`, `src/app/viewer/`, `src/types/`, project root
**Files scanned:** 7
**Pattern extraction date:** 2026-04-24
