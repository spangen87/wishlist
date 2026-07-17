import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, occasion } = body as {
    idToken?: string;
    wishlistId?: string;
    occasion?: { name: string; date: string } | null;
  };

  if (!idToken || !wishlistId) {
    return NextResponse.json(
      { error: 'idToken and wishlistId required' },
      { status: 400 },
    );
  }

  if (occasion != null) {
    if (typeof occasion.name !== 'string' || !occasion.name.trim()) {
      return NextResponse.json({ error: 'occasion.name required' }, { status: 400 });
    }
    if (typeof occasion.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(occasion.date)) {
      return NextResponse.json(
        { error: 'occasion.date must be YYYY-MM-DD' },
        { status: 400 },
      );
    }
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

  // Once a parent manages the list and an occasion is set, the child can no
  // longer change or clear it (mirrors the firestore.rules occasion lock).
  const hasParents = Array.isArray(data.parentUids) && data.parentUids.length > 0;
  if (isOwner && !isParent && hasParents && data.occasion != null) {
    return NextResponse.json(
      { error: 'Occasion is locked — a parent manages it' },
      { status: 403 },
    );
  }

  if (occasion == null) {
    await adminDb.collection('wishlists').doc(wishlistId).update({
      occasion: FieldValue.delete(),
    });
  } else {
    await adminDb.collection('wishlists').doc(wishlistId).update({
      occasion: { name: occasion.name.trim(), date: occasion.date },
    });
  }

  return NextResponse.json({ ok: true });
}
