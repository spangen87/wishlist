import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: targetUid } = await params;
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

  // Load target user profile to determine role + username
  const userSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const userData = userSnap.data()!;
  const role: string = userData.role;
  const username: string | undefined = userData.username;

  if (role === 'child') {
    // Only a parent of this child may delete the child account.
    // Primary source: wishlists/{targetUid}.parentUids (set during Phase 6 invite redemption).
    // Fallback: users/{targetUid}.parentUids (populated by 07-02 migration script and kept
    //   in sync by future parent invite flows). This handles the case where the wishlist
    //   was already deleted before the account delete is requested.
    const wishlistSnap = await adminDb.collection('wishlists').doc(targetUid).get();
    const parentUids: string[] =
      wishlistSnap.exists
        ? (wishlistSnap.data()!.parentUids ?? [])
        : (userData.parentUids ?? []);  // fallback to user doc after migration
    if (!parentUids.includes(decoded.uid)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete Firestore data first (Pitfall 2: Firestore before Auth)
    // 1. Cascade-delete wishlist + items/* + purchaseStatus/* + activityLog/*
    if (wishlistSnap.exists) {
      await adminDb.recursiveDelete(adminDb.collection('wishlists').doc(targetUid));
    }

    // 2. Batch-delete users/{uid} and usernames/{username}
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('users').doc(targetUid));
    if (username) {
      batch.delete(adminDb.collection('usernames').doc(username));
    }
    await batch.commit();

    // 3. Clean up orphaned invite tokens for this wishlist
    const inviteSnap = await adminDb.collection('invites')
      .where('wishlistId', '==', targetUid).get();
    if (!inviteSnap.empty) {
      const inviteBatch = adminDb.batch();
      inviteSnap.docs.forEach((d) => inviteBatch.delete(d.ref));
      await inviteBatch.commit();
    }
  } else {
    // parent or viewer: only the user themselves may delete their own account
    if (decoded.uid !== targetUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Remove UID from all wishlists where they appear as parent or viewer
    const [parentLists, viewerLists] = await Promise.all([
      adminDb.collection('wishlists').where('parentUids', 'array-contains', targetUid).get(),
      adminDb.collection('wishlists').where('viewerUids', 'array-contains', targetUid).get(),
    ]);

    const removalBatch = adminDb.batch();
    parentLists.docs.forEach((d) =>
      removalBatch.update(d.ref, { parentUids: FieldValue.arrayRemove(targetUid) })
    );
    viewerLists.docs.forEach((d) =>
      removalBatch.update(d.ref, { viewerUids: FieldValue.arrayRemove(targetUid) })
    );
    removalBatch.delete(adminDb.collection('users').doc(targetUid));
    await removalBatch.commit();
  }

  // Delete Firebase Auth user — idempotent (Pitfall 3: handle auth/user-not-found)
  try {
    await adminAuth.deleteUser(targetUid);
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    // Already deleted from Auth — Firestore cleanup above is still valid
  }

  return NextResponse.json({ ok: true });
}
