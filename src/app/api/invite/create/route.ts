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

  // Verify caller is the wishlist owner (child) or a parent
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const wishlistData = wishlistSnap.data()!;
  const isOwner = wishlistData.childUid === decoded.uid;
  const isParent = Array.isArray(wishlistData.parentUids) && wishlistData.parentUids.includes(decoded.uid);
  if (!isOwner && !isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Idempotent: reuse an existing active token instead of minting a new one.
  // Overwriting currentInviteToken without deactivating the old invite used to
  // leave orphaned tokens that stayed redeemable forever.
  const existingToken: string | undefined = wishlistData.currentInviteToken;
  if (existingToken) {
    const existingSnap = await adminDb.collection('invites').doc(existingToken).get();
    if (existingSnap.exists && existingSnap.data()!.active) {
      return NextResponse.json({ token: existingToken });
    }
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
