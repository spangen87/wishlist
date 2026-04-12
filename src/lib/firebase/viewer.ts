import {
  collection, query, where, orderBy, limit, startAfter,
  onSnapshot, type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { WishlistDoc, PurchaseStatusDoc, ActivityLogDoc } from '@/types/firestore';

// VIEW-06: Subscribe to all wishlists the viewer has access to.
// Uses array-contains query on viewerUids — requires no composite index (single field).
// fromCache=true means the result came from local IndexedDB — caller should stay in loading
// state until fromCache=false arrives (the confirmed network result).
export function subscribeToViewerWishlists(
  viewerUid: string,
  onWishlists: (wishlists: WishlistDoc[], fromCache: boolean) => void,
  onError?: () => void
): () => void {
  const q = query(
    collection(db, 'wishlists'),
    where('viewerUids', 'array-contains', viewerUid)
  );
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const lists = snap.docs.map((d) => ({
      id: d.id,
      ...d.data() as Omit<WishlistDoc, 'id'>,
    }));
    onWishlists(lists, snap.metadata.fromCache);
  }, () => { onError?.(); });
}

// D-10: Subscribe to all wishlists the user has parent-level access to.
// Uses array-contains query on parentUids — no composite index required (single field).
export function subscribeToParentWishlists(
  parentUid: string,
  onWishlists: (wishlists: WishlistDoc[], fromCache: boolean) => void,
  onError?: () => void
): () => void {
  const q = query(
    collection(db, 'wishlists'),
    where('parentUids', 'array-contains', parentUid)
  );
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const lists = snap.docs.map((d) => ({
      id: d.id,
      ...d.data() as Omit<WishlistDoc, 'id'>,
    }));
    onWishlists(lists, snap.metadata.fromCache);
  }, () => { onError?.(); });
}

// VIEW-01, VIEW-05: Subscribe to purchaseStatus subcollection.
// Returns a Record<itemId, PurchaseStatusDoc> for O(1) merge with items array.
// Pitfall 5: Missing docs are simply absent from the record — treated as "not purchased, no notes".
export function subscribeToPurchaseStatus(
  wishlistId: string,
  onStatuses: (statuses: Record<string, PurchaseStatusDoc>) => void
): () => void {
  return onSnapshot(
    collection(db, 'wishlists', wishlistId, 'purchaseStatus'),
    (snap) => {
      const record: Record<string, PurchaseStatusDoc> = {};
      snap.docs.forEach((d) => {
        record[d.id] = { itemId: d.id, ...d.data() as Omit<PurchaseStatusDoc, 'itemId'> };
      });
      onStatuses(record);
    }
  );
}

// VIEW-07: Subscribe to activityLog ordered newest-first, 50 entries per page.
// Pass lastDoc to paginate: call subscribeToActivityLog(wishlistId, onEntries, lastDoc).
export function subscribeToActivityLog(
  wishlistId: string,
  onEntries: (entries: ActivityLogDoc[], lastDoc: QueryDocumentSnapshot | null) => void,
  afterDoc?: QueryDocumentSnapshot | null
): () => void {
  let q = query(
    collection(db, 'wishlists', wishlistId, 'activityLog'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  if (afterDoc) {
    q = query(
      collection(db, 'wishlists', wishlistId, 'activityLog'),
      orderBy('timestamp', 'desc'),
      startAfter(afterDoc),
      limit(50)
    );
  }
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({
      id: d.id,
      ...d.data() as Omit<ActivityLogDoc, 'id'>,
    })) as ActivityLogDoc[];
    const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    onEntries(entries, last);
  });
}
