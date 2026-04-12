---
status: complete
phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-04-12T11:00:00Z
updated: 2026-04-12T11:00:00Z
---

## Current Test

All tests complete.

## Tests

### 1. /onboarding redirects unauthenticated users
expected: Navigate to /onboarding while logged out. You should be immediately redirected to /login — the page never renders the wizard.
result: pass

### 2. Onboarding wizard — Step 1 form renders correctly
expected: Log in as a viewer/parent. Go to /onboarding. You should see Step 1 with 4 Swedish-labeled fields: Visningsnamn, Användarnamn, Lösenord, Ålder. Three dots appear as a progress indicator at the top, with the first dot filled (accent orange).
result: pass

### 3. Onboarding wizard — Step 1 creates child account
expected: Fill in the 4 fields with valid data and submit. Step 1 should advance to Step 2 (wishlist naming). No redirect — the wizard stays on the same page. The second dot becomes active.
result: pass

### 4. Onboarding wizard — Step 2 names the wishlist
expected: In Step 2, enter a wishlist name (e.g. "Elsas önskelista") and submit. The step should advance to Step 3. The third dot becomes active.
result: pass

### 5. Onboarding wizard — Step 3 shows share link with copy button
expected: In Step 3, you should see a share/invite link and a copy-to-clipboard button. Clicking the button copies the link. A "Gå till önskelistan" button is visible.
result: pass

### 6. /register page is fully Swedish with correct design tokens
expected: Go to /register. The heading should say "Skapa konto". Labels should be "E-post" and "Lösenord". The submit button text and error messages should be in Swedish. There should be no blue buttons — the primary button uses the app's accent orange/brand color. Page background is cream (#FFF9F5).
result: pass

### 7. Dashboard shows "Lägg till barn" button
expected: Log in as a viewer/parent and go to /dashboard. Below the wishlists grid there should be a ghost-style "Lägg till barn" button (border only, no fill). Clicking it navigates to /add-child.
result: pass

### 8. /add-child page renders ChildAccountForm
expected: Navigate to /add-child as a logged-in viewer. You should see the same 4-field form as in onboarding Step 1 (Visningsnamn, Användarnamn, Lösenord, Ålder). A "Tillbaka till instrumentpanelen" back-link should be visible. Submitting successfully redirects to /dashboard.
result: pass

### 9. /add-child redirects unauthenticated users
expected: Navigate to /add-child while logged out. You should be redirected to /login — the form never renders.
result: pass

## Summary

total: 9
passed: 9
issues: 3
pending: 0
skipped: 0

## Gaps

### GAP-01: Dashboard does not show new child wishlist until hard reload
severity: minor
description: After completing the onboarding wizard and navigating to /dashboard, the newly created child's wishlist does not appear. A hard reload makes it appear. Root cause: Firestore's onSnapshot returns a cached empty result first, setting dataLoading=false and showing "Inga önskelistor" before the confirmed network result arrives.
fix: (1) fetchChildName now uses a useRef Set instead of childNames Map dep — prevents subscription teardown on every name fetch. (2) subscribeToViewerWishlists now passes fromCache flag via includeMetadataChanges:true. (3) Dashboard keeps dataLoading=true while the snapshot is fromCache and empty, waiting for the network confirmation before showing the empty state.
status: fixed-pending-verification

### GAP-02: Parent cannot access share link or administer child wishlist after wizard
severity: major
description: Once the onboarding wizard is complete, there is no way for the parent to retrieve the share/invite link again, edit the wishlist name, or add items to the child's wishlist on their behalf. The wizard is the only place where the share link appears.
status: open — requires new phase

### GAP-03: No role distinction between parent and anhörig (family member)
severity: major
description: The app currently has only "viewer" and "child" roles. The user expects two distinct viewer types: a parent (creator, can manage the child's wishlist and share link) and an anhörig/family member (read-only, can mark items as purchased). These have meaningfully different permissions and UI surfaces.
status: open — requires new phase
