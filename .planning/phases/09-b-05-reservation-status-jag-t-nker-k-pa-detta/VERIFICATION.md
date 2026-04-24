---
phase: 09-b-05-reservation-status-jag-t-nker-k-pa-detta
verified: 2026-04-24T22:10:00Z
status: human_needed
score: 17/17 must-haves verified (D-01..D-17 all satisfied in code)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Two-viewer race + UI badge"
    expected: "Viewer A clicks 'Jag tänker köpa detta' → button turns orange 'Du tänker köpa detta'. Viewer B (different account, same wishlist) sees the disabled grey button labeled 'Reserverad av {Viewer A name}' and the inline italic badge under the title."
    why_human: "Real-time multi-account propagation requires two browser sessions and live Firestore subscription updates — cannot be exercised by static code analysis."
  - test: "409 conflict copy on simultaneous reserve"
    expected: "If Viewer B forces a click on the disabled button (e.g. via DevTools removing the disabled attr) or two viewers race, the API returns 409 and Viewer B sees the inline error 'Någon annan har redan reserverat detta.'"
    why_human: "Race condition; needs DevTools tampering or simultaneous clicks to reach the 409 path."
  - test: "D-03 auto-clear on purchase"
    expected: "Reserve an item as Viewer A → click 'Markera som köpt' → reserve button disappears (D-14), purchase button shows 'Markerad som köpt av dig', and the purchaseStatus doc no longer has reservedBy."
    why_human: "End-to-end behavioural check across the mark-purchased route + UI hide condition."
  - test: "Activity log Swedish copy"
    expected: "Activity log page renders entries '{namn} reserverade \"{itemTitle}\"' and '{namn} avbokade sin reservation på \"{itemTitle}\"'. Italic styling matches existing entries."
    why_human: "Visual rendering + Swedish copy verification on the activity log page (live data needed)."
  - test: "Default-state dashed border visual"
    expected: "Default 'Jag tänker köpa detta' button shows a dashed border in white background — visually distinct from the solid-border purchase button below it."
    why_human: "Tailwind class 'border-dashed' is present in source; visual confirmation that it renders as intended (not broken by other utility classes) requires a browser."
  - test: "Child cannot see reservation"
    expected: "Log in as the child account on the same wishlist. Reservation badge, reserve button, and reservedBy field must not be visible/readable. Firestore rules deny read on purchaseStatus subcollection for child UID."
    why_human: "Privacy boundary verification — needs live child auth session and confirmation that no reservation UI surfaces appear in the child's wishlist view."
  - test: "Firestore rules deployed"
    expected: "Defense-in-depth `reservedBy` clause in firestore.rules is active in production (run `firebase deploy --only firestore:rules`). Without deploy, only the Admin SDK route protection holds."
    why_human: "Deployment step — code change is committed, but rules apply only after deploy; user must trigger or confirm."
---

# Phase 9: B-05 Reservation Status Verification Report

**Phase Goal:** Allow viewers/parents to signal "Jag tänker köpa detta" reservation intent on a wish item, with first-come-first-served locking, separate from purchase confirmation, child cannot see, automatic clear on purchase. Activity log records reserve/unreserve events.

**Verified:** 2026-04-24
**Status:** human_needed (all 17 requirements pass automated verification; 7 UAT items require browser/multi-account testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PurchaseStatusDoc` has `reservedBy?: string` field                                                                                                                                   | ✓ VERIFIED | `src/types/firestore.ts:39` — field declared with privacy comment                                                                                                                                                       |
| 2   | `ActivityLogDoc.action` union includes `'reserved' \| 'unreserved'`                                                                                                                   | ✓ VERIFIED | `src/types/firestore.ts:48` — full union present                                                                                                                                                                        |
| 3   | `POST /api/viewer/reserve-item` exists with idToken + access check                                                                                                                    | ✓ VERIFIED | `src/app/api/viewer/reserve-item/route.ts:6-39` — adminAuth.verifyIdToken + viewerUids/parentUids check                                                                                                                  |
| 4   | Route returns 409 when another user already holds reservedBy                                                                                                                          | ✓ VERIFIED | `route.ts:42-49` — pre-batch read of `purchaseStatus.reservedBy`, 409 returned if `existingReservedBy && existingReservedBy !== uid`                                                                                     |
| 5   | Route sets `reservedBy: uid` on reserve and `FieldValue.delete()` on un-reserve, both in same Admin SDK batch with activity-log entry                                                 | ✓ VERIFIED | `route.ts:51-79` — batch.set merge + batch.set logRef with `action: reserve ? 'reserved' : 'unreserved'`                                                                                                                |
| 6   | `mark-purchased` clears `reservedBy` via `FieldValue.delete()` in purchased branch (D-03)                                                                                             | ✓ VERIFIED | `src/app/api/viewer/mark-purchased/route.ts:53` — `reservedBy: FieldValue.delete()` inside `batch.set({...},{merge:true})`                                                                                              |
| 7   | `firestore.rules` validates `reservedBy == request.auth.uid \|\| null` in purchaseStatus write rule                                                                                   | ✓ VERIFIED | `firestore.rules:65-69` — `!('reservedBy' in request.resource.data) \|\| reservedBy == auth.uid \|\| reservedBy == null`                                                                                                |
| 8   | Child privacy boundary unchanged — purchaseStatus read still gated by `isViewer \|\| isParent`                                                                                        | ✓ VERIFIED | `firestore.rules:61` — original `allow read` rule preserved; child UID is in neither viewerUids nor parentUids                                                                                                          |
| 9   | `ViewerWishItemCard` renders reserve button above purchase button when not purchased                                                                                                  | ✓ VERIFIED | `ViewerWishItemCard.tsx:126-151` — reserve button JSX precedes the purchase button JSX (line 157)                                                                                                                       |
| 10  | Reserve button shows 'Jag tänker köpa detta' with dashed border in default state                                                                                                      | ✓ VERIFIED | `ViewerWishItemCard.tsx:142,149` — `border-dashed border-[#E5D5CC] bg-white` + literal text                                                                                                                             |
| 11  | Reserve button shows 'Du tänker köpa detta' (orange filled) when current user is reserver                                                                                             | ✓ VERIFIED | `ViewerWishItemCard.tsx:140-141,148` — `bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white` + literal text                                                                                                     |
| 12  | Reserve button shows 'Reserverad av {namn}' (disabled, muted) when other user has reserved                                                                                            | ✓ VERIFIED | `ViewerWishItemCard.tsx:138-139,145-146` — `opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]`, `disabled={reserving \|\| isOtherReservation}` (line 129)                                          |
| 13  | Reserve button is hidden entirely when item is purchased (D-14)                                                                                                                       | ✓ VERIFIED | `ViewerWishItemCard.tsx:126` — `{!isPurchased && (` wrapper                                                                                                                                                             |
| 14  | Reservation badge 'Reserverad av {namn}' renders inline when other reserved (D-10)                                                                                                    | ✓ VERIFIED | `ViewerWishItemCard.tsx:119-123` — `{isOtherReservation && reserverName && (<span ...italic>Reserverad av {reserverName}</span>)}`                                                                                      |
| 15  | `handleToggleReserved` POSTs to `/api/viewer/reserve-item` with full body and surfaces 409                                                                                            | ✓ VERIFIED | `src/app/viewer/[wishlistId]/page.tsx:119-138` — fetch with `{ idToken, wishlistId, itemId, itemTitle, reserve }`; appends ` 409` to error msg on conflict, picked up by card's substring check (`tsx:72`)              |
| 16  | `subscribeToPurchaseStatus` callback fetches display names for `reservedBy` UIDs; `renderCard` passes `onToggleReserved` and `reserverName` to the card                                | ✓ VERIFIED | `page.tsx:89` — `if (s.reservedBy) fetchDisplayName(s.reservedBy)`; `page.tsx:328` — `onToggleReserved={handleToggleReserved}`; `page.tsx:334-338` — `reserverName={statusDoc?.reservedBy ? displayNames.get(...) : ...}` |
| 17  | `ActivityLogEntry.formatAction` handles 'reserved' / 'unreserved' with Swedish copy                                                                                                   | ✓ VERIFIED | `ActivityLogEntry.tsx:21-24` — `case 'reserved': return \`${viewerName} reserverade "${itemTitle}"\`;` and `case 'unreserved': return \`${viewerName} avbokade sin reservation på "${itemTitle}"\`;`                    |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact                                              | Expected                                              | Status     | Details                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/types/firestore.ts`                              | reservedBy field + extended action union              | ✓ VERIFIED | Both edits present; types are imported and used by routes, components, page, and subscription helper                   |
| `src/app/api/viewer/reserve-item/route.ts`            | POST handler, 409 on conflict, batch + activity log   | ✓ VERIFIED | Full implementation matches plan; called from `page.tsx:127`                                                           |
| `src/app/api/viewer/mark-purchased/route.ts`          | D-03 auto-clear via `FieldValue.delete()`             | ✓ VERIFIED | Line 53; merged into existing purchased branch without breaking unmark logic                                           |
| `firestore.rules`                                     | reservedBy defense-in-depth                            | ✓ VERIFIED | purchaseStatus write rule extended; child-deny boundary intact (no rule change to read side)                           |
| `src/components/viewer/ViewerWishItemCard.tsx`        | 4-state reserve button + badge + reserving state      | ✓ VERIFIED | Props extended, derivations added, JSX present, `border-dashed` matches UI-SPEC, all 4 states covered including hidden |
| `src/app/viewer/[wishlistId]/page.tsx`                | handleToggleReserved + displayName fetch + props      | ✓ VERIFIED | Function on lines 119-138; reservedBy display name fetch on line 89; props wired in renderCard on lines 328, 334-338   |
| `src/components/viewer/ActivityLogEntry.tsx`          | formatAction cases for 'reserved' / 'unreserved'      | ✓ VERIFIED | Cases on lines 21-24; default fallback retained                                                                        |

### Key Link Verification

| From                                                | To                                              | Via                                                | Status  | Details                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `reserve-item/route.ts`                             | `wishlists/{id}/purchaseStatus/{itemId}`        | adminDb batch.set / batch.update with reservedBy   | ✓ WIRED | Lines 57-67 — set in reserve branch, update + delete in un-reserve branch                                          |
| `reserve-item/route.ts`                             | `wishlists/{id}/activityLog`                    | adminDb batch.set with `action: reserved/unreserved` | ✓ WIRED | Lines 69-79                                                                                                        |
| `viewer/[wishlistId]/page.tsx`                      | `/api/viewer/reserve-item`                      | `handleToggleReserved → fetch POST`                | ✓ WIRED | Lines 119-138                                                                                                       |
| `viewer/[wishlistId]/page.tsx`                      | `ViewerWishItemCard.tsx`                        | `onToggleReserved` + `reserverName` props          | ✓ WIRED | Lines 328, 334-338                                                                                                  |
| `ViewerWishItemCard.tsx`                            | `status.reservedBy`                             | `isReserved/isOwnReservation/isOtherReservation`   | ✓ WIRED | Lines 47-49 derivations consumed throughout JSX (lines 119, 126, 129, 138-150)                                      |
| `subscribeToPurchaseStatus`                         | `displayNames` map                              | `if (s.reservedBy) fetchDisplayName(s.reservedBy)` | ✓ WIRED | `page.tsx:89` — fetched alongside purchasedBy in same forEach                                                       |
| `mark-purchased route` (purchase) → reservation clear | `purchaseStatus.reservedBy` field              | `FieldValue.delete()` inside batch.set merge       | ✓ WIRED | `mark-purchased/route.ts:53` (D-03 auto-clear)                                                                     |

### Data-Flow Trace (Level 4)

| Artifact                                          | Data Variable             | Source                                                                  | Produces Real Data                                                              | Status     |
| ------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| `ViewerWishItemCard` reserve button state         | `status.reservedBy`        | `subscribeToPurchaseStatus` Firestore snapshot listener                  | Yes — onSnapshot streams real Firestore docs (verified `viewer.ts:51-65`)        | ✓ FLOWING  |
| `ViewerWishItemCard` reservation badge name       | `reserverName` prop        | `displayNames` map populated by `fetchDisplayName(s.reservedBy)`         | Yes — `getDoc(users/{uid})` reads username/email                                | ✓ FLOWING  |
| API POST body                                      | `reserve` flag            | `handleToggleReserve → onToggleReserved(item.id, item.title, !isOwn)`   | Yes — caller passes the negated current state                                   | ✓ FLOWING  |
| Activity log entries                               | `entry.action`            | Firestore `activityLog` subcollection written via Admin SDK batch        | Yes — written in same atomic batch as the status mutation                       | ✓ FLOWING  |

### Behavioral Spot-Checks

Skipped — phase produces UI/route code that requires running dev server + Firebase auth + multiple browser sessions to exercise. All such checks routed to human verification (see frontmatter `human_verification`).

| Behavior                                          | Command                  | Result | Status |
| ------------------------------------------------- | ------------------------ | ------ | ------ |
| `npx tsc --noEmit` (source tree)                  | `npx tsc --noEmit`        | Only pre-existing `.next/types/*` stale-artifact errors (test page removed; duplicate `* 2.ts` files); zero source-tree errors and zero new errors introduced by this phase | ✓ PASS |

### Requirements Coverage (D-01 .. D-17)

| Req   | Description                                                                                              | Plan      | Status      | Evidence                                                                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-01  | Reserve and purchase are independent actions                                                             | 09-01     | ✓ SATISFIED | Two separate routes (`reserve-item`, `mark-purchased`); reservation is a separate field; UI shows two distinct buttons                                            |
| D-02  | Single reservation per item; first-come locks                                                            | 09-01     | ✓ SATISFIED | 409 conflict path in `reserve-item/route.ts:42-49`                                                                                                                |
| D-03  | Reserver marking purchased auto-clears reservation                                                       | 09-01     | ✓ SATISFIED | `mark-purchased/route.ts:53` — `reservedBy: FieldValue.delete()`                                                                                                  |
| D-04  | Other-user purchase leaves reservation as-is (acceptable edge case)                                      | 09-01     | ✓ SATISFIED | `mark-purchased` only writes `purchasedBy`; `reservedBy: FieldValue.delete()` only on the purchased=true branch (caller's own reservation cleared)                |
| D-05  | `reservedBy?: string` on PurchaseStatusDoc                                                               | 09-01     | ✓ SATISFIED | `src/types/firestore.ts:39`                                                                                                                                       |
| D-06  | Reservation lives on existing purchaseStatus doc, no new subcollection                                   | 09-01     | ✓ SATISFIED | Field added to existing doc; same path used in route                                                                                                              |
| D-07  | New `POST /api/viewer/reserve-item` mirroring mark-purchased pattern                                     | 09-01     | ✓ SATISFIED | Route file created; auth + access check + batch + activity log all match mark-purchased shape                                                                     |
| D-08  | Child cannot see reservation                                                                             | 09-01     | ✓ SATISFIED | Reservation lives on `purchaseStatus` which child cannot read (rule unchanged); child UID is excluded from viewerUids/parentUids                                  |
| D-09  | Viewers/parents see who reserved                                                                         | 09-02     | ✓ SATISFIED | Display name resolved via `fetchDisplayName(s.reservedBy)`; passed as `reserverName` prop                                                                         |
| D-10  | Non-reserver sees badge + disabled button                                                                | 09-02     | ✓ SATISFIED | Badge JSX (`ViewerWishItemCard:119-123`) + disabled state (`:138-139,129`)                                                                                        |
| D-11  | Reserver sees own reservation as active toggle                                                           | 09-02     | ✓ SATISFIED | Orange filled state (`:140-141,148`) + togglable via `handleToggleReserve`                                                                                        |
| D-12  | Separate button placed above purchase button                                                             | 09-02     | ✓ SATISFIED | Reserve button JSX (lines 126-151) precedes purchase button JSX (line 157)                                                                                        |
| D-13  | Three button states: default / own / other                                                               | 09-02     | ✓ SATISFIED | Three className branches in ternary (`:138-142`); three label branches (`:145-149`); three aria-label branches (`:130-136`)                                       |
| D-14  | Reserve button hidden when purchased                                                                     | 09-02     | ✓ SATISFIED | `{!isPurchased && (` wrapper at line 126                                                                                                                          |
| D-15  | Un-reserving uses same toggle button                                                                     | 09-02     | ✓ SATISFIED | `handleToggleReserve` calls `onToggleReserved(item.id, item.title, !isOwnReservation)` — symmetric                                                                |
| D-16  | Reserve/unreserve logged to activity log                                                                 | 09-01,02  | ✓ SATISFIED | Backend writes activity log entries in batch; frontend `ActivityLogEntry` formats both action types in Swedish                                                    |
| D-17  | `ActivityLogDoc.action` extended with 'reserved' \| 'unreserved'                                         | 09-01     | ✓ SATISFIED | `src/types/firestore.ts:48`                                                                                                                                       |

**Coverage:** 17/17 requirements satisfied in code. No orphaned requirements. All requirements declared in plan frontmatter are implemented.

### Anti-Patterns Found

None. Anti-pattern grep on the seven modified files surfaced no TODO/FIXME/placeholder comments, no empty handlers (`() => {}`), no static returns ignoring queries, no console.log-only implementations, and no hollow props.

| File                                          | Line | Pattern | Severity | Impact |
| --------------------------------------------- | ---- | ------- | -------- | ------ |
| _none_                                        | —    | —       | —        | —      |

Notable observation (not an anti-pattern, but worth flagging): the 409 conflict transport via `Error.message` substring check (`msg.includes('409')`) is a pragmatic shortcut documented in the plan. It works correctly but would be cleaner as a structured error class if reused elsewhere — acceptable for a single-callsite feature.

### Human Verification Required

See frontmatter `human_verification` for the seven UAT items. Summarised:

1. **Two-viewer race** — open as Viewer A and Viewer B in two browsers; reserve as A; verify B sees disabled "Reserverad av {A}" button + inline italic badge.
2. **409 conflict copy** — force a conflict and verify the inline error reads "Någon annan har redan reserverat detta."
3. **D-03 auto-clear** — reserve then purchase as same user; reserve button must disappear and reservedBy field must be removed.
4. **Activity log copy** — verify Swedish entries: "{namn} reserverade "{itemTitle}"" and "{namn} avbokade sin reservation på "{itemTitle}"".
5. **Default-state dashed border visual** — confirm dashed border renders correctly in browser (Tailwind class is present, but visual integrity needs eyes).
6. **Child cannot see reservation** — log in as the child and verify no reservation UI surfaces appear.
7. **Firestore rules deployed** — run `firebase deploy --only firestore:rules` so the defense-in-depth `reservedBy` clause is active in production. Until deployed, only the Admin SDK route protection holds (which is sufficient for the contract, but defense-in-depth is the explicit Plan-01 deliverable for production).

### Gaps Summary

No code gaps. All 17 D-requirements are implemented and TypeScript compiles clean against the source tree (only pre-existing `.next/types/*` stale-artifact errors from a removed test page and duplicate `* 2.ts` files — known, out of scope, documented in both plan SUMMARYs).

The end-to-end story works in code:

> Viewer clicks "Jag tänker köpa detta" → `handleToggleReserve` → `onToggleReserved` → `handleToggleReserved` (page.tsx) → `POST /api/viewer/reserve-item` → adminAuth.verifyIdToken → access check → 409 conflict pre-check → batch.set(purchaseStatus, { reservedBy: uid }) + batch.set(activityLog, { action: 'reserved' }) → batch.commit() → Firestore onSnapshot fires → `subscribeToPurchaseStatus` callback → `setStatuses` + `fetchDisplayName(s.reservedBy)` → re-render `ViewerWishItemCard` with `status.reservedBy` and `reserverName` → button switches to orange/disabled/badge as appropriate.

The mirrored un-reserve flow uses `FieldValue.delete()`. The auto-clear path on purchase (D-03) is wired through the same `mark-purchased` route's purchased branch. The Firestore rule update protects against direct client writes (defense-in-depth). The child read-deny boundary is unchanged.

### Overall Verdict

**PHASE COMPLETE — pending UAT.** All 17 D-requirements are satisfied in code, TypeScript compiles clean, no anti-patterns or stubs detected, end-to-end data flow is wired without hollow links. The seven items in `human_verification` are standard UAT for a multi-viewer real-time feature and a Firestore rules deployment step — they are confirmation work, not gap closure.

---

_Verified: 2026-04-24T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
