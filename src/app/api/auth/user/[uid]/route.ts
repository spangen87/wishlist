import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isAccountFreeList } from '@/lib/wishlist-kind';
import { getChildLists } from '@/lib/firebase/child-lists';

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
    // Primary source: parentUids on the child's lists — wishlists/{targetUid}
    //   plus any further lists carrying the same childUid.
    // Fallback: users/{targetUid}.parentUids (populated by 07-02 migration script and kept
    //   in sync by future parent invite flows). This handles the case where every
    //   list was already deleted before the account delete is requested.
    const childLists = await getChildLists(targetUid);
    const parentUids: string[] =
      childLists.length > 0
        ? childLists.flatMap((d) => (d.data().parentUids ?? []) as string[])
        : (userData.parentUids ?? []);  // fallback to user doc after migration
    if (!parentUids.includes(decoded.uid)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete Firestore data first (Pitfall 2: Firestore before Auth)
    // 1. Cascade-delete every list + items/* + purchaseStatus/* + activityLog/*,
    //    and the invite tokens that point at them.
    for (const listDoc of childLists) {
      await adminDb.recursiveDelete(listDoc.ref);
      const inviteSnap = await adminDb.collection('invites')
        .where('wishlistId', '==', listDoc.id).get();
      if (!inviteSnap.empty) {
        const inviteBatch = adminDb.batch();
        inviteSnap.docs.forEach((d) => inviteBatch.delete(d.ref));
        await inviteBatch.commit();
      }
    }

    // 2. Batch-delete users/{uid} and usernames/{username}
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('users').doc(targetUid));
    if (username) {
      batch.delete(adminDb.collection('usernames').doc(username));
    }
    await batch.commit();
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

    // A list with no account behind it survives only through its parents. Once
    // the last one leaves nobody can ever reach it again — while its share
    // links would still work — so it goes with them.
    const abandonedLists = parentLists.docs.filter((d) => {
      const data = d.data();
      const parentUids: string[] = data.parentUids ?? [];
      return isAccountFreeList(data as { childUid?: string }) &&
        parentUids.every((uid) => uid === targetUid);
    });
    const abandonedIds = new Set(abandonedLists.map((d) => d.id));

    const removalBatch = adminDb.batch();
    parentLists.docs
      .filter((d) => !abandonedIds.has(d.id))
      .forEach((d) =>
        removalBatch.update(d.ref, { parentUids: FieldValue.arrayRemove(targetUid) })
      );
    viewerLists.docs
      .filter((d) => !abandonedIds.has(d.id))
      .forEach((d) =>
        removalBatch.update(d.ref, { viewerUids: FieldValue.arrayRemove(targetUid) })
      );
    removalBatch.delete(adminDb.collection('users').doc(targetUid));
    await removalBatch.commit();

    for (const listDoc of abandonedLists) {
      // recursiveDelete cannot join a batch — it walks the subcollections itself.
      await adminDb.recursiveDelete(listDoc.ref);
      const inviteSnap = await adminDb.collection('invites')
        .where('wishlistId', '==', listDoc.id).get();
      if (!inviteSnap.empty) {
        const inviteBatch = adminDb.batch();
        inviteSnap.docs.forEach((d) => inviteBatch.delete(d.ref));
        await inviteBatch.commit();
      }
    }
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
