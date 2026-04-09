import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, itemTitle, purchased } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      itemTitle?: string;
      purchased?: boolean;
    };

  if (!idToken || !wishlistId || !itemId || itemTitle === undefined || purchased === undefined) {
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
  if (!viewerUids.includes(uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const batch = adminDb.batch();

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  if (purchased) {
    batch.set(statusRef, {
      itemId,
      viewerUids,   // denormalized for rule evaluation
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
