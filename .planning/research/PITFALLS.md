# Pitfalls Research

**Domain:** Family wishlist PWA — Next.js App Router + Firebase Firestore + Firebase Auth
**Researched:** 2026-04-06
**Confidence:** MEDIUM (training data through Aug 2025; external verification tools unavailable during this session)

---

## Critical Pitfalls

### Pitfall 1: Firebase SDK Initialized on the Server (Hydration Mismatch / Module Crash)

**What goes wrong:**
The Firebase Client SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`) uses browser globals (`window`, `indexedDB`, `BroadcastChannel`). When Next.js App Router renders a Server Component or calls a Server Action that accidentally imports a file that initializes the client SDK, the build either crashes outright or produces a hydration mismatch where the server-rendered HTML differs from what the client expects.

**Why it happens:**
Developers put `initializeApp()` at module scope in a shared `lib/firebase.ts` file and then import it from both Server Components and Client Components. Next.js executes that module on the server during SSR/RSC, hitting browser-only APIs.

**How to avoid:**
- Keep two separate Firebase initialization files: `lib/firebase-client.ts` (browser only, add `'use client'` guard or lazy-initialize inside a `useEffect`/hook) and `lib/firebase-admin.ts` (server only, using `firebase-admin` SDK).
- Never call `getAuth()`, `getFirestore()`, or `onSnapshot()` from a Server Component or a Server Action.
- Use the `firebase-admin` SDK for any server-side reads (e.g., verifying tokens in middleware, generating invite tokens).
- Mark the client init file with a dynamic import + `ssr: false` if importing it indirectly: `const firebase = dynamic(() => import('../lib/firebase-client'), { ssr: false })`.
- Add a `typeof window === 'undefined'` guard inside the init function as a last resort.

**Warning signs:**
- Build error: `ReferenceError: indexedDB is not defined`
- Hydration error in browser console about mismatched HTML
- Auth state flickering on first load (user appears logged out briefly even when session cookie is present)

**Phase to address:** Authentication / project scaffolding phase (before any real feature work)

---

### Pitfall 2: Firestore Security Rules That Leak Purchase Status to the Child

**What goes wrong:**
The core promise of this app is that children cannot see what has been marked as purchased. If the Firestore security rules allow a child to read the full wish item document (which contains a `purchased: true` field and buyer notes), the child can see that data directly — either via the Firestore console, a browser devtools network tab, or a trivially modified client.

**Why it happens:**
Developers write rules that check the user's role for *write* access but forget to restrict *field-level* read access. Firestore's free-tier rules do not support field-level masking natively: a `get` or `list` permission exposes the entire document.

**How to avoid:**
Split the data model so purchase status lives in a separate sub-collection or a sibling document that children cannot read:
```
/wishlists/{listId}/items/{itemId}          ← child can read (title, link, image, price, note)
/wishlists/{listId}/purchases/{itemId}      ← viewers only (purchased, buyerNote, purchasedBy, purchasedAt)
```
Security rules then simply deny the child's UID read access to the `purchases` sub-collection. Never put `purchased` or `buyerNote` fields on the same document the child reads.

**Warning signs:**
- Single document schema with both `title` and `purchased` fields — red flag at design time
- Rules that say `allow read: if isOwner(listId) || isViewer(listId)` without sub-collection separation

**Phase to address:** Data model + security rules phase (must be decided before any item schema is written)

---

### Pitfall 3: Drag-and-Drop Order Stored as an Index That Conflicts Under Concurrent Edits

**What goes wrong:**
Storing drag-and-drop order as a numeric `position` field (0, 1, 2 …) means two simultaneous reorders produce a write conflict. If viewer A moves item 3 to position 0 at the same moment viewer B moves item 1 to position 0, the last write wins and one reorder is silently discarded. At scale, position values collapse (two items both have `position: 0`).

**Why it happens:**
Developers write a single `batch.update(itemRef, { position: newIndex })` for all items in the new order. Firestore has no compare-and-swap; last write wins.

**How to avoid:**
Use a **fractional indexing** (also called "order key") approach. Each item has a `sortKey` string like `"a0"`, `"m0"`, `"z0"`. Inserting between two items picks the lexicographic midpoint. Libraries: `fractional-indexing` (npm). This means a reorder only writes *one* document (`sortKey` of the dragged item) rather than the entire list. Two concurrent reorders of different items never conflict. Two concurrent reorders of the same item: last write wins, which is acceptable.

Alternatively, store order as an array of IDs on the parent list document (`itemOrder: string[]`) and use a Firestore transaction to read-then-write. Simpler but causes high contention if many reorders happen quickly; also bumps the list document's read/write count.

**Warning signs:**
- Reorder logic that updates `position` on every item in the list in a loop
- No optimistic update + rollback on the client side (users see items jumping back)

**Phase to address:** Wish item CRUD + drag-and-drop phase

---

### Pitfall 4: Child Account Auth — Email Wrapper Creates Orphaned Accounts

**What goes wrong:**
Firebase Auth requires an email address. The common workaround is to create a synthetic email like `child-username@yourapp.internal` and store the real username separately. This works but creates several failure modes: (a) the synthetic email leaks into Firebase console and support emails, (b) the parent creates an account for a username that already exists and gets a confusing `auth/email-already-in-use` error, (c) if the parent resets the child's password they receive an email at the synthetic address, which bounces, (d) username changes require deleting and recreating the auth account, losing the UID and all Firestore data tied to it.

**Why it happens:**
Firebase Auth has no concept of username-only accounts. The email workaround is widely recommended but its edge cases are rarely documented.

**How to avoid:**
- Enforce username uniqueness via a Firestore collection `usernames/{username} → { uid }` with a security rule that prevents overwrite. Check existence before calling `createUserWithEmailAndPassword`.
- Never surface the synthetic email to users anywhere in the UI.
- Store `displayName` (the real username) in the Firestore user profile document, not just in Firebase Auth's `displayName` field (which is volatile).
- For password reset: expose a parent-only "reset child password" flow that calls `updatePassword()` server-side via the Admin SDK, not Firebase's email reset flow.
- Document the `@yourapp.internal` domain so it never gets accidentally configured as a real sending domain in Firebase.

**Warning signs:**
- No uniqueness check for usernames before account creation
- Using Firebase Auth's built-in password reset email flow for child accounts
- No `usernames` collection to prevent duplicates

**Phase to address:** Authentication phase (child account creation flow)

---

### Pitfall 5: Share Link Token With Insufficient Entropy or No Revocation

**What goes wrong:**
A short or predictable share link token allows enumeration attacks — an attacker guessing tokens to join wishlists. Once a viewer joins with a valid token, there is no way to remove them if the link is later shared too broadly (e.g., posted in a public Facebook group by a well-meaning grandparent).

**Why it happens:**
Developers generate tokens like `${listId.slice(0,8)}` or use sequential IDs. Revocation is skipped because "it's just a wishlist."

**How to avoid:**
- Generate tokens using `crypto.randomUUID()` (128-bit, built into Node.js and modern browsers) or `nanoid` with at least 21 characters. Store the token in `wishlists/{listId}/inviteToken`.
- Implement revocation: a "regenerate link" button that writes a new token, invalidating the old one. Any viewer who joined via the old token retains their membership (their UID is in the `viewers` array), but new joins via the old token are rejected.
- The token is checked server-side (or in a Firestore rule) only to add a viewer to the list, not on every read. Once a viewer is in the `viewers` array, reads are gated by UID, not by token.
- Rate-limit the join endpoint (e.g., Vercel Edge middleware) to prevent brute-force.

**Warning signs:**
- Token stored as a short hash or slug
- No way to regenerate the link after it's been shared
- Token checked on *every* read request (adds latency and unnecessary reads)

**Phase to address:** Share link + viewer join phase

---

### Pitfall 6: PWA Service Worker Serving Stale Data While Firestore Listeners Are Live

**What goes wrong:**
A service worker using a cache-first strategy can serve an old version of the Next.js JS bundles after a deployment. The user sees the new data from Firestore (because `onSnapshot` connects over a WebSocket, bypassing the HTTP cache) but the UI code is outdated. This produces subtle bugs: new fields in Firestore documents are ignored by old code, or new UI components fail to render.

A secondary issue: the service worker caches API route responses (e.g., a `/api/invite/[token]` route). If the cache TTL is too long, a revoked token may still appear valid to a cached response.

**Why it happens:**
`next-pwa` (based on Workbox) defaults to cache-first for static assets, which is correct, but developers forget to configure runtime caching for API routes separately, or forget to implement `skipWaiting` + forced reload on update.

**How to avoid:**
- Configure Workbox with `clientsClaim: true` and `skipWaiting: true` so new service worker versions take control immediately after deployment.
- Add an in-app update prompt: listen for `waiting` on the service worker registration and prompt the user to refresh.
- Never cache API responses that contain auth-sensitive data (invite tokens, purchase status) with anything other than `NetworkOnly` strategy.
- Use `StaleWhileRevalidate` only for non-sensitive static-ish data (e.g., user profile avatars).
- The Firestore realtime listener (`onSnapshot`) is not affected by the service worker — it uses a persistent WebSocket connection, not HTTP — so it remains reliable.

**Warning signs:**
- `next-pwa` installed with default config and no explicit `runtimeCaching` array
- Users reporting they see old UI after a deployment
- No `update found` banner in the app

**Phase to address:** PWA configuration phase

---

### Pitfall 7: Firestore Free Tier Read Exhaustion From Naive Listeners

**What goes wrong:**
The Spark (free) plan gives 50,000 reads/day. Each `onSnapshot` call counts a read for the initial load **and** for every changed document pushed thereafter. If the activity log is a sub-collection that is fetched with `onSnapshot`, every write to the wishlist (marking purchased, adding a note) triggers a listener update across all connected clients, each of which reads the updated documents. With 10 viewers across 3 devices each watching a list with 20 items and an active log, you can exhaust reads in a single busy evening.

**Why it happens:**
Developers think of Firestore as "free" and don't count listener reads as quota consumption. The billing docs are clear, but easy to miss.

**How to avoid:**
- Paginate and use `query(collection, orderBy('at', 'desc'), limit(20))` for the activity log. Do not listen to the full log with no limit.
- Detach listeners (`unsubscribe()`) when the component unmounts or the user navigates away. In Next.js App Router this means returning the unsubscribe function from a `useEffect`.
- Consider a `once()` (one-time read) instead of `onSnapshot` for the activity log — it doesn't need real-time updates on every second.
- Monitor reads in Firebase console during development by watching the usage graph daily.
- The Spark plan **hard-stops** at the daily limit — users get `permission-denied`-like errors or stale data, not graceful degradation.

**Warning signs:**
- `onSnapshot` attached to the activity log collection with no `limit()`
- No `return unsubscribe` in `useEffect` for Firestore listeners
- Firebase console showing reads climbing steeply

**Phase to address:** Real-time sync architecture phase (before building activity log)

---

### Pitfall 8: Activity Log Unbounded Write Growth

**What goes wrong:**
Every user action (item added, item edited, item reordered, purchase toggled, note saved) writes to the activity log. With drag-and-drop, each drag fires multiple events. If each `dragover` or `onDragEnd` writes to Firestore, a single 10-item reorder session can produce 50+ log entries and burn through write quota. Over months, the log collection grows without bound, making reads progressively more expensive and slow.

**Why it happens:**
Activity logging is added as an afterthought with `addDoc(logCollection, { ... })` inside every mutation handler, including drag callbacks.

**How to avoid:**
- Write log entries only on committed mutations, never on intermediate drag events. The log entry for a reorder is written once, when the drag ends and the new order is persisted.
- Add a `limit()` on log reads (show last 50 entries only).
- Schedule a Firestore TTL deletion (Firebase has a native document TTL feature in Firestore as of 2023) to auto-delete log entries older than 90 days.
- Batch log writes: write the log entry in the same `writeBatch` as the mutation it describes, so they succeed or fail atomically.
- Cap the log collection size: before writing a new entry, if `logCount > 500`, delete the oldest (done via a Cloud Function or a Firebase Extension — acceptable complexity for v2).

**Warning signs:**
- `addDoc` called inside a `onDragOver` handler
- No TTL or pruning strategy for log documents
- Log collection growing faster than item collection

**Phase to address:** Activity log phase

---

### Pitfall 9: `next/image` Refusing Arbitrary External Image URLs

**What goes wrong:**
Wish items have an image field where the child pastes a URL from any website (Amazon, toy manufacturer, random blog). `next/image` requires all external hostnames to be whitelisted in `next.config.js` under `images.remotePatterns`. An image from an unlisted domain renders as a broken image with a console error. You cannot whitelist `*` (all domains) in the standard config — it requires explicit hostname patterns.

**Why it happens:**
The feature is designed to accept truly arbitrary URLs, but `next/image` optimization pipeline only works with known hosts for security reasons.

**How to avoid:**
Two options:
1. **Use a plain `<img>` tag** for user-supplied image URLs, skipping Next.js image optimization entirely. Add `unoptimized` checks. This is the simplest and correct choice for v1 — image optimization for arbitrary external URLs would require proxying.
2. **Proxy via `/_next/image` with `images.remotePatterns: [{ protocol: 'https', hostname: '**' }]`** — this was made possible in Next.js 13.4+ by using the double-wildcard hostname pattern. This allows all HTTPS sources but disables most security benefits. Acceptable for a family app with no financial motive for attack.

Also handle the case where the URL returns a 404 or non-image content type — show a placeholder with `onError` handler.

**Warning signs:**
- `next/image` with `src={item.imageUrl}` and no `remotePatterns` configured
- Images showing broken icon in production but working in dev (different optimization behavior)

**Phase to address:** Wish item creation phase

---

### Pitfall 10: Auth State Not Persisting Across Page Refreshes in App Router

**What goes wrong:**
Firebase Auth state is stored in IndexedDB (or localStorage) by default. On a hard page refresh in Next.js App Router, the server renders the page without knowing the auth state (no cookie), producing a flash of unauthenticated content before the client SDK rehydrates and re-establishes the auth listener. In the worst case, middleware redirect logic runs before auth is resolved, sending users to a login page on every refresh.

**Why it happens:**
The Firebase client SDK is async — `onAuthStateChanged` fires after the first render. Server-side middleware cannot read Firebase's IndexedDB auth state; it has no access to it.

**How to avoid:**
- Use **Firebase session cookies** for SSR: on login, call `getIdToken()` on the client and POST it to a Next.js API route which calls `auth.verifyIdToken()` via the Admin SDK and sets a `HttpOnly` session cookie. Middleware then reads the cookie to determine auth state server-side.
- Alternatively, accept the flash and handle it gracefully with a loading skeleton on the client side — appropriate for v1 where SEO is not a concern.
- Do not put server-side auth logic in `layout.tsx` Server Components without a valid session cookie strategy — it will always think the user is unauthenticated.

**Warning signs:**
- Middleware that redirects unauthenticated users but no session cookie strategy
- `useEffect(() => { onAuthStateChanged(...) }, [])` in a layout — correct, but produces visible flash
- Users repeatedly redirected to login after refresh

**Phase to address:** Authentication phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Firestore document with both child-visible and purchase fields | Simpler data model, fewer reads | Child can read purchase status; requires data migration to fix | Never — must be decided at schema design time |
| Storing sort order as integer `position` on each item | Simple to implement | Reorder conflicts under concurrent use; O(n) writes per reorder | Never for real-time collaborative lists |
| Using `onSnapshot` without `limit()` on activity log | Always fresh log | Quota burn; unbounded collection growth | Never |
| Skipping session cookie, relying only on client-side auth | Fast to build | SSR flash; middleware cannot protect routes | Acceptable in v1 if PWA-only and no SEO need |
| Hardcoding `next.config.js` hostname patterns for images | Works for known toy sites | Breaks for any URL not in list | Only if image sources are curated, not arbitrary |
| No share link revocation | Faster to build | Link shared too broadly cannot be invalidated | Never — revocation is one button and one Firestore write |
| Writing activity log entries in every mutation inline | Simple | Unbounded growth, quota burn from drag events | Acceptable temporarily if drag events are excluded |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Firebase Auth + Next.js middleware | Reading auth state from `req.cookies` assuming Firebase sets one automatically | Firebase client SDK does NOT set cookies; must manually implement session cookie via Admin SDK |
| Firestore + React state | Calling `setState` inside `onSnapshot` without checking if component is still mounted | Return the `unsubscribe` function from `useEffect` to detach listener on unmount |
| `next-pwa` + Next.js App Router | Using `next-pwa` v5 (Workbox 6) which has known App Router incompatibilities | Use `@ducanh2912/next-pwa` or `@serwist/next` which are actively maintained App Router forks |
| Firestore batched writes + transactions | Using `batch.commit()` for operations that need read-before-write (e.g., checking token validity then adding viewer) | Use `runTransaction()` not `writeBatch` when the write depends on a current read |
| Firebase Auth `createUserWithEmailAndPassword` | Not handling `auth/email-already-in-use` for synthetic child emails | Check username uniqueness in Firestore first; surface a username-taken error, not a raw Firebase error code |
| `next/image` + external URLs | Assuming `remotePatterns` wildcard works the same in all Next.js versions | Test with `**` wildcard in `next.config.js`; fall back to plain `<img>` if optimization is not needed |
| Firestore security rules + custom claims | Calling `request.auth.token.role` in rules before custom claims have been set on the token | Custom claims require a token refresh after being set; client must call `user.getIdToken(true)` to force refresh |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `onSnapshot` on full activity log collection | Firebase quota exhausted mid-day; slow log rendering | `limit(50)` + no real-time for log (use one-time read) | ~5 active families with verbose logging |
| Loading all wishlists for a viewer on mount | Slow dashboard; excessive reads if viewer is on many lists | Paginate; load only list summaries, fetch items on demand | When a viewer manages 10+ children's lists |
| Fractional index string getting too long | Sort key strings grow unbounded after thousands of reorders | Periodically re-index (rewrite all `sortKey` values to clean spread) | After ~500 reorders on same list without rebalance |
| PWA cache serving stale JS bundles | Users see old UI after deployment | `skipWaiting` + `clientsClaim` in Workbox config | Every deployment without proper update handling |
| Drag-and-drop library re-rendering entire list on every drag event | Laggy drag on lists > 20 items | Virtualize list or memoize item components with `React.memo` | Lists > 30 items on low-end mobile |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing `purchased: true` on the same doc the child reads | Child sees what's been bought, spoiling surprise | Separate sub-collection `purchases/{itemId}` accessible only to viewers |
| Share link token with < 64 bits of entropy | Enumeration attack joins list | Use `crypto.randomUUID()` (128-bit) as token |
| No rate limiting on invite join endpoint | Brute-force token guessing | Vercel Edge middleware rate limit; max 10 join attempts per IP per hour |
| Firestore rules with `allow write: if request.auth != null` | Any authenticated user (including children) can write purchase status | Gate on role: `allow write: if isViewer(listId)` using UID lookup |
| Using Firebase Auth's email verification or reset flows for child accounts | Password reset email sent to synthetic `@yourapp.internal` address, bounces | Parent-only password reset via Admin SDK `updatePassword()` |
| `imageUrl` field accepting `javascript:` or `data:` URIs | XSS via CSS `content` or `<img src>` in some browsers | Validate URL scheme on input: only allow `https://` |
| Viewer sub-collection readable by child | Child knows who is watching their list (viewer UIDs exposed) | `viewers` sub-collection readable only by list owner (parent who created the list) or viewers themselves |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No optimistic updates for drag-and-drop reorder | List snaps back to old order while waiting for Firestore write, feels broken | Apply new order in local state immediately; revert only on write error |
| Auth state flash on page load | Child sees a login screen for 200ms before their wishlist appears | Show skeleton/loading state while `onAuthStateChanged` resolves; never redirect before resolution |
| Showing "0 wishes" while Firestore data is loading | Feels like the list is empty, child may add duplicate items | Distinguish loading state from empty state; show spinner until first snapshot arrives |
| No feedback when image URL fails to load | Child thinks their wish was saved without an image; confusing on re-edit | `onError` on the image element showing a placeholder; tooltip suggesting they try a different URL |
| Activity log visible to child | Spoils surprise (log says "Mormor marked roller blades as purchased") | Activity log visible only in viewer mode; completely hidden from child's view |
| Drag-and-drop not working on touch screens | Mobile children cannot reorder their list | Ensure drag-and-drop library supports touch events (`@dnd-kit/core` does; HTML5 drag API does not) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Purchase status separation:** Verify Firestore rules deny child UID all reads of `purchases/` sub-collection — emulator test, not just code inspection
- [ ] **Username uniqueness:** Verify two simultaneous account-creation attempts with the same username result in exactly one success — test with concurrent requests
- [ ] **Share link revocation:** Verify regenerating the link rejects the old token and old-token holders cannot rejoin (though already-joined viewers retain access)
- [ ] **Listener cleanup:** Verify every `onSnapshot` call has a corresponding `unsubscribe` returned from `useEffect` — check with React DevTools that no listeners leak after navigation
- [ ] **Service worker update flow:** Verify that after a new deployment, users on the old version see an update prompt or are automatically refreshed within 30 seconds
- [ ] **Firestore daily limit behavior:** Verify what the app shows when reads are exhausted — should show a graceful error, not a blank screen
- [ ] **Drag-and-drop on mobile:** Test on a real iOS and Android device — not just browser DevTools touch simulation
- [ ] **Image URL validation:** Verify `javascript:` and `data:` URIs are rejected at input time, not just at render time
- [ ] **Custom claims token refresh:** Verify that after a viewer joins via invite link, their role is reflected without requiring a manual logout/login

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong data model (purchase field on item doc) | HIGH | Firestore data migration script; rewrite all item docs; update security rules and all client reads |
| Integer sort positions with collisions | MEDIUM | One-time migration script to re-assign fractional sort keys to all existing items |
| Quota exhaustion (Spark plan reads) | LOW | Detach problematic listeners; add `limit()` to queries; quota resets at midnight Pacific time |
| Leaked share link (shared publicly) | LOW | "Regenerate link" button writes new token; existing viewers retain access |
| Auth state persistence failure (users always logged out) | MEDIUM | Implement session cookie flow; requires server-side API route and middleware changes |
| Service worker serving stale UI | LOW | Force `skipWaiting` + `clients.claim()` in SW update; users hard-refresh or clear site data |
| Activity log too large / slow | MEDIUM | Add TTL policy; paginate reads; retroactive cleanup via Admin SDK script |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Firebase SDK on server / hydration mismatch | Phase 1: Project scaffolding | Build succeeds with no SSR errors; `typeof window` guard tested |
| Purchase status exposed to child | Phase 1-2: Data model + security rules | Firestore emulator rules test: child UID denied read on `purchases/` |
| Drag-and-drop order conflicts | Phase 3: Wish item CRUD + reorder | Concurrent reorder test: two clients reorder simultaneously, no data corruption |
| Child auth email workaround pitfalls | Phase 2: Auth | Duplicate username creation attempt returns user-facing error, not Firebase error code |
| Share link token security | Phase 4: Share link / viewer join | Token entropy verified; revocation tested; rate-limit tested |
| PWA stale bundle after deploy | Phase 5: PWA configuration | Post-deploy: old client receives update prompt within 30 seconds |
| Firestore read quota burn | Phase 3-4: Listeners + activity log | Dev monitoring: reads per session measured in Firebase console |
| Activity log unbounded growth | Phase 4: Activity log | Log entries per drag session counted; TTL policy configured |
| Arbitrary image URLs in next/image | Phase 3: Wish item creation | Images from 5 different domains (Amazon, random blog, etc.) render correctly |
| Auth flash / middleware redirect loop | Phase 2: Auth | Hard refresh while logged in shows skeleton, not login redirect |

---

## Sources

- Firebase documentation (training data): Firestore quotas, security rules, Auth custom claims, session cookies
- Next.js App Router documentation (training data): Server Components, hydration, middleware, `next/image` remote patterns
- Workbox / next-pwa documentation (training data): service worker strategies, `skipWaiting`, `clientsClaim`
- `@dnd-kit/core` documentation (training data): touch support, sort strategies
- Community knowledge (training data): fractional indexing pattern for collaborative ordering, Firebase synthetic email workarounds for children
- Note: All external verification tools (WebSearch, WebFetch, Brave) were unavailable during this research session. Claims are based on training data through August 2025. Verify Firebase Spark tier limits in the current Firebase console before launch, as quotas are subject to change.

---
*Pitfalls research for: Family wishlist PWA — Next.js App Router + Firebase*
*Researched: 2026-04-06*
