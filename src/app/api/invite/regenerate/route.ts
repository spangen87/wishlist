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

  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists || wishlistSnap.data()!.childUid !== decoded.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const oldToken: string | undefined = wishlistSnap.data()!.currentInviteToken;
  const newToken = randomBytes(24).toString('hex');

  const batch = adminDb.batch();

  // Invalidate old token if it exists
  if (oldToken) {
    batch.update(adminDb.collection('invites').doc(oldToken), { active: false });
  }

  // Create new InviteDoc
  const newInviteRef = adminDb.collection('invites').doc(newToken);
  batch.set(newInviteRef, {
    wishlistId,
    token: newToken,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update currentInviteToken on wishlist doc atomically
  batch.update(adminDb.collection('wishlists').doc(wishlistId), {
    currentInviteToken: newToken,
  });

  await batch.commit();

  return NextResponse.json({ token: newToken });
}
