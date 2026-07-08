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

  // Bootstrap-only: assign viewer to accounts without a role. A parent or
  // child replaying this call must keep their higher role — downgrading it
  // would break their own account's routing and permissions.
  const userRecord = await adminAuth.getUser(uid);
  const existingRole = userRecord.customClaims?.role as string | undefined;
  if (existingRole && existingRole !== 'viewer') {
    return NextResponse.json({ ok: true, role: existingRole });
  }

  if (!existingRole) {
    await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });
  }

  // Merge so a repeat call can't wipe profile fields
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.set({ role: 'viewer' }, { merge: true });
  } else {
    await userRef.set({
      uid,
      email: email ?? '',
      role: 'viewer',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true, role: 'viewer' });
}
