import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getChildLists } from '@/lib/firebase/child-lists';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, memberUid, memberType } = body as {
    idToken?: string;
    wishlistId?: string;
    memberUid?: string;
    memberType?: string;
  };

  if (!idToken || !wishlistId || !memberUid || (memberType !== 'viewer' && memberType !== 'parent')) {
    return NextResponse.json(
      { error: 'idToken, wishlistId, memberUid and memberType (viewer|parent) required' },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlistRef = adminDb.collection('wishlists').doc(wishlistId);
  const wishlistSnap = await wishlistRef.get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const data = wishlistSnap.data()!;
  const isOwner = data.childUid === decoded.uid;
  const isParent = Array.isArray(data.parentUids) && data.parentUids.includes(decoded.uid);

  if (memberType === 'viewer') {
    // Owner (child) and parents can remove viewers
    if (!isOwner && !isParent) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await wishlistRef.update({ viewerUids: FieldValue.arrayRemove(memberUid) });
    return NextResponse.json({ ok: true });
  }

  // memberType === 'parent': only another parent may remove a co-parent.
  // The child must not be able to remove parental oversight, and a parent
  // cannot remove themselves (so a list always keeps at least one parent).
  if (!isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (memberUid === decoded.uid) {
    return NextResponse.json(
      { error: 'Du kan inte ta bort dig själv som förälder.' },
      { status: 409 },
    );
  }

  await wishlistRef.update({ parentUids: FieldValue.arrayRemove(memberUid) });
  // Keep the users/{childUid}.parentUids fallback (used by account deletion) in
  // sync. An account-free list has no child profile to mirror into, and
  // doc('') throws — which used to 500 *after* the removal had committed.
  if (data.childUid) {
    // Parent access is per child, so it goes from all of the child's lists —
    // otherwise the removed parent would keep full control through a sibling.
    const siblings = (await getChildLists(data.childUid)).filter((d) => d.id !== wishlistId);
    if (siblings.length > 0) {
      const siblingBatch = adminDb.batch();
      siblings.forEach((d) =>
        siblingBatch.update(d.ref, { parentUids: FieldValue.arrayRemove(memberUid) })
      );
      await siblingBatch.commit();
    }
    await adminDb.collection('users').doc(data.childUid).set(
      { parentUids: FieldValue.arrayRemove(memberUid) },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
