import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ wishlistId: string }> }
) {
  const { wishlistId } = await params;
  const body = await request.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = wishlistSnap.data()!;
  const callerIsOwner = data.childUid === decoded.uid;
  const callerIsParent = (data.parentUids ?? []).includes(decoded.uid);
  if (!callerIsOwner && !callerIsParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Cascade-delete wishlist root + items/* + purchaseStatus/* + activityLog/*
  //    MUST use Admin SDK recursiveDelete — client deleteDoc() leaves subcollections orphaned
  await adminDb.recursiveDelete(adminDb.collection('wishlists').doc(wishlistId));

  // 2. Clean up invite tokens referencing this wishlist (they'd 404 on redeem anyway but take space)
  const inviteSnap = await adminDb.collection('invites')
    .where('wishlistId', '==', wishlistId).get();
  if (!inviteSnap.empty) {
    const inviteBatch = adminDb.batch();
    inviteSnap.docs.forEach((d) => inviteBatch.delete(d.ref));
    await inviteBatch.commit();
  }

  return NextResponse.json({ ok: true });
}
