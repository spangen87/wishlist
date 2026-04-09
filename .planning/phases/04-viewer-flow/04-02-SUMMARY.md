---
phase: 04-viewer-flow
plan: 02
subsystem: invite-flow
tags: [invite, auth, viewer, api-routes, redemption]
dependency_graph:
  requires: [04-01]
  provides: [invite-redeem-api, invite-join-page]
  affects: [04-03, 04-04, 04-05]
tech_stack:
  added: []
  patterns: [Admin SDK token verification, FieldValue.arrayUnion, getIdToken force-refresh, use(params) Next.js 16]
key_files:
  created:
    - src/app/api/invite/redeem/route.ts
    - src/app/invite/[token]/page.tsx
  modified: []
decisions:
  - "Inline auth on invite page (not redirect to /login) for welcoming UX — user stays in join flow context"
  - "redeemToken called immediately when user is logged in (useEffect on user dependency) — no separate join-confirm button step needed"
  - "alreadyViewer check skips token refresh since claim is already set — avoids redundant getIdToken(true) call"
metrics:
  duration: ~10min
  completed: 2026-04-09
  tasks: 2
  files: 2
requirements: [SHARE-02, SHARE-03]
---

# Phase 04 Plan 02: Invite Join Page and Redemption API Summary

One-liner: Invite redemption API route with Admin SDK-only token validation and viewer claim assignment, plus a welcoming Swedish-language join page with inline login/register and automatic redirect to the viewer wishlist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement POST /api/invite/redeem route | c7a845f | src/app/api/invite/redeem/route.ts |
| 2 | Build /invite/[token] join page | 03b41d9 | src/app/invite/[token]/page.tsx |

## What Was Built

### Redemption API (src/app/api/invite/redeem/route.ts)
- `POST /api/invite/redeem` accepts `{ idToken, token }` in request body
- Verifies caller identity via `adminAuth.verifyIdToken(idToken)` — forged tokens rejected with 401 (T-04-08)
- Reads invite doc via Admin SDK only — client never touches the `invites` collection (T-04-11)
- Returns 410 if `invite.active === false` — expired/revoked tokens blocked (T-04-09, SHARE-03)
- Adds `uid` to `wishlists/{wishlistId}.viewerUids` atomically via `FieldValue.arrayUnion`
- Sets `role: 'viewer'` custom claim via `adminAuth.setCustomUserClaims`
- Upserts user profile doc with `{ role: 'viewer' }` via merge set
- Idempotent: already-viewers get `{ ok: true, wishlistId, alreadyViewer: true }` without duplicate writes
- Returns `{ ok: true, wishlistId, alreadyViewer }` on success

### Invite Join Page (src/app/invite/[token]/page.tsx)
- Client component using `use(params)` for Next.js 16 dynamic params pattern
- Four page states: `loading`, `logged-out`, `joining`, `invalid`, `error`
- When logged in: auto-calls `redeemToken()` immediately via `useEffect` on `user` dependency
- When logged out: shows welcoming Swedish UI with inline auth card
- Inline `InlineAuthForm` supports `login` and `register` modes with toggle
- New registrations call `/api/auth/set-viewer-claim` then force-refresh token before proceeding
- After successful redemption: calls `getIdToken(true)` to refresh token with new viewer claim (T-04-12), then redirects to `/viewer/[wishlistId]`
- Invalid/expired tokens show "Länken är inte längre giltig" error state with Swedish instructions
- All error states use `role="alert"` for accessibility

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files are fully wired to real API routes and Firebase services.

## Threat Flags

No new security surface introduced beyond what is modeled in the plan's threat register. All six STRIDE threats (T-04-08 through T-04-13) are mitigated as designed.

## Self-Check: PASSED

Files created/exist:
- src/app/api/invite/redeem/route.ts — FOUND
- src/app/invite/[token]/page.tsx — FOUND

Commits verified:
- c7a845f — feat(04-02): implement POST /api/invite/redeem route
- 03b41d9 — feat(04-02): build /invite/[token] invite join page

TypeScript: npx tsc --noEmit exits 0 — PASS

Acceptance criteria verified:
- route.ts begins with `import 'server-only'` — PASS
- route.ts contains `adminAuth.verifyIdToken(idToken)` — PASS
- route.ts reads `adminDb.collection('invites').doc(token)` — PASS
- route.ts checks `invite.active` and returns 410 if false — PASS
- route.ts uses `FieldValue.arrayUnion(uid)` — PASS
- route.ts calls `adminAuth.setCustomUserClaims(uid, { role: 'viewer' })` — PASS
- route.ts returns `{ ok: true, wishlistId }` on success — PASS
- page.tsx uses `'use client'` — PASS
- page.tsx uses `use(params)` for Next.js 16 — PASS
- page.tsx calls `fetch('/api/invite/redeem', ...)` — PASS
- page.tsx calls `auth.currentUser?.getIdToken(true)` before redirect — PASS
- page.tsx contains "Du har bjudits in till" — PASS
- page.tsx contains "Länken är inte längre giltig" — PASS
- page.tsx imports `useAuth` from `@/components/AuthProvider` — PASS
- page.tsx has `role="alert"` on error messages — PASS
