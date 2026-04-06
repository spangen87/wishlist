# Architecture Research

**Domain:** Real-time family wishlist PWA (Next.js + Firebase)
**Researched:** 2026-04-06
**Confidence:** MEDIUM — based on training knowledge (Aug 2025 cutoff). External docs unavailable during this session. Verify security rules patterns against current Firebase docs before implementing.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / PWA                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Child View  │  │ Viewer View  │  │  Auth / Onboarding   │  │
│  │  (no status) │  │ (full status)│  │  (register/login)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └─────────────────┴──────────────────────┘              │
│                        React Client Components                   │
│              (Firestore real-time listeners via SDK)             │
├─────────────────────────────────────────────────────────────────┤
│                     Next.js App Router                           │
│  ┌─────────────────────────┐  ┌───────────────────────────┐    │
│  │  Server Components      │  │  API Routes / Actions     │    │
│  │  (initial render, SSR)  │  │  (share link, admin ops)  │    │
│  └─────────────────────────┘  └───────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                        Firebase                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Firestore   │  │  Auth        │  │  (optional) Functions│  │
│  │  (data+rules)│  │  (UID+claims)│  │  (activity log hook) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Child View | Display wishlist items without purchase/note data | Client component + Firestore listener on `items` subcollection; purchase fields excluded server-side (see below) |
| Viewer View | Full list with purchased status, notes, activity | Client component + Firestore listener on same `items` + `activity` subcollection |
| Auth layer | Firebase Auth sessions, custom claims for role | Firebase Auth + `onIdTokenChanged` listener in client context provider |
| Server Components | Initial page shell, metadata, share-link landing | Next.js RSC — no Firestore real-time here; hand off to client boundary |
| API Routes | Share link redemption, admin account creation | Next.js Route Handlers using Firebase Admin SDK |
| Security Rules | Enforce data access at DB layer | Firestore rules file — sole enforcement point |

---

## Firestore Data Model

### Collections and Documents

```
users/{userId}
  - uid: string
  - role: "child" | "viewer"
  - displayName: string
  - createdAt: timestamp

wishlists/{wishlistId}
  - childUserId: string          # UID of the child who owns this list
  - childName: string            # display name (denormalized for viewer UI)
  - createdAt: timestamp
  - updatedAt: timestamp

  items/{itemId}                 # subcollection of wishlists
    - title: string
    - url: string | null
    - imageUrl: string | null
    - note: string | null        # child's own note
    - price: number | null
    - order: string              # fractional index string (see below)
    - purchasedBy: string | null # viewer userId or null
    - purchasedAt: timestamp | null
    - viewerNote: string | null  # note left by a viewer
    - createdAt: timestamp
    - updatedAt: timestamp

  activity/{activityId}         # subcollection of wishlists
    - action: "purchased" | "unpurchased" | "note_added" | "item_added" | "item_removed"
    - performedBy: string        # userId
    - performedByName: string    # denormalized display name
    - itemId: string
    - itemTitle: string          # denormalized for display
    - timestamp: timestamp

  viewers/{userId}              # subcollection — who has access
    - userId: string
    - joinedAt: timestamp
    - displayName: string        # denormalized

invites/{token}
  - wishlistId: string
  - createdBy: string            # userId of parent who generated link
  - createdAt: timestamp
  - expiresAt: timestamp | null  # null = never expires (v1)
  - usedCount: number
```

**Rationale:**
- Items and activity as subcollections of `wishlists` keeps all wishlist data co-located and allows per-wishlist Firestore rules.
- `viewers` subcollection is the membership roster — rules check `exists(/databases/(default)/documents/wishlists/{wId}/viewers/{uid})`.
- `invites` is a top-level collection keyed by token — share link is `/join/{token}`.
- Denormalizing `childName`, `itemTitle`, `performedByName` avoids extra reads in list views.

---

## Drag-and-Drop Order: Fractional Indexing

**Recommendation: fractional index string (lexicographic).**

**Confidence: HIGH** — this is the established pattern for Firestore drag-and-drop.

### Why not integer order?

Integer order (1, 2, 3...) requires rewriting every document below the insertion point on reorder. At 20 items that is 20 writes. Expensive, race-prone, and burns Firestore free-tier quota.

### Why not array on the wishlist document?

Storing an array of item IDs in the wishlist document allows atomic reorders with a single write, but:
- The document can grow large with metadata embedded
- Firestore document size limit is 1 MB
- Real-time listeners re-read the whole document on any field change

### Fractional indexing string (recommended)

Use a library like `fractional-indexing` (npm) to generate lexicographically-sorted strings between two existing values.

```typescript
// Inserting between "a0" and "a2" → generates "a1"
// Inserting between "a1" and "a2" → generates "a1V"
// No other documents need updating

import { generateKeyBetween } from "fractional-indexing";

// Move item to position between itemA.order and itemB.order
const newOrder = generateKeyBetween(itemA.order, itemB.order);
await updateDoc(itemRef, { order: newOrder });
// Single write, no batch needed
```

**Query:** `collection("wishlists/{id}/items").orderBy("order", "asc")`

Each reorder is exactly 1 document write. No race conditions on order values.

**Initial seed:** Generate sequential keys (`"a0"`, `"a1"`, ...) when items are first created. The `fractional-indexing` package handles key generation safely.

---

## Hiding Purchase Status from Child: The Core Design Challenge

**Confidence: HIGH on Firestore limitation; HIGH on server-side filtering recommendation.**

### Firestore Cannot Hide Individual Fields

Firestore security rules operate at the document level. You cannot write a rule that allows a child to read an `items` document but blocks the `purchasedBy` and `viewerNote` fields. If a child can read the document, they can read all fields.

This means **field-level redaction must happen outside Firestore rules**.

### Two Implementation Strategies

#### Option A: Server-Side Filtering via Next.js API Route (RECOMMENDED)

The child's wishlist page fetches items through a Next.js API route (using Firebase Admin SDK), which strips purchase-related fields before returning the response. The child never receives `purchasedBy`, `purchasedAt`, or `viewerNote`.

```
Child browser
    → GET /api/wishlists/{id}/items (Next.js Route Handler)
    → Firebase Admin SDK reads Firestore (bypasses client rules)
    → Server strips { purchasedBy, purchasedAt, viewerNote }
    → Returns sanitized items array

Viewer browser
    → Firestore client SDK real-time listener (direct)
    → Receives full documents
```

**Trade-off:** Child's view loses real-time updates (polling or manual refresh needed), OR you implement SSE/WebSocket from your own API. For wishlist items (not chat), polling every 30s or a simple refresh button is acceptable in v1.

**Alternatively:** Keep child on real-time listener but strip fields in the client component before rendering. This is simpler but relies on client-side enforcement — a determined child who knows DevTools could inspect the raw Firestore response.

For a family wishlist app targeting non-adversarial children, **client-side stripping is pragmatically acceptable in v1** if the fields are never rendered.

#### Option B: Separate Firestore Documents (purchase shadow doc)

Store purchase state in a separate subcollection `purchaseStatus/{itemId}` that the child's UID cannot read. Viewers query both `items` and `purchaseStatus` and merge them client-side.

```
items/{itemId}           — child can read (title, url, image, price, note, order)
purchaseStatus/{itemId}  — child CANNOT read (purchasedBy, purchasedAt, viewerNote)
```

Security rules enforce this cleanly — no server-side stripping needed.

**Trade-off:** Every item requires 2 reads. Viewer must merge two collections. More complex queries.

### Recommendation

**Use Option B (separate purchaseStatus subcollection) for clean Firestore-native enforcement.** It's the only approach that prevents a tech-savvy child from seeing purchase data via DevTools. Option A (client-side strip) is acceptable for v1 if you accept the tradeoff.

---

## Firebase Security Rules

**Confidence: HIGH on patterns; verify exact syntax against current Firebase docs.**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isChild() {
      return request.auth.token.role == "child";
    }

    function isViewer() {
      return request.auth.token.role == "viewer";
    }

    function isWishlistOwner(wishlistId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/wishlists/$(wishlistId)).data.childUserId
          == request.auth.uid;
    }

    function isWishlistViewer(wishlistId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/wishlists/$(wishlistId)/viewers/$(request.auth.uid));
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    // Wishlists
    match /wishlists/{wishlistId} {
      allow read: if isWishlistOwner(wishlistId) || isWishlistViewer(wishlistId);
      allow create: if isSignedIn() && isViewer(); // only parents create wishlists
      allow update: if isWishlistViewer(wishlistId); // viewers can update metadata
      allow delete: if isWishlistViewer(wishlistId);

      // Items subcollection
      match /items/{itemId} {
        // Child can read items (purchase fields stored in purchaseStatus, not here)
        allow read: if isWishlistOwner(wishlistId) || isWishlistViewer(wishlistId);
        // Only the child who owns the list can add/edit items
        allow write: if isWishlistOwner(wishlistId);
      }

      // Purchase status — viewers only, child cannot read
      match /purchaseStatus/{itemId} {
        allow read, write: if isWishlistViewer(wishlistId);
        // Explicitly deny child (belt-and-suspenders)
        allow read, write: if isWishlistOwner(wishlistId) == false;
      }

      // Activity log — viewers can read and write, child cannot
      match /activity/{activityId} {
        allow read: if isWishlistViewer(wishlistId);
        allow create: if isWishlistViewer(wishlistId);
        allow update, delete: if false; // activity is append-only
      }

      // Viewers subcollection
      match /viewers/{viewerId} {
        allow read: if isWishlistOwner(wishlistId) || isWishlistViewer(wishlistId);
        // New viewer can add themselves (share link redemption via API route is safer)
        allow create: if isSignedIn() && request.auth.uid == viewerId;
        allow delete: if isWishlistViewer(wishlistId) || request.auth.uid == viewerId;
      }
    }

    // Invites — only readable by the server (Admin SDK) or by the bearer of the token
    match /invites/{token} {
      allow read: if false; // API route reads via Admin SDK only
      allow write: if false;
    }
  }
}
```

### Custom Claims for Roles

Store `role: "child" | "viewer"` in Firebase Auth custom claims. Set via Firebase Admin SDK in an API route during account creation. Rules then check `request.auth.token.role` without a Firestore read.

```typescript
// In Next.js API Route (server-side, Admin SDK)
import { getAuth } from "firebase-admin/auth";

await getAuth().setCustomUserClaims(uid, { role: "child" });
```

**Important:** Custom claims are embedded in the ID token. After setting claims, the client must force-refresh the token: `await user.getIdToken(true)`.

---

## Auth: Child Account Pattern

**Confidence: MEDIUM** — Firebase does not have a built-in "child account under parent" concept. This is the standard workaround.

### Problem

Children may not have email addresses. Firebase Auth requires an identifier — email/password is the simplest flow.

### Recommended Approach

A parent (viewer account) creates a child account by calling a Next.js API route with Firebase Admin SDK. The API creates a Firebase Auth user with a synthetic email (e.g., `{childName}-{random}@wishlist.internal`) and a parent-chosen password. The child logs in with their chosen username — the UI maps username → synthetic email before calling `signInWithEmailAndPassword`.

```
Parent flow:
1. POST /api/admin/create-child  { childName, password }
   → Admin SDK creates Firebase Auth user with synthetic email
   → Admin SDK sets custom claim { role: "child" }
   → Creates /users/{uid} doc and /wishlists/{newId} doc
   → Returns { wishlistId, childLoginName }

Child flow:
1. Child visits /login, types their name + password
2. Client maps name → synthetic email via /api/auth/resolve-username
   (or stores username→uid mapping in /usernames/{username} doc)
3. signInWithEmailAndPassword(auth, syntheticEmail, password)
```

**Alternative:** Firebase Auth anonymous accounts for children (no password). Child gets a persistent token stored in localStorage. Parent links wishlist to that anonymous UID. Simpler but fragile (clearing browser data = lost access).

**Username → email mapping:** Store a top-level `usernames/{username}` collection with `{ uid, syntheticEmail }`. Rules: public read (needed for login lookup), write only via Admin SDK.

---

## Share Link Implementation

**Confidence: HIGH** — standard token-based pattern for Firebase apps.

### Flow

```
1. Viewer (parent) clicks "Create share link"
   → POST /api/wishlists/{id}/invite
   → API Route generates crypto.randomUUID() token
   → Writes invites/{token} = { wishlistId, createdBy, createdAt }
   → Returns share URL: https://app.example.com/join/{token}

2. Recipient visits /join/{token}
   → Page reads token from URL param
   → If not authenticated → redirect to /login?next=/join/{token}
   → If authenticated → POST /api/join/{token}
      → Admin SDK reads invites/{token} (bypassing client rules)
      → Validates token exists and not expired
      → Writes wishlists/{wishlistId}/viewers/{uid} = { userId, joinedAt, displayName }
      → Sets custom claim if not already viewer
      → Redirects to /wishlists/{wishlistId}
```

**Why invites are Admin-SDK-only:** Prevents enumeration attacks. Client rules deny all reads to `invites/{token}` — only the server can validate.

**Token entropy:** `crypto.randomUUID()` gives 122 bits of entropy. Sufficient.

---

## Next.js App Router + Firebase Patterns

**Confidence: MEDIUM** — App Router + Firebase is a known combination but patterns were still evolving as of mid-2025.

### Server Components vs. Client Components

| Use Case | Component Type | Rationale |
|----------|----------------|-----------|
| Initial page shell, metadata, layout | Server Component | SEO, fast initial render, no Firebase SDK needed |
| Wishlist item list (real-time) | Client Component | Firestore `onSnapshot` requires browser SDK |
| Auth state (logged in user) | Client Component | `onAuthStateChanged` is browser-only |
| Share link landing `/join/{token}` | Server Component → redirect | Token validated server-side via Admin SDK; then redirect |
| API mutations (mark purchased, add item) | Server Action or Route Handler | Can use either; Route Handler easier to unit test |

### Firebase SDK Split

Use two separate Firebase initializations:

```typescript
// lib/firebase/client.ts — browser only, imported in "use client" files
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const app = getApps().length ? getApps()[0] : initializeApp(clientConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// lib/firebase/admin.ts — server only, imported in Route Handlers / Server Actions
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const adminApp = getApps().find(a => a.name === "admin") ??
  initializeApp({ credential: cert(serviceAccountJson) }, "admin");

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
```

**Never import `firebase-admin` in a Client Component** — it will break the build. Use the `server-only` package to enforce this:

```typescript
// lib/firebase/admin.ts
import "server-only";
```

### Auth Session Pattern

Firebase Auth tokens are managed in the browser. For Server Components to know the current user, use a session cookie (Firebase recommends this pattern):

1. After `signInWithEmailAndPassword` on client, call a Route Handler with the ID token.
2. Route Handler verifies the token via Admin SDK, creates a session cookie with `adminAuth.createSessionCookie()`.
3. Subsequent requests include the cookie; Server Components can call `adminAuth.verifySessionCookie()`.

This is only needed if Server Components need to know the user identity (e.g., for server-side data fetching). For a real-time app where most reads happen client-side via Firestore SDK, this is optional in v1.

---

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Route group — unauthenticated
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                  # Route group — authenticated
│   │   ├── layout.tsx          # Auth guard, nav
│   │   ├── wishlists/
│   │   │   ├── page.tsx        # Viewer: list of children's wishlists
│   │   │   └── [wishlistId]/
│   │   │       ├── page.tsx    # Server shell
│   │   │       └── WishlistClient.tsx  # "use client" real-time component
│   │   └── child/
│   │       └── page.tsx        # Child's own wishlist view
│   ├── join/
│   │   └── [token]/page.tsx    # Share link redemption
│   └── api/
│       ├── auth/
│       │   ├── session/route.ts        # Create/verify session cookie
│       │   └── resolve-username/route.ts
│       ├── admin/
│       │   └── create-child/route.ts   # Parent creates child account
│       ├── wishlists/
│       │   └── [wishlistId]/
│       │       └── invite/route.ts     # Generate share link
│       └── join/
│           └── [token]/route.ts        # Redeem invite token
├── components/
│   ├── wishlist/
│   │   ├── WishlistItem.tsx     # Single item (child view)
│   │   ├── WishlistItemViewer.tsx  # Single item (viewer view, with purchase toggle)
│   │   ├── AddItemForm.tsx
│   │   └── DraggableList.tsx    # DnD wrapper
│   ├── activity/
│   │   └── ActivityLog.tsx
│   └── ui/                     # Shared design system components
├── lib/
│   ├── firebase/
│   │   ├── client.ts            # Browser Firebase SDK init
│   │   └── admin.ts             # Server Firebase Admin SDK init
│   ├── firestore/
│   │   ├── wishlists.ts         # Firestore query helpers
│   │   ├── items.ts
│   │   └── activity.ts
│   └── auth/
│       └── session.ts           # Session cookie helpers
├── hooks/
│   ├── useWishlistItems.ts      # Firestore real-time listener hook
│   ├── useActivity.ts
│   └── useAuth.ts
└── types/
    ├── wishlist.ts
    ├── user.ts
    └── activity.ts
```

---

## Data Flow

### Child Adding an Item

```
Child types item form → AddItemForm (client)
    → addDoc("wishlists/{id}/items", { title, url, ..., order: generateKeyBetween(...) })
    → Firestore rules: isWishlistOwner() = true → allowed
    → onSnapshot listener fires on all connected clients
    → WishlistClient re-renders item list in order
```

### Viewer Marking Item Purchased

```
Viewer clicks "Mark purchased" → WishlistItemViewer (client)
    → batch write:
        setDoc("wishlists/{id}/purchaseStatus/{itemId}", { purchasedBy, purchasedAt })
        addDoc("wishlists/{id}/activity", { action: "purchased", performedBy, itemId, ... })
    → Firestore rules: isWishlistViewer() = true → allowed
    → Viewer's onSnapshot updates immediately
    → Child's listener on "items" subcollection: unaffected (no items doc changed)
```

### Share Link Redemption

```
User visits /join/{token}
    → Next.js Server Component
    → If unauthenticated → redirect to /login?next=/join/{token}
    → POST /api/join/{token} (Route Handler)
        → Admin SDK reads invites/{token}
        → Validates: exists, not expired
        → Admin SDK writes viewers/{uid}
        → Sets custom claim role: "viewer" if not set
        → Returns { wishlistId }
    → Client redirects to /wishlists/{wishlistId}
```

### Drag-and-Drop Reorder

```
User drags item to new position → DraggableList (client)
    → Compute newOrder = generateKeyBetween(prevItem.order, nextItem.order)
    → updateDoc("wishlists/{id}/items/{itemId}", { order: newOrder })
    → Single Firestore write
    → All connected clients reorder via sorted onSnapshot
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users | Current architecture; Firestore free tier (50k reads/day, 20k writes/day). Monitor quota. |
| 500-5k users | Add Firestore bundle caching for initial page load. Consider read cost from `exists()` calls in rules. |
| 5k+ users | Denormalize role into wishlist membership docs to eliminate `get()` calls in rules (billed reads). Consider Firebase Functions for activity log writes to avoid client trust issues. |

### Free Tier Pressure Points

- Security rules using `get()` and `exists()` count as document reads. At scale, the viewer membership check (`exists(.../viewers/{uid})`) fires on every item read.
- **Mitigation:** Include the viewer's role in a custom claim and embed wishlistIds the viewer has access to in the claim (up to 1000 bytes). Rules then check the claim without a DB read.
- Firestore free tier: 1 GB storage, 50k reads/day, 20k writes/day, 20k deletes/day.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Purchase State in the Items Document

**What people do:** Add `purchasedBy` and `viewerNote` directly to the `items/{itemId}` document.

**Why it's wrong:** Firestore rules cannot hide individual fields — if the child can read the item (which they must), they can read all fields including purchase state. There is no field-level security in Firestore.

**Do this instead:** Store purchase state in a separate `purchaseStatus/{itemId}` subcollection with rules that deny child reads.

---

### Anti-Pattern 2: Integer Order with Full-List Rewrites

**What people do:** Use `order: 1, 2, 3...` and on drag-and-drop, rewrite all items with new sequential integers.

**Why it's wrong:** A wishlist with 30 items triggers 30 Firestore writes per reorder. At free tier limits, a single active family could exhaust the daily write quota.

**Do this instead:** Use fractional indexing — each reorder is 1 write, regardless of list size.

---

### Anti-Pattern 3: Using Firebase Admin SDK in Client Components

**What people do:** Import `firebase-admin` in a Next.js component that isn't server-only.

**Why it's wrong:** The Admin SDK requires a service account private key. Bundling it client-side exposes the key and gives anyone full database access.

**Do this instead:** Keep Admin SDK strictly in Route Handlers and Server Actions. Add `import "server-only"` to the admin init file.

---

### Anti-Pattern 4: Skipping Activity Log Atomicity

**What people do:** Write the activity log entry in a separate `addDoc` call after the main mutation.

**Why it's wrong:** If the second write fails, the action is recorded in Firestore but not in the log (or vice versa). The log diverges from reality.

**Do this instead:** Use a Firestore `writeBatch` to write both the mutation and the activity entry atomically.

---

### Anti-Pattern 5: Invite Token Validation Client-Side

**What people do:** Read `invites/{token}` from the client SDK and handle redemption in the browser.

**Why it's wrong:** Client SDK rules can't prevent enumeration of token IDs if any read is allowed. Even with rules blocking reads, redemption logic in the client can be bypassed.

**Do this instead:** Route all invite redemption through a Next.js API Route using the Admin SDK. Firestore rules deny all client reads to the `invites` collection.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Firebase Auth | Client SDK `signInWithEmailAndPassword` + Admin SDK `verifySessionCookie` | Two SDK instances required; never mix |
| Firestore (real-time) | Client SDK `onSnapshot` in custom hooks | Always unsubscribe in useEffect cleanup |
| Firestore (mutations) | Client SDK `addDoc`/`updateDoc`/`writeBatch` from client components | Use batch for atomic multi-doc operations |
| Firestore (server reads) | Admin SDK in Route Handlers | Bypasses security rules — validate manually |
| `fractional-indexing` (npm) | Called locally in DnD handler | Pure function, no network |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client Component ↔ Firestore | Direct via client SDK + security rules | Real-time for reads; direct writes for mutations |
| Server Component / Route Handler ↔ Firestore | Admin SDK, no rules | Must manually authorize |
| Child view ↔ purchase data | Separate subcollection (`purchaseStatus`) | Enforced by Firestore rules |
| Share link ↔ invite validation | Route Handler only (Admin SDK) | Client never reads invites collection |
| Activity log ↔ mutations | `writeBatch` in client SDK | Atomic; both or neither |

---

## Sources

- Firebase Firestore data model documentation (training knowledge, Aug 2025)
- Firebase Security Rules field-level limitation (well-established platform constraint — HIGH confidence)
- `fractional-indexing` npm package pattern (widely used in collaborative editing tools — HIGH confidence)
- Next.js App Router + Firebase Admin SDK "server-only" pattern (HIGH confidence, official Next.js recommendation)
- Firebase Auth session cookie pattern (HIGH confidence, official Firebase docs pattern)
- Firebase free tier quotas: 50k reads/day, 20k writes/day, 1 GB storage (MEDIUM confidence — verify current limits at firebase.google.com/pricing)

**Note:** External documentation was unavailable during this research session (WebSearch, WebFetch, Bash restricted). All findings are from training knowledge with cutoff August 2025. Before implementing security rules, verify current Firestore rules syntax at firebase.google.com/docs/firestore/security/get-started.

---
*Architecture research for: Real-time family wishlist PWA*
*Researched: 2026-04-06*
