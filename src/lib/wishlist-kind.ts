/**
 * "Lista utan konto" — a wishlist with no child account behind it.
 *
 * A normal wishlist is owned by a child: the doc ID equals the child's UID and
 * childUid points back at it. An account-free list has no login of its own —
 * the creator manages it through parentUids, childUid is stored as '' and
 * ownerUid records who created it. Everything downstream (items, invites,
 * purchase status, activity log) is identical.
 *
 * The doc ID is prefixed so it can never collide with a Firebase Auth UID,
 * which the `request.auth.uid == wishlistId` branch in firestore.rules relies on
 * (Auth UIDs are alphanumeric only, so a hyphen makes the two sets disjoint).
 */
export const ACCOUNT_FREE_LIST_ID_PREFIX = 'list-';

export function isAccountFreeList(wishlist: { childUid?: string }): boolean {
  return !wishlist.childUid;
}

/** Name to show for a list: its own title, the child's name, or a neutral fallback. */
export function wishlistDisplayName(
  wishlist: { childUid?: string; title?: string },
  childName?: string,
): string {
  if (isAccountFreeList(wishlist)) return wishlist.title?.trim() || 'Önskelista';
  return childName?.trim() || wishlist.title?.trim() || 'Önskelista';
}

/**
 * Suggestions for the "Tillfälle" field, offered both when a list is created
 * and when it is edited later. Kept in one place so a wedding list created on
 * /add-list still finds "Bröllop" in the settings dropdown.
 */
export const OCCASION_SUGGESTIONS = [
  'Födelsedag',
  'Jul',
  'Dop',
  'Bröllop',
  'Namngivningsfest',
  'Inflyttningsfest',
  'Påsk',
  'Studenten',
  'Namnsdagen',
] as const;
