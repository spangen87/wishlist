import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { idToken, childUid, newPassword } = body as {
    idToken?: string;
    childUid?: string;
    newPassword?: string;
  };

  if (!idToken || !childUid || !newPassword) {
    return NextResponse.json(
      { error: 'idToken, childUid, and newPassword required' },
      { status: 400 },
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: 'Lösenordet måste vara minst 6 tecken.' },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorize: caller must be a parent of the target child.
  // Source of truth is wishlists/{childUid}.parentUids (set on register-child + invite redemption).
  const wishlistSnap = await adminDb.collection('wishlists').doc(childUid).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }
  const parentUids: string[] = wishlistSnap.data()?.parentUids ?? [];
  if (!parentUids.includes(decoded.uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Sanity-check: target must actually be a child account
  const userSnap = await adminDb.collection('users').doc(childUid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'child') {
    return NextResponse.json({ error: 'Target is not a child account' }, { status: 400 });
  }

  try {
    await adminAuth.updateUser(childUid, { password: newPassword });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Child auth account not found' }, { status: 404 });
    }
    if (code === 'auth/invalid-password') {
      return NextResponse.json({ error: 'Lösenordet är ogiltigt.' }, { status: 400 });
    }
    console.error('[reset-child-password] updateUser failed:', err);
    return NextResponse.json({ error: 'Något gick fel. Försök igen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
