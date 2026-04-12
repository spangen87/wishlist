---
phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
plan: 03
subsystem: onboarding-ui
tags: [react, next.js, typescript, onboarding, swedish, localization, dashboard]

dependency_graph:
  requires:
    - phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
      plan: 02
      provides: ChildAccountForm component
  provides:
    - /add-child page (viewer-only, reuses ChildAccountForm)
    - Dashboard Lagg-till-barn button pointing to /add-child
    - Dashboard displayName resolution (data.displayName ?? data.username ?? data.email ?? uid)
    - Fully Swedish /register page with correct design tokens
  affects:
    - phase-03-child-wishlist (dashboard UX improvement)
    - phase-04-viewer-flow (viewer can add more children post-onboarding)

tech-stack:
  added: []
  patterns:
    - "Auth-gate useEffect pattern (viewer-only): !user → /login, role==='child' → /wishlist"
    - "ChildAccountForm reuse: import from '@/components/onboarding/ChildAccountForm', onSuccess callback"
    - "displayName fallback chain: data.displayName ?? data.username ?? data.email ?? uid"
    - "Design tokens: bg-[var(--color-accent)], border-[#E5D5CC], text-[#DC2626], bg-[#FFF9F5]"

key-files:
  created:
    - src/app/add-child/page.tsx
  modified:
    - src/app/dashboard/page.tsx
    - src/app/register/page.tsx

decisions:
  - "ChildAccountForm onSuccess receives uid but /add-child ignores it — redirects to /dashboard regardless (no step 2/3 needed post-onboarding)"
  - "Lagg till barn button uses ghost style (border-[#E5D5CC]) not primary CTA — secondary action, viewer already has wishlists"

metrics:
  duration: ~10min
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 3
---

# Phase 01 Plan 03: /add-child Page, Dashboard Update, and /register Localization

**Dedicated /add-child page reusing ChildAccountForm, dashboard Lagg-till-barn button with displayName resolution, and full Swedish localization of /register with corrected design tokens.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-12
- **Tasks:** 2
- **Files committed:** 3

## Accomplishments

- Created `src/app/add-child/page.tsx`: viewer-only page with auth-gate (unauthenticated→/login, child→/wishlist), renders ChildAccountForm, onSuccess→router.push('/dashboard'), back-link "Tillbaka till instrumentpanelen"
- Updated `src/app/dashboard/page.tsx`: fetchChildName now resolves `data.displayName ?? data.username ?? data.email ?? uid`; added "Lagg till barn" ghost button below wishlists grid pointing to /add-child
- Updated `src/app/register/page.tsx`: full Swedish — heading "Skapa konto", labels "E-post"/"Losenord", all error messages in Swedish, footer "Har du redan ett konto? Logga in"; design tokens corrected — button uses `var(--color-accent)`, inputs use `border-[#E5D5CC]`, error uses `text-[#DC2626]`, page bg uses `bg-[#FFF9F5]`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /add-child page and Swedish-localize /register | b559278 | src/app/add-child/page.tsx, src/app/register/page.tsx |
| 2 | Dashboard — displayName resolution and Lagg till barn button | 7fd4976 | src/app/dashboard/page.tsx |

## Decisions Made

### ChildAccountForm onSuccess ignores uid on /add-child
The /add-child flow is post-onboarding: parent already has a wishlist. After creating a new child, the parent is sent directly to /dashboard to see all their wishlists. No Step 2 (name wishlist) or Step 3 (share link) needed — those are part of the onboarding wizard (/onboarding). The uid/wishlistId is used by the API but not needed by the page callback.

### Ghost button style for Lagg till barn
The primary CTA on the dashboard is navigating to individual wishlists. "Lagg till barn" is a secondary action — using a ghost button (border only, no fill) matches the UI hierarchy and avoids visual competition with the WishlistDashboardCard grid.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three files are fully wired:
- /add-child: ChildAccountForm calls /api/auth/register-child, result redirects to /dashboard
- dashboard: displayName fetched from Firestore users/{uid}, fallback chain complete
- register: all form logic unchanged, text and tokens corrected

## Threat Flags

No new security surface introduced. Changes are:
- /add-child: viewer-only page, auth-gate mirrors /onboarding pattern (T-03-01, T-03-02 mitigated by useEffect redirects)
- dashboard: displayName rendered as React text node — XSS not possible (T-03-03 accepted)
- register: text/style changes only, Firebase Auth logic unchanged (T-03-04 accepted)

## Self-Check

Files verified present:
- src/app/add-child/page.tsx: FOUND
- src/app/dashboard/page.tsx: FOUND (modified)
- src/app/register/page.tsx: FOUND (modified)

Content verified:
- add-child/page.tsx: imports ChildAccountForm, auth-gate useEffect, onSuccess→/dashboard, "Tillbaka till instrumentpanelen" back-link
- dashboard/page.tsx: `data.displayName ?? data.username ?? data.email ?? uid`, "Lagg till barn" button, `/add-child` onClick
- register/page.tsx: "Skapa konto" (heading + button), "E-post", "Losenord", "Har du redan ett konto?", "Logga in", Swedish error messages, color-accent button, E5D5CC inputs, DC2626 error, FFF9F5 bg
- bg-blue-600 count in register/page.tsx: 0
- text-blue-600 count in register/page.tsx: 0

TypeScript: `npx tsc --noEmit` exits 0

Commits:
- b559278: feat(01-03): add /add-child page and Swedish-localize /register page — VERIFIED
- 7fd4976: feat(01-03): update dashboard — displayName resolution and Lagg till barn button — VERIFIED

## Self-Check: PASSED

---
*Phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat*
*Completed: 2026-04-12*
