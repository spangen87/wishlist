# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — PWA

**Shipped:** 2026-04-10
**Phases:** 5 | **Plans:** 17 | **Commits:** 101 (36 feat)
**Timeline:** 4 days (2026-04-06 → 2026-04-10)

### What Was Built

- Next.js 16 + Firebase scaffold with correct subcollection privacy boundary (`purchaseStatus` viewer-only, enforced at Firestore rules layer)
- Dual Firebase SDK split (`client.ts` / `admin.ts`) as foundation for all future phases
- Full dual-role authentication: child username+password login (synthetic email shim), viewer email registration, `proxy.ts` route protection, persistent sessions
- Real-time wishlist management: item CRUD, fractional-indexing drag-and-drop (1 Firestore write per drag), privacy-safe child view
- Complete viewer flow: share link generation/redemption via Admin SDK, mark-as-purchased coordination, viewer-only notes, activity log, multi-child dashboard
- PWA installability (iOS/Android standalone), Workbox offline cache, pastel family-friendly UI design system
- 13 Firestore security rule emulator tests confirming privacy boundary in production rules

### What Worked

- **Architecture-first Phase 1** — nailing the irreversible subcollection schema in Phase 1 meant no rework in later phases; the privacy boundary held without modification all the way through Phase 5 security tests
- **Wave-based plan execution** — independent plans executed in parallel where possible cut wall-clock time significantly
- **Emulator-first development** — having Firebase emulators configured from Phase 1 made auth flows and security rule testing straightforward in every subsequent phase
- **Fractional indexing decision** — one Firestore write per drag vs. O(n) rewrites was the right call; implementation was clean with `generateKeyBetween`

### What Was Inefficient

- **MILESTONES.md extraction errors** — the `summary-extract` CLI tool failed silently on the SUMMARY.md format, producing garbage entries ("1. [Rule 1 - Bug]", blank "One-liner:" lines) that required manual correction at milestone completion
- **STATE.md stale progress bar** — the progress bar showed 60% even when milestone was 100% complete; STATE.md wasn't kept in sync with actual completion
- **proxy.ts vs. middleware.ts discovery** — cost time discovering Next.js 16 dropped middleware-based auth in favor of proxy.ts; this should be in the phase context from the start on Next.js projects

### Patterns Established

- Firebase subcollection privacy pattern: separate `purchaseStatus/{itemId}` from `items/{itemId}` so Firestore rules can enforce the boundary at the DB layer — not app layer
- Synthetic email shim for username-only child accounts: `{username}@wishlist.internal` in Firebase Auth, with `usernames/{username}` → uid mapping collection
- `proxy.ts` (not `middleware.ts`) for Next.js 16 route protection — optimistic guard, real auth in AuthProvider
- Admin SDK batch write for invite redemption — never use client SDK for security-sensitive invite flow
- `server-only` guard on `lib/firebase/admin.ts` — prevents accidental client bundle inclusion of service account credentials

### Key Lessons

1. **Lock irreversible schema decisions in Phase 1** — the subcollection split could not be changed after data exists; getting it right first eliminated a class of future rework
2. **SUMMARY.md one_liner field must match exactly what gsd-tools expects** — tools fail silently if the field name or format doesn't match; validate extraction during phase completion, not milestone completion
3. **Next.js version-specific patterns diverge fast** — always check `node_modules/next/dist/docs/` for the actual version in use; middleware, routing, and server component patterns changed significantly in v16

### Cost Observations

- Model mix: primarily Sonnet 4.6 for execution
- Sessions: ~8-10 sessions across 4 days
- Notable: 4-day turnaround from empty repo to shipped PWA with full auth, real-time sync, viewer coordination, and PWA installability

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Timeline | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 PWA | 5 | 17 | 4 days | Initial — established all base patterns |

### Cumulative Quality

| Milestone | Security Tests | Privacy Boundary | PWA |
|-----------|---------------|-----------------|-----|
| v1.0 | 13 emulator tests | ✓ Firestore rules | ✓ iOS + Android |

### Top Lessons (Verified Across Milestones)

1. Architecture-first phases (irreversible decisions in Phase 1) prevent compounding rework
2. Emulator-first development enables confidence in security rules and auth flows without live Firebase costs
