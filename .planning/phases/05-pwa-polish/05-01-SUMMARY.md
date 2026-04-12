---
phase: 05-pwa-polish
plan: 01
subsystem: ui-polish
tags: [css, layout, pwa, offline, accessibility]
dependency_graph:
  requires: []
  provides: [accent-token-pastel, swedish-metadata, offline-banner, update-toast]
  affects: [all-pages, root-layout]
tech_stack:
  added: []
  patterns: [css-custom-properties, use-client-components, service-worker-postmessage]
key_files:
  created:
    - src/app/offline/page.tsx
    - src/components/OfflineBanner.tsx
    - src/components/UpdateToast.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
decisions:
  - "OfflineBanner uses height+opacity toggle (h-0/h-11) rather than display:none so CSS transition works smoothly"
  - "UpdateToast returns null when no update pending — no DOM overhead at runtime for the common case"
metrics:
  duration: ~12 min
  completed: 2026-04-09
  tasks_completed: 2
  files_changed: 5
---

# Phase 05 Plan 01: UI Polish Pass — Accent Tokens, Swedish Metadata, and PWA Components Summary

**One-liner:** Pastel peach accent (#F9A87A) replaces vivid orange site-wide, root layout gains Swedish metadata with OpenGraph, and OfflineBanner + UpdateToast are globally mounted for offline/update awareness.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update CSS accent tokens and root layout metadata | 91231e9 | globals.css, layout.tsx, src/app/offline/page.tsx |
| 2 | Create OfflineBanner and UpdateToast client components | 9d558b0 | OfflineBanner.tsx, UpdateToast.tsx, layout.tsx |

## What Was Built

### Task 1 — CSS Accent Tokens + Metadata + Offline Page
- `globals.css`: `--color-accent` changed from `#F97316` to `#F9A87A`; `--color-accent-hover` from `#EA6C0A` to `#F49060`. Old vivid orange is fully gone.
- `layout.tsx`: metadata title set to "Min önskelista", description and OpenGraph in Swedish, `lang="sv"` on html element.
- `src/app/offline/page.tsx`: new offline fallback page route with "Du är offline" heading and reconnect instruction.

### Task 2 — OfflineBanner + UpdateToast
- `OfflineBanner.tsx`: `'use client'` component with `window.addEventListener('offline'/'online')` listeners, sticky top-0 z-50, fade via height+opacity toggle, `role="status" aria-live="polite"` for screen readers, `#FFF0E8` background with `#E5D5CC` border.
- `UpdateToast.tsx`: `'use client'` component detecting SW update via `navigator.serviceWorker.ready` + `updatefound` event; `postMessage({ type: 'SKIP_WAITING' })` to trigger SW activation; fixed bottom-center, non-blocking, accent CTA button with `#F9A87A` background; disabled+opacity-50 loading state during update.
- `layout.tsx`: both components imported and mounted — OfflineBanner immediately after `<body>` open tag (before AuthProvider), UpdateToast after AuthProvider.

## Verification Results

1. `npx tsc --noEmit` — exits 0, no TypeScript errors
2. `--color-accent: #F9A87A` and `--color-accent-hover: #F49060` confirmed in globals.css; `#F97316` and `#EA6C0A` absent
3. Swedish metadata confirmed: "Min önskelista", `lang="sv"`, OpenGraph block present
4. Both component imports and JSX mounts confirmed in layout.tsx
5. `src/app/offline/page.tsx` exists with "Du är offline" heading

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All components are fully wired to real browser APIs (navigator.onLine, ServiceWorker).

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced beyond those analyzed in the plan threat model (T-05-01-01 through T-05-01-04, all accepted).

## Self-Check

Checking files and commits exist:

| Item | Status |
|------|--------|
| src/app/globals.css | FOUND |
| src/app/layout.tsx | FOUND |
| src/app/offline/page.tsx | FOUND |
| src/components/OfflineBanner.tsx | FOUND |
| src/components/UpdateToast.tsx | FOUND |
| commit 91231e9 | FOUND |
| commit 9d558b0 | FOUND |

## Self-Check: PASSED
