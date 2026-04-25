import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, itemTitle, reserve } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      itemTitle?: string;
      reserve?: boolean;
    };

  if (!idToken || !wishlistId || !itemId || itemTitle === undefined || reserve === undefined) {
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
  if (!viewerUids.includes(uid) && !parentUids.includes(uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Enforce single reservation per item (D-02): 409 if another user already reserved
  const existingSnap = await adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId).get();
  const existingReservedBy: string | undefined = existingSnap.data()?.reservedBy;

  if (reserve && existingReservedBy && existingReservedBy !== uid) {
    return NextResponse.json({ error: 'Already reserved by another user' }, { status: 409 });
  }

  const batch = adminDb.batch();

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  if (reserve) {
    batch.set(statusRef, {
      itemId,
      viewerUids,   // denormalized for rule evaluation
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
}
