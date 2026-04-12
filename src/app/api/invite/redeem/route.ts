import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, token } = body as { idToken?: string; token?: string };

  if (!idToken || !token) {
    return NextResponse.json({ error: 'idToken and token required' }, { status: 400 });
  }

  // Step 1: Verify caller identity
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Step 2: Read invite — Admin SDK only
  const inviteRef = adminDb.collection('invites').doc(token);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
  }

  const invite = inviteSnap.data()!;

  if (!invite.active) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
  }

  const { wishlistId } = invite;
  // Default to 'viewer' for backward compatibility with invites created before D-11
  const inviteType: 'parent' | 'viewer' = invite.type === 'parent' ? 'parent' : 'viewer';

  // Step 3: Read wishlist
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Block self-invite: child cannot join their own wishlist
  const childUid: string = wishlistSnap.data()!.childUid;
  if (childUid === uid) {
    return NextResponse.json({ error: 'Du kan inte gå med i din egen önskelista' }, { status: 409 });
  }

  if (inviteType === 'parent') {
    // Parent invite branch (D-12)
    const existingParentUids: string[] = wishlistSnap.data()!.parentUids ?? [];
    if (existingParentUids.includes(uid)) {
      return NextResponse.json({ ok: true, wishlistId, wishlistRole: 'parent', alreadyMember: true });
    }

    // Add to parentUids
    await adminDb.collection('wishlists').doc(wishlistId).update({
      parentUids: FieldValue.arrayUnion(uid),
    });

    // Upgrade claim to parent (even if currently viewer — D-12)
    await adminAuth.setCustomUserClaims(uid, { role: 'parent' });

    // Upsert user profile
    await adminDb.collection('users').doc(uid).set(
      { role: 'parent' },
      { merge: true }
    );

    return NextResponse.json({ ok: true, wishlistId, wishlistRole: 'parent', alreadyMember: false });
  }

  // Viewer invite branch — unchanged from original (D-02, D-06)
  const existingViewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  if (existingViewerUids.includes(uid)) {
    return NextResponse.json({ ok: true, wishlistId, alreadyViewer: true });
  }

  await adminDb.collection('wishlists').doc(wishlistId).update({
    viewerUids: FieldValue.arrayUnion(uid),
  });

  await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });

  await adminDb.collection('users').doc(uid).set(
    { role: 'viewer' },
    { merge: true }
  );

  return NextResponse.json({ ok: true, wishlistId, alreadyViewer: false });
}
