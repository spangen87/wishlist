import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { username, password, displayName, age, viewerIdToken } = body as {
    username?: string;
    password?: string;
    displayName?: string;
    age?: number | string;
    viewerIdToken?: string;
  };

  if (!username || !password || !displayName || !viewerIdToken) {
    return NextResponse.json(
      { error: 'username, password, displayName, and viewerIdToken required' },
      { status: 400 },
    );
  }

  const ageNum = Number(age);
  if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 18) {
    return NextResponse.json(
      { error: 'age must be a number between 1 and 18' },
      { status: 400 },
    );
  }

  // Verify the parent's token UP FRONT — fail loudly instead of silently writing
  // an orphaned child with empty parentUids if the Admin SDK or token is broken.
  let parentUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(viewerIdToken, false);
    parentUid = decoded.uid;
  } catch (err) {
    console.error('[register-child] verifyIdToken failed:', err);
    return NextResponse.json({ error: 'Invalid session, please log in again' }, { status: 401 });
  }

  // Normalise: lowercase + trim (per anti-patterns in research)
  const usernameLower = username.trim().toLowerCase();
  const syntheticEmail = `${usernameLower}@wishlist.internal`;
  const usernameRef = adminDb.collection('usernames').doc(usernameLower);

  // --- Atomic username claim via Firestore transaction (Pitfall 3) ---
  // Order: (1) transaction claims username doc, (2) createUser(), (3) batch writes profile
  // If createUser() fails after transaction succeeds, cleanup deletes the username doc.
  let usernameClaimed = false;
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(usernameRef);
      if (snap.exists) {
        throw new Error('USERNAME_TAKEN');
      }
      // Reserve the slot with a placeholder; real uid written after createUser
      tx.set(usernameRef, { uid: '__pending__' });
    });
    usernameClaimed = true;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'USERNAME_TAKEN') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }

  // Create the Firebase Auth account
  let userRecord;
  try {
    userRecord = await adminAuth.createUser({
      email: syntheticEmail,
      password,
      displayName: displayName.trim(),
    });
  } catch (err: unknown) {
    // Clean up the claimed username slot if Auth creation fails
    if (usernameClaimed) {
      await usernameRef.delete().catch(() => {});
    }
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }

  // Set custom claim
  await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'child' });

  // Batch: update username doc with real uid + write user profile
  const batch = adminDb.batch();
  batch.set(usernameRef, { uid: userRecord.uid });
  batch.set(adminDb.collection('users').doc(userRecord.uid), {
    uid: userRecord.uid,
    username: usernameLower,
    email: syntheticEmail,
    role: 'child',
    createdAt: FieldValue.serverTimestamp(),
    displayName: displayName.trim(),
    age: ageNum,
  });
  // Add the verified caller as the first parent (D-05). parentUid was decoded
  // up front, so this is guaranteed non-empty when we reach this point.
  batch.set(adminDb.collection('wishlists').doc(userRecord.uid), {
    childUid: userRecord.uid,
    viewerUids: [],
    parentUids: [parentUid],
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
}
