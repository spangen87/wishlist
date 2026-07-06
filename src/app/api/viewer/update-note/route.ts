import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';

// Cap so the shared purchaseStatus doc can't be bloated toward the 1 MiB
// Firestore document limit (which would block ALL viewers on the item).
const MAX_NOTE_CHARS = 1000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, wishlistId, itemId, note } =
    body as {
      idToken?: string;
      wishlistId?: string;
      itemId?: string;
      note?: string;
    };

  if (!idToken || !wishlistId || !itemId || note === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (typeof note !== 'string' || note.length > MAX_NOTE_CHARS) {
    return NextResponse.json(
      { error: `Anteckningen får vara högst ${MAX_NOTE_CHARS} tecken.` },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decoded;

  // Verify caller is a viewer
  const wishlistSnap = await adminDb.collection('wishlists').doc(wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }
  const viewerUids: string[] = wishlistSnap.data()!.viewerUids ?? [];
  const parentUids: string[] = wishlistSnap.data()!.parentUids ?? [];
  if (!viewerUids.includes(uid) && !parentUids.includes(uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // The item must exist — its title is read server-side so the activity log
  // can't be spoofed with fabricated entries.
  const itemSnap = await adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('items').doc(itemId).get();
  if (!itemSnap.exists) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  const itemTitle: string = itemSnap.data()!.title ?? '';

  const statusRef = adminDb
    .collection('wishlists').doc(wishlistId)
    .collection('purchaseStatus').doc(itemId);

  const batch = adminDb.batch();

  // Write the viewer's note into the viewerNotes map.
  // Use FieldPath for the nested key — batch.set() with merge:true treats dotted string keys
  // as literal field names, not nested paths. FieldPath ensures correct nested write.
  batch.set(statusRef, {
    itemId,
    viewerUids,
    viewerNotes: { [uid]: note },
  }, { mergeFields: ['itemId', 'viewerUids', new FieldPath('viewerNotes', uid)] });

  // Only log if note is non-empty (don't log clearing a note)
  if (note.trim().length > 0) {
    const logRef = adminDb
      .collection('wishlists').doc(wishlistId)
      .collection('activityLog').doc();

    batch.set(logRef, {
      viewerUid: uid,
      action: 'added_note',
      itemId,
      itemTitle,
      timestamp: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return NextResponse.json({ ok: true });
}
