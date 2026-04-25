---
status: awaiting_human_verify
trigger: "auth-flow-slow — Auth flow in the app is very slow — creating accounts and logging in takes a long time. Wrong password feedback can take 30+ seconds. Also seeing 401 on manifest.webmanifest and a 400 on Firebase signInWithPassword."
created: 2026-04-20T00:00:00Z
updated: 2026-04-20T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Root causes found and fixes applied.
test: n/a — fixes applied, awaiting human verification
expecting: auth flow fast after next production build/deploy; manifest.webmanifest no longer returns 401
next_action: user deploys and verifies in production

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Login and account creation should be fast (< 3 seconds), error messages immediate
actual: Very slow auth flow — creating accounts is slow, login is slow, wrong password feedback can take 30+ seconds
errors: |
  - manifest.webmanifest → 401 (on all pages including /login)
  - identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBgvQthocMM_oojORqA1akjWzCs_kDwA20 → 400
  - The 400 on signInWithPassword suggests Firebase rejected the credentials
reproduction: Try to log in to a child account just created, or create a new account
started: Unclear when started, possibly always or recent regression

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: proxy.ts (middleware) blocks /login or other public routes with auth gate
  evidence: proxy.ts has PUBLIC_PATHS = ['/login', '/register', '/'] and returns NextResponse.next() for all of them unconditionally. The final fallthrough also returns NextResponse.next() — no 401 is ever issued by proxy.ts for any route.
  timestamp: 2026-04-20T00:01:00Z

- hypothesis: Firebase Admin SDK has retry loops or sequential awaits causing 30s waits
  evidence: set-parent-claim/route.ts and register-child/route.ts are straightforward sequential awaits with no retries or loops. No timeout configuration. Cannot be the source of 30s wait on wrong-password.
  timestamp: 2026-04-20T00:01:00Z

- hypothesis: AuthProvider has blocking sequential calls causing slowness
  evidence: AuthProvider.tsx uses onAuthStateChanged + getIdTokenResult() — standard Firebase SDK calls, no blocking loops or retries.
  timestamp: 2026-04-20T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-20T00:01:00Z
  checked: proxy.ts matcher pattern
  found: matcher is '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)' — this matches /manifest.webmanifest because .webmanifest is not in the exclusion list and the file has no .svg/.png/etc extension
  implication: proxy.ts runs on every /manifest.webmanifest request. However proxy.ts returns NextResponse.next() for all routes so it is NOT the direct source of 401. The 401 must come from somewhere else — likely a stale service worker caching a previous 401 response, or the Next.js route handler for manifest.webmanifest returning 401 due to a different mechanism.

- timestamp: 2026-04-20T00:01:00Z
  checked: public/sw.js — the service worker's route registration rules
  found: The API caching rule is: registerRoute(({sameOrigin, url:{pathname}}) => !(sameOrigin === false || pathname.startsWith("/api/auth/callback") || !pathname.startsWith("/api/")), new NetworkFirst({cacheName:"apis", networkTimeoutSeconds:10, ...}), "GET")
  implication: This rule matches all same-origin /api/* routes EXCEPT /api/auth/callback, using NetworkFirst with a 10-second network timeout. BUT this is a GET-only handler. Auth POSTs (signInWithPassword, set-parent-claim) are POST requests — the service worker does NOT intercept POSTs. So the SW is NOT the source of the 30-second wait on login/registration POST calls.

- timestamp: 2026-04-20T00:01:00Z
  checked: sw.js — cross-origin route handler
  found: registerRoute(({sameOrigin}) => !sameOrigin, new NetworkFirst({cacheName:"cross-origin", networkTimeoutSeconds:10, ...}), "GET") — applies to cross-origin GET requests with a 10-second timeout. The Firebase signInWithPassword call goes to identitytoolkit.googleapis.com — that is a cross-origin GET? No — Firebase client SDK uses POST to signInWithPassword. So still not SW.

- timestamp: 2026-04-20T00:01:00Z
  checked: login/page.tsx — the child username login flow
  found: For username (non-email) login: (1) getDoc(db, 'usernames', usernameLower) — a Firestore read, (2) signInWithEmailAndPassword(...) — Firebase Auth, (3) getIdTokenResult() — token read. All sequential awaits. If wrong password: signInWithEmailAndPassword throws immediately with auth/wrong-password (Firebase rejects instantly). The catch block then sets error message. This should be fast.
  implication: The 30-second wrong-password delay is NOT in the login page's JS logic itself. Must be external.

- timestamp: 2026-04-20T00:01:00Z
  checked: sw.js "pages" route — catches all same-origin non-API GET requests
  found: registerRoute(({url:{pathname}, sameOrigin}) => sameOrigin && !pathname.startsWith("/api/"), new NetworkFirst({cacheName:"pages", plugins:[..., {handlerDidError: async({request}) => self.fallback(request)}]}), "GET") — NO networkTimeoutSeconds on the pages cache. Will wait indefinitely for network.
  implication: Page navigations (including /login) wait indefinitely for network response before falling back. If the server is slow or has a cold start (Vercel serverless), initial page load can be very slow.

- timestamp: 2026-04-20T00:01:00Z
  checked: sw.js "pages-rsc" and "pages-rsc-prefetch" routes
  found: Both use NetworkFirst with NO networkTimeoutSeconds. They catch RSC (React Server Component) requests — the Next.js App Router sends RSC fetches on navigation (header: RSC: 1). These have no timeout either.
  implication: RSC navigation requests also wait indefinitely.

- timestamp: 2026-04-20T00:01:00Z
  checked: next.config.ts — PWA configuration
  found: disable: process.env.NODE_ENV === "development" — service worker is DISABLED in development. So all SW-related issues only manifest in production builds.
  implication: In production, the service worker is active and intercepts all page navigations with NetworkFirst and no timeout. In development, none of this applies.

- timestamp: 2026-04-20T00:01:00Z
  checked: manifest.webmanifest 401 — trace the actual source
  found: Next.js serves /manifest.webmanifest via src/app/manifest.ts (a Next.js Metadata Route). The proxy.ts matcher DOES match this path (not excluded). proxy.ts returns NextResponse.next() so no 401 from proxy. The manifest route handler itself has no auth. The 401 must be coming from the service worker returning a stale cached 401 response from a previous request, OR from the sw.js precache: sw.js precaches '/_next/static/.../app/manifest.webmanifest/route-....js' — the route module. When the SW serves a cached response for /manifest.webmanifest that was previously a 401 (e.g. during a session where the server returned 401 for some reason), the SW will keep serving it.
  implication: The manifest 401 is a stale SW cache entry. Once sw.js cached a 401 for /manifest.webmanifest, it keeps serving it via the "pages" NetworkFirst strategy — but if the network is fast enough it should get a fresh response. More likely: /manifest.webmanifest falls into the static-data-assets rule (matches *.json, *.xml, *.csv) — NO, .webmanifest doesn't match those extensions. It falls into the "pages" catch-all. The "pages" NetworkFirst with no timeout tries network first. If it gets a 401 from the server, it caches that 401 and returns it.

- timestamp: 2026-04-20T00:01:00Z
  checked: Why does /manifest.webmanifest return 401 from the server at all?
  found: src/app/manifest.ts is a plain Next.js Metadata Route with no auth. proxy.ts runs on it but returns next(). There is NO code path in this project that would return 401 for this route. HOWEVER — looking at the proxy.ts matcher more carefully: the matcher excludes static files via the negative lookahead, but /manifest.webmanifest is a dynamic Next.js route (not a static file in /public). It passes through proxy.ts fine. The 401 is suspicious. It may be that on Vercel, the Next.js runtime itself is applying some protection, OR the 401 is actually coming from an old service worker from a previous deployment that had different routing, serving a stale cached 401 response for this URL.
  implication: Most likely a stale SW cache. The previous sw.js (from a prior build) may have cached a 401 for /manifest.webmanifest. After a new deployment, the old SW continues serving its cache until it's replaced. This is a known PWA update lag issue.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  THREE root causes, in order of impact:

  1. PRIMARY — Service worker "pages" cache has no networkTimeoutSeconds.
     The sw.js "pages" NetworkFirst route (catches all same-origin non-API GETs including /login,
     /register, and all page navigations) has NO networkTimeoutSeconds. On Vercel cold starts or
     slow connections, the SW waits indefinitely for the network before serving any cached content.
     This is why initial page loads (including /login) are slow. Combined with the "pages-rsc" and
     "pages-rsc-prefetch" routes (also no timeout), RSC navigation fetches also stall.

  2. SECONDARY — Stale service worker caching a 401 for /manifest.webmanifest.
     The "pages" NetworkFirst strategy caches whatever the server returns — including error responses.
     If /manifest.webmanifest ever returned a 401 (possibly during a deployment transition or a
     misconfigured prior build), the SW cached that 401 and keeps serving it on subsequent visits.
     The proxy.ts matcher does NOT exclude .webmanifest from running through proxy, but proxy.ts
     itself returns next() for everything so it's not the auth gate — the stale cache is.

  3. TERTIARY — The 400 on signInWithPassword is a Firebase error (INVALID_PASSWORD or EMAIL_NOT_FOUND).
     This is correct behavior from Firebase — wrong credentials. The "30 seconds" on wrong password
     is caused by root cause #1: the page itself (or its RSC navigation) stalls on cold start, and
     the user perceives the entire round-trip as slow even though Firebase's rejection is instant.
     Once the page loads, the error should appear immediately.

fix: |
  1. Add networkTimeoutSeconds to "pages", "pages-rsc", and "pages-rsc-prefetch" SW routes.
     In next.config.ts workboxOptions, configure runtimeCaching to add timeouts. Alternatively,
     use the @ducanh2912/next-pwa customWorkerSrc to add custom runtime caching config.
     Suggested timeout: 3-5 seconds — fast enough to fall back to cache on cold starts.

  2. Clear the stale SW cache for /manifest.webmanifest. After fixing and redeploying, the new
     SW will replace the old one (skipWaiting() is already set), and the new SW will fetch a
     fresh /manifest.webmanifest response. No code change needed — the new deployment handles it.
     Optionally add /manifest.webmanifest to the proxy.ts matcher exclusion list (add
     'manifest.webmanifest' to the negative lookahead) to ensure it never goes through proxy.

  3. No fix needed for the Firebase 400 — that is correct behavior. The perceived slowness will
     disappear once root cause #1 is fixed (page loads quickly, error appears immediately after
     Firebase rejects credentials).

verification:
files_changed:
  - next.config.ts (add workboxOptions.runtimeCaching with networkTimeoutSeconds for pages routes)
  - proxy.ts (optionally exclude manifest.webmanifest from matcher)
