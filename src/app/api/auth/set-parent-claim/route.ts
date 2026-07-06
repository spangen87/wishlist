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

  // Never touch a child account's role — a child calling this endpoint would
  // otherwise corrupt their claim and profile. Viewer → parent upgrade is
  // allowed (same as parent invite redemption).
  let currentRole: string | undefined;
  try {
    const userRecord = await adminAuth.getUser(uid);
    currentRole = userRecord.customClaims?.role as string | undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (currentRole === 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (currentRole !== 'parent') {
    await adminAuth.setCustomUserClaims(uid, { role: 'parent' });
  }

  // Merge — never overwrite existing profile fields.
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.set({ uid, role: 'parent' }, { merge: true });
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
