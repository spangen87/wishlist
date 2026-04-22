# Architecture
_Last updated: 2026-04-22_

## Summary

This is a Next.js 16 (App Router) application backed by Firebase (Firestore + Auth). It follows a layered client/server architecture: React Server Components are used for the shell only; all data-bound pages are `'use client'` components that subscribe to Firestore in real time via the Firebase client SDK. Sensitive operations — role assignment, invite redemption, purchase status writes, and all cascade deletes — are routed through Next.js Route Handlers that execute exclusively with the Firebase Admin SDK. Authorization is enforced at two levels: Firestore security rules for direct client reads, and `adminAuth.verifyIdToken()` in every Route Handler for mutating operations.

---

## High-Level Pattern

**Layered client-server with a real-time client data layer.**

- The root layout (`src/app/layout.tsx`) is a React Server Component. It wraps all children in `<AuthProvider>`, which is a `'use client'` context.
- All page-level components are `'use client'`. They use Firebase's `onSnapshot` listeners for live data and `fetch()` to call API routes for privileged writes.
- Route Handlers in `src/app/api/` are the only place where the Admin SDK runs. They are always guarded with `import 'server-only'`.
- There is no tRPC, GraphQL, or custom RPC layer. The API surface is plain REST-style JSON routes.

---

## Layers

**Auth Context (`src/components/AuthProvider.tsx`)**
- Purpose: Expose the current Firebase `User`, their custom claim `role` (`child | viewer | parent`), and a `refreshRole()` function to the entire component tree.
- Pattern: React Context + `onAuthStateChanged`. Role is read from the Firebase ID token claims, not from Firestore, so it is always cryptographically authoritative.
- Consumed via: `useAuth()` hook in every page component.

**Pages (`src/app/**/page.tsx`)**
- All pages are `'use client'` with `useEffect`-based auth guards that redirect unauthenticated users or wrong-role users.
- Data is loaded via Firestore `onSnapshot` listeners (real-time) or one-off `getDoc` calls.
- Privileged mutations go through `fetch('/api/...')` calls; the client always passes the current Firebase ID token in the JSON body.
- Role-based UI differences (parent controls, danger zone) are computed client-side by checking `isParent` membership in `wishlist.parentUids`.

**Library helpers (`src/lib/firebase/`)**
- `client.ts`: Initializes the Firebase client app singleton (HMR-safe). Exports `db` and `auth`.
- `admin.ts`: Initializes the Firebase Admin app singleton (server-only). Exports `adminDb` and `adminAuth`. Supports emulator, service account credential, and Application Default Credential modes.
- `wishlist.ts`: Client-side Firestore helpers for the child's wishlist — `subscribeToItems`, `addWishItem`, `updateItemPosition` (uses `fractional-indexing` for drag-and-drop order), `deleteWishItem`.
- `viewer.ts`: Client-side Firestore helpers for viewers/parents — `subscribeToViewerWishlists`, `subscribeToParentWishlists`, `subscribeToPurchaseStatus`, `subscribeToActivityLog` (paginated, 50 entries).

**Route Handlers (`src/app/api/`)**
- All handlers import `'server-only'` and verify the caller's `idToken` with `adminAuth.verifyIdToken()` before any mutation.
- Pattern: Parse JSON body → verify token → check authorization in Firestore → mutate via Admin SDK batch or transaction → return `NextResponse.json`.
- No session cookies. Authentication state is passed as a bearer-style `idToken` in every request body.

**Types (`src/types/firestore.ts`)**
- Single file defining all Firestore document shapes as TypeScript interfaces. Shared by both client and server code.

---

## Data Flow

### Child viewing their own wishlist (`/wishlist`)
1. `WishlistPage` mounts, calls `getOrCreateWishlist(user.uid)` — creates the wishlist doc if absent (child UID = wishlist ID).
2. `subscribeToItems(wishlistId, ...)` opens an `onSnapshot` listener ordered by `position`.
3. Drag-to-reorder calls `updateItemPosition()` which writes directly to Firestore (child has write permission on `items`).
4. Adding an item calls `addWishItem()` directly via client SDK. Firestore rules permit this for the child owner.

### Viewer/parent viewing a wishlist (`/viewer/[wishlistId]`)
1. Page reads the wishlist doc (`getDoc`) to check `parentUids` membership and fetch the title.
2. `subscribeToItems` and `subscribeToPurchaseStatus` run in parallel via `onSnapshot`.
3. Toggling purchased calls `POST /api/viewer/mark-purchased` — the route verifies the caller is in `viewerUids` or `parentUids`, then writes `purchaseStatus` and an `activityLog` entry atomically via Admin SDK batch.
4. `purchaseStatus` subcollection is invisible to child accounts (Firestore rule: `isViewer || isParent` only).

### Invite redemption (`/invite/[token]`)
1. Unauthenticated user lands on page; shown inline login/register form.
2. After auth, client calls `POST /api/invite/redeem` with the ID token and invite token.
3. Route verifies: token exists, is active, wishlist exists, caller is not the child. Determines `inviteType` (`viewer | parent`).
4. Route calls `adminAuth.setCustomUserClaims()` to set `role`, updates `wishlist.viewerUids` or `wishlist.parentUids`, upserts `users/{uid}`.
5. Client calls `getIdToken(true)` to force-refresh the token, then `refreshRole()` to sync context. Redirects to `/viewer/{wishlistId}`.

### Child account creation (`/onboarding`)
1. Parent (viewer/parent role) fills `ChildAccountForm`.
2. Client posts to `POST /api/auth/register-child` with username, password, displayName, age, and optionally the parent's own ID token.
3. Route runs a Firestore transaction to atomically claim the username slot, then `adminAuth.createUser()`, sets `role: 'child'` claim, batch-writes `users/{uid}`, `usernames/{username}`, and `wishlists/{uid}` (with `parentUids: [callerUid]` if a parent token was provided).

---

## API Design

Plain REST-style JSON routes. No versioning prefix. No shared client library.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register-child` | POST | Create child Auth account + Firestore docs |
| `/api/auth/set-parent-claim` | POST | Promote caller to `role: parent` |
| `/api/auth/set-viewer-claim` | POST | Set `role: viewer` on new registrant |
| `/api/auth/user/[uid]` | DELETE | Delete user account and cascade data |
| `/api/invite/create` | POST | Create viewer invite for a wishlist |
| `/api/invite/create-for-child` | POST | Create viewer invite (called by parent session on behalf of child) |
| `/api/invite/create-for-parent` | POST | Create parent-level invite |
| `/api/invite/current` | GET | Fetch current active invite token |
| `/api/invite/redeem` | POST | Join a wishlist via invite token |
| `/api/invite/regenerate` | POST | Revoke old token and issue new one |
| `/api/viewer/mark-purchased` | POST | Toggle purchased status + write activity log |
| `/api/viewer/update-note` | POST | Write viewer note to `purchaseStatus.viewerNotes` |
| `/api/wishlist/[wishlistId]` | DELETE | Cascade-delete wishlist (Admin SDK `recursiveDelete`) |
| `/api/wishlist/add-item` | POST | Add wish item (parent-session context) |
| `/api/wishlist/update-title` | POST | Set wishlist title |

Authentication pattern: every route receives `idToken` in the JSON body and calls `adminAuth.verifyIdToken(idToken)`. There are no HTTP-only cookies or server-managed sessions.

---

## State Management

No global state library (no Redux, Zustand, Jotai, etc.).

- **Auth state**: React Context via `AuthProvider`. Single source of truth for `user`, `role`, `loading`.
- **Page-local state**: `useState` + `useEffect` in each page component. Firestore `onSnapshot` subscriptions drive updates.
- **Real-time data**: Firestore listeners. Components subscribe on mount, unsubscribe on unmount via the returned unsubscribe function.
- **Derived state**: Computed inline (e.g., `isParent` from `wishlist.parentUids.includes(user.uid)`).

---

## Authentication and Authorization Architecture

**Three roles, enforced at two layers:**

| Role | How assigned | Firestore claim |
|---|---|---|
| `child` | `/api/auth/register-child` | `role: 'child'` |
| `viewer` | `/api/auth/set-viewer-claim` (registration) or `/api/invite/redeem` | `role: 'viewer'` |
| `parent` | `/api/auth/set-parent-claim` or `/api/invite/redeem` with parent token | `role: 'parent'` |

**Layer 1 — Firebase Custom Claims**: Role is stored in the JWT. `AuthProvider` reads it from `getIdTokenResult().claims.role`. Route handlers re-verify it from the token on every request.

**Layer 2 — Firestore Security Rules** (`firestore.rules`):
- `wishlists/{id}` read: allowed if caller is child owner, in `viewerUids`, or in `parentUids`.
- `items` write: child owner or parent only.
- `purchaseStatus` read/write: viewer or parent only — child is explicitly excluded (privacy boundary).
- `activityLog` write: `false` — Admin SDK only.
- `invites`: `read, write: false` — Admin SDK only, client SDK never touches this collection.
- `usernames`: public read, no client write.

**Proxy (`proxy.ts`)**: Next.js 16 proxy file (replaces middleware.ts). Currently passes all requests through — real auth gates are in `AuthProvider` client-side useEffect redirects and Route Handler `verifyIdToken` calls.

---

## Key Design Decisions

**Wishlist ID equals child UID.** `wishlists/{wishlistId}` uses the child's Firebase Auth UID as the document ID. This makes the wishlist deterministically addressable and eliminates a lookup step.

**No server-side session cookies.** Each Route Handler call carries the raw Firebase ID token in the request body. The server validates it fresh on every request. This avoids session management complexity but means every API call incurs a token verification round-trip to Firebase.

**`purchaseStatus` subcollection as privacy boundary.** Purchase coordination data (who bought what, viewer notes) lives in a separate subcollection with a Firestore rule that explicitly excludes the child UID. This is the core privacy invariant of the app.

**Real-time via Firestore `onSnapshot`.** All list views use Firestore listeners rather than polling or server-sent events. Updates propagate immediately across sessions.

**Fractional indexing for item ordering.** `WishItemDoc.position` is a string key from the `fractional-indexing` package. Reordering writes a single Firestore document update (no array rewrite). This is managed in `src/lib/firebase/wishlist.ts`.

**Admin SDK for all sensitive mutations.** Purchase status, activity log, invite management, and user deletion all go through Route Handlers that use the Admin SDK, bypassing Firestore rules. This keeps complex authorization logic server-side.

---

## Gaps & Unknowns

- `proxy.ts` is documented as Next.js 16's replacement for `middleware.ts`, but it currently passes all requests through without enforcing auth. It is unclear whether this is intentional (auth left entirely to client-side guards and Route Handler verification) or a pending phase of work.
- The `src/app/test/page.tsx` file exists but was not read — its purpose is unknown.
- The `src/app/offline/` directory exists (listed in find output) but contains no `page.tsx` — it may be a stub or leftover from an earlier PWA attempt.
- There is no explicit rate limiting on Route Handlers.
- The `src/app/add-child/page.tsx` file was not read — its relationship to `/onboarding` is not confirmed from reading alone.
