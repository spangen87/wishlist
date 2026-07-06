import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, purchased } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      purchased?: boolean;
    };

  if (!idToken || !wishlistId || !itemId || purchased === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Verify caller is a viewer on this wishlist
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const viewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  const parentUids: string[] = wishlistSnap.data()!.parentUids ?? [];
  const isParent = parentUids.includes(uid);
  if (!viewerUids.includes(uid) && !isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // The item must exist — its title is read server-side so the activity log
  // can't be spoofed with fabricated entries.
  const itemSnap = await adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('items').doc(itemId).get();
  if (!itemSnap.exists) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  const itemTitle: string = itemSnap.data()!.title ?? '';

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);
  const logRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('activityLog').doc();

  // Transaction: the existing purchasedBy decides whether the caller may act,
  // so check-and-write must be atomic (two viewers clicking simultaneously).
  try {
    await adminDb.runTransaction(async (tx) => {
      const statusSnap = await tx.get(statusRef);
      const existingPurchasedBy: string | undefined = statusSnap.data()?.purchasedBy;

      if (purchased) {
        // Someone else already bought it — don't silently overwrite their purchase.
        if (existingPurchasedBy && existingPurchasedBy !== uid) {
          throw new Error('ALREADY_PURCHASED');
        }
        tx.set(statusRef, {
          itemId,
          viewerUids,   // denormalized for rule evaluation
          purchasedBy: uid,
          purchasedAt: FieldValue.serverTimestamp(),
          reservedBy: FieldValue.delete(),  // D-03: auto-clear caller's reservation on purchase
        }, { merge: true });
      } else {
        // Only the purchaser (or a parent, as admin override) may unmark.
        if (existingPurchasedBy && existingPurchasedBy !== uid && !isParent) {
          throw new Error('NOT_PURCHASER');
        }
        // set+merge instead of update — the doc may not exist (concurrent unmark).
        tx.set(statusRef, {
          itemId,
          purchasedBy: FieldValue.delete(),
          purchasedAt: FieldValue.delete(),
        }, { merge: true });
      }

      tx.set(logRef, {
        viewerUid: uid,
        action: purchased ? 'marked_purchased' : 'unmarked_purchased',
        itemId,
        itemTitle,
        timestamp: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'ALREADY_PURCHASED') {
      return NextResponse.json({ error: 'Already purchased by another user' }, { status: 409 });
    }
    if (msg === 'NOT_PURCHASER') {
      return NextResponse.json({ error: 'Only the purchaser can unmark this' }, { status: 403 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
