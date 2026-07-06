import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Remove a viewer from a wishlist. Regenerating the share link only stops NEW
// viewers from joining — this is the only way to revoke an existing viewer.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, viewerUid } = body as {
    idToken?: string;
    wishlistId?: string;
    viewerUid?: string;
  };

  if (!idToken || !wishlistId || !viewerUid) {
    return NextResponse.json(
      { error: 'idToken, wishlistId, and viewerUid required' },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const data = wishlistSnap.data()!;
  const isOwner = data.childUid === decoded.uid;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);
  if (!isOwner && !isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const viewerUids: string[] = data.viewerUids ?? [];
  if (!viewerUids.includes(viewerUid)) {
    return NextResponse.json({ error: 'Not a viewer on this wishlist' }, { status: 404 });
  }

  await adminDb.collection('wishlists').doc(wishlistId).update({
    viewerUids: FieldValue.arrayRemove(viewerUid),
  });

  return NextResponse.json({ ok: true });
}
