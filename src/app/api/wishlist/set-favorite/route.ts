import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { MAX_FAVORITES_PER_LIST } from '@/lib/favorites';

// Lets a parent heart or un-heart a wish. firestore.rules keeps isFavorite
// child-only for direct client writes, so the parents' way in is this route:
// it checks parentUids and holds the same cap of favorites the child's own
// view does. The child keeps toggling their hearts straight through the SDK.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, isFavorite } = body as {
    idToken?: string;
    wishlistId?: string;
    itemId?: string;
    isFavorite?: boolean;
  };

  if (!idToken || !wishlistId || !itemId || typeof isFavorite !== 'boolean') {
    return NextResponse.json(
      { error: 'idToken, wishlistId, itemId, and isFavorite required' },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlistRef = adminDb.collection('wishlists').doc(wishlistId);
  const wishlistSnap = await wishlistRef.get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const data = wishlistSnap.data()!;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);
  if (!isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const itemRef = wishlistRef.collection('items').doc(itemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (isFavorite && itemSnap.data()!.isFavorite !== true) {
    const favoritesSnap = await wishlistRef
      .collection('items')
      .where('isFavorite', '==', true)
      .get();
    if (favoritesSnap.size >= MAX_FAVORITES_PER_LIST) {
      return NextResponse.json(
        { error: `Listan kan ha max ${MAX_FAVORITES_PER_LIST} favoriter.` },
        { status: 409 },
      );
    }
  }

  await itemRef.update({ isFavorite });

  return NextResponse.json({ ok: true });
}
