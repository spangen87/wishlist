# Phase 5: PWA + Polish - Research

**Researched:** 2026-04-09
**Domain:** PWA (service worker + manifest), UI polish (CSS tokens + Tailwind), security rules verification
**Confidence:** HIGH (most findings verified against local Next.js 16.2.2 docs and npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Accent color shifts to `#F9A87A` (peach/rose tone). `--color-accent` and `--color-accent-hover` updated to `#F9A87A` / `#F49060`.
- **D-02:** Background tokens `#FFF9F5`, `#FFF0E8`, `#E5D5CC` stay as-is.
- **D-03:** All user-facing pages receive UI polish: login, register, wishlist, viewer, dashboard, invite, settings. `layout.tsx` gets app title, description, Open Graph metadata.
- **D-04:** Cards use `rounded-2xl` and `shadow-sm`/`shadow-md` consistently.
- **D-05:** Use `@ducanh2912/next-pwa` (serwist-based) as PWA plugin. Configured in `next.config.ts`.
- **D-06:** Manifest `name`: "Min önskelista". `short_name`: "Önskelista".
- **D-07:** PWA `theme_color` and `background_color`: `#FFF9F5`.
- **D-08:** `display`: `standalone`.
- **D-09:** Icons generated via Node.js script using `sharp` npm package. 192x192 and 512x512 PNG. Pastel background + gift emoji centered. Output to `public/icons/`.
- **D-10:** Caching: cache-first for `/_next/static/`, stale-while-revalidate for pages. Offline fallback at `app/offline/page.tsx`.
- **D-11:** Offline sticky banner: "Du är offline — data kan vara föråldrad". Disappears when online.
- **D-12:** Offline detection via `window.addEventListener('online'/'offline')` in a client component or hook.
- **D-13:** New SW waiting toast: "Ny version tillgänglig — uppdatera nu" with reload button calling `skipWaiting()` then `window.location.reload()`.
- **D-14:** Update detection via SW `waiting` event. Toast lives in root layout.
- **D-15:** Toast is non-modal, non-blocking, does not auto-dismiss.

### Claude's Discretion

- Exact peach/rose hex for new accent (within pastel warm range — `#F9A87A` selected per UI-SPEC)
- Specific Tailwind class choices for rounded corners and shadows
- Icon generation script implementation details
- Offline fallback page content and design
- Toast component animation and positioning
- Whether to use a separate `useServiceWorker` hook or inline SW registration logic

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 5 scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PWA-01 | App can be installed on home screen (web app manifest) | D-05 through D-09: @ducanh2912/next-pwa generates SW + manifest; built-in `app/manifest.ts` route alternative. Icons via sharp script. |
| PWA-02 | App works offline for reading cached data (service worker) | D-10: Serwist cache strategies. D-11/D-12: offline banner. D-13/D-14/D-15: update toast. |
| UI-01 | Pastel colors with soft contours, gender-neutral and child-friendly | D-01 through D-04: CSS token update in globals.css propagates to all pages automatically. Component inventory in UI-SPEC. |

</phase_requirements>

---

## Summary

Phase 5 has three distinct tracks: (1) PWA infrastructure — manifest, service worker, icons, caching strategy; (2) UI polish — a targeted CSS token update plus two new system components (OfflineBanner, UpdateToast); and (3) security verification — re-running existing emulator tests against final Firestore rules.

The single most important discovery is a **compatibility constraint between `@ducanh2912/next-pwa` and Next.js 16's default bundler (Turbopack)**. The plugin uses `workbox-webpack-plugin` internally, and the Next.js 16 docs explicitly state "Turbopack does not support webpack plugins." The project's `package.json` currently runs `next dev` (Turbopack by default in v16). Therefore, the `dev` and `build` scripts must be updated to use `--webpack` flag when the PWA plugin is active. This is a one-line change but is a prerequisite for the entire PWA track.

The UI polish track is low-risk: the entire app already uses CSS custom properties, so the accent token swap (`#F97316` → `#F9A87A`) propagates automatically. Two new client components (OfflineBanner, UpdateToast) are added to the root layout. Sharp v0.34.5 is already installed in the project and supports `{create: ...}` + SVG composite for icon generation — no additional installs needed.

The security verification track re-runs the existing Jest + Firebase emulator test suite against the final Firestore rules and adds test cases for `activityLog` subcollection (currently tested only for `purchaseStatus`).

**Primary recommendation:** Address the Turbopack/webpack conflict first (update `package.json` scripts), then install `@ducanh2912/next-pwa`, configure `next.config.ts`, generate icons, and implement the two client components — in that order.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md. The directive is:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Directives extracted:**
1. Read `node_modules/next/dist/docs/` before writing any Next.js code — do not rely on training-data assumptions.
2. Heed deprecation notices in those docs.

**Research compliance:** All Next.js findings in this document were read from `node_modules/next/dist/docs/` (version 16.2.2). Key findings differ from pre-Next-15 training data (Turbopack as default, manifest file convention in `app/`, etc.).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ducanh2912/next-pwa` | 10.2.9 (latest) | PWA plugin: service worker generation + Workbox strategies | Locked by D-05; maintained Workbox-based plugin for Next.js App Router |
| `sharp` | 0.34.5 (already installed) | Icon generation script (build-time) | Already in project; supports `{create}` API + SVG composite for emoji rendering |
| Next.js built-in `app/manifest.ts` | Next.js 16.2.2 | Web app manifest | Built-in convention in App Router; generates `/manifest.webmanifest` automatically |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `workbox-window` | 7.1.1 (peer dep of `@ducanh2912/next-pwa`) | SW lifecycle events in client JS (waiting, activated, etc.) | Needed for UpdateToast SW waiting detection |
| Firebase emulator + Jest | Already installed | Security rules re-verification | For Phase 5 success criterion 5 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ducanh2912/next-pwa` (locked D-05) | `@serwist/next` 9.5.7 | `@serwist/next` is the upstream recommended migration path (even noted in `@ducanh2912/next-pwa` own README). Same Workbox engine. Either requires webpack mode. Not switching — D-05 locked. |
| Custom `app/manifest.ts` (Next.js built-in) | `public/manifest.json` (static file) | `@ducanh2912/next-pwa` may generate its own manifest or may require pointing to one; the built-in `app/manifest.ts` route is cleaner and type-safe. Confirm which approach the plugin uses. |
| `sharp` for icon generation | `canvas` npm package | `canvas` is not installed; `sharp` is. `sharp` supports SVG composite for text/emoji rendering. Use `sharp`. |

**Installation (PWA plugin only — sharp already present):**

```bash
npm install @ducanh2912/next-pwa
```

**Version verification:** [VERIFIED: npm registry]
- `@ducanh2912/next-pwa`: 10.2.9 (verified 2026-04-09)
- `sharp`: 0.34.5 already in project (verified 2026-04-09)

---

## Critical: Turbopack / Webpack Incompatibility

**This is the most important finding in this research.**

### Finding

Next.js 16 uses Turbopack as the **default bundler** for both `next dev` and `next build`. [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`]

`@ducanh2912/next-pwa` uses `workbox-webpack-plugin` as a dependency. The Next.js 16 Turbopack docs state: [VERIFIED: same source]

> "Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration."

The official Next.js PWA guide also notes for Serwist: [VERIFIED: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`]

> "Note: this plugin currently requires webpack configuration."

### Solution

Both `next dev` and `next build` accept a `--webpack` flag to opt into webpack. The fix is a `package.json` script update AND/OR a `next.config.ts` configuration. [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`]

```json
"scripts": {
  "dev": "next dev --webpack",
  "build": "next build --webpack",
  "start": "next start"
}
```

**Impact:** Development speed will be slightly slower (Turbopack is faster), but this is acceptable for a small app. The `--webpack` flag only affects the bundler, not the Next.js feature set.

### Alternative: Keep turbopack for dev, use webpack for build only

Some practitioners use turbopack for `dev` and webpack for `build`. This works but means the service worker is only generated on production builds — not during local development. This is acceptable because SW behavior during dev can be tested with `next build && next start` or with `next dev --webpack`.

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 5)

```
src/
├── app/
│   ├── manifest.ts               # Web app manifest (built-in Next.js App Router convention)
│   ├── offline/
│   │   └── page.tsx              # Offline fallback page (D-10)
│   ├── globals.css               # Update --color-accent, --color-accent-hover (D-01)
│   └── layout.tsx                # Add OfflineBanner + UpdateToast + updated metadata (D-03, D-14)
├── components/
│   ├── OfflineBanner.tsx         # 'use client' — offline detection hook (D-11, D-12)
│   └── UpdateToast.tsx           # 'use client' — SW waiting detection (D-13, D-14)
public/
├── icons/
│   ├── icon-192.png              # Generated by scripts/generate-icons.ts (D-09)
│   └── icon-512.png
scripts/
└── generate-icons.ts             # Node.js script using sharp (D-09)
next.config.ts                    # Wrap with withPWA from @ducanh2912/next-pwa
```

### Pattern 1: next.config.ts PWA Wrapper

**What:** `@ducanh2912/next-pwa` wraps the entire Next.js config object via a higher-order function. The service worker and Workbox precaching manifest are generated at build time. [VERIFIED: npm registry description + workbox-webpack-plugin dependency]

**When to use:** Always — required for SW generation with this plugin.

```typescript
// Source: @ducanh2912/next-pwa documentation pattern (ASSUMED — not verified against live docs)
// next.config.ts
import withPWA from "@ducanh2912/next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = withPWAConfig({
  // existing config options
});

export default nextConfig;
```

**IMPORTANT:** The `disable: process.env.NODE_ENV === "development"` option disables SW in dev mode (recommended to avoid caching issues during development). This means you test SW behavior with a production build (`next build --webpack && next start`).

### Pattern 2: Built-in App Router Manifest (`app/manifest.ts`)

**What:** Next.js App Router has a built-in file convention for the web app manifest. Creating `app/manifest.ts` generates the `/manifest.webmanifest` endpoint automatically. [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`]

**When to use:** When the PWA plugin does not auto-generate the manifest, OR as the primary manifest source. This is the cleanest approach for the App Router.

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Min önskelista',
    short_name: 'Önskelista',
    description: 'Barnets önskelista — koordinera inköp utan att förstöra överraskningen',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF9F5',
    theme_color: '#FFF9F5',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
```

### Pattern 3: OfflineBanner Client Component

**What:** A `'use client'` component that subscribes to `window` online/offline events and shows/hides a sticky banner. [VERIFIED: D-11, D-12 from CONTEXT.md; web API is standard]

```typescript
// Source: standard Web API pattern — browser online/offline events
// src/components/OfflineBanner.tsx
'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // Set initial state in case we mount already offline
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 px-4 py-3 text-sm text-[#171717] transition-opacity duration-300"
      style={{ background: '#FFF0E8', borderBottom: '1px solid #E5D5CC', minHeight: '44px' }}
    >
      Du är offline — data kan vara föråldrad
    </div>
  );
}
```

### Pattern 4: UpdateToast with Workbox Window

**What:** Listen for the SW `waiting` event using `workbox-window`'s `Workbox` class. When a new SW is waiting, show a toast that calls `skipWaiting()` then reloads. [VERIFIED: workbox-window is a dependency of @ducanh2912/next-pwa; skipWaiting pattern is standard SW API — ASSUMED for exact workbox-window API]

```typescript
// Source: workbox-window pattern (ASSUMED — verify workbox-window API)
// src/components/UpdateToast.tsx
'use client';

import { useState, useEffect } from 'react';

export function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          setRegistration(reg);
          setShowUpdate(true);
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setRegistration(reg);
              setShowUpdate(true);
            }
          });
        });
      });
    }
  }, []);

  const handleUpdate = () => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-md"
      style={{ background: '#FFF0E8', border: '1px solid #E5D5CC' }}
    >
      <span className="text-sm text-[#171717]">Ny version tillgänglig</span>
      <button
        onClick={handleUpdate}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white min-h-[44px]"
        style={{ background: '#F9A87A' }}
      >
        Uppdatera nu
      </button>
    </div>
  );
}
```

**Note on `SKIP_WAITING`:** The service worker must listen for the `SKIP_WAITING` message and call `self.skipWaiting()`. `@ducanh2912/next-pwa`'s generated SW includes this handler automatically. [ASSUMED — verify against plugin behavior]

### Pattern 5: Sharp Icon Generation Script

**What:** Node.js script using `sharp` to create PNG icons programmatically. Sharp supports SVG compositing for text/emoji rendering. [VERIFIED: sharp 0.34.5 installed; `{create}` API tested locally]

```typescript
// scripts/generate-icons.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SIZES = [192, 512];
const BG_COLOR = { r: 255, g: 249, b: 245, alpha: 1 };
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'icons');

async function generateIcon(size: number): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // SVG with emoji centered — system font renders the gift emoji
  const fontSize = Math.round(size * 0.5);
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="55%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">🎁</text>
  </svg>`;

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG_COLOR },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));

  console.log(`Generated icon-${size}.png`);
}

Promise.all(SIZES.map(generateIcon)).catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
```

**Caveat:** Emoji rendering quality depends on the system's font stack. On a headless CI server, the gift emoji may render as a box or be missing. Consider using a pre-rasterized PNG of the gift symbol embedded as base64 SVG, or accept that the icon is generated at build-time on the dev machine and committed to the repo. [ASSUMED]

### Anti-Patterns to Avoid

- **Using `navigator.serviceWorker.register()` directly in layout.tsx:** With `@ducanh2912/next-pwa`, registration is handled by the plugin. Do not double-register.
- **Leaving `--webpack` off build scripts:** The PWA plugin will silently fail (no SW generated) if Turbopack is used. The build will succeed but no service worker will be produced.
- **Calling `skipWaiting()` directly from the client page:** Must use `postMessage({ type: 'SKIP_WAITING' })` to communicate to the SW context.
- **Using Tailwind `hidden` class for OfflineBanner when offline:** This makes the banner permanently absent from the DOM. Use conditional rendering (`if (!isOffline) return null`) or CSS opacity/height — both are acceptable. The UI-SPEC specifies opacity transition.
- **Hardcoding icon paths in manifest as `/icons/icon-192x192.png`:** The actual output path from D-09 is `public/icons/icon-192.png` → served as `/icons/icon-192.png`. Must match exactly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker with precaching | Custom SW with manual cache list | `@ducanh2912/next-pwa` (Workbox) | Workbox handles precache manifest generation, versioning, cache busting, and stale-while-revalidate strategies correctly; hand-rolled SW breaks with Next.js chunk hashing |
| SW update detection | Polling `navigator.serviceWorker.controller` | Standard SW `updatefound` / `statechange` events via `serviceWorker.ready` | The event-based pattern is the correct SW lifecycle approach |
| PNG icon generation from scratch | Manual PNG encoding | `sharp` | Already installed; handles PNG creation, compositing, and color management correctly |
| Web app manifest | Route handler returning JSON manually | `app/manifest.ts` built-in convention | Type-safe, auto-served at correct URL, integrated with Next.js metadata system |

**Key insight:** Service worker caching is deceptively complex — cache invalidation on deploy, navigation request handling, and offline fallback routing all have subtle edge cases. Workbox is the industry-standard solution precisely because it encodes years of these edge cases.

---

## Common Pitfalls

### Pitfall 1: Turbopack Silently Skips the PWA Plugin

**What goes wrong:** Developer runs `npm run dev` (which uses Turbopack by default in Next.js 16), installs `@ducanh2912/next-pwa`, wraps `next.config.ts` — and sees no errors, but no service worker is generated.

**Why it happens:** Turbopack ignores webpack plugins without throwing an error. The plugin simply doesn't execute.

**How to avoid:** Add `--webpack` flag to both `dev` and `build` scripts in `package.json`. Verify service worker registration in DevTools → Application → Service Workers after `next build --webpack && next start`.

**Warning signs:** `/sw.js` 404s in the Network tab; DevTools Application → Service Workers shows nothing registered.

### Pitfall 2: Service Worker Serves Stale Files After Deployment

**What goes wrong:** After a new deployment, users see old JS bundles because the SW has cached the previous precache manifest.

**Why it happens:** If `disable: process.env.NODE_ENV === "development"` is not set, the dev SW precaches chunks — which then conflict with production.

**How to avoid:** Always disable SW in development mode. Verify `Cache-Control: no-cache, no-store, must-revalidate` is set on `/sw.js` response (Next.js 16 PWA guide recommends this as a security header).

**Warning signs:** After `npm run build && npm start` + code change + rebuild, users don't see the update.

### Pitfall 3: iOS Safari Install Prompt Doesn't Show

**What goes wrong:** iOS Safari does not show an automatic "Add to Home Screen" prompt like Android Chrome does.

**Why it happens:** iOS Safari requires the user to manually tap the Share button → "Add to Home Screen". It does not support the `beforeinstallprompt` event. [VERIFIED: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`]

**How to avoid:** The success criterion is "presents an Add to Home Screen prompt" — this is met by the manifest's `display: standalone` and the browser's passive affordance. No custom prompt needed. The official Next.js docs explicitly say not to use `beforeinstallprompt` for cross-platform compatibility.

**Warning signs:** Trying to implement a custom "Install App" button that works on both iOS and Android will not work uniformly.

### Pitfall 4: Offline Fallback Not Served for Navigation Requests

**What goes wrong:** When offline and navigating to an uncached page, the browser shows a generic network error instead of `app/offline/page.tsx`.

**Why it happens:** The service worker must explicitly intercept navigation requests and return the offline fallback when the network is unavailable.

**How to avoid:** `@ducanh2912/next-pwa` supports a `fallbacks` configuration option pointing to the offline page URL. Configure `fallbacks: { document: '/offline' }` in the plugin options. [ASSUMED — verify against plugin docs]

**Warning signs:** Going offline and navigating to `/wishlist/[id]` shows a Chrome offline dinosaur page instead of the app's offline page.

### Pitfall 5: `navigator.onLine` Is Not Reliable for Initial State

**What goes wrong:** On some browsers, `navigator.onLine` returns `true` even when the device has no actual internet access (e.g., connected to a router with no WAN).

**Why it happens:** `navigator.onLine` only reflects whether the device is connected to a network, not whether it has internet access.

**How to avoid:** Use `navigator.onLine` for the initial state in the `useEffect` as a best-effort check. The `offline`/`online` event listeners are more reliable for state changes. Accept that the banner may not show in all offline scenarios — it's a progressive enhancement.

**Warning signs:** Users on captive portals don't see the offline banner even when Firestore fails.

### Pitfall 6: Sharp SVG Emoji Rendering in CI

**What goes wrong:** Icon generation script works locally but produces blank/broken icons in CI.

**Why it happens:** Sharp's SVG text rendering depends on system fonts. Servers running Linux Alpine or minimal containers may not have the emoji fonts installed.

**How to avoid:** Generate icons locally once and commit them to the repository. Add an npm script `generate:icons` that developers can run manually. Do not run icon generation as part of the CI build — treat the PNG files as build artifacts committed to git.

**Warning signs:** CI produces `icon-192.png` that is a solid peach rectangle with no visible emoji.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 5 is not a rename/refactor/migration phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Icon generation script | ✓ | v24.11.1 | — |
| `sharp` | Icon generation | ✓ | 0.34.5 | — |
| `canvas` npm | Icon generation (alternative) | ✗ | — | Use `sharp` (already installed) |
| Firebase emulator | Security rules verification (success criterion 5) | ✓ | via `firebase-tools` 15.13.0 | Manual rules review (downgrade confidence) |
| `@ducanh2912/next-pwa` | PWA plugin | ✗ (not yet installed) | — | Must install; no fallback |

**Missing dependencies with no fallback:**
- `@ducanh2912/next-pwa` — must install before implementation (`npm install @ducanh2912/next-pwa`)

**Missing dependencies with fallback:**
- None (canvas would have been an alternative but sharp is sufficient)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Turbopack opt-in (`next dev --turbopack`) | Turbopack is the **default** in Next.js 16 | Next.js 16.0 | Webpack plugins (including @ducanh2912/next-pwa) require `--webpack` flag |
| `public/manifest.json` static file | `app/manifest.ts` built-in App Router convention | Next.js 13.3 | Type-safe manifest generation; auto-served at correct URL |
| next-pwa (shadowwalker/next-pwa) | `@ducanh2912/next-pwa` → recommends `@serwist/next` | 2023–2024 | Original `next-pwa` is unmaintained; `@ducanh2912/next-pwa` readme suggests `@serwist/next` migration |
| `window.navigator.onLine` for offline state | `online`/`offline` event listeners + `navigator.onLine` for initial state | Always standard | Combined approach is most reliable |

**Deprecated/outdated:**
- `shadowwalker/next-pwa` (the original `next-pwa` package): unmaintained; replaced by `@ducanh2912/next-pwa`
- `beforeinstallprompt` custom install button: not cross-platform (no iOS Safari support); Next.js 16 docs explicitly advise against it [VERIFIED: progressive-web-apps.md]

---

## Security Domain

Phase 5 includes success criterion 5: Firestore rules emulator re-run confirming child UID cannot access `purchaseStatus` or `activityLog` subcollections.

### Existing Security Tests

The test file `tests/firestore.rules.test.ts` currently covers: [VERIFIED: file read]

- `DENY: child UID cannot read purchaseStatus subcollection` ✓
- `DENY: child UID cannot write to purchaseStatus subcollection` ✓
- `ALLOW: viewer UID can read purchaseStatus subcollection` ✓
- `ALLOW: viewer UID can write to purchaseStatus subcollection` ✓
- `DENY: unauthenticated user cannot read purchaseStatus` ✓
- `ALLOW: child UID can read items subcollection` ✓
- `ALLOW: viewer UID can read items subcollection` ✓
- `DENY: viewer UID cannot write to items subcollection` ✓
- `DENY: authenticated user cannot read invites collection` ✓

### Missing Test Cases for Phase 5

The `activityLog` subcollection is in the Firestore rules but NOT yet tested. Phase 5 success criterion 5 requires confirming `activityLog` is also protected. Need to add:

- `DENY: child UID cannot read activityLog subcollection`
- `DENY: child UID cannot write to activityLog subcollection`
- `ALLOW: viewer UID can read activityLog subcollection`
- `DENY: viewer UID cannot write to activityLog subcollection` (write is `if false` — Admin SDK only)

### Current Firestore Rules Assessment

The existing `firestore.rules` already contains the correct rules for `activityLog`: [VERIFIED: file read]

```
match /activityLog/{entryId} {
  allow read: if isViewer(wishlistId);
  allow write: if false;
}
```

The rules are correct. Phase 5 task is to **add test cases** proving they work, not to change the rules.

### PWA Security Headers

The Next.js 16 PWA guide recommends security headers in `next.config.ts`: [VERIFIED: progressive-web-apps.md]

```typescript
headers: [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // SW-specific:
  { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, // for /sw.js
]
```

These are standard hardening headers. They should be added to `next.config.ts` as part of Phase 5.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth in Phase 5 |
| V3 Session Management | No | No session changes |
| V4 Access Control | Yes | Firestore rules emulator test re-run (existing tests + new activityLog tests) |
| V5 Input Validation | No | No new user inputs |
| V6 Cryptography | No | No crypto in Phase 5 |

---

## Code Examples

### globals.css Token Update

```css
/* Source: CONTEXT.md D-01; existing file: src/app/globals.css */
:root {
  /* ... existing tokens unchanged ... */
  --color-accent: #F9A87A;       /* was #F97316 */
  --color-accent-hover: #F49060; /* was #EA6C0A */
  /* All other tokens stay as-is (D-02) */
}
```

### layout.tsx Metadata Update

```typescript
// Source: CONTEXT.md D-03; node_modules/next/dist/docs — Metadata API
// src/app/layout.tsx
export const metadata: Metadata = {
  title: 'Min önskelista',
  description: 'Barnets önskelista — koordinera inköp utan att förstöra överraskningen',
  openGraph: {
    title: 'Min önskelista',
    description: 'Barnets önskelista — koordinera inköp utan att förstöra överraskningen',
  },
};

// Also update <html lang="en"> → <html lang="sv">
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@ducanh2912/next-pwa` configuration options (`dest`, `cacheOnFrontEndNav`, `fallbacks.document`) | Architecture Patterns — Pattern 1 | Wrong options → SW not configured correctly; consult official docs at https://ducanh-next-pwa.vercel.app before coding |
| A2 | `@ducanh2912/next-pwa`'s generated SW includes a `SKIP_WAITING` message listener automatically | Architecture Patterns — Pattern 4 | If not included, the UpdateToast `postMessage` will be silently ignored; would need to add SW listener manually |
| A3 | `fallbacks: { document: '/offline' }` is the correct config key for offline fallback | Pitfall 4 | Wrong key → offline fallback URL not registered; user sees browser error instead of app page |
| A4 | Sharp SVG emoji rendering works on the dev machine and produces acceptable icons | Architecture Patterns — Pattern 5, Pitfall 6 | Emoji renders as box → icons look bad; mitigated by generating once and committing to repo |
| A5 | `@ducanh2912/next-pwa` does not conflict with `app/manifest.ts` (both can coexist) | Architecture Patterns | Plugin may auto-generate its own `manifest.json` to `public/` and conflict with App Router convention; verify after install |

---

## Open Questions

1. **Does `@ducanh2912/next-pwa` auto-generate `public/manifest.json`, or should we use `app/manifest.ts`?**
   - What we know: The plugin's `dest: "public"` outputs SW files. Some versions also output a manifest.
   - What's unclear: Whether it conflicts with the App Router's built-in `app/manifest.ts` file convention.
   - Recommendation: Use `app/manifest.ts` (type-safe, App Router native). If the plugin also generates a manifest, disable that behavior in plugin options. Verify after `npm install @ducanh2912/next-pwa` by checking the plugin's config options.

2. **Should SW be disabled in dev mode?**
   - What we know: With `disable: process.env.NODE_ENV === "development"`, the SW is not generated in dev. This means offline and update features cannot be tested with `next dev`.
   - What's unclear: Whether the planner should include a task for testing PWA features (requires `next build --webpack && next start`).
   - Recommendation: Disable SW in dev. Add a verification step in the plan using `next build --webpack && next start` to test PWA features.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` — PWA guide for Next.js 16.2.2: manifest, SW, security headers
- `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md` — Turbopack as default bundler; no webpack plugin support
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` — `app/manifest.ts` App Router convention
- `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md` — `--webpack` flag for dev and build
- `npm view @ducanh2912/next-pwa` — version 10.2.9, dependencies include workbox-webpack-plugin 7.1.1
- `firestore.rules` (local file) — existing security rules for activityLog subcollection
- `tests/firestore.rules.test.ts` (local file) — existing test coverage (no activityLog tests)
- `node_modules/sharp/package.json` — version 0.34.5 already installed
- `.planning/config.json` — `nyquist_validation: false` (no validation architecture section needed)

### Secondary (MEDIUM confidence)
- `npm view @ducanh2912/next-pwa readme` — plugin's own README recommends migrating to `@serwist/next`; confirms workbox basis
- `npm view @serwist/next peerDependencies` — peer deps include `@serwist/cli` (confirms it's a different integration path)

### Tertiary (LOW confidence — ASSUMED claims)
- `@ducanh2912/next-pwa` plugin configuration options (A1, A2, A3): not verified against live docs; verify at https://ducanh-next-pwa.vercel.app before implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from npm registry and local Next.js 16.2.2 docs
- Architecture: MEDIUM — Turbopack/webpack finding is HIGH; plugin config options are ASSUMED
- Security verification track: HIGH — rules and test file read directly
- Pitfalls: HIGH for Turbopack issue; MEDIUM for others based on standard SW knowledge

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable ecosystem; @ducanh2912/next-pwa is actively maintained)
