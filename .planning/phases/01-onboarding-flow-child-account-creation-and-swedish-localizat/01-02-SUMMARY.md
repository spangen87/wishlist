---
phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
plan: 02
subsystem: onboarding
tags: [react, next.js, firebase, typescript, onboarding, wizard, swedish]

requires:
  - phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat
    plan: 01
    provides: register-child API (extended), update-title API, invite/create-for-child API

provides:
  - ChildAccountForm component (reusable, used by /add-child in plan 03)
  - /onboarding page — 3-step wizard for parent to create child account and share wishlist link

affects:
  - phase-03-child-wishlist (reuses ChildAccountForm)
  - phase-04-viewer-flow (wishlist created in batch here)

tech-stack:
  added: []
  patterns:
    - "3-step client-side wizard with useState<WizardState> — no router transitions between steps"
    - "Auth-gate useEffect: !user → /login, role==='child' → /wishlist"
    - "wishlistId === childUid (deterministic pattern — derived from register-child response)"
    - "Step 3 uses inline InvitePanel calling /api/invite/create-for-child instead of ShareLinkPanel (D-02 override)"

key-files:
  created:
    - src/components/onboarding/ChildAccountForm.tsx
    - src/app/onboarding/page.tsx
  modified: []

key-decisions:
  - "D-02 override: Step 3 uses custom inline Step3 component calling /api/invite/create-for-child instead of ShareLinkPanel. ShareLinkPanel calls /api/invite/current which enforces childUid === decoded.uid, blocking the viewer/parent session. User approved deviation."
  - "D-03: Auth-gate redirects child role → /wishlist and unauthenticated → /login before rendering wizard"
  - "wishlistId === uid: register-child returns {uid}, wizard passes uid as wishlistId to Steps 2 and 3 — no separate fetch needed"

patterns-established:
  - "Pattern: ChildAccountForm — reusable 'use client' form component, import from '@/components/onboarding/ChildAccountForm'"
  - "Pattern: Auth-gate useEffect — copy from dashboard/page.tsx, guards all viewer-only pages"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06]

duration: ~15min
completed: "2026-04-12"
---

# Phase 01 Plan 02: ChildAccountForm + Onboarding Wizard

**3-step onboarding wizard at /onboarding: parent creates a child account, names the wishlist, and copies the share link in one guided flow. ChildAccountForm component is reusable for /add-child in plan 03.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-12
- **Tasks:** 2 (Task 1 was already complete from plan 01-01)
- **Files committed:** 2

## Accomplishments

- Created `src/components/onboarding/ChildAccountForm.tsx` — reusable 'use client' form with Visningsnamn, Användarnamn, Lösenord, Ålder fields. Swedish error messages, 409 conflict handling, calls POST /api/auth/register-child with displayName and age.
- Created `src/app/onboarding/page.tsx` — 3-step wizard with StepDots progress indicator (3 × 8px dots, accent fill for active). Auth-gate redirects unauthenticated → /login and child role → /wishlist. Step 2 names wishlist via /api/wishlist/update-title. Step 3 creates share link via /api/invite/create-for-child with copy-to-clipboard button. Final CTA navigates to /viewer/{wishlistId}.

## Task Commits

1. **Task 2: Build ChildAccountForm and onboarding wizard** — `9b0bdfb` (feat)

(Task 1 — register-child API extension — was committed as part of plan 01-01 wave in commit `1269615`)

## Files Created/Modified

- `src/components/onboarding/ChildAccountForm.tsx` — reusable child account creation form, exports `ChildAccountForm`, uses established input/button/error CSS classes from UI-SPEC
- `src/app/onboarding/page.tsx` — 3-step wizard page with StepDots, auth-gate, Steps 1–3 wired to API routes

## Decisions Made

### D-02 override: Custom Step3 instead of ShareLinkPanel
ShareLinkPanel calls /api/invite/current which enforces `childUid === decoded.uid`. During onboarding the logged-in user is the parent/viewer — their UID does not match childUid, causing a 403. Plan 01 created /api/invite/create-for-child which accepts viewer idToken and checks `viewerUids.includes(decoded.uid)`. The inline Step3 component calls this route directly. User approved the deviation.

### wishlistId === uid deterministic pattern
register-child returns `{ uid }`. The wizard passes uid directly as wishlistId to Steps 2 and 3. No additional Firestore fetch is needed between steps.

### Auth-gate placement
useEffect auth-gate mirrors dashboard/page.tsx exactly: `if (!loading && !user) router.push('/login')` and `if (!loading && user && role === 'child') router.push('/wishlist')`.

## Deviations from Plan

- D-02 override: Step 3 uses inline Step3 instead of ShareLinkPanel — approved and documented in plan's decision_overrides block.

## Issues Encountered

None.

## User Setup Required

None for this plan. /onboarding is accessible immediately once the parent is logged in as viewer role.

## Next Phase Readiness

- `ChildAccountForm` available for reuse in /add-child page (plan 03)
- /onboarding page live and fully wired
- Wishlist doc created server-side in register-child batch — Step 2 (update-title) will always find an existing document

## Known Stubs

None.

## Threat Flags

All threats from plan's threat model addressed:
- T-02-01 (age tampering): server-side `ageNum < 1 || ageNum > 18` validation in register-child — MITIGATED
- T-02-02 (displayName empty): server returns 400 if displayName missing — MITIGATED
- T-02-03 (displayName XSS): React renders as text node, no dangerouslySetInnerHTML — ACCEPTED
- T-02-04 (idToken spoofing): API routes call adminAuth.verifyIdToken before writes — MITIGATED
- T-02-05 (child role on /onboarding): auth-gate redirects to /wishlist — MITIGATED
- T-02-06 (unauthenticated /onboarding): auth-gate redirects to /login — MITIGATED
- T-02-07 (age client bypass): server validation is primary control, HTML min/max is defense-in-depth — MITIGATED

## Self-Check

Files verified present:
- src/components/onboarding/ChildAccountForm.tsx: FOUND
- src/app/onboarding/page.tsx: FOUND

Content verified:
- ChildAccountForm: exports ChildAccountForm, all 4 fields, Swedish error messages, border-[#E5D5CC] inputs, text-[#DC2626] error, 409 handling
- onboarding/page.tsx: StepDots with bg-[#F9A87A] active, aria-label "Steg {step} av 3", auth-gate, /api/invite/create-for-child in Step3, /api/wishlist/update-title in Step2, "Gå till önskelistan" button → /viewer/{wishlistId}

TypeScript: `npx tsc --noEmit` exits 0

## Self-Check: PASSED

---
*Phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat*
*Completed: 2026-04-12*
