import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wishlistId = searchParams.get('wishlistId');
  const idToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!idToken || !wishlistId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner (child) and parents can retrieve the invite token
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = wishlistSnap.data()!;
  const isOwner = data.childUid === decoded.uid;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);
  if (!isOwner && !isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token: string | undefined = data.currentInviteToken;

  if (!token) {
    return NextResponse.json({ token: null });
  }

  // Verify it's still active
  const inviteSnap = await adminDb.collection('invites').doc(token).get();
  if (!inviteSnap.exists || !inviteSnap.data()!.active) {
    return NextResponse.json({ token: null });
  }

  return NextResponse.json({ token });
}
