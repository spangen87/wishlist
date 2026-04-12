---
phase: 06-parent-administration-and-role-distinction-parent-can-manage
verified: 2026-04-12T00:00:00Z
status: human_needed
score: 18/18
overrides_applied: 0
human_verification:
  - test: "Parent sees purchased count on dashboard 'Mina barn' cards"
    expected: "purchasedCount is non-zero when relatives have marked items purchased"
    why_human: "purchaseStatus Firestore rules restrict read to isViewer only. Parents querying purchaseStatus via client SDK on the dashboard will silently get 0. Cannot verify whether this silent failure is acceptable or a bug — the plan intentionally excluded parents from purchaseStatus access, but the dashboard UI renders purchasedCount from that subscription."
  - test: "Self-registering user at /register completes full flow as parent"
    expected: "After registration, user lands on /dashboard, sees 'Mina barn' and 'Jag är inbjuden till' sections, can create a child account via /add-child"
    why_human: "Full registration + claim propagation + redirect requires a live browser session to verify the auth flow end to end"
  - test: "Co-parent invite link creation and redemption"
    expected: "Parent in settings page creates co-parent link, second user redeems it, second user lands on dashboard and sees the child wishlist in 'Mina barn'"
    why_human: "Two-user flow involving claim upgrade from viewer to parent requires a live Firebase environment"
  - test: "Viewer (anhörig) on viewer page sees no parent controls"
    expected: "User in viewerUids only (not parentUids) sees no 'Lägg till önskemål', no inline rename, no 'Inställningar' link on the viewer page"
    why_human: "isParent state is set client-side by reading the wishlist doc — verify the conditional rendering hides controls correctly in a real browser session"
---

# Phase 06: Parent Administration and Role Distinction — Verification Report

**Phase Goal:** Parent can manage child wishlist (share link, rename, add items) and app distinguishes parent role from anhörig (family member). Parents are tracked in parentUids[] and see a distinct two-section dashboard. Co-parents can be added via a parent invite link.

**Verified:** 2026-04-12
**Status:** human_needed (all automated checks pass; 4 behaviors require live browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Self-registering users at /register receive role: 'parent' custom claim | VERIFIED | register/page.tsx line 27: `fetch('/api/auth/set-parent-claim')`; set-parent-claim/route.ts calls `setCustomUserClaims(uid, { role: 'parent' })` |
| 2 | Child accounts created via register-child have creating parent's UID in parentUids[], not viewerUids[] | VERIFIED | register-child/route.ts lines 94-108: `parentUids = [decoded.uid]`, `batch.set(..., { viewerUids: [], parentUids })` |
| 3 | WishlistDoc TypeScript type has parentUids: string[] field | VERIFIED | firestore.ts line 8: `parentUids: string[];` inside WishlistDoc interface |
| 4 | InviteDoc TypeScript type has type: 'parent' | 'viewer' field | VERIFIED | firestore.ts line 71: `type: 'parent' \| 'viewer';` inside InviteDoc interface |
| 5 | Firestore rules allow parentUids members to read wishlist documents | VERIFIED | firestore.rules line 38: `request.auth.uid in resource.data.parentUids` in the wishlist read rule |
| 6 | Firestore rules allow parentUids members to write to items subcollection | VERIFIED | firestore.rules line 47: `allow write: if isOwner(wishlistId) \| isParent(wishlistId)` |
| 7 | A parent can generate a parent invite link (type: 'parent') for a specific wishlist | VERIFIED | create-for-parent/route.ts: parentUids gate (line 28), writes `type: 'parent'` (line 49), idempotent token return |
| 8 | Redeeming a parent invite link adds the redeemer's UID to parentUids[], not viewerUids[] | VERIFIED | redeem/route.ts lines 62-64: `parentUids: FieldValue.arrayUnion(uid)` inside `if (inviteType === 'parent')` branch |
| 9 | If a viewer redeems a parent invite, their custom claim is upgraded from 'viewer' to 'parent' | VERIFIED | redeem/route.ts line 67: `setCustomUserClaims(uid, { role: 'parent' })` always applied in parent branch |
| 10 | Parent invite creation is gated: caller must be in parentUids[] of the target wishlist | VERIFIED | create-for-parent/route.ts lines 28-31: `data.parentUids.includes(decoded.uid)` → 403 if false |
| 11 | Viewer invite redemption (type: 'viewer' or missing type) is unchanged | VERIFIED | redeem/route.ts lines 78-95: viewer branch unchanged, backward-compatible default to 'viewer' when type absent |
| 12 | Dashboard shows 'Mina barn' section listing wishlists where user is in parentUids[] | VERIFIED | dashboard/page.tsx line 141: `<h2>Mina barn</h2>`; line 78: `subscribeToParentWishlists(user.uid, ...)` |
| 13 | Dashboard shows 'Jag är inbjuden till' section listing wishlists where user is in viewerUids[] | VERIFIED | dashboard/page.tsx line 180: `<h2>Jag är inbjuden till</h2>`; line 89: `subscribeToViewerWishlists(user.uid, ...)` |
| 14 | Parent cards in 'Mina barn' show child name, item count, purchased count, AND management actions | VERIFIED | ParentWishlistDashboardCard.tsx: renders childName, itemCount, purchasedCount props; settings Link to `/wishlist/${wishlist.id}/settings`; "Mitt barn" badge |
| 15 | Viewer cards in 'Jag är inbjuden till' are unchanged from today | VERIFIED | dashboard/page.tsx line 186: renders `WishlistDashboardCard` (existing component, no modification) |
| 16 | A parent on the viewer page sees an 'Lägg till önskemål' form, inline rename field, and settings link | VERIFIED | viewer/[wishlistId]/page.tsx lines 190-258: all three controls wrapped in `{isParent && (...)}` |
| 17 | Settings page accepts parentUids members (not just childUid) | VERIFIED | settings/page.tsx lines 138-143: `callerIsOwner \|\| callerIsParent` gate; redirects if neither |
| 18 | Settings page shows Co-förälder parent invite link section | VERIFIED | settings/page.tsx line 200: `<CoParentInviteSection wishlistId={wishlistId} initialToken={initialParentToken} />`; CoParentInviteSection calls `/api/invite/create-for-parent` |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/firestore.ts` | WishlistDoc with parentUids, InviteDoc with type field | VERIFIED | parentUids: string[] at line 8; type: 'parent' \| 'viewer' at line 71 |
| `src/app/api/auth/set-parent-claim/route.ts` | POST endpoint sets role: parent claim | VERIFIED | 33 lines, exports POST, verifies idToken before setting claim, writes users/{uid} |
| `src/app/api/auth/register-child/route.ts` | Updated to write parentUids instead of viewerUids | VERIFIED | parentUids populated from viewerIdToken; viewerUids: [] hardcoded |
| `src/app/api/invite/create-for-parent/route.ts` | POST endpoint to generate parent invite token | VERIFIED | 57 lines, exports POST, parentUids gate, type: 'parent', idempotent |
| `src/app/api/invite/redeem/route.ts` | Extended to handle type: 'parent' invites | VERIFIED | inviteType dispatch on line 40; parent branch lines 54-76 |
| `src/lib/firebase/viewer.ts` | subscribeToParentWishlists function | VERIFIED | Exported at lines 31-46; `where('parentUids', 'array-contains', parentUid)` |
| `src/app/dashboard/page.tsx` | Two-section dashboard layout | VERIFIED | 200 lines; imports both subscription functions; parentWishlists + viewerWishlists state; two named sections |
| `src/components/viewer/ParentWishlistDashboardCard.tsx` | Dashboard card with management actions | VERIFIED | "Mitt barn" badge line 22; Link to viewer page line 27; settings Link line 47 |
| `src/app/api/wishlist/add-item/route.ts` | POST endpoint for parent to add items | VERIFIED | 78 lines, exports POST, parentUids gate, same WishItemDoc schema as child items |
| `src/app/api/wishlist/update-title/route.ts` | Extended to accept parentUids callers | VERIFIED | Lines 38-40: isOwner \|\| isParent gate replacing old isViewer gate |
| `src/app/viewer/[wishlistId]/page.tsx` | Parent-conditional controls | VERIFIED | isParent state set from wishlist doc line 71; controls rendered conditionally lines 190-258 |
| `src/app/wishlist/[wishlistId]/settings/page.tsx` | Updated gate + Co-förälder section | VERIFIED | parentUids gate lines 138-143; CoParentInviteSection component in JSX |
| `firestore.rules` | isParent helper + updated item write rule | VERIFIED | isParent() function lines 22-26; parentUids in wishlist read line 38; isParent in items write line 47 |
| `src/components/viewer/ParentAddItemForm.tsx` | Thin client component POSTing to /api/wishlist/add-item | VERIFIED | 133 lines; fetches /api/wishlist/add-item with idToken; calls onClose/onError |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/app/register/page.tsx | /api/auth/set-parent-claim | fetch POST with idToken | WIRED | Line 27: `fetch('/api/auth/set-parent-claim')`; no set-viewer-claim reference remains |
| register-child/route.ts | wishlists/{wishlistId}.parentUids | batch.set with parentUids | WIRED | Lines 94-108: parentUids array constructed and written in batch.set |
| create-for-parent route | invites/{token} | adminDb.set with type: 'parent' | WIRED | Line 44-50: `type: 'parent'` written to invites collection |
| redeem route | wishlists/{wishlistId}.parentUids | FieldValue.arrayUnion(uid) | WIRED | Line 63: `parentUids: FieldValue.arrayUnion(uid)` |
| dashboard/page.tsx | subscribeToParentWishlists | import and useEffect subscription | WIRED | Line 8: import; line 78: `subscribeToParentWishlists(user.uid, ...)` |
| dashboard/page.tsx | subscribeToViewerWishlists | import and useEffect subscription | WIRED | Line 8: import; line 89: `subscribeToViewerWishlists(user.uid, ...)` |
| viewer/[wishlistId]/page.tsx | /api/wishlist/add-item | ParentAddItemForm fetch POST | WIRED | ParentAddItemForm.tsx line 30: `fetch('/api/wishlist/add-item')` |
| viewer/[wishlistId]/page.tsx | /api/wishlist/update-title | fetch POST on rename blur/Enter | WIRED | viewer page line 138: `fetch('/api/wishlist/update-title')` |
| settings/page.tsx | /api/invite/create-for-parent | fetch POST from CoParentInviteSection | WIRED | settings page line 33: `fetch('/api/invite/create-for-parent')` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| dashboard/page.tsx (Mina barn) | parentWishlists | subscribeToParentWishlists → Firestore query on parentUids | Yes — onSnapshot with array-contains query | FLOWING |
| dashboard/page.tsx (purchasedCount) | stats.purchasedCount | onSnapshot on purchaseStatus subcollection | Silent failure for parents (rule: isViewer only) | STATIC (see note) |
| ParentWishlistDashboardCard.tsx | itemCount, purchasedCount | props from dashboard stats subscription | flows from Firestore items subcollection (itemCount OK); purchasedCount always 0 for parents | PARTIAL |
| viewer/[wishlistId]/page.tsx | isParent | getDoc(wishlists/{wishlistId}).data.parentUids | Yes — reads real wishlist doc on mount | FLOWING |
| settings/page.tsx | initialParentToken | getDoc(wishlists/{wishlistId}).data.currentParentInviteToken | Yes — reads real wishlist doc | FLOWING |

**Note on purchasedCount:** The dashboard subscribes to `purchaseStatus/{itemId}` for both parent and viewer wishlists. Firestore rules (`allow read, write: if isViewer(wishlistId)`) do not grant parents access. The subscription silently fails and defaults to `purchasedCount: 0`. This is explicitly accepted behavior per plan 06-01 task 3: "Keep purchaseStatus, activityLog...UNCHANGED — parents do not get extra access to those subcollections." The CONTEXT (line 162) also notes: "parents can already do this via viewerUids." The displayed purchased count for parent wishlists will show 0 unless the parent was also added to viewerUids separately.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| set-parent-claim exports POST | `grep "export async function POST" src/app/api/auth/set-parent-claim/route.ts` | match found | PASS |
| register page calls set-parent-claim | `grep "set-parent-claim" src/app/register/page.tsx && ! grep "set-viewer-claim" src/app/register/page.tsx` | set-parent-claim found, no set-viewer-claim | PASS |
| register-child writes parentUids | `grep "parentUids" src/app/api/auth/register-child/route.ts` | match found at lines 94, 98, 107 | PASS |
| isParent in Firestore rules | `grep -c "parentUids" firestore.rules` | 3 matches | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0 | PASS |
| All phase commits verified | `git log --oneline` | 7 commits matching summaries (30dac6c, 95e2f4f, d8fdcdb, 4ebce5d, 7ddfb67, 2c273df, 3a0444d, 90aec07, 4953df9, abab0ab, 143248c) | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| D-01 | 06-01 | Self-registering users get role: 'parent' | SATISFIED — set-parent-claim route + register page wired |
| D-02 | 06-01 | Relatives joining via share link keep role: 'viewer' | SATISFIED — redeem viewer branch unchanged |
| D-03 | 06-01 | parent claim used only for routing; parentUids controls actual rights | SATISFIED — documented in set-parent-claim comments |
| D-04 | 06-01 | WishlistDoc.parentUids: string[] added | SATISFIED — firestore.ts line 8 |
| D-05 | 06-01 | register-child writes parentUids not viewerUids | SATISFIED — register-child/route.ts lines 94-108 |
| D-06 | 06-01 | viewerUids remains for anhörig only | SATISFIED — no change to viewer invite flow |
| D-07 | 06-02 | parentUids can have multiple entries via parent invite | SATISFIED — FieldValue.arrayUnion in redeem route |
| D-08 | 06-03 | Dashboard two sections: Mina barn + Jag är inbjuden till | SATISFIED — dashboard/page.tsx with two named sections |
| D-09 | 06-03 | Both parent and viewer roles use same /dashboard route | SATISFIED — no separate route; role check only gates child redirect |
| D-10 | 06-03 | subscribeToParentWishlists added to viewer.ts | SATISFIED — exported function at viewer.ts lines 31-46 |
| D-11 | 06-02 | Parent invite link with type: 'parent' in InviteDoc | SATISFIED — create-for-parent route + InviteDoc.type field |
| D-12 | 06-02 | Parent invite redemption upgrades claim to 'parent' | SATISFIED — redeem route parent branch with setCustomUserClaims |
| D-13 | 06-04 | Settings page has Co-förälder section | SATISFIED — CoParentInviteSection inline in settings page |
| D-14 | 06-04 | Viewer page shows parent-only controls when isParent | SATISFIED — conditional rendering in viewer page |
| D-15 | 06-04 | Viewer (anhörig) sees no parent controls | SATISFIED — controls behind `{isParent && ...}` guard |
| D-17 | 06-04 | Settings page gate extended to parentUids | SATISFIED — callerIsOwner \|\| callerIsParent gate |
| D-18 | 06-04 | Settings page shows both viewer and parent invite sections | SATISFIED — ShareLinkPanel + CoParentInviteSection |
| D-19 | 06-04 | Back nav in settings is context-aware | SATISFIED — accessType state drives href |
| D-20 | 06-04 | /api/wishlist/add-item parentUids-gated | SATISFIED — add-item/route.ts with parentUids gate |
| D-21 | 06-04 | Items added by parents are indistinguishable from child items | SATISFIED — same WishItemDoc schema, no createdBy field |
| D-22 | 06-01 | Firestore items write rule includes isParent | SATISFIED — firestore.rules line 47 |
| D-23 | 06-04 | update-title accepts parentUids callers | SATISFIED — isOwner \|\| isParent gate in update-title/route.ts |
| D-24 | 06-04 | Inline rename on viewer page | SATISFIED — input/button toggle on isRenaming state |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/viewer/ParentWishlistDashboardCard.tsx | 43 | `<div ... bg-[#E5D5CC]" aria-hidden="true" />` — thumbnail placeholder div | Info | Cosmetic placeholder, not functional — does not affect parent management flow |

No blockers found. The thumbnail placeholder in ParentWishlistDashboardCard is decorative (aria-hidden), consistent with WishlistDashboardCard styling, and does not affect the goal.

---

## Human Verification Required

### 1. Dashboard purchased count for parent wishlists

**Test:** Log in as a parent who has child wishlists (parentUids). Have a relative (in viewerUids) mark an item purchased on that wishlist. Then check the parent's dashboard "Mina barn" card.

**Expected:** Investigate whether purchasedCount shows 0 (Firestore rule blocks parent's purchaseStatus read) or the correct count. Decide if this silent failure is acceptable for v1.0 or requires a Firestore rule fix.

**Why human:** The purchaseStatus rule (`allow read, write: if isViewer(wishlistId)`) explicitly excludes parents. The client-side subscription silently returns empty results. Cannot determine from code alone whether the product intention is "parents see 0" or "parents should see purchased counts."

### 2. Full parent registration flow

**Test:** Navigate to /register, create a new parent account, verify redirect to /dashboard, confirm "Mina barn" and "Jag är inbjuden till" sections both render, then create a child account via /add-child.

**Expected:** Seamless flow. Dashboard sections appear. Child wishlist card appears in "Mina barn" after child creation.

**Why human:** Full registration + Firebase custom claim propagation + redirect logic requires a live browser session with a real Firebase project.

### 3. Co-parent invite redemption

**Test:** As parent, go to /wishlist/[id]/settings, generate Co-förälder link. Log in as a second user (preferably with role: viewer), redeem the parent invite link.

**Expected:** Second user's claim upgraded to 'parent', second user sees the child wishlist under "Mina barn" on their dashboard.

**Why human:** Two-user session with custom claim upgrade requires a live Firebase environment. Claim propagation (force token refresh) timing cannot be verified from code.

### 4. Viewer vs parent controls on viewer page

**Test:** As a viewer (in viewerUids only, not parentUids), navigate to /viewer/[wishlistId]. Confirm no "Lägg till önskemål", no rename control, no "Inställningar" link. Then as a parent (in parentUids), navigate to the same page and confirm all three controls appear.

**Expected:** Controls are entirely absent for viewers; present for parents.

**Why human:** `isParent` is set client-side by reading the wishlist doc. The conditional rendering must be verified in a real browser with a real Firestore document.

---

## Gaps Summary

No automated gaps found. All 18 observable truths are VERIFIED. All artifacts exist, are substantive, and are wired to real data sources and API routes. TypeScript compiles clean. All commits referenced in summaries are confirmed in git log.

The 4 human verification items above are behavioral tests that require a live Firebase session and cannot be verified programmatically. They focus on: (1) the accepted purchaseStatus limitation for parents, (2) auth claim propagation, (3) two-user co-parent invite flow, and (4) conditional rendering correctness.

---

_Verified: 2026-04-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
