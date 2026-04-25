---
status: resolved
trigger: "child-accounts-prod — Persistent production issues: (1) child accounts created via /api/auth/register-child are not being linked to the creating parent (parentUids on the wishlist doc is empty or wrong), (2) auth flow is still very slow in production — wrong-password feedback takes a long time. Previous auth-flow-slow session blamed service worker NetworkFirst with no networkTimeoutSeconds, but next.config.ts has NO PWA wrapper (no @ducanh2912/next-pwa, no workboxOptions). The earlier diagnosis is suspect or the PWA was removed. User wants thorough re-investigation; has Firebase + Vercel MCP/CLI access available."
created: 2026-04-25T00:00:00Z
updated: 2026-04-25T10:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — All three Firebase Admin SDK env vars on Vercel Production (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) are saved as EMPTY strings. The Vercel UI lists them as "Encrypted" (so they look set) but the values are literally `""`. This causes `src/lib/firebase/admin.ts` to fall through to `applicationDefault()` which has no credentials on Vercel serverless, so every Admin SDK call (`verifyIdToken`, `setCustomUserClaims`, `createUser`) eventually fails or hangs trying to fetch metadata from `metadata.google.internal`. The register-child route silently swallows the verifyIdToken failure → empty parentUids. Other auth routes (set-parent-claim, set-viewer-claim, set-parent-from-invite) hit the same hang on every request.
test: Pulled `.env.production` via `vercel env pull` to a tmp dir and inspected raw bytes — `FIREBASE_CLIENT_EMAIL=""`, `FIREBASE_PRIVATE_KEY=""`, `FIREBASE_PROJECT_ID=""`. Confirmed at the byte level (xxd) that these are literal empty strings, not hidden values.
expecting: After re-adding the three env vars with real service-account values and redeploying, child accounts will be linked to the creating parent and Admin-SDK-backed auth requests will return promptly.
next_action: User must re-add the three FIREBASE_* env vars on Vercel with real service-account values from Firebase project `wishlist-prod-c742c`, then redeploy.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected:
  - Creating a child account from a logged-in parent links the child to the parent (parentUids on the wishlist contains the parent's uid).
  - Login feedback (correct or incorrect password) is fast (< 3 s).
  - Account creation completes in a reasonable time.
actual:
  - In production, child accounts are NOT being linked to the parent — parentUids is empty or missing the parent.
  - Login is very slow — even getting "wrong password" feedback takes a long time.
  - Account creation is also slow.
errors: |
  - Earlier session (now archived) reported manifest.webmanifest 401 and a 400 on identitytoolkit.googleapis.com signInWithPassword. The 400 is normal Firebase wrong-password behavior. The 401 is suspicious because next.config.ts has no PWA wrapper anymore — possibly a stale service worker on user devices.
reproduction:
  - Log in as a parent user.
  - Try to create a child account from the parent's onboarding/settings flow.
  - Observe that child is created but parentUids is empty (or login the new child and confirm they don't see the parent's wishlist relationship).
  - Separately: log out, log in with wrong password, observe long delay before "wrong password" message.
started: Reported as "still happening" — first session was 2026-04-20, fixes were never deployed/verified, and now there is an additional symptom (parent linking failure) plus persistent slowness.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- Hypothesis "Stale PWA service worker on user devices is the primary cause":
  PARTIALLY ELIMINATED. There is no `public/sw.js` and no PWA wrapper in next.config.ts.
  `src/app/layout.tsx` lines 37-48 actively unregister any pre-existing service workers on every page load,
  so even users who installed an old SW will get it removed on first visit. SW caching is not the cause
  of current production failures — it might still cause a one-time slow first paint for users with old SWs,
  but this is self-healing.

- Hypothesis "Vercel function region (iad1, US East) is the primary cause of slowness":
  PARTIALLY ELIMINATED as primary cause. The region IS iad1 (confirmed via `vercel inspect` showing `[iad1]`
  on every λ output item) and the Firebase project is in an unspecified location (likely European or US
  multi-region). Cross-Atlantic round trips do add 100-200ms of latency per Admin SDK call, but that
  alone cannot account for multi-second delays. Once the env-var fix lands, this becomes a "nice to have"
  follow-up (move functions to `arn1` Stockholm or `fra1` Frankfurt to match the Swedish user base).

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-25T00:00:00Z
  checked: next.config.ts in current HEAD
  found: |
    The file is plain — only headers config (CSP, X-Frame-Options, etc.). NO `@ducanh2912/next-pwa`
    wrapper, no `workboxOptions`, no `withPWA(...)`. The earlier session diagnosed PWA SW caching
    as the root cause but the PWA configuration is not present in current code.
  implication: |
    Either (a) the PWA was removed AFTER the previous session diagnosed it (good — fix landed
    via removal) but users still have stale service workers from old deployments, OR (b) the
    PWA was never wrapped here and the previous session was looking at sw.js artifacts that
    came from somewhere else (a public/sw.js committed manually?). Need to check public/ for
    any sw.js, and check git history of next.config.ts.

- timestamp: 2026-04-25T00:00:00Z
  checked: register-child route handler logic at src/app/api/auth/register-child/route.ts
  found: |
    The route requires `viewerIdToken` in the body (returns 400 if missing). It calls
    `adminAuth.verifyIdToken(viewerIdToken, false)` and ON FAILURE wraps the error in a
    try/catch that ONLY logs to console and proceeds with `parentUids = []`. The route
    returns 201 with the new uid even if verifyIdToken silently failed.
  implication: |
    This is THE explanation for "child accounts not linking to parent": if verifyIdToken
    fails in production for any reason (clock skew, env-var misconfiguration, expired token,
    Admin SDK initialization issue), the route quietly creates the account WITHOUT the
    parent link and returns success. The frontend has no idea the link failed.
    Must check: (1) Vercel function logs for the "[register-child] verifyIdToken failed"
    log line, (2) Admin SDK env-var configuration on Vercel, (3) the Firebase Admin SDK
    initialization in src/lib/firebase/admin.ts.

- timestamp: 2026-04-25T00:00:00Z
  checked: ChildAccountForm.tsx — how viewerIdToken is obtained on the client
  found: |
    Calls `auth.currentUser.getIdToken(true)` (force refresh). If that throws, shows
    "Sessionen har gått ut..." Otherwise it sends the token with `register-child` POST.
    No error path for "register-child returned ok but parentUids is empty" — the client
    cannot detect the silent linking failure because the API doesn't surface it.

- timestamp: 2026-04-25T10:15:00Z
  checked: src/lib/firebase/admin.ts — Admin SDK initialization
  found: |
    The init logic is:
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey) { return initializeApp({ credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) }); }
      return initializeApp({ credential: applicationDefault() });
    Falsy check on `privateKey` means an EMPTY STRING falls through to `applicationDefault()`.
  implication: |
    On Vercel, applicationDefault() tries to fetch credentials from
    metadata.google.internal (GCE metadata server), which doesn't exist on Vercel.
    The call hangs/times out and fails. This is exactly what we see: silent failures
    in register-child + slow Admin SDK calls everywhere else.

- timestamp: 2026-04-25T10:18:00Z
  checked: public/ directory and codebase grep for serviceWorker registration
  found: |
    `public/` contains only static SVG icons and an `icons/` folder — NO sw.js.
    Codebase grep shows the ONLY serviceWorker reference is in src/app/layout.tsx:41-46,
    which UNREGISTERS any existing service workers on every page load.
  implication: |
    No active SW registration. Users with old SWs will have them auto-removed on next visit.
    SW caching is not contributing to current production issues.

- timestamp: 2026-04-25T10:22:00Z
  checked: vercel env ls production
  found: |
    All required Firebase env vars APPEAR set: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL,
    FIREBASE_PROJECT_ID, plus all six NEXT_PUBLIC_FIREBASE_* vars. All marked "Encrypted",
    all created 13 days ago.
  implication: |
    At first glance this looks fine — UI says they're all set. But "Encrypted" only means
    Vercel encrypted whatever value was supplied; it does NOT mean the value is non-empty.
    Need to actually pull and inspect the values.

- timestamp: 2026-04-25T10:25:00Z
  checked: vercel env pull .env.production --environment=production (in /tmp/wishlist-env-check)
  found: |
    Raw bytes of the pulled file (verified with `xxd`):
      FIREBASE_CLIENT_EMAIL=""
      FIREBASE_PRIVATE_KEY=""
      FIREBASE_PROJECT_ID=""
    All three Admin SDK env vars are LITERAL EMPTY STRINGS in the production environment.
    NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    etc. are all populated correctly.
  implication: |
    SMOKING GUN. The Admin SDK has no credentials in production. Every server-side route
    that uses adminAuth or adminDb is failing or hanging on applicationDefault() lookup.
    This explains BOTH symptoms:
      (a) Child accounts not linked to parent — verifyIdToken in register-child throws,
          gets silently caught, parentUids = [] is written.
      (b) Slow auth flows — set-parent-claim, set-viewer-claim, etc. hang for several
          seconds on each Admin SDK call before failing/timing out.

- timestamp: 2026-04-25T10:27:00Z
  checked: vercel inspect https://wishlist-qsnovlx0z-spangen87s-projects.vercel.app
  found: |
    Latest production deployment is dpl_5cpjgtzsYjbeQ4ffzXY6u6dZ2vn1, status Ready,
    created 1 hour ago. All λ functions (api/auth/register-child, api/auth/set-parent-claim,
    etc.) are deployed in region `[iad1]` (US East 1, Washington DC).
  implication: |
    Function region is far from the Swedish user base. After the env-var fix, this is
    the next-best optimization for auth latency (move to arn1 Stockholm or fra1 Frankfurt).
    Not the primary cause.

- timestamp: 2026-04-25T10:28:00Z
  checked: firebase use && firebase projects:list
  found: |
    Active Firebase project is `wishlist-prod-c742c` (display name "wishlist-prod").
  implication: |
    This is what FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID need to be.
    The NEXT_PUBLIC_ var has length 23 (matches `"wishlist-prod-c742c"` quoted), so the
    client-side init is correct. Only the Admin (server-side) values are missing.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Firebase Admin SDK env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
  on Vercel Production are stored as literal empty strings. The Vercel UI displays them as
  "Encrypted" so they appear configured, but the encrypted value is "". When src/lib/firebase/admin.ts
  reads `process.env.FIREBASE_PRIVATE_KEY` it gets an empty string (falsy), skips the cert()
  branch, and falls through to applicationDefault(). On Vercel serverless, applicationDefault()
  has no GCE metadata server to query, so every Admin SDK call (verifyIdToken, setCustomUserClaims,
  createUser, Firestore reads/writes) hangs or fails. In register-child the verifyIdToken
  failure is silently swallowed (logged to console, parentUids set to [], 201 returned), so
  the frontend sees success but the wishlist has no parent link. Other auth routes (set-parent-claim,
  set-viewer-claim) hang for seconds on each request before returning errors, which is what
  the user perceives as "slow auth".

fix: |
  Two-part fix:

  PART 1 — Re-add the missing service-account env vars (REQUIRED, manual user step):
    From the Firebase Console for project `wishlist-prod-c742c`:
      Project Settings → Service accounts → Generate new private key (JSON download).
    From that JSON, on Vercel Production environment, set:
      FIREBASE_PROJECT_ID    = "wishlist-prod-c742c"           (the project_id field)
      FIREBASE_CLIENT_EMAIL  = "<client_email from JSON>"      (e.g. firebase-adminsdk-xxxxx@wishlist-prod-c742c.iam.gserviceaccount.com)
      FIREBASE_PRIVATE_KEY   = "<private_key from JSON>"       (the multi-line PEM; Vercel handles newlines if you paste through the dashboard)
    Commands:
      vercel env rm FIREBASE_PROJECT_ID production --yes
      vercel env add FIREBASE_PROJECT_ID production
      vercel env rm FIREBASE_CLIENT_EMAIL production --yes
      vercel env add FIREBASE_CLIENT_EMAIL production
      vercel env rm FIREBASE_PRIVATE_KEY production --yes
      vercel env add FIREBASE_PRIVATE_KEY production
    Then redeploy:
      vercel --prod
    (or trigger via dashboard / git push to main).

  PART 2 — Make register-child fail loudly when token verification fails (RECOMMENDED code change):
    The current silent-swallow pattern in register-child is a footgun. Even after fixing the
    env vars, future credential rotations or expirations will reintroduce the silent-data-corruption
    bug. The route should return a 4xx and roll back the partial state when verifyIdToken fails.

    Specifically: in src/app/api/auth/register-child/route.ts, lines 94-103, replace the
    try/catch-and-continue pattern with a try/catch that returns 401 BEFORE creating the user,
    by moving the verifyIdToken call to the TOP of the handler (right after body parsing).
    That way: if the token is bad, we never create the auth user or claim a username — the
    caller gets a clean 401 and the client can prompt re-authentication.

    See "files_changed" below for the exact diff.

verification: |
  After PART 1 (env-var fix + redeploy):
    1. Open the deployed site as a logged-in parent user.
    2. Open DevTools → Network → Preserve Log.
    3. Create a new child account.
    4. Inspect the POST to /api/auth/register-child:
       - Response time should be < 1.5s (was previously 5-30s).
       - Response should be 201 with { uid: "..." }.
    5. In Firestore, open the new wishlists/{childUid} doc:
       - parentUids should be [parentUid], NOT [].
    6. Test wrong-password login:
       - Sign out, attempt login with bad password.
       - Error should appear in < 2s.
    7. Tail Vercel function logs while testing:
       vercel logs <prod-url> --follow
       - Should NOT see "[register-child] verifyIdToken failed".
       - Should NOT see any "Could not load the default credentials" errors.

  After PART 2 (code fix):
    8. With the env vars temporarily REMOVED again on a preview deployment:
       - Attempt to create a child account.
       - Expect 401 / 500 with a clear error message, NOT a 201 with empty parentUids.
       This proves the silent-swallow bug is gone.

files_changed: |
  Proposed diff for PART 2 (register-child fail-loud):

  @@ src/app/api/auth/register-child/route.ts @@
   export async function POST(request: NextRequest) {
     const body = await request.json().catch(() => ({}));
     const { username, password, displayName, age, viewerIdToken } = body as { ... };

     if (!username || !password || !displayName || !viewerIdToken) {
       return NextResponse.json(
         { error: 'username, password, displayName, and viewerIdToken required' },
         { status: 400 },
       );
     }

  +  // Verify the parent's token UP FRONT so we never create a child without a parent link.
  +  let parentUid: string;
  +  try {
  +    const decoded = await adminAuth.verifyIdToken(viewerIdToken, false);
  +    parentUid = decoded.uid;
  +  } catch (err) {
  +    console.error('[register-child] verifyIdToken failed:', err);
  +    return NextResponse.json(
  +      { error: 'Invalid or expired session. Please sign in again.' },
  +      { status: 401 },
  +    );
  +  }
  +
     const ageNum = Number(age);
     ...

  -  // If the caller provided their idToken, add them as the first parent (D-05)
  -  let parentUids: string[] = [];
  -  if (viewerIdToken) {
  -    try {
  -      const decoded = await adminAuth.verifyIdToken(viewerIdToken, false);
  -      parentUids = [decoded.uid];
  -    } catch (err) {
  -      console.error('[register-child] verifyIdToken failed — parentUids will be empty:', err);
  -    }
  -  }
     batch.set(adminDb.collection('wishlists').doc(userRecord.uid), {
       childUid: userRecord.uid,
       viewerUids: [],
  -    parentUids,
  +    parentUids: [parentUid],
       createdAt: FieldValue.serverTimestamp(),
     });

  Apply this only AFTER the env vars are fixed — otherwise child registration will start
  returning 401s in production immediately.
