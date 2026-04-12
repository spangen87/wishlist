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

  // Gate: caller must be in parentUids[] (D-11)
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const data = wishlistSnap.data()!;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);
  if (!isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Idempotent: return existing active parent invite token if present
  const existingToken: string | undefined = data.currentParentInviteToken;
  if (existingToken) {
    const inviteSnap = await adminDb.collection('invites').doc(existingToken).get();
    if (inviteSnap.exists && inviteSnap.data()!.active) {
      return NextResponse.json({ token: existingToken });
    }
  }

  const token = randomBytes(24).toString('hex'); // 48 hex chars

  await adminDb.collection('invites').doc(token).set({
    wishlistId,
    token,
    active: true,
    type: 'parent',  // D-11: parent invite type
    createdAt: FieldValue.serverTimestamp(),
  });

  await adminDb.collection('wishlists').doc(wishlistId).update({
    currentParentInviteToken: token,
  });

  return NextResponse.json({ token });
}
