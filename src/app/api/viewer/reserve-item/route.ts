import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, reserve } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      reserve?: boolean;
    };

  if (!idToken || !wishlistId || !itemId || reserve === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Verify caller is a viewer or parent on this wishlist
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

  // Transaction enforces single reservation per item (D-02) — a plain
  // read-then-write would let two simultaneous reservations both succeed.
  try {
    await adminDb.runTransaction(async (tx) => {
      const statusSnap = await tx.get(statusRef);
      const existingReservedBy: string | undefined = statusSnap.data()?.reservedBy;

      if (reserve) {
        if (existingReservedBy && existingReservedBy !== uid) {
          throw new Error('ALREADY_RESERVED');
        }
        tx.set(statusRef, {
          itemId,
          viewerUids,   // denormalized for rule evaluation
          reservedBy: uid,
        }, { merge: true });
      } else {
        // Only the reserver (or a parent, as admin override) may release it.
        if (existingReservedBy && existingReservedBy !== uid && !isParent) {
          throw new Error('NOT_RESERVER');
        }
        // set+merge instead of update — the doc may not exist (concurrent unreserve).
        tx.set(statusRef, {
          itemId,
          reservedBy: FieldValue.delete(),
        }, { merge: true });
      }

      tx.set(logRef, {
        viewerUid: uid,
        action: reserve ? 'reserved' : 'unreserved',
        itemId,
        itemTitle,
        timestamp: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'ALREADY_RESERVED') {
      return NextResponse.json({ error: 'Already reserved by another user' }, { status: 409 });
    }
    if (msg === 'NOT_RESERVER') {
      return NextResponse.json({ error: 'Only the reserver can release this' }, { status: 403 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
