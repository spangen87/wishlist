---
phase: 05-pwa-polish
plan: 02
subsystem: pwa
tags: [pwa, service-worker, manifest, icons, workbox, offline]
dependency_graph:
  requires: []
  provides: [PWA-01, PWA-02]
  affects: [next.config.ts, package.json, public/sw.js]
tech_stack:
  added: ["@ducanh2912/next-pwa@10.x", "sharp (icon generation via tsx)"]
  patterns: ["withPWA wrapper", "Next.js App Router manifest convention", "Workbox GenerateSW"]
key_files:
  created:
    - src/app/manifest.ts
    - scripts/generate-icons.ts
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/sw.js
    - public/workbox-9dfdb848.js
    - public/fallback-ce627215c0e4a9af.js
    - public/swe-worker-5c72df51bb1f6ee0.js
  modified:
    - package.json
    - next.config.ts
decisions:
  - "@ducanh2912/next-pwa chosen over serwist per RESEARCH.md — better Next.js 16 compatibility, simpler API"
  - "Service worker disabled in development (disable: NODE_ENV === development) — prevents caching issues during dev"
  - "Icons committed to repo (not generated at build time) — emoji rendering depends on system fonts, must be stable"
  - "tsx used instead of ts-node --esm for generate-icons script — simpler ESM handling"
metrics:
  duration: "~20 min"
  completed: "2026-04-10"
  tasks_completed: 2
  files_changed: 10
requirements_satisfied: [PWA-01, PWA-02]
---

# Phase 05 Plan 02: PWA Infrastructure Summary

**One-liner:** Workbox service worker via @ducanh2912/next-pwa with offline fallback, App Router manifest at /manifest.webmanifest, and 192/512px PNG icons committed to repo.

## What Was Built

Full PWA infrastructure enabling installability (PWA-01) and offline capability (PWA-02):

1. **@ducanh2912/next-pwa installed** — wraps next.config.ts with withPWA, generates sw.js at build time via Workbox GenerateSW strategy.

2. **Turbopack incompatibility fixed** — added `--webpack` flag to `dev` and `build` scripts in package.json. Without this, the plugin silently produces no service worker (Turbopack does not support workbox-webpack-plugin).

3. **next.config.ts configured** with:
   - `dest: "public"` — sw.js served at /sw.js
   - `fallbacks: { document: "/offline" }` — maps failed offline navigation to offline page
   - `disable: process.env.NODE_ENV === "development"` — no SW in dev
   - `cacheOnFrontEndNav: true` + `aggressiveFrontEndNavCaching: true` — cache-first navigation
   - `reloadOnOnline: true` — auto-reload when connectivity restored

4. **src/app/manifest.ts created** — Next.js App Router built-in convention, served at /manifest.webmanifest:
   - name: "Min önskelista", short_name: "Önskelista"
   - display: standalone, theme_color: #FFF9F5, background_color: #FFF9F5
   - Icons: /icons/icon-192.png, /icons/icon-512.png

5. **scripts/generate-icons.ts** — generates PNG icons via sharp with #FFF9F5 background and gift emoji overlay; solid background fallback if emoji rendering fails.

6. **Icons generated and committed** — public/icons/icon-192.png (1.6KB) and icon-512.png (8.7KB), both generated successfully with emoji on this system.

7. **public/sw.js generated** — Workbox service worker at build time, 11KB, with cache-first strategy for static assets and offline document fallback.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | f4df5aa | feat(05-02): install @ducanh2912/next-pwa, enable webpack mode, configure Workbox |
| Task 2 | 58a6939 | feat(05-02): create web manifest, generate PWA icons, produce service worker |

## Verification Results

- `package.json` contains `"dev": "next dev --webpack"` — PASS
- `package.json` contains `"build": "next build --webpack"` — PASS
- `next.config.ts` contains `import withPWA from "@ducanh2912/next-pwa"` — PASS
- `next.config.ts` exports `withPWAConfig(nextConfig)` — PASS
- `next.config.ts` contains `disable: process.env.NODE_ENV === "development"` — PASS
- `next.config.ts` contains `fallbacks: { document: "/offline" }` — PASS
- `src/app/manifest.ts` contains `name: 'Min önskelista'` — PASS
- `src/app/manifest.ts` contains `short_name: 'Önskelista'` — PASS
- `src/app/manifest.ts` contains `display: 'standalone'` — PASS
- `src/app/manifest.ts` contains `theme_color: '#FFF9F5'` — PASS
- `public/icons/icon-192.png` exists (1624 bytes) — PASS
- `public/icons/icon-512.png` exists (8674 bytes) — PASS
- `public/sw.js` generated at build time (11642 bytes) — PASS
- TypeScript: `npx tsc --noEmit` exits 0 — PASS

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Build Note (Out of Scope)

`npm run build` exits with code 1 due to a pre-existing `auth/invalid-api-key` Firebase error during static prerendering of `/_not-found`. This occurs because Firebase env vars are not set in the build environment. This is unrelated to PWA infrastructure and was present before this plan. The PWA compilation step (webpack + Workbox) completed successfully before the Firebase error — sw.js is confirmed generated at `public/sw.js`.

This pre-existing issue is out of scope per deviation rules (not caused by this plan's changes).

## Checkpoint Status

A `checkpoint:human-verify` gate follows the two auto tasks. The human must verify:
1. Chrome DevTools → Application → Manifest shows "Min önskelista", icons, standalone mode
2. Application → Service Workers shows sw.js "activated and running"
3. /manifest.webmanifest returns valid JSON
4. Offline fallback shows /offline page instead of Chrome error
5. Lighthouse PWA audit passes "Installable" criterion

Run with: `npm run build && npm start` (requires Firebase env vars to be set for successful build)

## Known Stubs

None — all manifest fields are wired with real values, icons are real PNG files.

## Threat Flags

No new security surface beyond what was planned in the threat model.
