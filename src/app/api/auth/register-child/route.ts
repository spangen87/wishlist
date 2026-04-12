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

  if (!username || !password || !displayName) {
    return NextResponse.json(
      { error: 'username, password, and displayName required' },
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
  // If the caller provided their idToken, add them as the first viewer
  let viewerUids: string[] = [];
  if (viewerIdToken) {
    try {
      const decoded = await adminAuth.verifyIdToken(viewerIdToken);
      viewerUids = [decoded.uid];
    } catch {
      // Invalid token — proceed without adding viewer (non-fatal)
    }
  }
  batch.set(adminDb.collection('wishlists').doc(userRecord.uid), {
    childUid: userRecord.uid,
    viewerUids,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
}
