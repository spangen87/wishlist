import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, itemTitle, note } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      itemTitle?: string;
      note?: string;
    };

  if (!idToken || !wishlistId || !itemId || itemTitle === undefined || note === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Verify caller is a viewer
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const viewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  if (!viewerUids.includes(uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  const batch = adminDb.batch();

  // Write the viewer's note into the viewerNotes map — uses merge to avoid overwriting purchasedBy
  batch.set(statusRef, {
    itemId,
    viewerUids,
    [`viewerNotes.${uid}`]: note,
  }, { merge: true });

  // Only log if note is non-empty (don't log clearing a note)
  if (note.trim().length > 0) {
    const logRef = adminDb
      .collection('wishlists').doc(wishlistId)
      .collection('activityLog').doc();

    batch.set(logRef, {
      viewerUid: uid,
      action: 'added_note',
      itemId,
      itemTitle,
      timestamp: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return NextResponse.json({ ok: true });
}
