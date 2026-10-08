import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

/**
 * A child account can have several wishlists. The first one is keyed by the
 * child's UID (wishlists/{childUid}); any further ones get a generated
 * `list-…` ID but carry the same childUid. Parents belong to the child rather
 * than to a single list, so these helpers look across all of them.
 */

export async function getChildLists(childUid: string) {
  const snap = await adminDb.collection('wishlists').where('childUid', '==', childUid).get();
  return snap.docs;
}

/**
 * Everyone with parent access to the child — the union over all its lists, with
 * users/{childUid}.parentUids as fallback once every list has been deleted.
 */
export async function getChildParentUids(childUid: string): Promise<string[]> {
  const lists = await getChildLists(childUid);
  if (lists.length > 0) {
    const uids = new Set<string>();
    lists.forEach((d) => ((d.data().parentUids ?? []) as string[]).forEach((uid) => uids.add(uid)));
    return [...uids];
  }
  const userSnap = await adminDb.collection('users').doc(childUid).get();
  return (userSnap.data()?.parentUids ?? []) as string[];
}
