import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId } = body as { idToken?: string; wishlistId?: string };

  if (!idToken || !wishlistId) {
    return NextResponse.json({ error: 'idToken and wishlistId required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is the wishlist owner (childUid === caller uid)
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists || wishlistSnap.data()!.childUid !== decoded.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = randomBytes(24).toString('hex'); // 48 hex chars

  await adminDb.collection('invites').doc(token).set({
    wishlistId,
    token,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Store currentInviteToken on the wishlist doc for easy lookup (avoids composite index)
  await adminDb.collection('wishlists').doc(wishlistId).update({
    currentInviteToken: token,
  });

  return NextResponse.json({ token });
}
