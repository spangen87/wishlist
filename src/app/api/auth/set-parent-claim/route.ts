import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { uid, email } = decodedToken;

  // This route exists for the registration flow only: it may bootstrap a role
  // on a fresh account, never change an existing one. Without this guard any
  // logged-in viewer or child could escalate themselves to parent.
  const userRecord = await adminAuth.getUser(uid);
  const existingRole = userRecord.customClaims?.role as string | undefined;
  if (existingRole && existingRole !== 'parent') {
    return NextResponse.json({ error: 'Role already assigned' }, { status: 409 });
  }

  if (!existingRole) {
    await adminAuth.setCustomUserClaims(uid, { role: 'parent' });
  }

  // Merge so a repeat call can't wipe profile fields (displayName, username, …)
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.set({ role: 'parent' }, { merge: true });
  } else {
    await userRef.set({
      uid,
      email: email ?? '',
      role: 'parent',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}
