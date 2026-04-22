import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, title, productUrl, imageUrl, note, price, position } = body as {
    idToken?: string;
    wishlistId?: string;
    title?: string;
    productUrl?: string;
    imageUrl?: string;
    note?: string;
    price?: number;
    position?: string;
  };

  if (!idToken || !wishlistId || !title) {
    return NextResponse.json({ error: 'idToken, wishlistId, and title required' }, { status: 400 });
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

  // Gate: caller must be in parentUids[] (D-20)
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const data = wishlistSnap.data()!;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);
  if (!isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Write item with same schema as WishItemDoc (D-21 — identical to child-created items)
  const itemRef = adminDb.collection('wishlists').doc(wishlistId).collection('items').doc();
  // Compute append position server-side if not provided (D-21: items append to end)
  let resolvedPosition = position;
  if (!resolvedPosition) {
    const itemsSnap = await adminDb
      .collection('wishlists').doc(wishlistId)
      .collection('items')
      .orderBy('position', 'desc')
      .limit(1)
      .get();
    if (!itemsSnap.empty) {
      // Append after the last item using a simple suffix convention
      resolvedPosition = itemsSnap.docs[0].data().position + '|z';
    } else {
      resolvedPosition = 'a0'; // first item in an empty list
    }
  }

  const itemData: Record<string, unknown> = {
    title: trimmedTitle,
    position: resolvedPosition,
    createdAt: FieldValue.serverTimestamp(),
  };
  const SAFE_URL_PREFIXES = ['https://', 'http://'];
  if (productUrl?.trim()) {
    const url = productUrl.trim();
    if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
      return NextResponse.json(
        { error: 'productUrl must start with https:// or http://' },
        { status: 400 }
      );
    }
    itemData.productUrl = url;
  }
  if (imageUrl?.trim()) {
    const url = imageUrl.trim();
    if (!SAFE_URL_PREFIXES.some(p => url.startsWith(p))) {
      return NextResponse.json(
        { error: 'imageUrl must start with https:// or http://' },
        { status: 400 }
      );
    }
    itemData.imageUrl = url;
  }
  if (note?.trim()) itemData.note = note.trim();
  if (typeof price === 'number' && !isNaN(price)) itemData.price = price;

  await itemRef.set(itemData);

  return NextResponse.json({ ok: true, itemId: itemRef.id }, { status: 201 });
}
