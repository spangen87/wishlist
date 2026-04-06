# Wishlist

## What This Is

En webbapp (PWA) där barn kan skapa och hantera sina önskelistor. Föräldrar och släkt bjuds in via delningslänk och kan se listan, markera köpta saker och skriva anteckningar — utan att barnet ser vad som är avbockat. Appen är byggd med Next.js och Firebase.

## Core Value

Barnet äger sin önskelista och kan enkelt lägga till önskningar; föräldrar och släkt kan koordinera inköp utan att förstöra överraskningen.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Förälder kan registrera ett barnkonto (med sin e-post) och barnet loggar in med användarnamn + lösenord
- [ ] Barn kan lägga till önskemål med titel, länk, bild via URL, anteckning och ungefärligt pris
- [ ] Drag-and-drop för att ändra ordning på önskemål
- [ ] Delningslänk — vem som helst med länken kan gå med som "betraktare" på barnets lista
- [ ] Betraktare (föräldrar/släkt) kan se listan, bocka av köpta saker och lämna egna anteckningar
- [ ] Aktivitetslogg: spårar vilken användare som gjort vad (bockat av, antecknat etc.)
- [ ] Barnets vy döljer vad som är avbockat/köpt — överraskningseffekten bevaras
- [ ] En förälder/betraktare kan hantera flera barns önskelistor från samma konto
- [ ] Realtidssynkronisering — flera enheter ser ändringar direkt (via Firebase)
- [ ] PWA — kan läggas till på hemskärmen på telefon
- [ ] Pastellfärger med mjuka konturer, genusneutralt och barnvänligt UI

### Out of Scope

- PIN-kodat föräldraläge inom samma konto — valt separata konton med inbjudningssystem istället (tydligare rollseparation)
- E-post-inbjudningar — delningslänk räcker för v1
- Mobilapp (React Native / Expo) — PWA täcker behovet i v1
- Push-notifikationer — v2
- Betalfunktioner/integrationer mot butiker — v2

## Context

- Stackval: Next.js (React), Firebase Firestore (realtidsdatabas, gratis tier), Firebase Auth
- Supabase används redan på annat projekt (gratis-kvoten uppnådd), därav Firebase
- Appen är primärt avsedd för familjer med barn i skolålder
- Önskelistor är kopplade till ett barn, inte till en händelse (födelsedag, jul etc.) — alltid tillgänglig
- Betraktare ser inte vad andra betraktare har köpt om barnet inte ska känna till det; loggen är synlig för betraktare men inte för barnet

## Constraints

- **Databas**: Firebase Firestore — gratis tier, realtid, ingen SQL. Väljs framför Neon/Turso pga realtidsstöd.
- **Hosting**: Vercel eller Firebase Hosting — gratis tier
- **Auth**: Firebase Authentication — täcker barnkonto (username/password via email-wrapper) och betraktarkonton
- **Platform**: Webb-first PWA, Next.js — inga native app stores i v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separata konton (barn + betraktare) istället för delat konto med PIN | Tydligare rollseparation, betraktare kan hantera flera barn | — Pending |
| Firebase Firestore istället för Supabase | Supabase gratis-kvot uppnådd; Firebase gratis tier är generös + realtid inkluderat | — Pending |
| Delningslänk istället för e-postinbjudan | Enklare flöde, ingen e-post-infrastruktur behövs i v1 | — Pending |
| Next.js + PWA istället för React Native | Webb räcker, undviker App Store-process | — Pending |

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
*Last updated: 2026-04-06 after initialization*
