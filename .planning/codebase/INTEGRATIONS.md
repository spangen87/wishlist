# External Integrations
_Last updated: 2026-04-22_

## Summary
The application integrates exclusively with Firebase (Google). There are no third-party payment, analytics, monitoring, or messaging services connected. Firebase provides authentication, the Firestore document database, and server-side privileged operations through the Admin SDK. All other logic is self-contained in Next.js API routes.

## APIs & External Services

**Firebase (Google Cloud):**
- Firebase Authentication — user identity, custom claims (parent/viewer roles), session management
- Cloud Firestore — primary data store for wishlists, items, purchase status, activity logs, invite tokens, user profiles, and username mappings
- No Firebase Storage, Functions, Hosting, or Messaging detected

## Data Storage

**Database:**
- Cloud Firestore (NoSQL document database)
  - Client connection: `src/lib/firebase/client.ts` — exports `db` (Firestore) and `auth` (Auth)
  - Admin connection: `src/lib/firebase/admin.ts` — exports `adminDb` and `adminAuth`
  - ORM/Query layer: Firebase SDK directly (no abstraction layer like Prisma)
  - Security rules: `firestore.rules`
  - Index definitions: `firestore.indexes.json`

**Firestore Collections:**
| Collection | Purpose |
|-----------|---------|
| `wishlists/{wishlistId}` | Root wishlist document (owner = child UID) |
| `wishlists/{wishlistId}/items` | Wish items subcollection |
| `wishlists/{wishlistId}/purchaseStatus` | Purchase state (hidden from child) |
| `wishlists/{wishlistId}/activityLog` | Activity log (written via Admin SDK only) |
| `usernames/{username}` | Username → UID mapping (public read) |
| `users/{uid}` | User profiles |
| `invites/{token}` | Share invite tokens (Admin SDK only) |

**File Storage:**
- Not used — no Firebase Storage, S3, Cloudinary, or equivalent detected

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Client SDK usage: `src/lib/firebase/client.ts`
  - Admin SDK usage: `src/lib/firebase/admin.ts`
  - Custom claims used for role-based access (`parent`, `viewer`)
  - Session tokens passed as Bearer tokens to API routes for server-side verification

**Auth Flow:**
- Child registers via `/api/auth/register-child/route.ts` (Admin SDK creates user)
- Parents register via `/register` page, claim set via `/api/auth/set-parent-claim/route.ts`
- Viewers join via invite link at `/invite/[token]`, claim set via `/api/auth/set-viewer-claim/route.ts`

**Auth Context:**
- `src/components/AuthProvider.tsx` — React context wrapping Firebase `onAuthStateChanged`

## Invite / Share Link System

**Mechanism:**
- Invite tokens stored in Firestore `invites/{token}` collection
- Written exclusively via Admin SDK (client has no write access to this collection)
- Token redemption: `POST /api/invite/redeem` — validates token, sets viewer/parent claim, updates wishlist doc
- Invite management routes: `create`, `create-for-parent`, `create-for-child`, `current`, `regenerate`

## Environment Configuration

**Required environment variables:**

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client (public) | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client (public) | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client (public) | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client (public) | Firebase Storage bucket (declared but Storage not in use) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client (public) | Firebase Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client (public) | Firebase app ID |
| `FIREBASE_PROJECT_ID` | Server-only | Admin SDK project ID |
| `FIREBASE_CLIENT_EMAIL` | Server-only | Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | Server-only | Admin SDK private key (PEM, `\n` escaped) |
| `NEXT_PUBLIC_USE_EMULATOR` | Both | Set to `true` to route to local Firebase emulators |

**Reference file:** `.env.example`

**Secrets location:** `.env.local` (not committed)

**Admin SDK fallback:** If `FIREBASE_PRIVATE_KEY` is absent, the Admin SDK falls back to Application Default Credentials (`applicationDefault()`), which supports Google Cloud environments (e.g., Cloud Run, Vercel with Workload Identity).

## Monitoring & Observability

**Error Tracking:** None detected (no Sentry, Datadog, LogRocket, etc.)

**Logging:** `console.error` / `console.log` statements only — no structured logging framework

## CI/CD & Deployment

**Hosting:** Deployment target not explicitly configured. No `vercel.json` detected. Likely Vercel (inferred from `eslint-config-next` and project structure).

**CI Pipeline:** None detected (no `.github/workflows/`, `.gitlab-ci.yml`, etc.)

## Webhooks & Background Jobs

**Incoming webhooks:** None detected

**Outgoing webhooks:** None detected

**Background jobs:** None detected (no cron routes, no queue workers, no Vercel Cron config)

## Local Development Emulation

Firebase Emulator Suite replaces live Firebase services during local development:
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Emulator UI: `http://localhost:4000`
- Configured in `firebase.json`
- Connected conditionally in `src/lib/firebase/client.ts` and `src/lib/firebase/admin.ts` when `NEXT_PUBLIC_USE_EMULATOR=true`

## Gaps & Unknowns

- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is declared in `.env.example` and included in the Firebase client config, but Firebase Storage is not used anywhere in the application. This may be a leftover from project scaffolding or planned for future use.
- No email/SMS notification service is connected — invite sharing appears to rely on users manually copying share links.
- No analytics integration detected (no Google Analytics, Mixpanel, Posthog, etc.).
- Deployment platform not confirmed — no `vercel.json` or equivalent config present.
