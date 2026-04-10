---
phase: 04-viewer-flow
verified: 2026-04-09T12:00:00Z
status: passed
score: 22/22 must-haves verified
---

# Phase 4: Viewer Flow Verification Report

**Phase Goal:** A viewer with a share link can join a child's wishlist, coordinate purchases with other viewers, and review an activity log — all without the child seeing any of it
**Verified:** 2026-04-09
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | A parent can generate a share link; visiting it (after login) adds the visitor as a viewer | VERIFIED | `POST /api/invite/create` generates 48-char hex token; `POST /api/invite/redeem` adds `FieldValue.arrayUnion(uid)` to viewerUids and sets viewer claim |
| SC-2 | Regenerating the link invalidates the old token — old URL no longer grants access | VERIFIED | `POST /api/invite/regenerate` uses `adminDb.batch()` to set `active: false` on old token atomically; redeem route returns 410 for `active === false` |
| SC-3 | Viewer can see the full wishlist including which items are marked purchased and by whom | VERIFIED | `/viewer/[wishlistId]/page.tsx` uses parallel `subscribeToItems` + `subscribeToPurchaseStatus`; `ViewerWishItemCard` renders purchaser badge |
| SC-4 | Viewer can mark an item as purchased (their name recorded) and undo that marking | VERIFIED | `POST /api/viewer/mark-purchased` uses `adminDb.batch()` to write purchaseStatus; toggle uses `FieldValue.delete()` on unmark |
| SC-5 | Viewer can leave a note on any item visible to other viewers but not to the child | VERIFIED | `POST /api/viewer/update-note` writes `viewerNotes[uid]` via `FieldPath` + `mergeFields`; `OtherViewerNotes` shows other viewers' notes; child cannot read purchaseStatus subcollection per Firestore rules |
| SC-6 | Activity log shows each viewer action with username and timestamp | VERIFIED | `ActivityLogEntry` formats three action types in Swedish; uses `<time dateTime={isoString}>`; activity log page at `/viewer/[wishlistId]/activity` with real-time `subscribeToActivityLog` |
| SC-7 | A viewer account can access multiple children's wishlists from a single dashboard | VERIFIED | `/dashboard` uses `subscribeToViewerWishlists` (array-contains query); `WishlistDashboardCard` links to `/viewer/${wishlist.id}`; empty state "Inga önskelistor än" confirmed |

**Score:** 7/7 roadmap success criteria verified

---

### Plan-Level Must-Have Truths

#### Plan 01: Data Layer Foundation

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `PurchaseStatusDoc` has `viewerNotes: Record<string, string>` | VERIFIED | `firestore.ts` line 30: `viewerNotes?: Record<string, string>` |
| 2 | `ActivityLogDoc` type is exported from `firestore.ts` | VERIFIED | `firestore.ts` line 36: `export interface ActivityLogDoc` |
| 3 | `activityLog` subcollection rule allows viewer reads and blocks client writes | VERIFIED | `firestore.rules` lines 52–55: inside `match /wishlists/{wishlistId}`, `allow read: if isViewer(wishlistId)`, `allow write: if false` |
| 4 | `purchaseStatus` rule allows viewer writes (unchanged) | VERIFIED | `firestore.rules` line 46–48: `match /purchaseStatus/{itemId}` rule present and unchanged |
| 5 | `POST /api/invite/create` creates an InviteDoc with 48-char hex token and returns `{ token }` | VERIFIED | `invite/create/route.ts`: `randomBytes(24).toString('hex')` and `adminDb.collection('invites').doc(token).set(...)` |
| 6 | `GET /api/invite/current` returns the active token string for a wishlistId | VERIFIED | `invite/current/route.ts`: reads Authorization header, returns `{ token }` |
| 7 | `POST /api/invite/regenerate` invalidates old token and creates new one atomically | VERIFIED | `invite/regenerate/route.ts`: `adminDb.batch()` with `active: false` on old + new set |
| 8 | `viewer.ts` exports `subscribeToViewerWishlists`, `subscribeToPurchaseStatus`, `subscribeToActivityLog` | VERIFIED | All three functions confirmed in `src/lib/firebase/viewer.ts` |

#### Plan 02: Invite Join Page and Redemption

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting `/invite/[token]` when logged out shows inline login and register options | VERIFIED | Page renders `InlineAuthForm` with login/register toggle in logged-out state |
| 2 | Visiting when already a viewer redirects to `/viewer/[wishlistId]` | VERIFIED | Redeem route returns `alreadyViewer: true`; page calls `router.push` |
| 3 | Visiting when logged in but not yet a viewer redeems token and redirects | VERIFIED | `useEffect` on `user` dependency fires `redeemToken()`; calls `getIdToken(true)` then `router.push` |
| 4 | Invalid or inactive token shows "Länken är inte längre giltig" error state | VERIFIED | `invite/[token]/page.tsx` contains unicode-escaped "Länken är inte längre giltig" (line ~205) |
| 5 | `POST /api/invite/redeem` validates token, adds uid to viewerUids, sets viewer claim, forces token refresh | VERIFIED | Route: `verifyIdToken`, checks `invite.active`, `FieldValue.arrayUnion`, `setCustomUserClaims`; page calls `getIdToken(true)` |

#### Plan 03: Viewer Wishlist Page and Purchase Toggle

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Viewer can see all wishlist items at `/viewer/[wishlistId]` with real-time updates | VERIFIED | Page subscribes via `subscribeToItems` + `subscribeToPurchaseStatus` in parallel |
| 2 | Each card shows item title, price, productUrl, imageUrl thumbnail plus purchased overlay | VERIFIED | `ViewerWishItemCard.tsx` renders all fields including 64px thumbnail with fallback |
| 3 | Viewer can mark an item as purchased — their name shown, item title struck through | VERIFIED | Toggle calls `onTogglePurchased`; `ViewerWishItemCard` applies `line-through text-[#6B7280]` when `isPurchased` |
| 4 | Viewer can unmark an item they purchased | VERIFIED | Toggle fires with `!isPurchased`; route uses `FieldValue.delete()` on `purchasedBy`/`purchasedAt` |
| 5 | When purchased by another viewer, the toggle is disabled with 'Köpt av [namn]' label | VERIFIED | `isOthersPurchase` → `disabled` + `cursor-not-allowed` + `opacity-50` |
| 6 | Non-viewer access to `/viewer/[wishlistId]` redirects to `/login` | VERIFIED | `useEffect` guard: `!user → router.push('/login')` |
| 7 | Child-role users who access `/viewer/[wishlistId]` are redirected to `/wishlist` | VERIFIED | `useEffect` guard: `role === 'child' → router.push('/wishlist')` (line 32) |

#### Plan 04: Viewer Notes and Activity Log

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Viewer can expand a note field on any item and type a note — auto-saved on blur | VERIFIED | `ViewerNoteField.tsx` renders textarea on expand; `onBlur` calls `handleBlur` → `onSave(value)` |
| 2 | When a note exists, truncated text shown inline with 'Redigera' link | VERIFIED | `ViewerNoteField.tsx` line 65: "Redigera" link in accent color when `!expanded && currentNote` |
| 3 | Other viewers' notes shown read-only below current viewer's note field | VERIFIED | `ViewerWishItemCard.tsx` renders `<OtherViewerNotes notes={otherViewerNotes} />` below `ViewerNoteField` |
| 4 | Activity log at `/viewer/[wishlistId]/activity` shows all viewer actions newest-first | VERIFIED | Page uses `subscribeToActivityLog` with `orderBy('timestamp', 'desc')` |
| 5 | Activity log shows 50 entries per page with 'Visa fler' button | VERIFIED | `subscribeToActivityLog` uses `limit(50)`; page has "Visa fler" button when `hasMore` |
| 6 | `POST /api/viewer/update-note` writes viewerNotes[uid] and appends activityLog entry atomically | VERIFIED | Route uses `new FieldPath('viewerNotes', uid)` with `mergeFields` and `adminDb.batch()` |

#### Plan 05: Viewer Dashboard and Settings

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Viewer who logs in sees grid of wishlists at `/dashboard` | VERIFIED | Dashboard uses `subscribeToViewerWishlists`; CSS grid `grid-cols-1 sm:grid-cols-2` |
| 2 | Each dashboard card shows child name, total item count, and purchased count | VERIFIED | `WishlistDashboardCard.tsx` renders child name + counts line |
| 3 | Clicking a dashboard card navigates to `/viewer/[wishlistId]` | VERIFIED | `WishlistDashboardCard` is wrapped in `<Link href={'/viewer/${wishlist.id}'}>`  |
| 4 | Empty dashboard shows 'Inga önskelistor än' state | VERIFIED | Dashboard `page.tsx` line ~120: "Inga önskelistor än" |
| 5 | Child/owner can navigate to settings via gear icon on wishlist page | VERIFIED | `wishlist/page.tsx` line 115: `aria-label="Inställningar för önskelistan"` link |
| 6 | Settings page shows current share link with copy button ('Kopierat!' for 2s) | VERIFIED | `ShareLinkPanel.tsx`: `navigator.clipboard.writeText`, `setCopyLabel('Kopierat!')`, `setTimeout(..., 2000)` |
| 7 | Settings page shows list of current viewers | VERIFIED | `ShareLinkPanel.tsx` renders viewer list with "Betraktare (X)" subheading |
| 8 | Regenerate link shows inline confirmation before executing | VERIFIED | `ShareLinkPanel.tsx` inline confirmation with "Gamla länken slutar fungera. Fortsätt?" |
| 9 | Child users who visit `/dashboard` are redirected to `/wishlist` | VERIFIED | `dashboard/page.tsx` line 29: `role === 'child' → router.push('/wishlist')` |
| 10 | Viewer users who visit `/wishlist` are redirected to `/dashboard` | VERIFIED | `wishlist/page.tsx` line 52: `role === 'viewer' → router.push('/dashboard')` |

---

## Required Artifacts

All 22 artifacts checked for existence, substantive content, and wiring.

| Artifact | Status | Details |
|----------|--------|---------|
| `src/types/firestore.ts` | VERIFIED | viewerNotes + ActivityLogDoc present |
| `firestore.rules` | VERIFIED | activityLog rule inside wishlists block; viewer-read-only; client-write blocked |
| `src/app/api/invite/create/route.ts` | VERIFIED | Exports `POST`; 48-char hex token; owner guard; writes invites collection |
| `src/app/api/invite/current/route.ts` | VERIFIED | Exports `GET`; reads Authorization header; owner-only guard |
| `src/app/api/invite/regenerate/route.ts` | VERIFIED | Exports `POST`; atomic batch; `active: false` on old token |
| `src/lib/firebase/viewer.ts` | VERIFIED | 74 lines; exports all 3 subscription helpers; no server-only import |
| `src/app/api/invite/redeem/route.ts` | VERIFIED | Exports `POST`; `arrayUnion`; `setCustomUserClaims`; self-invite 409 guard |
| `src/app/invite/[token]/page.tsx` | VERIFIED | 244 lines; `use(params)`; inline auth; all 4 page states; `getIdToken(true)` before redirect |
| `src/app/api/viewer/mark-purchased/route.ts` | VERIFIED | 74 lines; `adminDb.batch()` with purchaseStatus + activityLog; `FieldValue.delete()` on unmark |
| `src/app/viewer/[wishlistId]/page.tsx` | VERIFIED | 181 lines; `use(params)`; parallel subscriptions; child redirect; "Visa aktivitetslogg" link; "← Mina önskelistor" nav link |
| `src/components/viewer/ViewerWishItemCard.tsx` | VERIFIED | 145 lines; exports `ViewerWishItemCard`; line-through on purchase; aria-label; disabled for other's purchase |
| `src/components/viewer/PurchasedBadge.tsx` | VERIFIED | Exports `PurchasedBadge`; "Markerad som köpt av dig" / "Köpt av [namn]" |
| `src/components/viewer/ViewerNoteField.tsx` | VERIFIED | Exports `ViewerNoteField`; 3 states (collapsed/no-note, collapsed/has-note, expanded); onBlur auto-save |
| `src/components/viewer/OtherViewerNotes.tsx` | VERIFIED | Exports `OtherViewerNotes`; read-only; returns null when empty |
| `src/app/api/viewer/update-note/route.ts` | VERIFIED | Exports `POST`; `new FieldPath('viewerNotes', uid)` + `mergeFields`; activityLog entry only when `note.trim().length > 0` |
| `src/app/viewer/[wishlistId]/activity/page.tsx` | VERIFIED | 128 lines; `use(params)`; `subscribeToActivityLog`; "Inga händelser ännu"; "Visa fler"; child redirect |
| `src/components/viewer/ActivityLogEntry.tsx` | VERIFIED | 46 lines; exports `ActivityLogEntry`; Swedish action text for all 3 action types; `<time dateTime>` |
| `src/app/dashboard/page.tsx` | VERIFIED | 161 lines; `subscribeToViewerWishlists`; CSS grid; "Inga önskelistor än"; child redirect |
| `src/components/viewer/WishlistDashboardCard.tsx` | VERIFIED | Exports `WishlistDashboardCard`; wrapped in `<Link>` to `/viewer/${wishlist.id}` |
| `src/app/wishlist/[wishlistId]/settings/page.tsx` | VERIFIED | 99 lines; ownership guard (`childUid !== user.uid → /dashboard`); renders `ShareLinkPanel` |
| `src/components/viewer/ShareLinkPanel.tsx` | VERIFIED | 191 lines; exports `ShareLinkPanel`; copy button with "Kopierat!" label; inline confirm before regenerate; calls `/api/invite/regenerate` |
| `src/app/wishlist/page.tsx` | VERIFIED | viewer role redirect guard; gear icon with `aria-label="Inställningar för önskelistan"` |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `invite/create/route.ts` | `invites/{token}` | `adminDb.collection('invites').doc(token).set(...)` | VERIFIED |
| `firestore.rules` | `activityLog` subcollection | `match /activityLog/{entryId}` inside `match /wishlists/{wishlistId}` | VERIFIED |
| `viewer.ts` | `wishlists/{id}/purchaseStatus` | `onSnapshot` on purchaseStatus collection | VERIFIED |
| `invite/[token]/page.tsx` | `POST /api/invite/redeem` | `fetch('/api/invite/redeem', { method: 'POST', body: JSON.stringify({ idToken, token }) })` | VERIFIED |
| `invite/redeem/route.ts` | `wishlists/{wishlistId}.viewerUids` | `FieldValue.arrayUnion(uid)` | VERIFIED |
| `invite/[token]/page.tsx` | `/viewer/[wishlistId]` | `router.push` after `getIdToken(true)` | VERIFIED |
| `viewer/[wishlistId]/page.tsx` | `viewer.ts` | `subscribeToItems` + `subscribeToPurchaseStatus` parallel calls | VERIFIED |
| `ViewerWishItemCard.tsx` | `POST /api/viewer/mark-purchased` | `onTogglePurchased` callback wired in parent page | VERIFIED |
| `mark-purchased/route.ts` | `purchaseStatus + activityLog` | `adminDb.batch().commit()` | VERIFIED |
| `ViewerNoteField.tsx` | `POST /api/viewer/update-note` | `onSave` callback fires on blur → `handleUpdateNote` in parent page | VERIFIED |
| `ViewerWishItemCard.tsx` | `ViewerNoteField + OtherViewerNotes` | Both imported and rendered in card body | VERIFIED |
| `activity/page.tsx` | `subscribeToActivityLog` | `useEffect` + `subscribeToActivityLog` call | VERIFIED |
| `dashboard/page.tsx` | `subscribeToViewerWishlists` | Real-time subscription on viewer UID | VERIFIED |
| `ShareLinkPanel.tsx` | `POST /api/invite/regenerate` | `fetch('/api/invite/regenerate', ...)` on confirm | VERIFIED |
| `wishlist/page.tsx` | `/dashboard` redirect for viewer role | `role === 'viewer'` guard in `useEffect` | VERIFIED |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `viewer/[wishlistId]/page.tsx` | `items`, `statuses` | `subscribeToItems` + `subscribeToPurchaseStatus` → Firestore onSnapshot | Yes — live Firestore data | FLOWING |
| `dashboard/page.tsx` | `wishlists` | `subscribeToViewerWishlists` → Firestore array-contains query | Yes — live Firestore data | FLOWING |
| `activity/page.tsx` | `entries` | `subscribeToActivityLog` → Firestore activityLog subcollection | Yes — live Firestore data, newest-first | FLOWING |
| `ShareLinkPanel.tsx` | `token` | `GET /api/invite/current` → adminDb wishlist.currentInviteToken | Yes — reads real Firestore document | FLOWING |

---

## Git Commit Verification

All 13 commits claimed in summaries verified present in the git log:

| Plan | Commit | Description | Status |
|------|--------|-------------|--------|
| 01 | e17be01 | update PurchaseStatusDoc and add ActivityLogDoc type | VERIFIED |
| 01 | e567b13 | add activityLog subcollection security rule | VERIFIED |
| 01 | 343cd49 | implement invite API routes (create, current, regenerate) | VERIFIED |
| 01 | 9a8c4ed | create viewer.ts Firestore subscription helpers | VERIFIED |
| 02 | c7a845f | implement POST /api/invite/redeem route | VERIFIED |
| 02 | 03b41d9 | build /invite/[token] invite join page | VERIFIED |
| 03 | f023ef4 | implement mark-purchased API route and viewer card components | VERIFIED |
| 03 | 7856c66 | build /viewer/[wishlistId] page with real-time subscriptions | VERIFIED |
| 04 | 47b632f | add ViewerNoteField, OtherViewerNotes, update-note API, extend ViewerWishItemCard | VERIFIED |
| 04 | 919960e | add ActivityLogEntry, activity log page, wire viewer page with note handlers | VERIFIED |
| 05 | 1df00fe | viewer dashboard grid, WishlistDashboardCard, viewer redirect guard | VERIFIED |
| 05 | c29e04a | settings page, ShareLinkPanel, gear icon on wishlist page | VERIFIED |
| 05 | af30bf6 | resolve 4 UAT issues from viewer flow verification | VERIFIED |

---

## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| SHARE-01 | 01, 05 | Parent can generate a share link | SATISFIED | `POST /api/invite/create` + `ShareLinkPanel` "Skapa delningslänk" button |
| SHARE-02 | 02 | Anyone with the link can join as viewer | SATISFIED | `POST /api/invite/redeem` adds to `viewerUids` + sets viewer claim |
| SHARE-03 | 01, 02, 05 | Joining via invalidated link is blocked | SATISFIED | `active: false` check returns 410; regenerate atomically invalidates old token |
| VIEW-01 | 03 | Viewer can see the wishlist | SATISFIED | `/viewer/[wishlistId]` with real-time `subscribeToItems` |
| VIEW-02 | 03 | Viewer can see purchased status | SATISFIED | `subscribeToPurchaseStatus` + `ViewerWishItemCard` purchased overlay |
| VIEW-03 | 03 | Viewer can mark item as purchased | SATISFIED | `POST /api/viewer/mark-purchased` + toggle button |
| VIEW-04 | 04 | Viewer can leave notes on items | SATISFIED | `POST /api/viewer/update-note` + `ViewerNoteField` auto-save |
| VIEW-05 | 03 | Viewer can unmark a purchase they made | SATISFIED | Toggle sends `purchased: false`; route uses `FieldValue.delete()` |
| VIEW-06 | 05 | Viewer can access multiple wishlists from dashboard | SATISFIED | `subscribeToViewerWishlists` + WishlistDashboardCard grid |
| VIEW-07 | 04 | Activity log shows viewer actions with username and timestamp | SATISFIED | `ActivityLogEntry` + activity log page with Swedish action text |

---

## Anti-Patterns Found

No blocking anti-patterns found. Specific checks performed:

- No `return null` or `return {}` stub patterns in any route files
- No hardcoded empty arrays passed to rendered components — all data flows from real Firestore subscriptions
- All TODO/FIXME: none found in phase 04 files
- `console.log` scan: none in phase 04 production files
- The `viewerNotes[uid]` dotted-path bug was identified during UAT and fixed via `new FieldPath('viewerNotes', uid)` with `mergeFields` (af30bf6) — no stub remains
- Self-invite guard missing in original redeem route was identified during UAT and added (af30bf6) — correctly returns 409

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for API routes (require running Firebase emulator + auth tokens). The following behaviors have been verified via code inspection rather than runtime execution:

- `POST /api/invite/create` → confirmed writes to `invites` collection with `randomBytes(24).toString('hex')` token
- `POST /api/invite/redeem` → confirmed `arrayUnion` + `setCustomUserClaims` + 410 on inactive
- `POST /api/viewer/mark-purchased` → confirmed `adminDb.batch()` writes to both `purchaseStatus` and `activityLog`
- `subscribeToViewerWishlists` → confirmed `where('viewerUids', 'array-contains', viewerUid)` query

---

## Human Verification Required

None. All observable truths were verified programmatically via code inspection and git log.

The phase included UAT (user acceptance testing) of 7 E2E flows conducted during Plan 05 Task 3 — the user approved all flows before the checkpoint commit (af30bf6). Four bugs discovered during UAT were fixed in that commit.

---

## Gaps Summary

No gaps. All 22 artifacts exist on disk with substantive implementations. All 13 git commits are present in the repository. All 7 ROADMAP success criteria and all 22 plan-level must-have truths are satisfied by the implementation. All 10 requirements (SHARE-01 through SHARE-03, VIEW-01 through VIEW-07) have implementation evidence. Data flows from real Firestore subscriptions through all rendering components — no hollow props or hardcoded empty data found.

The phase achieved its goal: a viewer with a share link can join a child's wishlist, coordinate purchases with other viewers, and review an activity log — all without the child seeing any of it.

---

_Verified: 2026-04-09_
_Verifier: Claude (gsd-verifier)_
