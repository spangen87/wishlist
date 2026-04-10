# Phase 5: PWA + Polish - Context

**Gathered:** 2026-04-09 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app installable on phone home screens (PWA manifest + standalone mode), readable offline for cached wishlist data (service worker + cache strategy), polished with the pastel family-friendly visual design system (all user-facing pages), and updated gracefully when a new version is deployed (update toast). No new features — this is PWA infrastructure + visual coherence.

</domain>

<decisions>
## Implementation Decisions

### Color Palette & UI Tokens
- **D-01:** Accent color shifts from vivid orange (#F97316) to a softer peach/rose tone (e.g., #FBBF99 or #F4A8A8). The warm character is preserved but the harshness is removed. Choose a specific hex in the pastel/warm range — not saturated primary colors.
- **D-02:** Background tokens (#FFF9F5, #FFF0E8, #E5D5CC) stay as-is — they are already pastel-appropriate.
- **D-03:** All user-facing pages receive the UI polish treatment: login, register, wishlist, viewer, dashboard, invite page, settings. `layout.tsx` gets proper app title, description, and Open Graph metadata.
- **D-04:** Cards across all pages use rounded corners (`rounded-xl` or similar) and soft shadows (`shadow-sm` or `shadow-md`). Consistent with the child-friendly aesthetic established in Phases 3–4.

### PWA Implementation
- **D-05:** Use `@ducanh2912/next-pwa` (serwist-based) as the PWA plugin. Configure in `next.config.ts`. This is the maintained App Router-compatible fork.
- **D-06:** App name in manifest: `"Min önskelista"`. Short name: `"Önskelista"`. These appear on the home screen after installation.
- **D-07:** PWA theme color: matches `--color-bg` (#FFF9F5). Background color in manifest: `#FFF9F5`.
- **D-08:** Display mode: `standalone` — the installed app opens without browser chrome (no address bar).
- **D-09:** Icons generated programmatically via a Node.js script using the `canvas` npm package (or `sharp`). Two sizes required: 192×192 and 512×512 PNG. Design: pastel background (matching `--color-bg`) + a gift or star emoji/character centered. Output to `public/icons/`.
- **D-10:** Caching strategy via Serwist: cache-first for static assets (`/_next/static/`), stale-while-revalidate for pages. Offline fallback page at `public/offline.html` or an `app/offline/page.tsx` route shown when network is unavailable.

### Offline Indicator
- **D-11:** When the app is offline and displaying cached data, show a non-intrusive sticky banner at the top of the page: "Du är offline — data kan vara föråldrad" (Swedish). The banner disappears automatically when the connection is restored. This applies on wishlist and viewer pages where stale data is a concern.
- **D-12:** Offline detection via `window.addEventListener('online'/'offline')` in a client component or hook. No server-side logic needed.

### Update Prompt
- **D-13:** When a new service worker is waiting (new deployment detected), show a soft toast/banner: "Ny version tillgänglig — uppdatera nu" with a reload button. Tapping the button calls `skipWaiting()` on the waiting SW and then `window.location.reload()`.
- **D-14:** The update detection listens for the SW `waiting` event via the `@ducanh2912/next-pwa` Serwist integration. The toast component lives in the root layout so it's available on all pages.
- **D-15:** The toast is non-modal and non-blocking — the user can continue using the app without updating. It does not auto-dismiss.

### Claude's Discretion
- Exact peach/rose hex value for the new accent (within the pastel warm range)
- Specific Tailwind class choices for rounded corners and shadows
- Icon generation script implementation details
- Offline fallback page content and design
- Toast component animation and positioning (top vs bottom of screen)
- Whether to use a separate `useServiceWorker` hook or inline SW registration logic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 5 success criteria (5 criteria, all must be met)
- `.planning/REQUIREMENTS.md` — PWA-01, PWA-02, UI-01, UI-02

### Existing design tokens
- `src/app/globals.css` — Current CSS custom properties (`--color-bg`, `--color-card`, `--color-accent`, etc.). D-01 requires updating `--color-accent` and `--color-accent-hover`.
- `src/app/layout.tsx` — Root layout; needs metadata update (D-03) and SW registration component + update toast (D-14).

### Prior phase context
- `.planning/phases/03-child-wishlist/03-CONTEXT.md` — Established card design, inline patterns, Tailwind conventions
- `.planning/phases/04-viewer-flow/04-CONTEXT.md` — Viewer card design should match child card design (same pastel tokens)

### External docs
- No external specs — requirements fully captured in decisions above and REQUIREMENTS.md

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` — CSS custom properties already in place; D-01 is a targeted token swap
- `src/components/AuthProvider.tsx` — Root-level provider; update toast can be added alongside it in layout.tsx
- `src/app/layout.tsx` — Single root layout that wraps all pages; ideal place for SW registration and update prompt

### Established Patterns
- Tailwind CSS for all styling (no CSS modules or styled-components)
- `'use client'` directive for interactive components; server components for data-free layouts
- Custom CSS tokens in `:root` consumed via Tailwind `var(--...)` or inline styles
- All pages already use pastel backgrounds and card containers — token swap (D-01) propagates automatically

### Integration Points
- `next.config.ts` — PWA plugin wraps the entire Next.js config (D-05)
- `public/` — Icons (D-09), manifest (auto-generated by plugin or manually placed)
- `src/app/layout.tsx` — SW registration + update toast mount point (D-14)
- Every page component — offline banner hook/component insertion (D-11)

</code_context>

<specifics>
## Specific Ideas

- The app is primarily in Swedish — all user-facing PWA/offline strings should be Swedish: "Min önskelista", "Du är offline — data kan vara föråldrad", "Ny version tillgänglig — uppdatera nu".
- The pastel background (#FFF9F5) is warm and slightly peachy already — the new accent should harmonize with it, not contrast sharply.
- The update toast should feel lightweight and friendly, not alarming. No red warning colors.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 5 scope.

</deferred>

---

*Phase: 05-pwa-polish*
*Context gathered: 2026-04-09*
