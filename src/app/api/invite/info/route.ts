import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { isAccountFreeList } from '@/lib/wishlist-kind';

// Public (token-gated) preview of an invite so the invite page can validate the
// link BEFORE the visitor creates an account, and tailor the copy to the invite
// type. The unguessable 48-char token is the capability; we only expose the
// list's name (the child's first name, or the list title when there is no
// child account) and the invite type, nothing else.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || !/^[a-f0-9]{16,64}$/.test(token)) {
    return NextResponse.json({ valid: false });
  }

  const inviteSnap = await adminDb.collection('invites').doc(token).get();
  if (!inviteSnap.exists || !inviteSnap.data()!.active) {
    return NextResponse.json({ valid: false });
  }
  const invite = inviteSnap.data()!;
  const type: 'parent' | 'viewer' = invite.type === 'parent' ? 'parent' : 'viewer';

  const wishlistSnap = await adminDb.collection('wishlists').doc(invite.wishlistId).get();
  if (!wishlistSnap.exists) {
    return NextResponse.json({ valid: false });
  }

  const wishlistData = wishlistSnap.data()!;

  // An account-free list has no child profile to read a name from — its own
  // title is the name, so send that instead and let the page word the invite around it.
  if (isAccountFreeList(wishlistData as { childUid?: string })) {
    return NextResponse.json({
      valid: true,
      type,
      childName: '',
      listName: (wishlistData.title as string | undefined) ?? '',
    });
  }

  let childName = '';
  try {
    const childSnap = await adminDb.collection('users').doc(wishlistData.childUid).get();
    const childData = childSnap.data();
    childName = childData?.displayName ?? childData?.username ?? '';
  } catch {
    // name is a nicety — the invite is still valid without it
  }

  return NextResponse.json({ valid: true, type, childName, listName: '' });
}
