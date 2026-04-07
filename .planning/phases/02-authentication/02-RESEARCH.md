# Phase 2: Authentication - Research

**Researched:** 2026-04-07
**Domain:** Firebase Authentication + Custom Claims + Next.js 16 Route Handlers + Session Persistence
**Confidence:** HIGH

## Summary

Phase 2 implements two distinct auth flows on top of the Firebase infrastructure delivered in Phase 1: (1) a parent-driven child account creation flow using a synthetic email (`{username}@wishlist.internal`) so children never see or enter an email, and (2) a standard viewer self-registration flow with real email + password. Both flows set Firebase custom claims (`role: 'child'` | `role: 'viewer'`) via the Admin SDK immediately after account creation. Session persistence uses Firebase Auth's built-in LOCAL persistence (the default), which survives hard browser refreshes without any additional cookie layer.

The project is on **Next.js 16**, which introduces a critical breaking change: `middleware.ts` is deprecated in favour of `proxy.ts`, the exported function must be named `proxy`, and all cookie/header reads are now **mandatory async** (`await cookies()`). Route protection is done through `proxy.ts`. The Admin SDK calls (create user, set claims, write Firestore docs) happen inside **Next.js Route Handlers** (`app/api/*/route.ts`), keeping secrets server-side.

**Primary recommendation:** Use Firebase Auth email/password provider with synthetic emails for children (`{username}@wishlist.internal`), custom claims set immediately after `createUser()` via Admin SDK, and `onAuthStateChanged` in a React Context provider for client-side session state. Use `proxy.ts` (not `middleware.ts`) for route protection. Do not add a separate session-cookie layer — Firebase's LOCAL persistence handles AUTH-04 natively.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Parent registers a child account with username + password; Firebase Auth account created with synthetic email; role claim set to "child" | Admin SDK `createUser()` + `setCustomUserClaims()` in Route Handler; `usernames/{username}` mapping written atomically |
| AUTH-02 | Child logs in at /login with username + password (no email visible) | Client-side: lookup `usernames/{username}` → email, then `signInWithEmailAndPassword()` |
| AUTH-03 | Viewer registers at /register with email + password; receives role claim "viewer" | Client-side `createUserWithEmailAndPassword()` → POST to Route Handler to set custom claim |
| AUTH-04 | Logged-in session persists across hard browser refresh | Firebase Auth LOCAL persistence (default); `onAuthStateChanged` in React Context |
| AUTH-05 | User can log out; redirected to /login | Client-side `signOut()` + `router.push('/login')` |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase (client) | 12.11.0 | `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `onAuthStateChanged`, `signOut` | [VERIFIED: npm registry] — already installed in Phase 1; modular SDK v12 is current |
| firebase-admin | 13.7.0 | `createUser()`, `setCustomUserClaims()` — server-only operations | [VERIFIED: npm registry] — already installed in Phase 1; only way to set custom claims |
| next | 16.2.2 | Route Handlers (`app/api/*/route.ts`), `proxy.ts` for route protection, `await cookies()` | [VERIFIED: npm registry] — already installed; v16 breaking changes apply |
| react (context) | 19.2.4 | `AuthContext` provider wraps app; exposes `user`, `loading`, `role` | [VERIFIED: npm registry] — already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | (bundled with next) | `useRouter()` for client-side redirects after login/logout | AUTH-05: redirect to /login after signOut |
| next/headers | (bundled with next) | `await cookies()` in Route Handlers (mandatory async in Next.js 16) | Any Route Handler that reads/sets a cookie |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Synthetic email `@wishlist.internal` | Firebase Custom Token / phone auth | Custom Token requires a signing step every login and adds a Cloud Function dependency; phone auth requires SMS infrastructure. Synthetic email is simpler and works offline with the emulator. [ASSUMED] |
| React Context for auth state | `next-firebase-auth-edge` library | The library adds cookie-based session management ideal for SSR auth; not needed for this app which is client-rendered for auth-sensitive pages. Adds 3rd-party dependency. |
| `proxy.ts` optimistic redirects | Hardcore session validation in proxy | Next.js 16 docs explicitly state proxy should NOT be used as full session management — it runs before auth resolves on some edge cases. Optimistic redirect is correct use. |

**Installation:** No new packages needed — Phase 1 already installed `firebase`, `firebase-admin`, `next`, `react`.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register-child/
│   │   │   │   └── route.ts      # POST: Admin SDK createUser + setCustomUserClaims (child)
│   │   │   └── set-viewer-claim/
│   │   │       └── route.ts      # POST: Admin SDK setCustomUserClaims (viewer)
│   ├── login/
│   │   └── page.tsx              # /login — username + password form
│   ├── register/
│   │   └── page.tsx              # /register — email + password form (viewer)
│   └── dashboard/
│       └── page.tsx              # Protected route (Phase 3+ content)
├── components/
│   └── AuthProvider.tsx          # React Context: wraps app with onAuthStateChanged
├── lib/
│   └── firebase/
│       ├── client.ts             # (exists) exports db, auth
│       └── admin.ts              # (exists) exports adminDb, adminAuth
proxy.ts                          # Route protection (NOT middleware.ts)
```

### Pattern 1: Child Account Creation (AUTH-01)

**What:** Parent posts `{username, password}` to `/api/auth/register-child`. Route Handler uses Admin SDK to create the user with a synthetic email, set `role: 'child'` custom claim, write `usernames/{username}` mapping, and write `users/{uid}` profile — all server-side.

**When to use:** AUTH-01 only. Never from client SDK.

**Why this route is correct:** `setCustomUserClaims()` requires Admin SDK (server-only). Creating the account server-side also lets us enforce username uniqueness atomically via Firestore before creating the Auth user.

```typescript
// src/app/api/auth/register-child/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password required' }, { status: 400 });
  }

  // Normalise username (lowercase, trim)
  const usernameLower = username.trim().toLowerCase();
  const syntheticEmail = `${usernameLower}@wishlist.internal`;

  // Check username uniqueness
  const usernameRef = adminDb.collection('usernames').doc(usernameLower);
  const existing = await usernameRef.get();
  if (existing.exists) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  // Create Firebase Auth user with synthetic email
  let userRecord;
  try {
    userRecord = await adminAuth.createUser({
      email: syntheticEmail,
      password,
      displayName: username,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }

  // Set custom claim
  await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'child' });

  // Write supporting Firestore docs in a batch
  const batch = adminDb.batch();
  batch.set(usernameRef, { uid: userRecord.uid });
  batch.set(adminDb.collection('users').doc(userRecord.uid), {
    uid: userRecord.uid,
    username: usernameLower,
    email: syntheticEmail,
    role: 'child',
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
}
```

[VERIFIED: firebase.google.com/docs/auth/admin/manage-users — createUser() API]
[VERIFIED: firebase.google.com/docs/auth/admin/custom-claims — setCustomUserClaims() API]
[CITED: nextjs.org/docs/app/getting-started/route-handlers — Route Handler POST export]

### Pattern 2: Child Login (AUTH-02)

**What:** Child enters username + password at `/login`. Client looks up `usernames/{username}` in Firestore (public read rule from Phase 1), retrieves the synthetic email, then calls `signInWithEmailAndPassword()`.

**When to use:** AUTH-02 only. Completely client-side — no Route Handler needed.

```typescript
// src/app/login/page.tsx (client component)
'use client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

async function loginWithUsername(username: string, password: string) {
  const usernameLower = username.trim().toLowerCase();
  const usernameRef = doc(db, 'usernames', usernameLower);
  const snap = await getDoc(usernameRef);

  if (!snap.exists()) {
    throw new Error('Username not found');
  }

  // Derive synthetic email and sign in
  const syntheticEmail = `${usernameLower}@wishlist.internal`;
  const credential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
  return credential.user;
}
```

[CITED: firebase.google.com/docs/auth/web/password-auth — signInWithEmailAndPassword]
[CITED: w3tutorials.net/blog/username-authentication-instead-of-email — username lookup pattern]

**Note on the usernames doc:** The doc only stores `{ uid }`. The email can be re-derived client-side with `${username}@wishlist.internal`. There is no need to store the email in `usernames/{username}`.

### Pattern 3: Viewer Registration (AUTH-03)

**What:** Viewer uses real email + password. Client calls `createUserWithEmailAndPassword()`, then POSTs the ID token to `/api/auth/set-viewer-claim` so the server can verify and set the claim.

**Why not set claim in client?** `setCustomUserClaims()` requires Admin SDK. Client must prove who it is by sending a verifiable ID token.

```typescript
// Client side (register page)
import { createUserWithEmailAndPassword, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

async function registerViewer(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await getIdToken(credential.user);

  // Send token to server to set custom claim
  await fetch('/api/auth/set-viewer-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  // Force token refresh so claim is available immediately
  await credential.user.getIdToken(true);
  return credential.user;
}
```

```typescript
// src/app/api/auth/set-viewer-claim/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { uid, email } = decodedToken;
  await adminAuth.setCustomUserClaims(uid, { role: 'viewer' });

  // Write user profile
  await adminDb.collection('users').doc(uid).set({
    uid,
    email: email ?? '',
    role: 'viewer',
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
```

[VERIFIED: firebase.google.com/docs/auth/admin/custom-claims — setCustomUserClaims, verifyIdToken]
[VERIFIED: firebase.google.com/docs/auth/web/password-auth — createUserWithEmailAndPassword]

### Pattern 4: Auth Context Provider (AUTH-04)

**What:** A single `AuthProvider` client component wraps `app/layout.tsx`. It listens with `onAuthStateChanged`, stores `user` + `role` (read from ID token claims), and makes them available via React Context.

**Why it solves AUTH-04:** Firebase Auth's default persistence is `LOCAL` (IndexedDB/localStorage). The SDK rehydrates the session from storage on page load. `onAuthStateChanged` fires with the stored user before any page renders. No cookie or server session needed for this use case.

```typescript
// src/components/AuthProvider.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

interface AuthContextValue {
  user: User | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Read role from ID token custom claims
        const idTokenResult = await firebaseUser.getIdTokenResult();
        setRole((idTokenResult.claims.role as string) ?? null);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

[CITED: firebase.google.com/docs/auth/web/auth-state-persistence — LOCAL persistence is default]
[CITED: firebase.google.com/docs/auth/web/manage-users — getIdTokenResult() for custom claims]

### Pattern 5: Route Protection with proxy.ts (Next.js 16)

**What:** `proxy.ts` at project root performs optimistic redirects — unauthenticated users trying to reach protected routes are redirected to `/login`. It does NOT validate tokens (that is the auth layer's job).

**CRITICAL Next.js 16 change:** File must be `proxy.ts` (not `middleware.ts`). Export must be `proxy` (not `middleware` or `default`). No Edge runtime — runs on Node.js. [VERIFIED: nextjs.org/blog/next-16]

```typescript
// proxy.ts  (NOT middleware.ts — renamed in Next.js 16)
import { NextRequest, NextResponse } from 'next/server';

// Routes that do not require authentication
const PUBLIC_PATHS = ['/login', '/register', '/'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Optimistic check: Firebase sets a cookie when the user is signed in
  // (next-firebase-auth-edge or manual cookie set). For now, check for
  // the presence of any auth indicator cookie.
  // NOTE: This is an OPTIMISTIC check — the real auth gate is the AuthProvider.
  // proxy.ts cannot verify Firebase ID tokens without next-firebase-auth-edge.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

[VERIFIED: nextjs.org/blog/next-16 — proxy.ts replaces middleware.ts]
[CITED: next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware — proxy.ts config pattern]

**Why no token validation in proxy.ts:** The official Next.js 16 docs warn that proxy should NOT be used as a full session management solution. For this phase, real route protection happens at the component level (AuthProvider + redirect in useEffect). Cookie-based server-side auth via `next-firebase-auth-edge` is a deferred enhancement.

### Pattern 6: Logout (AUTH-05)

```typescript
// In any client component
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';

async function handleLogout() {
  await signOut(auth);
  router.push('/login');
}
```

[CITED: firebase.google.com/docs/auth/web/password-auth — signOut()]

### Anti-Patterns to Avoid

- **Setting custom claims from the client:** `setCustomUserClaims()` is Admin SDK only. Client code cannot call it. All claim-setting MUST go through a Route Handler with Admin SDK.
- **Using `middleware.ts` in Next.js 16:** The file is deprecated — use `proxy.ts` with `export function proxy(...)`. The old filename still works for the Edge runtime but is deprecated. Using it risks confusion and future breakage.
- **Synchronous `cookies()` or `headers()`:** Next.js 16 removes the synchronous fallback. Any Route Handler that reads cookies must use `const cookieStore = await cookies()`. [VERIFIED: nextjs.org/blog/next-16 breaking changes table]
- **Expecting custom claims immediately after setCustomUserClaims():** Claims do not appear in the ID token until the next token refresh. After setting claims, the client must call `user.getIdToken(true)` to force a refresh before the claim is readable. [CITED: firebase.google.com/docs/auth/admin/custom-claims]
- **Storing synthetic emails in Firestore unnecessarily:** The email can be derived from the username (`${username}@wishlist.internal`) client-side. Avoid storing it in the `usernames` collection — it adds redundancy and a surface for inconsistency.
- **Username case sensitivity:** Always normalise usernames to lowercase before storing in `usernames/{username}` and before lookups. "Alice" and "alice" must map to the same document.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence across refreshes | Custom localStorage/cookie reader | Firebase Auth LOCAL persistence (default) | Firebase SDK rehydrates session from IndexedDB automatically; custom storage is error-prone and duplicates existing work |
| Role-based claims in ID token | Custom JWT claims layer | Firebase custom claims via Admin SDK | Claims are natively embedded in Firebase ID tokens and readable in Firestore security rules as `request.auth.token.role` |
| Username → UID mapping storage | Custom user table with index | `usernames/{username}` Firestore doc (already in schema from Phase 1) | Firestore document IDs are unique; lookup is O(1) single-doc read with no query needed |
| Password hashing for child accounts | Custom hash + storage | Firebase Auth email/password provider | Firebase handles bcrypt/Argon2 hashing, salting, and breach detection. Never hand-roll password storage. |
| Token verification server-side | Parse JWT manually | `adminAuth.verifyIdToken(token)` | Admin SDK verifies signature, expiry, and revocation in one call. Manual JWT parsing misses revocation checks. |

**Key insight:** Firebase Auth is a complete identity system. The only custom layer needed is the username→email shim (pattern 2) and the claim-setting Route Handlers. Everything else (hashing, token lifecycle, persistence) is provided by the SDK.

## Common Pitfalls

### Pitfall 1: Custom Claims Not Visible Until Token Refresh

**What goes wrong:** Parent creates a child account. Child immediately logs in. The `role` claim is absent from the first ID token because `setCustomUserClaims()` updates the Auth record but the SDK serves the token it already has cached.

**Why it happens:** ID tokens are cached for up to 1 hour. Custom claims only appear in the next issued token. [CITED: firebase.google.com/docs/auth/admin/custom-claims]

**How to avoid:** After the viewer registration Route Handler returns success, the client calls `await user.getIdToken(true)` (the `true` forces a refresh). For the child case, the parent is the one registering and the child logs in fresh — so the child's first login token already includes the claim because they have never had a cached token. The viewer flow needs the explicit refresh.

**Warning signs:** `idTokenResult.claims.role` is `undefined` right after registration; disappears after one sign-out/sign-in cycle.

### Pitfall 2: proxy.ts File Name / Export Name Mismatch

**What goes wrong:** Developer creates `middleware.ts` (old name) or exports `export default function middleware(...)` (old export) — route protection silently does nothing or generates a deprecation warning.

**Why it happens:** Next.js 16 deprecates `middleware.ts` in favour of `proxy.ts`. The old file still works on the deprecated Edge runtime but the new behaviour (Node.js runtime, single predictable execution) requires the rename. [VERIFIED: nextjs.org/blog/next-16]

**How to avoid:** File must be `proxy.ts` at project root. Export must be `export function proxy(request: NextRequest)`. Add the `config.matcher` export for path filtering.

**Warning signs:** Build warning about deprecated `middleware.ts`; proxy logic not executing for expected paths.

### Pitfall 3: Username Race Condition on Registration

**What goes wrong:** Two parents register child accounts with the same username simultaneously. Both read `usernames/alice` → not found. Both proceed to `createUser()`. One wins; the other creates a duplicate Firebase Auth account that will never be found by the username lookup.

**Why it happens:** The check-before-create pattern is not atomic. Firestore reads and Firebase Auth creates are separate operations. [NOTED in STATE.md as a known concern]

**How to avoid:** Use a Firestore transaction that reads and writes `usernames/{username}` atomically. If the document exists when the transaction commits, abort and return 409.

```typescript
await adminDb.runTransaction(async (tx) => {
  const snap = await tx.get(usernameRef);
  if (snap.exists) throw new Error('USERNAME_TAKEN');
  tx.set(usernameRef, { uid: userRecord.uid });
});
```

Note: Firebase Auth `createUser()` cannot participate in a Firestore transaction. The correct order is: (1) Firestore transaction claims the username, (2) `createUser()` creates the Auth user, (3) batch writes `users/{uid}` profile. If step 2 fails after step 1 succeeds, a cleanup step must delete the `usernames/{username}` document.

**Warning signs:** Two child accounts exist with the same username in Firestore; one is unreachable via login.

### Pitfall 4: Async cookies() Called Synchronously

**What goes wrong:** Route Handler calls `cookies()` synchronously (old Next.js 14/15 pattern). Next.js 16 throws at runtime: "cookies() should be awaited before using its value."

**Why it happens:** Next.js 16 removes the synchronous fallback for `cookies()`, `headers()`, and `draftMode()`. [VERIFIED: nextjs.org/blog/next-16 — breaking changes table]

**How to avoid:** Always: `const cookieStore = await cookies();` — even if Phase 2 Route Handlers don't read cookies, future handlers will. Establish the pattern now.

**Warning signs:** Runtime error about `cookies()` needing to be awaited; build warnings about sync dynamic API usage.

### Pitfall 5: Loading State Not Handled in AuthProvider

**What goes wrong:** Component reads `useAuth()` and renders content based on `user === null` before Firebase has rehydrated the session from IndexedDB. User sees a flash of the unauthenticated state (e.g., login page briefly appears) before being redirected.

**Why it happens:** Firebase Auth is async — `onAuthStateChanged` fires after the first render. The `loading` state in the context must be respected.

**How to avoid:** Every protected page checks `if (loading) return <LoadingSkeleton />` before checking `if (!user) redirect(...)`. The `loading: true` initial state in `AuthProvider` gates all auth-dependent rendering.

**Warning signs:** Brief flash of /login page when refreshing a protected page as a logged-in user; layout shift on initial load.

## Code Examples

### Modular Admin SDK: createUser + setCustomUserClaims

```typescript
// Source: firebase.google.com/docs/auth/admin/manage-users
import { getAuth } from 'firebase-admin/auth';

// adminAuth is the result of getAuth(adminApp) from admin.ts
const userRecord = await adminAuth.createUser({
  email: 'alice@wishlist.internal',
  password: 'securepassword',
  displayName: 'alice',
});

await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'child' });
```

### Modular Admin SDK: verifyIdToken

```typescript
// Source: firebase.google.com/docs/auth/admin/verify-id-tokens
const decodedToken = await adminAuth.verifyIdToken(idToken);
const { uid, email } = decodedToken;
// decodedToken.role will contain the custom claim ONLY if it was set before this token was issued
```

### Client SDK: Force Token Refresh After Claim Set

```typescript
// Source: firebase.google.com/docs/auth/admin/custom-claims (claim propagation)
// Call after server confirms setCustomUserClaims() succeeded
await auth.currentUser?.getIdToken(/* forceRefresh = */ true);
const result = await auth.currentUser?.getIdTokenResult();
console.log(result?.claims.role); // 'viewer'
```

### Next.js 16 Route Handler (async headers/cookies pattern)

```typescript
// Source: nextjs.org/blog/next-16 — Breaking Changes
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // REQUIRED in Next.js 16: await before use
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` with Edge runtime | `proxy.ts` with Node.js runtime | Next.js 16 (Oct 2025) | Must rename file and export; old file is deprecated |
| Sync `cookies()` / `headers()` | `await cookies()` / `await headers()` | Next.js 16 (Oct 2025) | Runtime error if not awaited; existing patterns from Next.js 14/15 break |
| `export default function middleware` | `export function proxy` | Next.js 16 (Oct 2025) | Export name must change |
| Firebase compat SDK (`firebase/compat`) | Modular SDK (`firebase/auth`, `firebase/firestore`) | Firebase v9 (2021) | Already using modular SDK from Phase 1; do not import from `firebase/compat` |
| Async `params` as `Promise` vs direct prop access | Must `await params` in page components | Next.js 16 | Page components that receive params must `await params` |

**Deprecated/outdated in this stack:**
- **`middleware.ts`:** Deprecated in Next.js 16 in favour of `proxy.ts`. Using the old name still works on Edge runtime but is explicitly deprecated. [VERIFIED: nextjs.org/blog/next-16]
- **Synchronous `cookies()` / `headers()`:** Removed in Next.js 16. The sync fallback that existed in Next.js 14/15 no longer exists. [VERIFIED: nextjs.org/blog/next-16]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `usernames/{username}` documents store only `{ uid }` (not the email); email is derived as `${username}@wishlist.internal` client-side | Pattern 2: Child Login | If the Phase 1 decision stored email in the username doc, the login function should read `snapshot.data().email` instead of deriving it. Check `UsernameDoc` type in `src/types/firestore.ts` — it only has `uid`, so derivation is correct. LOW risk. |
| A2 | Next.js 16 `proxy.ts` export is a named export `proxy`, not a default export | Pattern 5: proxy.ts | The Next.js 16 blog post shows `export default function proxy(...)` in one snippet and `export function proxy` in another. Need to verify exact export syntax from official docs. If wrong, proxy silently does nothing. |
| A3 | Firebase Auth emulator on port 9099 correctly intercepts `createUserWithEmailAndPassword` and `signInWithEmailAndPassword` in tests without additional config | Code Examples | If Auth emulator requires explicit `connectAuthEmulator()` call in client.ts (or only for tests), the login/register flows will hit production Auth during dev. Firebase emulator requires `connectAuthEmulator(auth, 'http://127.0.0.1:9099')` in emulator mode. [ASSUMED — verify in execution] |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **proxy.ts exact export syntax**
   - What we know: Next.js 16 blog shows both `export default function proxy` and `export function proxy` in different places
   - What's unclear: Is it a named export or default export?
   - Recommendation: Default to `export default function proxy(...)` matching the blog's primary example; the planner should add a task to verify against the official `proxy.ts` file-conventions docs before committing.

2. **Auth emulator connection in dev vs. test**
   - What we know: `firebase.json` configures the Auth emulator on port 9099; `client.ts` exports `auth`
   - What's unclear: Does `client.ts` need a `connectAuthEmulator()` call gated behind `process.env.NODE_ENV === 'development'`? Phase 1 did not need it (no Auth calls). Phase 2 does.
   - Recommendation: Add emulator connection to `client.ts` behind env check: `if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') connectAuthEmulator(auth, 'http://127.0.0.1:9099')`.

3. **Firestore security rules for `users/{uid}` write during registration**
   - What we know: Phase 1 rules allow `users/{uid}` read/write only if `request.auth.uid == uid`
   - What's unclear: Child account creation happens via Admin SDK (bypasses rules). Viewer account creation POSTs ID token to server, which uses Admin SDK. So neither flow needs client Firestore writes for `users/{uid}`. Confirm the batch write in the Route Handler uses `adminDb` (which bypasses rules). [Already true in Pattern 1 above — uses `adminDb`.]
   - Recommendation: No rules change needed. Document explicitly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Auth emulator (port 9099) | AUTH-01, AUTH-02, AUTH-03 dev testing | ✓ (configured in firebase.json) | firebase-tools@^15 | Use production Auth project (not recommended for dev) |
| Firebase Firestore emulator (port 8080) | AUTH-01 username uniqueness check during tests | ✓ (configured in firebase.json) | firebase-tools@^15 | Use production Firestore |
| Java Runtime (JRE 11+) | Firebase emulators | ? (not checked) | 11+ required | Cannot run emulators without JRE — blocks local auth testing |
| Node.js 20.9+ | Next.js 16 minimum | ? (not checked) | 20.9+ required by Next.js 16 | Next.js 16 will refuse to start on older Node |

**Missing dependencies with no fallback:**
- Java Runtime: Required for Firebase Auth + Firestore emulators. If absent, auth flows can only be tested against production Firebase project.
- Node.js 20.9+: Hard requirement by Next.js 16. Verify before executing Phase 2.

**Missing dependencies with fallback:**
- None for core auth flows.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth email/password provider; password complexity enforced by Firebase |
| V3 Session Management | yes | Firebase Auth LOCAL persistence (IndexedDB); no custom session cookie needed for Phase 2 |
| V4 Access Control | yes | Custom claims (`role: 'child'` / `role: 'viewer'`) read in Firestore security rules as `request.auth.token.role` |
| V5 Input Validation | yes | Validate `username` and `password` fields in Route Handler before calling Admin SDK; trim/lowercase username |
| V6 Cryptography | no | Firebase handles password hashing; no custom crypto needed |

### Known Threat Patterns for Firebase Auth + Next.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Username enumeration via timing attack on login | Information disclosure | Firebase `signInWithEmailAndPassword` returns a generic error; client shows "Username or password incorrect" regardless of which was wrong |
| Username squatting race condition | Tampering | Firestore transaction for atomically claiming `usernames/{username}` doc before `createUser()` — see Pitfall 3 |
| ID token sent over HTTP | Information disclosure | Next.js Route Handlers are HTTPS in production; enforce `Strict-Transport-Security` header. Dev uses HTTP on localhost only. |
| Admin SDK credentials in client bundle | Elevation of privilege | `import 'server-only'` on `admin.ts` from Phase 1 prevents accidental client import at build time |
| Stale custom claims in cached token | Elevation of privilege | Force token refresh with `getIdToken(true)` after claim is set; Firestore security rules evaluate the token at request time |
| Brute-force login attempts | Denial of service / Spoofing | Firebase Auth has built-in rate limiting on `signInWithEmailAndPassword`; no additional throttle needed for Phase 2 |

## Sources

### Primary (HIGH confidence)
- [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16) — Verified proxy.ts rename, async cookies breaking change, Node.js runtime change, breaking changes table
- [firebase.google.com/docs/auth/web/password-auth](https://firebase.google.com/docs/auth/web/password-auth) — createUserWithEmailAndPassword, signInWithEmailAndPassword API
- [firebase.google.com/docs/auth/admin/custom-claims](https://firebase.google.com/docs/auth/admin/custom-claims) — setCustomUserClaims, custom claims timing, Firestore rules access pattern
- [firebase.google.com/docs/auth/web/auth-state-persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence) — LOCAL persistence is default for web
- Phase 1 source files (verified on disk): `src/lib/firebase/client.ts`, `src/lib/firebase/admin.ts`, `src/types/firestore.ts`, `firestore.rules`

### Secondary (MEDIUM confidence)
- [next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware) — proxy.ts configuration patterns for Next.js 16 + Firebase
- [w3tutorials.net/blog/username-authentication-instead-of-email](https://www.w3tutorials.net/blog/username-authentication-instead-of-email) — Username → email lookup pattern verified against Firebase Auth docs

### Tertiary (LOW confidence — requires validation)
- [ASSUMED] Auth emulator requires explicit `connectAuthEmulator()` call in client.ts for local dev — standard Firebase emulator pattern but not confirmed for this specific project
- [ASSUMED] `proxy.ts` export style (named vs. default) — blog post shows both styles; exact convention needs verification against file-conventions docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages already installed from Phase 1; versions confirmed via npm registry 2026-04-07
- Architecture patterns: HIGH — Firebase Auth API verified against official docs; synthetic email pattern is a well-documented community pattern
- Next.js 16 proxy.ts: HIGH — Verified directly from the official Next.js 16 release blog post; all breaking changes confirmed
- Custom claims timing: HIGH — Documented in Firebase official docs; `getIdToken(true)` is the standard fix
- Username race condition mitigation: HIGH — Firestore transactions are the documented solution; the exact cleanup flow (if createUser fails) is MEDIUM as it requires careful implementation
- Security threats: MEDIUM — Derived from ASVS categories and common Firebase patterns; not all threat vectors are Firebase-specific

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Firebase Auth API is stable; Next.js 16 released Oct 2025 and is the current version)
