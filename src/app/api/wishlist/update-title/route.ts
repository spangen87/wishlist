import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, title } = body as {
    idToken?: string;
    wishlistId?: string;
    title?: string;
  };

  if (!idToken || !wishlistId || !title) {
    return NextResponse.json(
      { error: 'idToken, wishlistId, and title required' },
      { status: 400 },
    );
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return NextResponse.json({ error: 'title must not be empty' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is a parent on this wishlist (in parentUids) or the owner (D-23)
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

  await adminDb.collection('wishlists').doc(wishlistId).update({ title: trimmedTitle });

  return NextResponse.json({ ok: true });
}
