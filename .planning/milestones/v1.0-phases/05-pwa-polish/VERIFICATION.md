---
phase: 05-pwa-polish
verified: 2026-04-09T00:00:00Z
status: human_needed
score: 8/10 must-haves verified
re_verification: false
human_verification:
  - test: "Install prompt appears on iOS Safari and Android Chrome"
    expected: "'Add to Home Screen' affordance appears; installed app opens in standalone mode (no browser chrome)"
    why_human: "Cannot verify install prompt or standalone mode display without a real or emulated mobile browser"
  - test: "After new deployment, UpdateToast prompts user to update"
    expected: "A user with the old SW active sees the 'Ny version tillgänglig' toast and can click 'Uppdatera nu'"
    why_human: "Requires two sequential deployments with a running browser session to observe SW update lifecycle"
---

# Phase 5: PWA + Polish Verification Report

**Phase Goal:** The app is installable on a phone home screen, works offline for cached data, renders with the pastel family-friendly visual design, and passes a final security hardening review.
**Verified:** 2026-04-09
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Accent color is #F9A87A (peach) on all CTA buttons — vivid orange #F97316 is gone | VERIFIED | `globals.css` line 8: `--color-accent: #F9A87A`; grep confirms #F97316 and #EA6C0A are absent |
| 2 | layout.tsx title is 'Min önskelista', description is Swedish, html lang="sv" | VERIFIED | `layout.tsx` lines 19, 34: title, description, openGraph, and lang="sv" all present |
| 3 | Open Graph og:title and og:description are set in layout metadata | VERIFIED | `layout.tsx` lines 21–24: openGraph block with title and description confirmed |
| 4 | globals.css --color-accent is #F9A87A and --color-accent-hover is #F49060 | VERIFIED | `globals.css` lines 8–9: both tokens correct, old vivid orange absent |
| 5 | PWA manifest exists (manifest.ts) with name, display, id, icons | VERIFIED | `src/app/manifest.ts` present: name='Min önskelista', display='standalone', id='/', icons for 192 and 512 |
| 6 | next.config.ts wraps config with withPWA; webpack mode enabled; offline fallback wired | VERIFIED | `next.config.ts` uses `withPWA`, `fallbacks: { document: "/offline" }`, `disable: NODE_ENV==="development"`; `package.json` has `--webpack` on dev and build |
| 7 | Service worker (public/sw.js) and icons (public/icons/*.png) exist as build artifacts | VERIFIED | `public/sw.js` (11,736 bytes), `icon-192.png` (1,624 bytes), `icon-512.png` (8,674 bytes) all exist |
| 8 | OfflineBanner and UpdateToast are substantively implemented and mounted in root layout | VERIFIED | Both components exist with real browser API wiring (navigator.onLine, SW postMessage); both imported and mounted in layout.tsx body |
| 9 | Visiting the app on iOS Safari / Android Chrome presents 'Add to Home Screen' prompt | UNCERTAIN | Requires human verification on device or mobile emulator |
| 10 | After new deployment, UpdateToast detects waiting service worker and shows update prompt | UNCERTAIN | Requires two sequential deployments and an active browser session |

**Score:** 8/10 truths verified (2 require human)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/globals.css` | --color-accent: #F9A87A | VERIFIED | Token present, old #F97316 absent |
| `src/app/layout.tsx` | lang="sv", title "Min önskelista", OfflineBanner + UpdateToast mounted | VERIFIED | All four checks pass |
| `src/app/manifest.ts` | PWA manifest with name, icons, id, display | VERIFIED | All required fields present including id='/' |
| `next.config.ts` | withPWA wrapper | VERIFIED | Import and export wrap confirmed |
| `public/sw.js` | Service worker from build | VERIFIED | 11,736 byte file exists |
| `public/icons/icon-192.png` | 192x192 PWA icon | VERIFIED | 1,624 bytes, non-empty |
| `public/icons/icon-512.png` | 512x512 PWA icon | VERIFIED | 8,674 bytes, non-empty |
| `src/components/OfflineBanner.tsx` | Offline detection client component | VERIFIED | `'use client'`, offline/online event listeners, role="status", aria-live="polite" |
| `src/components/UpdateToast.tsx` | SW update detection client component | VERIFIED | `'use client'`, navigator.serviceWorker.ready, postMessage({type:'SKIP_WAITING'}), fixed bottom-center |
| `src/app/offline/page.tsx` | Offline fallback page | VERIFIED | "Du är offline" heading present |
| `tests/firestore.rules.test.ts` | activityLog tests with ACTIVITY_LOG_ID | VERIFIED | ACTIVITY_LOG_ID constant at line 18; 4 activityLog test cases at lines 207–247 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `globals.css` | All pages | `--color-accent` CSS custom property | VERIFIED | Property defined at :root scope; old vivid orange absent |
| `layout.tsx` | OfflineBanner + UpdateToast | import + JSX render in body | VERIFIED | Lines 5–6 imports; lines 38, 40 JSX mounts |
| `next.config.ts` | `public/sw.js` | @ducanh2912/next-pwa withPWA at build time | VERIFIED | sw.js exists at 11,736 bytes; package.json uses --webpack flag |
| `src/app/manifest.ts` | `/manifest.webmanifest` | Next.js App Router built-in file convention | VERIFIED | File at correct location `src/app/manifest.ts`; exports MetadataRoute.Manifest |
| `public/icons/*.png` | `manifest.ts` icons array | icon src paths `/icons/icon-192.png` and `/icons/icon-512.png` | VERIFIED | manifest.ts references exact paths; both PNG files exist |
| `tests/firestore.rules.test.ts` | `firestore.rules` | Firebase emulator rules unit testing | VERIFIED | Test file seeds activityLog, runs 4 assertions; 05-03-SUMMARY confirms all 13 tests pass |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `OfflineBanner.tsx` | `isOffline` | `navigator.onLine` + window events | Yes — browser API, not hardcoded | FLOWING |
| `UpdateToast.tsx` | `showUpdate`, `registration` | `navigator.serviceWorker.ready` + updatefound event | Yes — real SW lifecycle API | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| sw.js is non-empty build artifact | `wc -c public/sw.js` | 11,736 bytes | PASS |
| Icon-192 is non-empty PNG | `wc -c public/icons/icon-192.png` | 1,624 bytes | PASS |
| Icon-512 is non-empty PNG | `wc -c public/icons/icon-512.png` | 8,674 bytes | PASS |
| Old vivid orange absent from globals.css | `grep F97316 globals.css` | 0 matches | PASS |
| activityLog tests present (4+ lines) | `grep -c activityLog tests/firestore.rules.test.ts` | 10 matches | PASS |
| PWA install prompt on real device | Requires mobile browser | Not run | SKIP — needs human |
| UpdateToast fires after new deploy | Requires two live deployments | Not run | SKIP — needs human |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 05-01-PLAN | Pastel child-friendly design | SATISFIED | #F9A87A accent, Swedish copy, rounded cards in existing components |
| PWA-01 | 05-02-PLAN | App installable on phone home screen | PARTIAL — needs human | manifest.ts + sw.js + icons exist; install prompt requires human device test |
| PWA-02 | 05-02-PLAN | Offline capability with cached content | PARTIAL — needs human | Service worker with Workbox configured; offline behavior requires running app test |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments found in modified files. No empty return stubs. No hardcoded empty arrays passed to rendered components.

---

## Human Verification Required

### 1. PWA Install Prompt (iOS Safari + Android Chrome)

**Test:** Build and serve the app with `npm run build && npm start` (with Firebase env vars set). On an Android device or Chrome DevTools mobile emulation, navigate to the app root. On iOS Safari, open the share sheet.
**Expected:** Android Chrome shows "Add to Home Screen" prompt or three-dot menu option. iOS Safari shows "Add to Home Screen" in share sheet. After install, the app opens without browser chrome (standalone mode).
**Why human:** Cannot verify install eligibility or standalone launch behavior without a live browser and device environment.

### 2. UpdateToast SW Update Detection

**Test:** Deploy the app once, open it in a browser. Deploy a second time with a code change (or simulate by clearing SW cache and reloading). Wait for the UpdateToast to appear.
**Expected:** "Ny version tillgänglig" toast appears at the bottom of the screen. Clicking "Uppdatera nu" reloads the page with the new version. The button shows opacity-50 while updating.
**Why human:** Requires two sequential deployed builds and an active browser session to observe the SW update lifecycle — cannot simulate the waiting SW state without a full runtime environment.

---

## Gaps Summary

No automated gaps. All 8 programmatically verifiable truths are confirmed against actual files on disk. The two unverified items (install prompt, update toast behavior) require a running browser with a deployed service worker — they are behavioral/UX verifications that cannot be confirmed by static code analysis.

The phase has delivered all code artifacts at full quality:
- Pastel peach accent is live (#F9A87A replaces #F97316, verified absent)
- Swedish metadata confirmed in layout.tsx (lang="sv", title, OG tags)
- OfflineBanner and UpdateToast wired to real browser APIs and mounted globally
- PWA manifest correct (name, short_name, id, display, theme_color, icons)
- Service worker and icons exist as committed build artifacts
- withPWA configured with Workbox offline fallback to /offline
- 13/13 Firestore security rule tests confirmed passing (per 05-03-SUMMARY; 4 new activityLog cases + 9 existing)

---

_Verified: 2026-04-09_
_Verifier: Claude (gsd-verifier)_
