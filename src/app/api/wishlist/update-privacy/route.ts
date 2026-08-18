import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { isAccountFreeList } from '@/lib/wishlist-kind';

// Toggle surprise mode on an account-free list: when hidePurchases is true the
// list's own parents can no longer see purchases, reservations or the activity
// log — only the invited guests can. Enforced for real in firestore.rules; this
// route just flips the flag.
//
// Deliberately limited to account-free lists. On a child's list the parents are
// the ones coordinating the buying, and the privacy boundary that matters there
// (the child not seeing purchases) is a separate rule.

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, hidePurchases } = body as {
    idToken?: string;
    wishlistId?: string;
    hidePurchases?: boolean;
  };

  if (!idToken || !wishlistId || typeof hidePurchases !== 'boolean') {
    return NextResponse.json(
      { error: 'idToken, wishlistId and hidePurchases (boolean) required' },
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
  if (!isAccountFreeList(data as { childUid?: string })) {
    return NextResponse.json(
      { error: 'Surprise mode is only available on lists without an account' },
      { status: 400 },
    );
  }

  await wishlistRef.update({ hidePurchases });

  return NextResponse.json({ ok: true });
}
