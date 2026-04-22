# Wishlist

## What This Is

En webbapp (PWA) där barn kan skapa och hantera sina önskelistor. Föräldrar och släkt bjuds in via delningslänk och kan se listan, markera köpta saker och skriva anteckningar — utan att barnet ser vad som är avbockat. Appen är byggd med Next.js och Firebase och kan installeras på telefonens hemskärm.

## Core Value

Barnet äger sin önskelista och kan enkelt lägga till önskningar; föräldrar och släkt kan koordinera inköp utan att förstöra överraskningen.

## Requirements

### Validated

- ✓ Förälder kan registrera ett barnkonto (med sin e-post) och barnet loggar in med användarnamn + lösenord — v1.0
- ✓ Barn kan lägga till önskemål med titel, länk, bild via URL, anteckning och ungefärligt pris — v1.0
- ✓ Drag-and-drop för att ändra ordning på önskemål — v1.0 (fractional indexing, 1 Firestore write per drag)
- ✓ Delningslänk — vem som helst med länken kan gå med som "betraktare" på barnets lista — v1.0
- ✓ Betraktare (föräldrar/släkt) kan se listan, bocka av köpta saker och lämna egna anteckningar — v1.0
- ✓ Aktivitetslogg: spårar vilken användare som gjort vad (bockat av, antecknat etc.) — v1.0
- ✓ Barnets vy döljer vad som är avbockat/köpt — överraskningseffekten bevaras — v1.0 (enforced at Firestore rules layer)
- ✓ En förälder/betraktare kan hantera flera barns önskelistor från samma konto — v1.0
- ✓ Realtidssynkronisering — flera enheter ser ändringar direkt (via Firebase) — v1.0
- ✓ PWA — kan läggas till på hemskärmen på telefon — v1.0 (iOS Safari + Android Chrome)
- ✓ Pastellfärger med mjuka konturer, genusneutralt och barnvänligt UI — v1.0

### Active

(None — all v1.0 requirements shipped. Add v1.1 requirements here.)

### Out of Scope

- PIN-kodat föräldraläge inom samma konto — valt separata konton med inbjudningssystem istället (tydligare rollseparation)
- E-post-inbjudningar — delningslänk räcker för v1
- Mobilapp (React Native / Expo) — PWA täcker behovet; standalone mode fungerar väl på iOS/Android
- Push-notifikationer — v2
- Betalfunktioner/integrationer mot butiker — v2

## Context

- **Shipped v1.0** on 2026-04-10, 4 days from scaffold to shipped PWA
- ~3,335 LOC TypeScript/TSX, 136 files, 36 feat commits
- Stack: Next.js 16, Firebase Firestore (realtid), Firebase Auth, @ducanh2912/next-pwa (Workbox), dnd-kit, Tailwind CSS v4
- Firestore subcollection privacy boundary (`purchaseStatus` viewer-only) confirmed by 13 emulator security rule tests
- Supabase används på annat projekt (gratis-kvoten uppnådd), därav Firebase
- Appen är primärt avsedd för familjer med barn i skolålder
- Initial deployment target: Vercel (free tier)

## Constraints

- **Databas**: Firebase Firestore — gratis tier, realtid, ingen SQL
- **Hosting**: Vercel eller Firebase Hosting — gratis tier
- **Auth**: Firebase Authentication — barnkonto (username/password via email-wrapper) + betraktarkonton
- **Platform**: Webb-first PWA, Next.js — inga native app stores i v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separata konton (barn + betraktare) istället för delat konto med PIN | Tydligare rollseparation, betraktare kan hantera flera barn | ✓ Good — clean role separation, viewer dashboard works naturally |
| Firebase Firestore istället för Supabase | Supabase gratis-kvot uppnådd; Firebase gratis tier är generös + realtid inkluderat | ✓ Good — real-time listeners worked seamlessly |
| Delningslänk istället för e-postinbjudan | Enklare flöde, ingen e-post-infrastruktur behövs i v1 | ✓ Good — invite redemption via Admin SDK token is secure and simple |
| Next.js + PWA istället för React Native | Webb räcker, undviker App Store-process | ✓ Good — standalone mode on iOS/Android met the requirement |
| purchaseStatus as separate subcollection (irreversible) | Privacy boundary must be enforced at DB layer, not app layer | ✓ Good — child literally cannot read the subcollection, confirmed by emulator tests |
| Synthetic email for child accounts ({username}@wishlist.internal) | Firebase Auth requires email; username-only login needs a shim | ✓ Good — transparent to child, username→uid map in `usernames/` collection |
| Fractional indexing for drag order (one write per drag) | Integer positions require O(n) writes on reorder | ✓ Good — single Firestore write per drag confirmed |
| proxy.ts (Next.js 16) replacing middleware.ts | Next.js 16 changed middleware behavior; proxy.ts is the new pattern | ✓ Good — optimistic route guard works; server-side token verification deferred to v1.1 |
| @ducanh2912/next-pwa over next-pwa | next-pwa unmaintained; ducanh fork actively maintained for Next.js 15+ | ✓ Good — Workbox GenerateSW works correctly with App Router |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after Phase 8 — Security, Auth & Account Fixes*

**Phase 8 complete:** Tightened Firestore security rules (SEC-01/SEC-02/SEC-03), fixed BUG-01 child visibility regression, resolved PERF-01 listener leak and PERF-03 position corruption, removed dead code and debug pages.
