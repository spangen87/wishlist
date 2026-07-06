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

  // Only meant for freshly registered accounts. Never change an existing role:
  // a child calling this would corrupt their account, and a parent would be
  // downgraded. Existing roles are simply kept (idempotent no-op).
  let currentRole: string | undefined;
  try {
    const userRecord = await adminAuth.getUser(uid);
    currentRole = userRecord.customClaims?.role as string | undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!currentRole) {
    await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });
  }

  // Merge — never overwrite existing profile fields (username, displayName, age).
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({
      uid,
      email: email ?? '',
      role: currentRole ?? 'viewer',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}
