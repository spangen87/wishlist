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

  // Step 2: Read invite — Admin SDK only (client rules: allow read, write: if false)
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

  // Step 3: Check if already a viewer (idempotent — safe to call twice)
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Block self-invite: child cannot become a viewer of their own wishlist
  const childUid: string = wishlistSnap.data()!.childUid;
  if (childUid === uid) {
    return NextResponse.json({ error: 'Du kan inte gå med i din egen önskelista' }, { status: 409 });
  }

  const existingViewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  if (existingViewerUids.includes(uid)) {
    // Already a viewer — return wishlistId so client can redirect
    return NextResponse.json({ ok: true, wishlistId, alreadyViewer: true });
  }

  // Step 4: Add uid to viewerUids atomically
  await adminDb.collection('wishlists').doc(wishlistId).update({
    viewerUids: FieldValue.arrayUnion(uid),
  });

  // Step 5: Set viewer custom claim
  await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });

  // Step 6: Upsert user profile with viewer role
  await adminDb.collection('users').doc(uid).set(
    { role: 'viewer' },
    { merge: true }
  );

  return NextResponse.json({ ok: true, wishlistId, alreadyViewer: false });
}
