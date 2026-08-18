/**
 * Who may read or change the purchase side of a wishlist (purchaseStatus +
 * activityLog): the invited viewers always, and the list's parents unless the
 * list is in surprise mode.
 *
 * Mirrors canSeePurchases() in firestore.rules. The API routes below the viewer
 * flows go through the Admin SDK, which bypasses rules entirely, so the same
 * check has to be applied here by hand — otherwise surprise mode would only
 * hold for the client SDK.
 */
export function canActOnPurchases(
  uid: string,
  wishlist: { viewerUids?: unknown; parentUids?: unknown; hidePurchases?: unknown },
): boolean {
  const viewerUids = Array.isArray(wishlist.viewerUids) ? wishlist.viewerUids : [];
  if (viewerUids.includes(uid)) return true;

  const parentUids = Array.isArray(wishlist.parentUids) ? wishlist.parentUids : [];
  return parentUids.includes(uid) && wishlist.hidePurchases !== true;
}
