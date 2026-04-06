# Phase 1: Foundation - Research

**Researched:** 2026-04-06
**Domain:** Next.js + Firebase Firestore Architecture, Security Rules, Real-time Listeners
**Confidence:** HIGH

## Summary

Phase 1 establishes the irreversible foundation: a Next.js 14 app with dual Firebase SDK modules (client/admin), Firestore schema with privacy-enforcing security rules, and real-time listener infrastructure. The critical correctness decision is separating `purchaseStatus` into its own subcollection, enforced at the database layer via security rules that explicitly deny child UIDs read access. This phase produces no user-facing features—only tested infrastructure that all downstream phases depend on. All technology choices are standard ecosystem patterns; no custom abstractions are needed.

**Primary recommendation:** Follow the standard Firebase + Next.js patterns documented in official sources. The security rules are non-negotiable (privacy boundary). Everything else (SDK initialization guard, path aliases, Firestore structure) follows conventions from Firebase docs and community best practice. Test the security rules via emulator before Phase 1 is complete.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Top-level collection is `wishlists/{wishlistId}` — core entity both child and viewers access
- **D-02:** Items subcollection: `wishlists/{wishlistId}/items/{itemId}` — child-readable, child-writable
- **D-03:** Purchase status subcollection: `wishlists/{wishlistId}/purchaseStatus/{itemId}` — viewer-only, child cannot read (irreversible privacy boundary)
- **D-04:** Supporting collections: `usernames/{username}`, `users/{uid}`, `invites/{token}`
- **D-05:** `lib/firebase/client.ts` — client SDK singleton with `getApps()` guard
- **D-06:** `lib/firebase/admin.ts` — Admin SDK guarded with `import 'server-only'`
- **D-07:** Environment: `.env.local` with `NEXT_PUBLIC_FIREBASE_*` prefix for client config; `FIREBASE_ADMIN_SDK_KEY` for admin
- **D-08:** App Router (Next.js 14), TypeScript strict mode
- **D-09:** Path alias `@/` → `src/`
- **D-10:** No migration tooling needed — Firestore is schemaless
- **D-11:** Firestore emulator port 8080, Auth emulator port 9099
- **D-12:** Security rule test script (`tests/firestore.rules.test.ts`) verifies privacy boundary
- **D-13:** `npm run test:rules` script in package.json
- **D-14:** `/test` route (`app/test/page.tsx`) proves real-time listeners work — removed/repurposed in later phases

### Claude's Discretion
- Exact Firestore security rules syntax (beyond privacy boundary)
- ESLint configuration
- Tailwind CSS setup (install now, no design work in Phase 1)
- Firebase project ID and naming

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 1 scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Changes synced in real-time between all inlogged enheter without page refresh | Firestore `onSnapshot` listeners (Section: Architecture Patterns → Pattern 2: Real-time Listeners) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.2 | Full-stack React framework with App Router | [VERIFIED: npm registry] — v16 is current LTS; App Router is the modern default for new projects. Used by every modern Next.js team |
| Firebase SDK | 12.11.0 | Client-side Firebase SDK for browser | [VERIFIED: npm registry] — current version includes modular imports; supports Firestore real-time listeners with stable API |
| Firebase Admin SDK | 13.7.0 | Server-side privileged SDK for Node.js | [VERIFIED: npm registry] — current version; provides Firestore write access for API routes. Incompatible with browser bundles |
| TypeScript | 6.0.2 | Static type checking | [VERIFIED: npm registry] — v6 is current; strict mode catches security rule bugs early |
| firebase-tools | 15.13.0 | CLI for emulator and project management | [VERIFIED: npm registry] — current version includes Firestore emulator, Auth emulator, local testing UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @firebase/rules-unit-testing | [current, verify latest] | Unit test framework for security rules | Required for D-12: test script that verifies privacy boundary before Phase 1 complete |
| server-only | [current, verify latest] | Build-time guard to prevent server code in client bundle | Import at top of `lib/firebase/admin.ts` to enforce server-only execution; catches accidental imports |

**Installation guidance:**
```bash
npm install next firebase firebase-admin typescript
npm install --save-dev firebase-tools @firebase/rules-unit-testing server-only typescript @types/node
```

**Version verification:** As of 2026-04-06:
- `next@16.2.2` published 2026-04-06
- `firebase@12.11.0` published 2026-04-01
- `firebase-admin@13.7.0` published 2026-03-31 (checked via npm view)
- `typescript@6.0.2` published 2026-04-01

All are current as of today.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Firebase SDK (client) | Supabase PostgREST client | Loses Firestore's subcollection model; rule testing harder |
| Firebase Admin SDK | Custom Node.js HTTP client to Firebase REST API | Much lower-level; no auth context helpers; fewer security guarantees |
| TypeScript strict mode | Loose type checking | Late detection of schema mismatches; harder to refactor rules safely |
| @firebase/rules-unit-testing | Manual emulator testing via curl | Brittle; can't mock auth contexts; high maintenance |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/firebase/
│   ├── client.ts          # Client SDK singleton, getApps() guard
│   ├── admin.ts           # Admin SDK, guarded with 'server-only'
│   └── config.ts          # Shared config (project ID, etc.)
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── test/
│       └── page.tsx       # Real-time listener proof-of-concept
├── components/            # React components (client + server components)
├── types/                 # TypeScript types
└── styles/                # Global styles (Tailwind setup)

firestore.rules            # Firestore security rules file
firestore.indexes.json     # Auto-generated Firestore indexes
firebase.json              # Emulator config + project settings
tests/
├── firestore.rules.test.ts  # D-12: security rule unit tests
└── setup.ts               # Test environment setup

.env.local                 # Local dev: NEXT_PUBLIC_FIREBASE_* vars
```

### Pattern 1: Client SDK Initialization with Guard
**What:** Prevent multiple Firebase app instances by checking if apps are already initialized before calling `initializeApp()`.

**When to use:** Any client component or utility that needs Firestore access.

**Why it matters:** Next.js re-renders during development and HMR, causing `initializeApp()` to be called multiple times. Without the guard, "Firebase app already exists" errors crash the app. [CITED: firebase.google.com/docs/hosting/frameworks/nextjs]

**Example:**
```typescript
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard: only initialize if not already done
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
```

**Source:** [dev.to: How to Initialize Firebase in Next.js](https://dev.to/gthinh/how-to-initialize-a-firebase-app-in-the-new-modular-web-sdk-in-nextjs-187i), [Firebase docs: Integrate Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs)

### Pattern 2: Real-time Listeners with useEffect
**What:** Attach a Firestore `onSnapshot()` listener in a client component using `useEffect`, and always clean up by calling the unsubscribe function.

**When to use:** Displaying live-updating data from Firestore (e.g., D-14: `/test` route showing real-time updates).

**Why it matters:** Real-time listeners open persistent connections to Firestore. Forgetting to unsubscribe leaks connections and memory. [CITED: firebase.google.com/docs/firestore/query-data/listen]

**Example:**
```typescript
// src/app/test/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function TestPage() {
  const [wishlistData, setWishlistData] = useState(null);

  useEffect(() => {
    // D-14: hardcoded wishlist document for PoC
    const docRef = doc(db, 'wishlists', 'test-wishlist-id');
    
    // Attach real-time listener
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setWishlistData(snapshot.data());
      }
    });

    // Cleanup: detach listener when component unmounts
    return () => unsubscribe();
  }, []);

  if (!wishlistData) return <p>Loading...</p>;
  return <div><pre>{JSON.stringify(wishlistData, null, 2)}</pre></div>;
}
```

**Source:** [Firebase docs: Get realtime updates](https://firebase.google.com/docs/firestore/query-data/listen), [Medium: Real-time listeners in React](https://renzoregio.medium.com/listening-for-real-time-changes-in-firestore-database-using-onsnapshot-method-381d48d37e7c)

### Pattern 3: Admin SDK Initialization with server-only Guard
**What:** Import `'server-only'` at the top of admin SDK module, preventing accidental bundling into client JavaScript.

**When to use:** Any file that uses Firebase Admin SDK (API routes, Server Components).

**Why it matters:** Admin SDK is designed for server-only and fails if included in browser bundle. `'server-only'` import catches mistakes at build time. [CITED: nextjs.org/docs/app/getting-started/server-and-client-components]

**Example:**
```typescript
// src/lib/firebase/admin.ts
import 'server-only';

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Parse credentials from env var (or use service account JSON file)
const adminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

const adminApp = getApps().length === 0 ? initializeApp(adminConfig) : getApp();
export const adminDb = getFirestore(adminApp);
```

**Source:** [Firebase docs: Add Admin SDK](https://firebase.google.com/docs/admin/setup), [Makerkit: Server-only code in Next.js](https://makerkit.dev/blog/tutorials/server-only-code-nextjs)

### Pattern 4: Subcollection Security Rules for Privacy Boundary
**What:** Define explicit security rules for subcollections using nested `match` statements. Subcollections do NOT inherit parent rules. [CITED: firebase.google.com/docs/firestore/security/rules-structure]

**When to use:** Any sensitive data that needs different access control than parent document. Here: D-03 requires viewers can read `purchaseStatus` but children cannot.

**Why it matters:** This is the irreversible privacy boundary. If rules are wrong, children see purchase data (breaking feature requirement WISH-08). If wrong, migration is extremely high cost. Must test via emulator (D-12).

**Rule template:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Items subcollection: child-readable, child-writable
    match /wishlists/{wishlistId}/items/{itemId} {
      allow read, write: if request.auth.uid == resource.data.childUid;
    }
    
    // Purchase status: viewer-only, explicitly deny child
    match /wishlists/{wishlistId}/purchaseStatus/{itemId} {
      allow read, write: if request.auth.uid in resource.data.viewerUids;
      // Implicit: child UIDs are NOT in viewerUids, so read/write denied
    }
  }
}
```

**Source:** [Firebase docs: Structure security rules](https://firebase.google.com/docs/firestore/security/rules-structure), [Firebase blog: Code review security rules](https://firebase.blog/posts/2021/01/code-review-security-rules/)

### Pattern 5: Environment Variables for Firebase Config
**What:** Store Firebase client config in `.env.local` with `NEXT_PUBLIC_FIREBASE_*` prefix. Admin credentials via separate env vars (never `NEXT_PUBLIC`).

**When to use:** All Firebase initialization — client config must be public (embedded in browser), admin credentials must be server-only.

**Why it matters:** Firebase config (API key, project ID) is intentionally public; it doesn't grant access. But admin credentials are secret and must never leak to browser. [CITED: nextjs.org/docs/pages/guides/environment-variables]

**Example `.env.local`:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=wishlist-abc.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=wishlist-abc
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=wishlist-abc.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789...
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789...appspot

# Server-only (NOT NEXT_PUBLIC)
FIREBASE_PROJECT_ID=wishlist-abc
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@wishlist-abc.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
```

**Source:** [Firebase docs: Configure environment](https://firebase.google.com/docs/functions/config-env), [MakerKit: Environment variables Next.js + Firebase](https://makerkit.dev/docs/next-fire/tutorials/environment-variables)

### Anti-Patterns to Avoid
- **Direct browser-bundle Admin SDK:** Importing `firebase-admin` in client code will fail at build time or runtime. Always use client SDK for browser, Admin SDK only in API routes/Server Components.
- **Forgetting onSnapshot cleanup:** Leaving listeners attached after component unmount leaks memory and connections. Always return cleanup function from useEffect.
- **Assuming subcollection rules inherit:** Firestore rules apply only at the matched path. A rule on `wishlists/{id}` does NOT apply to `wishlists/{id}/items/{id}`. Each level needs explicit rules. [CITED: firebase.google.com/docs/firestore/security/rules-structure]
- **Publishing admin credentials:** Using `NEXT_PUBLIC_FIREBASE_ADMIN_*` or storing credentials in `.env` (which could be committed) exposes secret keys. Admin creds must stay server-only.
- **Hydration mismatch with Firestore:** Rendering server-side data that includes timestamps or UIDs that change between server and client. Use `useEffect` + client-side state for Firestore data. [CITED: nextjs.org/docs/messages/react-hydration-error]
- **Not testing rules before production:** The privacy boundary is non-negotiable. Emulator tests (D-12) must pass before Phase 1 is signed off. Security rules are not "implementation details" — they are the contract with users.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-instance Firebase app initialization | Custom singleton pattern with checks | Firebase `getApps()` / `getApp()` guard | Built-in pattern handles HMR, SSR re-renders, and edge cases. Hand-rolled singletons miss edge cases. |
| Real-time database listeners | setTimeout polling or manual WebSocket | Firestore `onSnapshot()` | Built-in handles reconnection, batching, and cleanup. Polling is inefficient; WebSocket manual coding is fragile and hard to test. |
| Security rule testing | Manual emulator tests with curl | `@firebase/rules-unit-testing` library | Library handles auth mocking, test setup, and assertions. Manual testing is brittle and easy to miss edge cases (e.g., role-based denies). |
| Server/client code separation | Manual import guards or comments | `'server-only'` package | Package adds build-time verification. Comments and manual checks fail silently and are easy to regress. |
| Firestore schema versioning | Custom version fields in documents | Firestore indexes + security rules versioning | Firestore is schemaless; versioning is enforced via rules and indexes, not documents. Custom fields add clutter and bugs. |

**Key insight:** Firestore and Firebase SDKs are mature and well-tested. Everything in the "Don't Build" column has standard library solutions that are simpler, more secure, and less error-prone than custom code.

## Common Pitfalls

### Pitfall 1: Subcollection Rules Not Applied to Child Access
**What goes wrong:** You write a rule on the parent collection (`wishlists/{id}`) and assume it applies to subcollections (`wishlists/{id}/purchaseStatus/{id}`). Child UIDs are denied on parent but accidentally allowed on subcollection, breaking the privacy boundary.

**Why it happens:** Firestore rules are path-matched, not hierarchical. Many developers assume inheritance (like file system permissions) but rules are explicit per path. [CITED: firebase.google.com/docs/firestore/security/rules-structure]

**How to avoid:** Always write explicit `match` statements for each subcollection path. In D-12 security rule tests, verify that a child UID cannot read/write `purchaseStatus` documents. The emulator test MUST pass before Phase 1 is done.

**Warning signs:** 
- Security rule tests not covering subcollection access
- Child UID able to query or see `purchaseStatus` in DevTools Firestore tab
- Tests only checking top-level collections

### Pitfall 2: Multiple Firebase App Instances in Next.js
**What goes wrong:** Without `getApps()` guard, code calls `initializeApp()` every time the module is imported. In Next.js, module imports happen on every render (dev/SSR), causing "Firebase app already exists [DEFAULT]" errors that crash the app.

**Why it happens:** Developers unfamiliar with Next.js HMR and SSR re-render all modules. The guard is required infrastructure, not optional. [CITED: github.com/firebase/firebase-tools/issues/9061]

**How to avoid:** Always use the guard pattern: `getApps().length === 0 ? initializeApp(config) : getApp()`. This is non-negotiable for Phase 1 `lib/firebase/client.ts` (D-05).

**Warning signs:**
- Build errors mentioning "[DEFAULT]" app already exists
- HMR stops working after Firebase init
- getApps() returns array of multiple apps instead of one

### Pitfall 3: Client Components Trying to Use Admin SDK
**What goes wrong:** A developer imports `lib/firebase/admin.ts` (which uses Admin SDK) in a client component. The Admin SDK cannot serialize to JSON (it has Node.js-only dependencies), so Next.js build fails with cryptic bundling errors.

**Why it happens:** File names are ambiguous (`admin.ts` could be Admin UI, not Admin SDK). Without build-time enforcement, mistakes happen. [CITED: nextjs.org/docs/app/getting-started/server-and-client-components]

**How to avoid:** `import 'server-only'` at the top of `lib/firebase/admin.ts` (D-06). This causes a build-time error if the file is ever imported in client code. No surprises at runtime.

**Warning signs:**
- Build errors about serializing Admin SDK objects
- Cryptic "Cannot find module" errors in browser DevTools
- Admin SDK code appearing in browser bundle

### Pitfall 4: Forgetting onSnapshot Unsubscribe
**What goes wrong:** A client component mounts a listener but doesn't clean up when unmounting. Listeners accumulate in memory, and connections to Firestore are never closed, leading to slowdowns, eventual crashes, and wasted quota.

**Why it happens:** Developers new to React hooks forget that Firestore listeners are resources (like event listeners, timers) that must be explicitly cleaned up in useEffect return. [CITED: firebase.google.com/docs/firestore/query-data/listen]

**How to avoid:** Always store the return value of `onSnapshot()` and call it in useEffect cleanup: `return () => unsubscribe();`. ESLint rules can catch missing cleanup.

**Warning signs:**
- Memory usage climbing over time
- Browser DevTools showing hundreds of pending Firestore connections
- Tests passing but production degrading
- Firestore showing unexpectedly high listener counts in console

### Pitfall 5: Firestore Config Leaked in Environment
**What goes wrong:** Firebase client config is committed to `.env` (which may be committed to git) or `NEXT_PUBLIC_FIREBASE_*` vars are used for admin credentials, leaking secrets to the browser.

**Why it happens:** Developers confuse "Firebase config" (intentionally public) with "Firebase credentials" (secret). They use a single `.env` file for everything.

**How to avoid:** `.env.local` is never committed (add to `.gitignore`). Client config uses `NEXT_PUBLIC_*` prefix (intentionally public). Admin credentials use plain env vars without `NEXT_PUBLIC_` prefix and are set in deployment environment, never in `.env` files. See Pattern 5 for example.

**Warning signs:**
- `.env` file committed to git
- Env vars with admin credentials in source
- Browser console exposing `FIREBASE_ADMIN_*` variables

### Pitfall 6: SSR/Hydration Mismatch with Firestore Data
**What goes wrong:** A page renders on the server without Firestore data (server can't authenticate to Firestore), then the client renders with Firestore data. React detects a mismatch and logs a hydration error or renders twice with different content.

**Why it happens:** Firestore is client-auth based. Server-side rendering doesn't have a user context, so servers cannot fetch Firestore data. Developers try to fetch data server-side and hit this wall. [CITED: nextjs.org/docs/messages/react-hydration-error]

**How to avoid:** Firestore data always loads client-side with `useEffect` + `onSnapshot()`. Never try to fetch Firestore documents in Server Components or during SSR. If you need server-side data, use Admin SDK in API routes and fetch via HTTP.

**Warning signs:**
- Hydration mismatch warnings in Next.js dev console
- Content flickering/changing on page load
- Trying to use `onSnapshot()` in a Server Component (TypeScript error)

## Code Examples

Verified patterns from official sources for common Phase 1 tasks:

### Initialize Client Firebase with Guard
```typescript
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
```

**Source:** [Firebase docs: Integrate Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs)

### Initialize Admin Firebase with server-only Guard
```typescript
// src/lib/firebase/admin.ts
import 'server-only';

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    : getApp();

export const adminDb = getFirestore(adminApp);
```

**Source:** [Firebase docs: Add Admin SDK](https://firebase.google.com/docs/admin/setup)

### Real-time Listener PoC (D-14: /test Route)
```typescript
// src/app/test/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function TestPage() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'wishlists', 'test-wishlist-id');
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h1>Firestore Real-time Test</h1>
      {loading && <p>Loading...</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

**Source:** [Firebase docs: Get realtime updates](https://firebase.google.com/docs/firestore/query-data/listen)

### Firestore Security Rules Unit Test (D-12 Requirement)
```typescript
// tests/firestore.rules.test.ts
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules - Privacy Boundary', () => {
  let testEnv: any;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'wishlist-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('child UID cannot read purchaseStatus subcollection', async () => {
    const childUid = 'child-123';
    const docRef = doc(testEnv.authenticatedContext(childUid).firestore(), 
                       'wishlists', 'test-id', 'purchaseStatus', 'item-1');
    
    // This should fail because child is not in viewerUids
    await assertFails(getDoc(docRef));
  });

  it('viewer UID can read purchaseStatus if in viewerUids', async () => {
    const viewerUid = 'viewer-123';
    const docRef = doc(testEnv.authenticatedContext(viewerUid).firestore(),
                       'wishlists', 'test-id', 'purchaseStatus', 'item-1');
    
    // Write test data first (without rules)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('wishlists').doc('test-id')
        .collection('purchaseStatus').doc('item-1')
        .set({ itemId: 'item-1', viewerUids: [viewerUid] });
    });

    // Now read should succeed
    await assertSucceeds(getDoc(docRef));
  });
});
```

**Source:** [Firebase docs: Build unit tests](https://firebase.google.com/docs/rules/unit-tests), [Firebase GitHub: quickstart-testing](https://github.com/firebase/quickstart-testing)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual initializeApp calls on each import | Guard pattern: `getApps().length === 0 ? initializeApp(...) : getApp()` | ~2020 with Firebase v9 modular SDK | Prevents multiple app instances; required for Next.js HMR |
| Custom Firestore singleton wrapper | Standard Firebase client/admin module pattern | ~2021 with Next.js 12 server components | Cleaner separation; leverages Next.js build-time checks |
| Hand-written security rules without testing | Unit tests via `@firebase/rules-unit-testing` library | ~2020 with Firebase Emulator Suite GA | Catches privacy bugs before production; rules are testable code |
| Firebase config in .env (committed to git) | .env.local (gitignored) + NEXT_PUBLIC_ prefix for public config | ~2019 with Next.js env var support | Prevents credential leaks; separates public config from secrets |
| onSnapshot without cleanup handling | Proper useEffect cleanup with unsubscribe | ~2018 with React hooks adoption | Prevents memory leaks and connection accumulation |

**Deprecated/outdated:**
- **Firebase Realtime Database:** Firestore is the modern choice for new projects (better querying, transactions, offline support). [ASSUMED]
- **Custom claims approach without Custom Token:** Use Firebase Auth custom claims + Admin SDK for role enforcement. [CITED: firebase.google.com/docs/rules/rules-and-auth]
- **compat SDK (firebase/compat):** Modular SDK (v9+) is the current approach. Compat is for legacy projects. [VERIFIED: npm registry — latest Firebase is modular only]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | User has access to Firebase Console to create a Firebase project and retrieve config values | Standard Stack, Environment Variables | If user cannot access Console, they cannot get API keys or service account. Phase would be blocked. **Mitigation:** Confirm Firebase project exists before Phase execution. |
| A2 | Node.js 18+ is available in target environment (required by firebase-tools and firebase-admin) | Standard Stack | Old Node.js versions incompatible with Admin SDK v13. Build would fail. **Mitigation:** Verify Node.js version in environment audit step. |
| A3 | `.gitignore` already excludes `.env.local` | Security Patterns | If .env.local is committed, admin credentials are exposed. **Mitigation:** Explicitly configure .gitignore in first task of Phase. |

## Open Questions

1. **Firebase Project ID and Configuration**
   - What we know: Context.md states "Firebase project ID and naming" is Claude's discretion
   - What's unclear: Will the user provide an existing Firebase project ID, or should tasks create a new project?
   - Recommendation: Ask user during plan phase: "Do you have an existing Firebase project ID, or should we create one?"

2. **Service Account Credentials Format**
   - What we know: D-07 mentions `FIREBASE_ADMIN_SDK_KEY` as JSON string or file path
   - What's unclear: Which format does user prefer? (JSON string in env var, or path to file?)
   - Recommendation: Support both patterns; default to file path for local dev, env var JSON for CI/production

3. **Firestore Emulator Port Configuration**
   - What we know: D-11 specifies ports 8080 (Firestore) and 9099 (Auth)
   - What's unclear: Are these ports available on user's machine?
   - Recommendation: Emulator setup task should check port availability and offer to change if needed

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm packages, firebase-tools | ✓ (assumed) | 18+ required | — |
| npm | Package installation | ✓ (assumed) | 8+ required | — |
| Java Runtime (JRE) | Firestore emulator | ? (not checked) | 11+ required | Cannot run emulator without JRE |
| Google Chrome / Firefox | Testing emulator UI | ✓ (assumed) | any recent | Safari may work but untested |

**Missing dependencies with no fallback:**
- Java Runtime: Required to run Firestore emulator. If not available, cannot test security rules locally (D-12 requirement). User must install JRE or skip emulator tests.

**Missing dependencies with fallback:**
- Firestore emulator UI: If emulator UI unavailable, can still test rules via command line with `firebase emulators:exec` (slightly lower visibility but functional).

## Sources

### Primary (HIGH confidence)
- [Firebase docs: Integrate Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs) — SDK initialization patterns, getApps guard
- [Firebase docs: Structure security rules](https://firebase.google.com/docs/firestore/security/rules-structure) — Subcollection rules, path matching, privacy patterns
- [Firebase docs: Get realtime updates](https://firebase.google.com/docs/firestore/query-data/listen) — onSnapshot patterns, cleanup
- [Firebase docs: Add Admin SDK](https://firebase.google.com/docs/admin/setup) — Admin SDK initialization, credentials
- [Firebase docs: Build unit tests](https://firebase.google.com/docs/rules/unit-tests) — @firebase/rules-unit-testing library
- [npm registry: next@16.2.2](https://www.npmjs.com/package/next), [firebase@12.11.0](https://www.npmjs.com/package/firebase), [firebase-admin@13.7.0](https://www.npmjs.com/package/firebase-admin) — Current versions verified 2026-04-06
- [Next.js docs: Module Path Aliases](https://nextjs.org/docs/13/app/building-your-application/configuring/absolute-imports-and-module-aliases) — @/ path alias configuration
- [Next.js docs: Environment Variables](https://nextjs.org/docs/pages/guides/environment-variables) — .env.local, NEXT_PUBLIC_ prefix
- [Next.js docs: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — server-only guard pattern

### Secondary (MEDIUM confidence)
- [WebSearch verified with official sources] Firebase/Next.js SSR hydration patterns
- [WebSearch verified with official sources] Firestore emulator setup and testing
- [WebSearch verified with official sources] Common security rule pitfalls and privacy best practices

### Tertiary (LOW confidence — requires validation)
- [ASSUMED] Java Runtime availability on target environment (not checked; affects emulator ability)
- [ASSUMED] Firebase project already exists or user has Console access to create one

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — All versions verified against npm registry as of 2026-04-06. Packages are current, within 5 days of research date.
- **Architecture patterns:** HIGH — All patterns verified against official Firebase docs and Next.js docs. Examples tested in community projects and official Firebase codelabs.
- **Security rules:** HIGH — Sourced from official Firebase Security Rules docs and Firebase blog code review guide. Privacy boundary pattern matches architecture decisions from CONTEXT.md.
- **Pitfalls:** MEDIUM — Sourced from Firebase docs, GitHub issues, and community blog posts. Logic is sound, but individual projects may have unique edge cases not covered here.
- **Emulator setup:** MEDIUM — Official docs are complete, but Java Runtime requirement not verified on target machine.

**Research date:** 2026-04-06
**Valid until:** 2026-04-20 (Firebase SDK updates regularly; security rules docs are stable; Next.js updates are less frequent but possible). Recheck Standard Stack versions if research is older than 2 weeks.

**Key uncertainties requiring user input:**
- Firebase project ID (existing or new?)
- Service account credentials format preference
- Emulator port availability
- Java Runtime availability
