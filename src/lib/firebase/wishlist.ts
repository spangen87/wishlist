import {
  doc, setDoc, getDoc, collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { generateKeyBetween } from 'fractional-indexing';
import { db } from '@/lib/firebase/client';
import type { WishItemDoc } from '@/types/firestore';

// Pattern 1 (RESEARCH.md): Use child UID as wishlist doc ID — deterministic and idempotent.
// setDoc with { merge: true } ensures a second concurrent call is a no-op.
export async function getOrCreateWishlist(childUid: string): Promise<string> {
  const ref = doc(db, 'wishlists', childUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      childUid,
      viewerUids: [],
      parentUids: [],
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
  return childUid; // wishlist ID equals child UID
}

// Pattern 2 (RESEARCH.md): Real-time items listener ordered by position string.
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

// Pattern 3 (RESEARCH.md): Add item — append after last item.
export async function addWishItem(
  wishlistId: string,
  fields: { title: string; productUrl?: string; imageUrl?: string; note?: string; price?: number },
  lastPosition: string | null
): Promise<void> {
  const SAFE_URL_PREFIXES = ['https://', 'http://'];
  if (fields.productUrl && !SAFE_URL_PREFIXES.some(p => fields.productUrl!.startsWith(p))) {
    throw new Error('productUrl must start with https:// or http://');
  }
  if (fields.imageUrl && !SAFE_URL_PREFIXES.some(p => fields.imageUrl!.startsWith(p))) {
    throw new Error('imageUrl must start with https:// or http://');
  }
  const position = generateKeyBetween(lastPosition, null);
  await addDoc(collection(db, 'wishlists', wishlistId, 'items'), {
    ...fields,
    position,
    createdAt: serverTimestamp(),
  });
}

// Update item fields (title, productUrl, imageUrl, note, price — never position here).
export async function updateWishItem(
  wishlistId: string,
  itemId: string,
  changes: Partial<Omit<WishItemDoc, 'id' | 'createdAt' | 'position'>>
): Promise<void> {
  const SAFE_URL_PREFIXES = ['https://', 'http://'];
  if (changes.productUrl && !SAFE_URL_PREFIXES.some(p => changes.productUrl!.startsWith(p))) {
    throw new Error('productUrl must start with https:// or http://');
  }
  if (changes.imageUrl && !SAFE_URL_PREFIXES.some(p => changes.imageUrl!.startsWith(p))) {
    throw new Error('imageUrl must start with https:// or http://');
  }
  await updateDoc(doc(db, 'wishlists', wishlistId, 'items', itemId), changes);
}

// Delete item.
export async function deleteWishItem(wishlistId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'wishlists', wishlistId, 'items', itemId));
}

// Pattern 3 (RESEARCH.md): Update only position — one Firestore write per reorder (D-10).
// Guard against equal bounds: if prevPos === nextPos, skip write.
export async function updateItemPosition(
  wishlistId: string,
  itemId: string,
  prevPos: string | null,
  nextPos: string | null
): Promise<void> {
  if (prevPos !== null && nextPos !== null && prevPos === nextPos) {
    console.warn('[wishlist] Skipping reorder — adjacent positions are equal:', prevPos);
    return;
  }
  const position = generateKeyBetween(prevPos, nextPos);
  await updateDoc(doc(db, 'wishlists', wishlistId, 'items', itemId), { position });
}

// Update wishlist title — called from onboarding Step 2 via /api/wishlist/update-title
// Direct client-side write is blocked by Firestore rules (viewer cannot update wishlist doc).
// This helper is NOT used directly — kept here for reference. Step 2 calls the API route instead.
// (If Firestore rules are ever relaxed to allow viewer title writes, this would be the helper.)
export async function updateWishlistTitle(
  wishlistId: string,
  title: string
): Promise<void> {
  await updateDoc(doc(db, 'wishlists', wishlistId), { title });
}

