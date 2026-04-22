---
phase: 08-security-auth-and-account-fixes
verified: 2026-04-22T18:30:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app in a browser with Firebase emulators running. Log in as a parent, navigate to /add-child or /onboarding, create a child account. Verify the child wishlist appears on the parent dashboard immediately after creation."
    expected: "The child appears in the parent's dashboard list. The wishlist document in Firestore has parentUids: [parentUid]."
    why_human: "BUG-01 fix depends on getIdToken(true) succeeding and the token being passed in the request body to register-child, which writes parentUids. The token fetch and network path cannot be exercised without a live browser + Firebase Auth session."
  - test: "Using a Firestore client (emulator UI or direct SDK call), attempt to create a wishlist document as authenticated user A with childUid set to authenticated user B's UID. Verify the write is rejected."
    expected: "PERMISSION_DENIED — Firestore rejects the create because auth.uid != request.resource.data.childUid."
    why_human: "Firestore rules enforcement requires a running emulator with the test rules deployed. npm run test:rules was skipped during plan execution because the emulator was not running."
  - test: "Navigate to /test in the deployed or emulator-connected app."
    expected: "404 — the route no longer exists."
    why_human: "File deletion from src/app/test/page.tsx removes the route, but this needs a browser or curl to confirm the Next.js route is actually gone from the build."
---

# Phase 8: Security, Auth & Account Fixes Verification Report

**Phase Goal:** Eliminate the three highest-severity live security vulnerabilities and fix the top correctness/performance bugs identified in the codebase audit.
**Verified:** 2026-04-22T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All 17 plan must-haves were verified against the actual codebase.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Firestore rejects wishlist create unless auth.uid == childUid and viewerUids == [] and parentUids == [] | VERIFIED | `firestore.rules` lines 40–43 contain all three constraints |
| 2 | Firestore rejects purchaseStatus write if purchasedBy is set to a uid other than auth.uid | VERIFIED | `firestore.rules` lines 58–60: split read/write, write requires `purchasedBy == auth.uid \|\| purchasedBy == null` |
| 3 | All HTTP responses include X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Content-Security-Policy headers | VERIFIED | `next.config.ts` exports `async headers()` with all four headers applied to `/:path*` |
| 4 | getOrCreateWishlist includes parentUids: [] so client-created docs satisfy the tightened SEC-01 rule | VERIFIED | `src/lib/firebase/wishlist.ts` line 18: `parentUids: []` in setDoc payload |
| 5 | POST /api/wishlist/add-item returns 400 when productUrl starts with javascript: | VERIFIED | `src/app/api/wishlist/add-item/route.ts` lines 71–80: SAFE_URL_PREFIXES check returns 400 before Firestore write; test passes |
| 6 | POST /api/wishlist/add-item returns 400 when imageUrl starts with data: | VERIFIED | Same SAFE_URL_PREFIXES block handles imageUrl; test passes |
| 7 | POST /api/wishlist/add-item accepts productUrl starting with https:// | VERIFIED | SAFE_URL_PREFIXES = ['https://', 'http://']; test passes |
| 8 | addWishItem() throws when productUrl does not start with https:// or http:// | VERIFIED | `src/lib/firebase/wishlist.ts` lines 49–52: throws before addDoc |
| 9 | updateWishItem() throws when imageUrl does not start with https:// or http:// | VERIFIED | `src/lib/firebase/wishlist.ts` lines 70–73: throws before updateDoc |
| 10 | WishItemCard does not render an anchor when productUrl starts with javascript: | VERIFIED | `src/components/wishlist/WishItemCard.tsx` line 247: `isSafeUrl(item.productUrl)` guards the anchor |
| 11 | ViewerWishItemCard does not render an anchor when productUrl starts with javascript: | VERIFIED | `src/components/viewer/ViewerWishItemCard.tsx` line 73: same isSafeUrl guard |
| 12 | If getIdToken(true) throws during child account creation, an error message is shown and the form does not submit | VERIFIED | `src/components/onboarding/ChildAccountForm.tsx` lines 41–48: try/catch with setError + setLoading(false) + return |
| 13 | The child account created via ChildAccountForm has parentUids: [callerUid] in Firestore and appears on the parent dashboard | VERIFIED (automated) / NEEDS HUMAN (live browser) | Token is passed as viewerIdToken in request body; register-child route writes parentUids from decoded token. Live flow requires human verification. |
| 14 | Dashboard Firestore stats listeners are cleaned up on component unmount | VERIFIED | `src/app/dashboard/page.tsx` lines 29, 80–82, 114–115: statsUnsubsRef declared, Map updated on each subscription, forEach cleanup in return block |
| 15 | Items appended via POST /api/wishlist/add-item use a valid fractional-indexing key (not string + '\|z') | VERIFIED | `src/app/api/wishlist/add-item/route.ts` line 60: `generateKeyBetween(itemsSnap.docs[0].data().position, null)` — no `\|z` present |
| 16 | loadMore() in activity page uses getDocs (one-shot read) instead of onSnapshot | VERIFIED | `src/app/viewer/[wishlistId]/activity/page.tsx` line 63: calls `getActivityLogPage` which uses `getDocs`; zero `onSnapshot` calls in the file |
| 17 | src/app/test/page.tsx does not exist | VERIFIED | `test ! -f src/app/test/page.tsx` succeeds |

**Score:** 17/17 must-haves verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | Tightened create + purchasedBy constraint | VERIFIED | Lines 40–43 (create) and 58–60 (purchaseStatus write) |
| `next.config.ts` | Security headers on all routes | VERIFIED | Exports nextConfig with async headers() |
| `src/lib/firebase/wishlist.ts` | getOrCreateWishlist with parentUids: []; SAFE_URL_PREFIXES in addWishItem + updateWishItem | VERIFIED | Lines 18, 49–53, 70–74 |
| `src/app/api/wishlist/add-item/route.ts` | SAFE_URL_PREFIXES validation + generateKeyBetween | VERIFIED | Lines 5 (import), 60, 71–84 |
| `src/components/wishlist/WishItemCard.tsx` | isSafeUrl guard; onEditStart removed | VERIFIED | isSafeUrl at line 8; grep -c onEditStart returns 0 |
| `src/components/viewer/ViewerWishItemCard.tsx` | isSafeUrl guard | VERIFIED | isSafeUrl at line 8, used at line 73 |
| `tests/api/wishlist/add-item.test.ts` | 4 URL validation tests passing | VERIFIED | 4 tests pass (confirmed by jest run) |
| `src/components/onboarding/ChildAccountForm.tsx` | getIdToken(true) with try/catch | VERIFIED | Lines 41–48 |
| `src/app/dashboard/page.tsx` | statsUnsubsRef Map with cleanup | VERIFIED | Lines 29, 80–82, 114–115 |
| `src/lib/firebase/viewer.ts` | getActivityLogPage exported | VERIFIED | Line 98 |
| `src/app/viewer/[wishlistId]/activity/page.tsx` | loadMore uses getActivityLogPage | VERIFIED | Lines 7, 63 |
| `src/lib/firebase/client.ts` | emulatorConnected boolean guard | VERIFIED | Lines 24, 28–29; _settingsFrozen grep returns 0 |
| `src/lib/firebase/wishlist.ts` | updateWishlistTitle removed | VERIFIED | grep -c returns 0 |
| `tests/api/auth/register-child.test.ts` | 'username, password, and displayName required' (3 times) | VERIFIED | grep -c returns 3; 0 old string occurrences |
| `src/app/offline/` | Directory does not exist | VERIFIED | `test ! -d src/app/offline` succeeds |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| firestore.rules wishlist allow create | src/lib/firebase/wishlist.ts getOrCreateWishlist | client SDK setDoc — must include parentUids: [] | WIRED | firestore.rules lines 40–43 require parentUids == []; wishlist.ts line 18 includes parentUids: [] |
| next.config.ts headers() | all HTTP responses | Next.js server header injection | WIRED | async headers() with source: '/:path*' applies to all routes |
| add-item/route.ts SAFE_URL_PREFIXES check | Firestore items write | adminDb write only runs if URL passes | WIRED | SAFE_URL_PREFIXES block returns 400 before any adminDb.collection write |
| wishlist.ts addWishItem SAFE_URL_PREFIXES check | Firestore addDoc call | throw before addDoc | WIRED | Throws on unsafe URL before await addDoc |
| WishItemCard isSafeUrl | anchor href={item.productUrl} | conditional render | WIRED | `{item.productUrl && isSafeUrl(item.productUrl) && (<a ...>)}` |
| ChildAccountForm getIdToken(true) | POST /api/auth/register-child viewerIdToken | token in request body | WIRED | viewerIdToken spread into JSON body (lines 51–55) |
| dashboard statsUnsubsRef forEach | subscribeToStats cleanup | Map cleanup on useEffect return | WIRED | forEach(unsub => unsub()) in return block at lines 114–115 |
| add-item route generateKeyBetween | Firestore items.position | route handler write | WIRED | Line 60 writes generateKeyBetween result to resolvedPosition |
| viewer.ts getActivityLogPage | activity page loadMore | imported and called | WIRED | Imported at line 7; called at line 63 in async loadMore |
| client.ts emulatorConnected | connectAuthEmulator + connectFirestoreEmulator | module-level boolean guard | WIRED | if (!emulatorConnected) sets flag then calls both connect functions |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/app/dashboard/page.tsx` | statsUnsubsRef (Map) | subscribeToStats return value stored on Map.set | Yes — listener cleanup functions | FLOWING |
| `src/app/viewer/[wishlistId]/activity/page.tsx` | entries (loadMore) | getActivityLogPage → getDocs → snap.docs | Yes — Firestore document reads | FLOWING |
| `src/components/wishlist/WishItemCard.tsx` | item.productUrl (anchor) | isSafeUrl guard on prop passed from parent | Real data gated by scheme check | FLOWING |
| `src/components/viewer/ViewerWishItemCard.tsx` | item.productUrl (anchor) | isSafeUrl guard on prop passed from parent | Real data gated by scheme check | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Jest suite (17 tests) | npx jest --no-coverage --testPathIgnorePatterns="firestore.rules" | 17 passed, 3 suites | PASS |
| add-item URL validation tests | npx jest tests/api/wishlist/add-item.test.ts --no-coverage | 4 passed | PASS |
| register-child tests | npx jest tests/api/auth/register-child.test.ts --no-coverage | 8 passed | PASS |
| Firestore rules wishlist create constraint | grep on firestore.rules | All 3 constraints present | PASS |
| Security headers in next.config.ts | grep on next.config.ts | All 4 headers present | PASS |
| _settingsFrozen removed | grep -c in client.ts | 0 | PASS |
| '|z' position string gone | grep in add-item/route.ts | No match | PASS |
| Firestore rules test suite | npm run test:rules (requires emulator) | SKIPPED — emulator not running | SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 08-01 | Overly permissive wishlist create rule | SATISFIED | firestore.rules lines 40–43: auth.uid == childUid && viewerUids == [] && parentUids == [] |
| SEC-02 | 08-02 | Stored XSS via javascript:/data: URIs | SATISFIED | SAFE_URL_PREFIXES in route + wishlist.ts; isSafeUrl in both card components |
| SEC-03 | 08-01 | No security headers | SATISFIED | next.config.ts async headers() with X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP |
| PERF-01 | 08-03 | Dashboard unbounded Firestore listener leak | SATISFIED | statsUnsubsRef Map + forEach cleanup on unmount |
| PERF-03 | 08-03 | Position string corruption ('|z' fallback) | SATISFIED | generateKeyBetween(lastPos, null) replaces string concatenation |
| DEBT-01 | 08-04 | Test/debug page in production | SATISFIED | src/app/test/page.tsx deleted |
| DEBT-02 | 08-04 | Dead updateWishlistTitle function | SATISFIED | grep -c returns 0 in wishlist.ts |
| DEBT-04 | 08-04 | _settingsFrozen undocumented SDK internal | SATISFIED | Replaced with module-level emulatorConnected boolean |
| DEBT-07 | 08-01 | getOrCreateWishlist missing parentUids | SATISFIED | parentUids: [] in setDoc payload |
| BUG-01 | 08-03 | Silent token failure creates orphaned child accounts | SATISFIED (automated) / NEEDS HUMAN (live flow) | getIdToken(true) in try/catch; token passed to register-child |

Note: PERF-04 (activity pagination getDocs) was addressed in plan 08-03 as a bonus fix (mentioned in objective) but is not listed in the plan's requirements frontmatter. It was verified as complete (getActivityLogPage using getDocs; loadMore is async and calls it).

---

### Anti-Patterns Found

No blocking anti-patterns detected across the 14 modified files. No TODO/FIXME/placeholder patterns in the changed code paths. No empty return stubs. No hardcoded empty arrays passed as rendering props.

---

### Human Verification Required

#### 1. Child Account Visibility (BUG-01 Live Flow)

**Test:** Log in as a parent user. Navigate to /add-child or /onboarding. Create a child account with a valid username, password, display name and age. Return to the dashboard.
**Expected:** The new child wishlist appears on the parent dashboard immediately. Inspecting the Firestore document `wishlists/{childUid}` shows `parentUids: [parentUid]`.
**Why human:** The full path (browser Firebase Auth session → getIdToken(true) → register-child route → Firestore write) cannot be exercised without a running browser + Firebase Auth + emulator or production credentials.

#### 2. Firestore Rules Enforcement (SEC-01 + purchaseStatus)

**Test:** Using the Firebase emulator UI or an SDK script, authenticate as user A and attempt to create a `wishlists/{randomId}` document with `childUid: "userB_uid"` and `viewerUids: ["userA_uid"]`.
**Expected:** Write is rejected with PERMISSION_DENIED.
**Also test:** As a viewer, write to `purchaseStatus/{itemId}` with `purchasedBy: "some_other_uid"` (not your own UID).
**Expected:** Write is rejected.
**Why human:** `npm run test:rules` requires a running Firebase emulator. The emulator was not available during plan execution. These are the highest-severity security fixes in the phase — they must be smoke-tested.

#### 3. /test Route Returns 404

**Test:** With the development server or a production build running, navigate to `/test` in the browser or run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/test`.
**Expected:** 404 response.
**Why human:** Next.js route existence depends on the file being absent from the build. Cannot confirm the route is gone without a running server.

---

### Gaps Summary

No automated gaps. All 17 must-haves are verified in the codebase. The three human verification items above are behavioral smoke tests that require a running browser or emulator — they are standard post-deployment checks, not code deficiencies.

The firestore.rules test suite (`npm run test:rules`) should be run with the emulator to fully confirm SEC-01 and purchaseStatus write constraints. This is the highest-priority human check.

---

_Verified: 2026-04-22T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
