import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACCOUNT_FREE_LIST_ID_PREFIX } from '@/lib/wishlist-kind';
import { getChildLists } from '@/lib/firebase/child-lists';

// Create a wishlist that a parent manages. Two kinds:
// - No childUid: a list with no child account behind it ("lista utan konto"),
//   for a toddler too young for a login, a christening, a wedding, and so on.
// - With childUid: one more list for an existing child account (a Christmas
//   list next to the birthday list). The child owns it like their first list.
// Must go through the Admin SDK — firestore.rules only lets a client create a
// wishlist whose childUid is their own UID, and never with parents on it.

const MAX_TITLE_LENGTH = 60;
const MAX_LISTS_PER_USER = 25;
const MAX_LISTS_PER_CHILD = 25;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, title, occasion, hidePurchases, childUid } = body as {
    idToken?: string;
    title?: string;
    occasion?: { name: string; date: string } | null;
    hidePurchases?: boolean;
    childUid?: string;
  };

  if (!idToken || !title) {
    return NextResponse.json({ error: 'idToken and title required' }, { status: 400 });
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return NextResponse.json({ error: 'title must not be empty' }, { status: 400 });
  }
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `title must be at most ${MAX_TITLE_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (childUid !== undefined && (typeof childUid !== 'string' || !childUid)) {
    return NextResponse.json({ error: 'childUid must be a non-empty string' }, { status: 400 });
  }

  if (occasion != null) {
    if (typeof occasion.name !== 'string' || !occasion.name.trim()) {
      return NextResponse.json({ error: 'occasion.name required' }, { status: 400 });
    }
    if (typeof occasion.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(occasion.date)) {
      return NextResponse.json({ error: 'occasion.date must be YYYY-MM-DD' }, { status: 400 });
    }
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Child accounts never create lists. An account-free one would hand them a
  // list whose purchaseStatus they can read, and more lists of their own are
  // their parents' call.
  let callerRole: string | undefined = decoded.role as string | undefined;
  if (!callerRole) {
    const callerSnap = await adminDb.collection('users').doc(uid).get();
    callerRole = callerSnap.data()?.role;
  }
  if (callerRole === 'child') {
    return NextResponse.json(
      { error: 'Barnkonton kan inte skapa egna listor.' },
      { status: 403 },
    );
  }

  const newListId = `${ACCOUNT_FREE_LIST_ID_PREFIX}${adminDb.collection('wishlists').doc().id}`;
  const wishlistRef = adminDb.collection('wishlists').doc(newListId);
  const occasionField =
    occasion != null ? { occasion: { name: occasion.name.trim(), date: occasion.date } } : {};

  if (childUid) {
    // Only someone who is already a parent of this child may give them
    // another list. The new list inherits every parent the child has, so the
    // co-parents don't have to be invited again.
    const childSnap = await adminDb.collection('users').doc(childUid).get();
    if (!childSnap.exists || childSnap.data()?.role !== 'child') {
      return NextResponse.json({ error: 'Barnkontot hittades inte.' }, { status: 404 });
    }
    const childLists = await getChildLists(childUid);
    const parentUids = new Set<string>();
    childLists.forEach((d) =>
      ((d.data().parentUids ?? []) as string[]).forEach((p) => parentUids.add(p))
    );
    if (!parentUids.has(uid)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (childLists.length >= MAX_LISTS_PER_CHILD) {
      return NextResponse.json(
        { error: `Ett barn kan ha som mest ${MAX_LISTS_PER_CHILD} listor.` },
        { status: 409 },
      );
    }

    // No hidePurchases: the child can never see purchases anyway, and hiding
    // them from the parents would only stop them from coordinating.
    await wishlistRef.set({
      childUid,
      viewerUids: [],
      parentUids: [...parentUids],
      title: trimmedTitle,
      createdAt: FieldValue.serverTimestamp(),
      ...occasionField,
    });

    return NextResponse.json({ wishlistId: wishlistRef.id }, { status: 201 });
  }

  // Soft cap so a single account can't fill the collection with empty lists.
  const existing = await adminDb
    .collection('wishlists')
    .where('ownerUid', '==', uid)
    .count()
    .get();
  if (existing.data().count >= MAX_LISTS_PER_USER) {
    return NextResponse.json(
      { error: `Du kan ha som mest ${MAX_LISTS_PER_USER} listor utan konto.` },
      { status: 409 },
    );
  }

  await wishlistRef.set({
    childUid: '',            // no child account — this is what marks the list account-free
    ownerUid: uid,
    viewerUids: [],
    parentUids: [uid],
    title: trimmedTitle,
    hidePurchases: hidePurchases === true,
    createdAt: FieldValue.serverTimestamp(),
    ...occasionField,
  });

  return NextResponse.json({ wishlistId: wishlistRef.id }, { status: 201 });
}
