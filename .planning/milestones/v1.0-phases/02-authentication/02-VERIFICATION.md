---
phase: 02-authentication
verified: 2026-04-08T21:30:00Z
status: human_needed
score: 4/5 must-haves verified
re_verification: false
human_verification:
  - test: "End-to-end auth flow — child account creation and login"
    expected: "POST /api/auth/register-child returns 201 {uid}; child logs in at /login with username + password; dashboard shows email testchild@wishlist.internal and role 'child'"
    why_human: "Requires Firebase emulators running and a browser; signInWithEmailAndPassword and Firestore username lookup cannot be exercised without a live runtime"
  - test: "Session persistence across hard browser refresh (AUTH-04)"
    expected: "After Cmd+Shift+R while on /dashboard, user remains authenticated; no redirect to /login; loading state shows briefly then resolves"
    why_human: "Firebase LOCAL persistence reads from IndexedDB — requires a real browser session; cannot be verified statically"
  - test: "Viewer registration and token refresh (AUTH-03)"
    expected: "Viewer registers at /register with email + password; role 'viewer' is readable from useAuth() immediately after redirect to /dashboard (getIdToken(true) forced refresh)"
    why_human: "Requires Firebase emulators; custom claim propagation timing can only be confirmed in a live session"
  - test: "Logout flow (AUTH-05)"
    expected: "Clicking 'Log out' calls signOut, redirects to /login; visiting /dashboard while logged out redirects back to /login via useEffect"
    why_human: "Router push and signOut behavior requires a running Next.js app and a browser session"
---

# Phase 02: Authentication Verification Report

**Phase Goal:** A parent can create a child account and the child can log in with just a username and password; viewers can register their own accounts; sessions persist across refreshes
**Verified:** 2026-04-08T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Parent submits a child username + password and a Firebase Auth account is created with a synthetic email; child role claim set to "child" | ✓ VERIFIED | `register-child/route.ts`: atomic Firestore transaction, `adminAuth.createUser()` with `{username}@wishlist.internal`, `setCustomUserClaims(uid, { role: 'child' })`, batch writes `usernames/{username}` + `users/{uid}` |
| 2 | Child can log in at /login with only their username and password (no email visible) | ✓ VERIFIED | `login/page.tsx`: only `type="text"` (username) and `type="password"` inputs; no `type="email"` field; `signInWithEmailAndPassword` called with derived synthetic email after `getDoc` on `usernames/{username}` |
| 3 | Viewer can register at /register with email + password and receives role claim "viewer" | ✓ VERIFIED | `register/page.tsx`: `createUserWithEmailAndPassword`, POSTs idToken to `/api/auth/set-viewer-claim`, `credential.user.getIdToken(true)` forces refresh; `set-viewer-claim/route.ts` verifies token and calls `setCustomUserClaims(uid, { role: 'viewer' })` |
| 4 | Logged-in user remains authenticated after a hard browser refresh | ? UNCERTAIN | `AuthProvider.tsx` uses `onAuthStateChanged` with Firebase LOCAL persistence (default) — IndexedDB rehydration will occur, but this requires a live browser to confirm; loading guard (`loading: true` initial state) prevents auth flash |
| 5 | User can log out and is redirected to the login page | ✓ VERIFIED | `dashboard/page.tsx`: `handleLogout()` calls `signOut(auth)` then `router.push('/login')`; `useEffect` guard also redirects to `/login` when `loading=false` and `user=null` |

**Score:** 4/5 truths verified (1 requires human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/firebase/client.ts` | Firebase client SDK with emulator support | VERIFIED | Exports `db` and `auth`; `connectAuthEmulator` (9099) and `connectFirestoreEmulator` (8080) behind `NEXT_PUBLIC_USE_EMULATOR=true`; HMR-safe guards present |
| `src/lib/firebase/admin.ts` | Admin SDK with server-only guard | VERIFIED | File exists (1060 bytes, modified 2026-04-08); exports `adminAuth` and `adminDb` per SUMMARY |
| `src/components/AuthProvider.tsx` | AuthContext provider and useAuth() hook | VERIFIED | `'use client'`; exports `AuthProvider` and `useAuth`; `onAuthStateChanged` + `getIdTokenResult()` for role; `loading: true` initial state; unsubscribe cleanup |
| `src/app/layout.tsx` | Root layout wrapping children with AuthProvider | VERIFIED | Imports `AuthProvider` from `@/components/AuthProvider`; `<AuthProvider>{children}</AuthProvider>` wraps body content; Geist fonts preserved |
| `src/app/api/auth/register-child/route.ts` | POST handler for child account creation | VERIFIED | `import 'server-only'`; `export async function POST`; atomic Firestore transaction; `setCustomUserClaims(uid, { role: 'child' })`; `FieldValue.serverTimestamp()`; 201 on success, 400/409 on errors |
| `src/app/api/auth/set-viewer-claim/route.ts` | POST handler for viewer claim setting | VERIFIED | `import 'server-only'`; `export async function POST`; `adminAuth.verifyIdToken(idToken)`; `setCustomUserClaims(uid, { role: 'viewer' })`; `FieldValue.serverTimestamp()`; 200/400/401 responses |
| `src/app/login/page.tsx` | Login page for child (username+password) | VERIFIED | `'use client'`; only username + password inputs; `getDoc` on `usernames/{username}`; `signInWithEmailAndPassword` with `@wishlist.internal` email; generic error (anti-enumeration); `router.push('/dashboard')` |
| `src/app/register/page.tsx` | Viewer self-registration page | VERIFIED | `'use client'`; email + password inputs; `createUserWithEmailAndPassword`; POSTs to `/api/auth/set-viewer-claim`; `credential.user.getIdToken(true)` forces refresh; `router.push('/dashboard')` |
| `proxy.ts` | Next.js 16 route proxy for optimistic redirects | VERIFIED | At project root (not `src/`); `export default function proxy`; `export const config` with `matcher`; `middleware.ts` is absent |
| `src/app/dashboard/page.tsx` | Protected dashboard page with logout button | VERIFIED | `'use client'`; `useAuth()` for `user`/`role`/`loading`; loading guard; `useEffect` redirect; `signOut(auth)` + `router.push('/login')` in `handleLogout` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AuthProvider.tsx` | `src/lib/firebase/client.ts` | `import { auth } from '@/lib/firebase/client'` | WIRED | Line 4: `import { auth } from '@/lib/firebase/client'`; `onAuthStateChanged(auth, ...)` on line 24 |
| `src/app/layout.tsx` | `AuthProvider.tsx` | `import { AuthProvider }` | WIRED | Line 4: `import { AuthProvider } from "@/components/AuthProvider"`; `<AuthProvider>{children}</AuthProvider>` on line 32 |
| `register-child/route.ts` | `src/lib/firebase/admin.ts` | `import { adminAuth, adminDb }` | WIRED | Line 3: `import { adminAuth, adminDb } from '@/lib/firebase/admin'`; `adminAuth.createUser()` on line 47 |
| `login/page.tsx` | `firebase/auth` | `signInWithEmailAndPassword(auth, syntheticEmail, password)` | WIRED | Line 3 import + line 35 call with `@wishlist.internal` email derived from Firestore lookup |
| `login/page.tsx` | `firebase/firestore` | `getDoc(doc(db, 'usernames', usernameLower))` | WIRED | Lines 4, 24-25: `getDoc` on `usernames/{username}` collection |
| `register/page.tsx` | `/api/auth/set-viewer-claim` | `fetch('/api/auth/set-viewer-claim', { method: 'POST' })` | WIRED | Lines 27-31: POST with `{ idToken }` body; response checked before forced refresh |
| `register/page.tsx` | `firebase/auth` | `createUserWithEmailAndPassword` + `getIdToken(true)` | WIRED | Line 3 import; line 21 `createUserWithEmailAndPassword`; line 40 `credential.user.getIdToken(true)` |
| `dashboard/page.tsx` | `AuthProvider.tsx` | `useAuth()` | WIRED | Line 5 import; line 10 `const { user, role, loading } = useAuth()` |
| `dashboard/page.tsx` | `firebase/auth` | `signOut(auth)` | WIRED | Line 4 import; line 32 `await signOut(auth)` |
| `proxy.ts` | `next/server` | `import { NextRequest, NextResponse }` | WIRED | Line 4 import; `NextResponse.next()` returned in both branches |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AuthProvider.tsx` | `user`, `role`, `loading` | `onAuthStateChanged(auth, ...)` + `firebaseUser.getIdTokenResult()` | Yes — populated by Firebase Auth SDK from IndexedDB/network | FLOWING |
| `dashboard/page.tsx` | `user`, `role`, `loading` | `useAuth()` from AuthProvider context | Yes — context values set by real Firebase Auth state | FLOWING |
| `login/page.tsx` | `snap` (username doc) | `getDoc(doc(db, 'usernames', usernameLower))` | Yes — real Firestore read | FLOWING |
| `register/page.tsx` | `credential` | `createUserWithEmailAndPassword(auth, email, password)` | Yes — real Firebase Auth account creation | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Firebase emulators and a Next.js dev server; no runnable entry points available without live services)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUTH-01 | 02-01 | Child account creation via synthetic email with atomic username claim | SATISFIED | `register-child/route.ts`: Firestore transaction + `adminAuth.createUser()` + `setCustomUserClaims('child')` |
| AUTH-02 | 02-01, 02-02 | Child logs in with username + password only (no email visible) | SATISFIED | `login/page.tsx`: no `type="email"` field; only username + password; synthetic email derived client-side |
| AUTH-03 | 02-01, 02-02 | Viewer registers with email + password; role claim set to "viewer" | SATISFIED | `register/page.tsx` + `set-viewer-claim/route.ts`: full chain wired |
| AUTH-04 | 02-01, 02-03 | Session persists across hard browser refresh (Firebase LOCAL persistence) | NEEDS HUMAN | `AuthProvider.tsx` relies on `onAuthStateChanged` default LOCAL persistence; loading guard prevents flash; cannot confirm without live browser |
| AUTH-05 | 02-03 | User can log out and is redirected to /login | SATISFIED | `dashboard/page.tsx`: `signOut(auth)` + `router.push('/login')` in `handleLogout` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `register-child/route.ts` | 32 | Comment mentions "placeholder" (code comment about `uid:'__pending__'` technique) | INFO | Not a stub — this is the documented atomic username reservation pattern. The value is immediately replaced by the real uid in the batch commit. |
| `proxy.ts` | 26-27 | `return NextResponse.next()` always passes through — no actual redirect to /login for unauthenticated users | INFO | Intentional and documented. Plan T-02-12 explicitly accepts this: "proxy.ts is OPTIMISTIC only — real gate is AuthProvider useEffect redirect." Dashboard implements the real auth gate. |
| `dashboard/page.tsx` | 37-54 | Dashboard renders email and role only — no wishlist content | INFO | Intentional stub for Phase 3. Documented in SUMMARY as "Known Stubs — Phase 3 will add wishlist items, drag-and-drop, and viewer interactions." |

No blockers found.

### Human Verification Required

#### 1. Child Account Creation + Login (AUTH-01, AUTH-02)

**Test:** Start Firebase emulators (`npm run emulator`), start dev server (`npm run dev`), then:
```
curl -X POST http://localhost:3000/api/auth/register-child \
  -H "Content-Type: application/json" \
  -d '{"username":"testchild","password":"password123"}'
```
Visit `http://localhost:3000/login`, enter username `testchild` and password `password123`.

**Expected:** curl returns `201 {"uid": "..."}`. Browser redirects to `/dashboard`. Dashboard shows `testchild@wishlist.internal` and role `child`.

**Why human:** Requires Firebase emulators and a running Next.js dev server.

#### 2. Session Persistence Across Hard Refresh (AUTH-04)

**Test:** While logged in at `/dashboard`, press Cmd+Shift+R (hard refresh).

**Expected:** User remains on `/dashboard` without being redirected to `/login`. A brief "Loading..." state appears and resolves. No flash of login page.

**Why human:** Firebase LOCAL persistence reads from IndexedDB — can only be confirmed in a real browser session.

#### 3. Viewer Registration with Immediate Role Availability (AUTH-03)

**Test:** Visit `http://localhost:3000/register`, enter `viewer@example.com` and `password123`. Confirm redirect to `/dashboard`. Check the role displayed.

**Expected:** Role shows `viewer` on the dashboard immediately (getIdToken(true) forced refresh before redirect).

**Why human:** Custom claim propagation timing requires a live Firebase Auth + emulator session.

#### 4. Logout Flow (AUTH-05)

**Test:** While on `/dashboard`, click "Log out". Then navigate directly to `http://localhost:3000/dashboard`.

**Expected:** After logout, redirected to `/login`. Second direct visit to `/dashboard` also redirects to `/login` via useEffect auth guard.

**Why human:** signOut behavior and router push require a running app and browser session.

### Gaps Summary

No blocking gaps found. All 10 required artifacts exist on disk with substantive implementation. All key links are wired. The 4 human verification items are behavioral confirmations of functioning code — they cannot be exercised without live Firebase emulators and a running Next.js dev server. The code paths are correctly implemented; only runtime confirmation is pending.

**Note on proxy.ts:** The optimistic pass-through behavior in `proxy.ts` (always returning `NextResponse.next()`) is architecturally intentional and documented as accepted risk T-02-12. The real auth gate is the `useEffect` redirect in `dashboard/page.tsx`. This is correct for Phase 2 scope; server-side token verification via `next-firebase-auth-edge` is deferred to Phase 5.

---

## Git Commit Evidence

| Plan | Commits | Hash |
|------|---------|------|
| 02-01 | feat(02-01): add emulator connection to client.ts | `1edd0de` |
| 02-01 | test(02-01): add failing tests for register-child and set-viewer-claim | `5f79d9d` |
| 02-01 | feat(02-01): create register-child and set-viewer-claim route handlers | `ff76ae2` |
| 02-01 | feat(02-01): create AuthProvider and wire into root layout | `ea1299f` |
| 02-02 | feat(02-02): build login page (child username + password) | `f9d951c` |
| 02-02 | feat(02-02): build viewer registration page (email + password) | `3524fff` |
| 02-03 | feat(02-03): add proxy.ts route protection and dashboard page with logout | `278a2d3` |

All 7 phase commits verified in git log.

---

_Verified: 2026-04-08T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
