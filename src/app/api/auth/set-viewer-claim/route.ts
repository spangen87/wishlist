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
  await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });

  await adminDb.collection('users').doc(uid).set({
    uid,
    email: email ?? '',
    role: 'viewer',
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
