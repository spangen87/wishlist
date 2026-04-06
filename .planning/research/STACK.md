# Stack Research

**Domain:** Family wishlist PWA (Next.js + Firebase)
**Researched:** 2026-04-06
**Confidence:** MEDIUM — external verification tools unavailable; based on training data (cutoff August 2025) + Next.js docs index confirmed via llms.txt. Version numbers flagged where unverified.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x | React framework + routing | App Router is the current standard; Server Components reduce bundle size; built-in image optimization and manifest support |
| React | 19.x | UI library | Ships with Next.js 15; no separate install needed |
| Firebase JS SDK | 10.x (modular) | Firestore real-time DB + Auth | Modular v9+ API is tree-shakeable; v10 is current; free Spark tier generous for family app |
| firebase-admin | 12.x | Server-side Auth session verification | Required for verifying ID tokens in Route Handlers / middleware |
| Tailwind CSS | 3.4.x | Styling | v3 is stable and mature; v4 still in early adoption as of early 2025; v3 has wider ecosystem compatibility |
| TypeScript | 5.x | Type safety | Ships with Next.js; use strict mode from day one |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.x | Drag-and-drop primitives | Core DnD engine — always needed |
| @dnd-kit/sortable | 8.x | Sortable list utilities | Wraps core for vertical/horizontal list sorting — use for wishlist reordering |
| @dnd-kit/utilities | 3.x | CSS transform helpers | Small utility package; include alongside core |
| react-hot-toast | 2.x | Toast notifications | Lightweight; works well with App Router; for "item added", "marked as bought" feedback |
| lucide-react | latest | Icon library | Actively maintained fork of Feather Icons; tree-shakeable; works with React 19 |
| clsx | 2.x | Conditional classnames | Tiny utility; use instead of manual string concatenation for Tailwind classes |
| tailwind-merge | 2.x | Merge Tailwind classes without conflicts | Use alongside clsx to safely merge Tailwind class strings |
| zod | 3.x | Schema validation | Validate form inputs (wishlist item form) before writing to Firestore |
| react-hook-form | 7.x | Form state management | Pairs well with Zod via `@hookform/resolvers`; minimal re-renders |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Next.js ships with eslint config; extend with `eslint-config-next` |
| Prettier | Code formatting | Add `prettier-plugin-tailwindcss` to auto-sort Tailwind classes |
| prettier-plugin-tailwindcss | Auto-sort Tailwind classes | Prevents class ordering bugs; must-have with Tailwind |

---

## Installation

```bash
# Bootstrap Next.js 15 project (includes React 19, TypeScript, Tailwind, ESLint)
npx create-next-app@latest wishlist --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Core Firebase (client-side)
npm install firebase

# Firebase Admin (server-side session verification)
npm install firebase-admin

# Drag and drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# PWA support (maintained App Router fork)
npm install @ducanh2912/next-pwa

# Forms + validation
npm install react-hook-form @hookform/resolvers zod

# UI utilities
npm install clsx tailwind-merge lucide-react react-hot-toast

# Dev dependencies
npm install -D prettier prettier-plugin-tailwindcss
```

---

## PWA Setup (Critical Detail)

Next.js 15 App Router has **built-in manifest support** via `app/manifest.ts`. Use this instead of a static `manifest.json`:

```typescript
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wishlist',
    short_name: 'Wishlist',
    description: 'Family wishlist app',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf4ff',
    theme_color: '#e9d5ff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

For the service worker (offline support + installability), use `@ducanh2912/next-pwa`:

```javascript
// next.config.js
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})

module.exports = withPWA({
  // your next config
})
```

**Do not use `next-pwa` (shadowwalker).** It is unmaintained and breaks with Next.js App Router.

---

## Firebase + Next.js App Router Pattern

### Client-side initialization (Client Components only)

```typescript
// lib/firebase/client.ts
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = { /* from env */ }

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
```

Guard with `getApps().length === 0` to prevent double-initialization in hot-reload.

### Server-side (Route Handlers / Server Actions)

```typescript
// lib/firebase/admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}

export const adminAuth = getAuth()
```

Use `firebase-admin` only in Server Components, Route Handlers, and middleware — never in Client Components.

### Auth pattern for App Router

1. Firebase Auth runs client-side via `onAuthStateChanged`
2. On sign-in, get ID token with `user.getIdToken()`
3. POST token to `/api/auth/session` Route Handler
4. Route Handler verifies with `adminAuth.verifyIdToken(token)` and sets an `httpOnly` session cookie
5. Next.js middleware reads the cookie to protect routes

This avoids exposing Firebase credentials server-side while enabling SSR auth.

---

## next/image with External URLs

`next/image` requires explicit domain allowlisting. For user-provided image URLs (unknown domains), use a permissive wildcard config:

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',  // Allow any HTTPS image domain
      },
    ],
  },
}
```

**Caveat:** Wildcard `hostname: '**'` works but bypasses domain-level security filtering. Acceptable for a family app where trusted users input URLs. Alternative: validate URLs against a blocklist on form submit.

For images that fail to load (broken URL, CORS), always provide an `onError` fallback:

```tsx
<Image
  src={item.imageUrl}
  alt={item.title}
  onError={(e) => { e.currentTarget.src = '/placeholder.png' }}
/>
```

---

## Tailwind CSS for Pastel/Soft UI

Extend the Tailwind config with a pastel palette:

```javascript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      pastel: {
        pink:   '#fce7f3',
        purple: '#f3e8ff',
        blue:   '#dbeafe',
        green:  '#dcfce7',
        yellow: '#fef9c3',
        peach:  '#fed7aa',
      }
    },
    borderRadius: {
      '2xl': '1rem',
      '3xl': '1.5rem',
    },
    boxShadow: {
      soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
    }
  }
}
```

Use `rounded-2xl`, `shadow-soft`, and pastel background colors for the soft card aesthetic.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @dnd-kit/sortable | @hello-pangea/dnd | If you need the exact react-beautiful-dnd API (migrating existing code); otherwise dnd-kit is superior |
| @dnd-kit/sortable | react-sortable-hob | Never — abandoned |
| @ducanh2912/next-pwa | serwist | serwist is more modern and better maintained long-term; use it if setting up fresh and comfortable with slightly less documentation |
| firebase (v10 modular) | firebase (v8 compat) | Never for new projects — v8 compat layer is deprecated |
| react-hook-form + zod | Formik | Only if team already knows Formik; react-hook-form has better performance and smaller bundle |
| Tailwind v3 | Tailwind v4 | Use v4 only if starting after mid-2025 and ecosystem has caught up; v4 has breaking CSS-variable config changes |
| Vercel (free hobby tier) | Firebase Hosting | Firebase Hosting is fine but Vercel has better Next.js integration (Edge Functions, automatic preview deploys) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| next-pwa (shadowwalker/shadowwalker) | Unmaintained since 2022; breaks with Next.js App Router | @ducanh2912/next-pwa or serwist |
| react-beautiful-dnd | Abandoned by Atlassian; no React 18+ support | @dnd-kit/sortable |
| Firebase v8 compat layer (`firebase/compat/*`) | Deprecated; will be removed; large bundle size | Firebase v10 modular imports |
| next-auth v4 with Firebase | Unnecessarily complex for this use case; Firebase Auth is self-contained | Firebase Auth + session cookie pattern |
| SWR or React Query for Firestore | Firestore has built-in real-time listeners; adding a query library creates state duplication | `onSnapshot` directly in custom hooks |
| CSS Modules | More boilerplate than Tailwind for this project size; harder to maintain design consistency | Tailwind CSS |
| Redux / Zustand | Overkill for this app's state complexity; Firebase Auth + Firestore listeners cover global state needs | React Context for auth state + Firestore real-time |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| firebase@10.x | Next.js 15, React 19 | Client Components only; no SSR (use firebase-admin for server) |
| firebase-admin@12.x | Node.js 18+, Next.js 15 Route Handlers | Server-side only; never bundle into client |
| @dnd-kit/core@6.x | React 18+, React 19 | Touch and pointer events supported |
| @ducanh2912/next-pwa | Next.js 14+, App Router | Set `disable: true` in development to avoid service worker caching issues |
| tailwind@3.4.x | Next.js 15 | v4 has breaking config changes; v3 is safe |
| react-hook-form@7.x | React 19 | Fully compatible; use `@hookform/resolvers` for Zod integration |

---

## Confidence Notes

- **Firebase v10 + Next.js App Router pattern** — HIGH confidence. The modular SDK + client/server split is well-established and stable.
- **dnd-kit as the correct choice** — HIGH confidence. react-beautiful-dnd abandoned, @hello-pangea/dnd is maintenance-only, dnd-kit is the active community standard.
- **@ducanh2912/next-pwa** — MEDIUM confidence. Recommended by community as the maintained fork, but serwist may have overtaken it by early 2026. Verify current npm download stats before committing.
- **Firebase SDK exact version (10.x)** — MEDIUM confidence. Version number based on training data; verify with `npm show firebase version` before scaffolding.
- **Tailwind v3 vs v4** — MEDIUM confidence. v4 released ~Jan 2025; ecosystem maturity by April 2026 is unknown. Check if `prettier-plugin-tailwindcss` and key plugins support v4 before upgrading.

---

## Sources

- Next.js docs index (`nextjs.org/docs/llms.txt`) — confirmed PWA guide exists at `/docs/app/guides/progressive-web-apps`; direct fetch unavailable in this environment
- Training data (August 2025 cutoff) — Firebase SDK patterns, dnd-kit ecosystem status, next-pwa deprecation status
- Project constraints from `.planning/PROJECT.md` — Firebase, Vercel, PWA, drag-and-drop requirements confirmed

---

*Stack research for: Family wishlist PWA (Next.js + Firebase)*
*Researched: 2026-04-06*
