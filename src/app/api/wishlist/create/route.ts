import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACCOUNT_FREE_LIST_ID_PREFIX } from '@/lib/wishlist-kind';

// Create a wishlist that has no child account behind it ("lista utan konto"):
// for a toddler too young for a login, a christening, a wedding, and so on.
// Must go through the Admin SDK — firestore.rules only lets a client create a
// wishlist whose childUid is their own UID, which is exactly what these lack.

const MAX_TITLE_LENGTH = 60;
const MAX_LISTS_PER_USER = 25;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, title, occasion, hidePurchases } = body as {
    idToken?: string;
    title?: string;
    occasion?: { name: string; date: string } | null;
    hidePurchases?: boolean;
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

  // Child accounts manage exactly one list — their own. Letting them create
  // more would hand them a list whose purchaseStatus they can read.
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

  const wishlistRef = adminDb
    .collection('wishlists')
    .doc(`${ACCOUNT_FREE_LIST_ID_PREFIX}${adminDb.collection('wishlists').doc().id}`);

  await wishlistRef.set({
    childUid: '',            // no child account — this is what marks the list account-free
    ownerUid: uid,
    viewerUids: [],
    parentUids: [uid],
    title: trimmedTitle,
    hidePurchases: hidePurchases === true,
    createdAt: FieldValue.serverTimestamp(),
    ...(occasion != null
      ? { occasion: { name: occasion.name.trim(), date: occasion.date } }
      : {}),
  });

  return NextResponse.json({ wishlistId: wishlistRef.id }, { status: 201 });
}
