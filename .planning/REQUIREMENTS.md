# Requirements: Wishlist

**Defined:** 2026-04-06
**Core Value:** Barnet äger sin önskelista och kan enkelt lägga till önskningar; föräldrar och släkt kan koordinera inköp utan att förstöra överraskningen.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: Förälder kan registrera ett barnkonto med barnets användarnamn (förälderns e-post används internt som syntetisk identifierare)
- [ ] **AUTH-02**: Barn kan logga in med användarnamn + lösenord (ingen e-post behövs)
- [ ] **AUTH-03**: Betraktare (föräldrar/släkt) kan skapa eget konto med e-post + lösenord
- [ ] **AUTH-04**: Inloggad session bevaras vid siduppdatering och byte av enhet
- [ ] **AUTH-05**: Förälder kan logga ut

### Önskelista — barnets vy

- [ ] **WISH-01**: Barn kan lägga till ett önskemål med titel (obligatorisk)
- [ ] **WISH-02**: Barn kan lägga till länk till produkt på önskemål
- [ ] **WISH-03**: Barn kan lägga till bild via URL på önskemål
- [ ] **WISH-04**: Barn kan lägga till anteckning på önskemål
- [ ] **WISH-05**: Barn kan ange ungefärligt pris på önskemål
- [ ] **WISH-06**: Barn kan redigera och ta bort egna önskemål
- [ ] **WISH-07**: Barn kan ändra ordning på önskemål via drag-and-drop
- [ ] **WISH-08**: Barnets vy visar INTE vilka önskemål som är avbockade/köpta

### Delning och inbjudan

- [ ] **SHARE-01**: Barn/förälder kan generera en delningslänk för barnets önskelista
- [ ] **SHARE-02**: Vem som helst med delningslänken kan gå med som betraktare (kräver konto om man inte redan är inloggad)
- [ ] **SHARE-03**: Delningslänk kan återkallas (länken slutar fungera)

### Betraktarens vy

- [ ] **VIEW-01**: Betraktare kan se barnets fullständiga önskelista
- [ ] **VIEW-02**: Betraktare kan markera ett önskemål som köpt (med sitt namn)
- [ ] **VIEW-03**: Betraktare kan avmarkera köpt-status på ett önskemål
- [ ] **VIEW-04**: Betraktare kan lämna en anteckning på ett önskemål (synlig för andra betraktare, ej barnet)
- [ ] **VIEW-05**: Betraktare ser vilka önskemål som är markerade som köpta och av vem
- [ ] **VIEW-06**: Betraktare kan hantera flera barns önskelistor från samma konto
- [ ] **VIEW-07**: Aktivitetslogg visar vad varje betraktare gjort (bockat av, antecknat etc.)

### Realtid och multi-enhet

- [ ] **SYNC-01**: Ändringar synkas i realtid mellan alla inloggade enheter utan siduppdatering

### PWA

- [ ] **PWA-01**: Appen kan installeras på hemskärmen (web app manifest)
- [ ] **PWA-02**: Appen fungerar offline för läsning av cachad data (service worker)

### UI/Design

- [ ] **UI-01**: Pastellfärger med mjuka konturer, genusneutralt och barnvänligt
- [ ] **UI-02**: Responsiv layout som fungerar på mobiltelefon och surfplatta

## v2 Requirements

### Notifikationer

- **NOTF-01**: Betraktare får notis när barn lägger till nytt önskemål
- **NOTF-02**: Förälder/betraktare får notis när annan betraktare bockar av ett önskemål

### Administratörsverktyg

- **ADMIN-01**: Förälder kan ta bort betraktare från barnets lista
- **ADMIN-02**: Förälder kan byta barnets lösenord

### Förbättringar av önskemål

- **ENH-01**: Automatisk OG-bildskrapning från produkt-URL (nice-to-have, instabilt)
- **ENH-02**: Kategorier/taggar på önskemål
- **ENH-03**: Prioritetsnivå (stjärnor) på önskemål

## Out of Scope

| Feature | Reason |
|---------|--------|
| PIN-kodat föräldraläge på samma konto | Ersatt av separata konton med tydligare rollseparation |
| E-postinbjudningar | Delningslänk räcker; ingen e-post-infrastruktur behövs i v1 |
| React Native / mobilapp | PWA räcker för v1, undviker App Store-process |
| OAuth-inloggning (Google, Apple) | E-post + lösenord räcker för v1; barn har inte alltid sociala konton |
| Grupp-inköp / dela-kostnad | Hög komplexitet, inte kärn-värde |
| Videor på önskemål | Bandbredd/lagringskostnad, skjut upp till v2+ |
| Händelsespecifika listor (födelsedag, jul) | Listan är alltid tillgänglig, inte kopplad till händelse |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| WISH-01 | Phase 3 | Pending |
| WISH-02 | Phase 3 | Pending |
| WISH-03 | Phase 3 | Pending |
| WISH-04 | Phase 3 | Pending |
| WISH-05 | Phase 3 | Pending |
| WISH-06 | Phase 3 | Pending |
| WISH-07 | Phase 3 | Pending |
| WISH-08 | Phase 3 | Pending |
| SHARE-01 | Phase 4 | Pending |
| SHARE-02 | Phase 4 | Pending |
| SHARE-03 | Phase 4 | Pending |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Pending |
| VIEW-04 | Phase 4 | Pending |
| VIEW-05 | Phase 4 | Pending |
| VIEW-06 | Phase 4 | Pending |
| VIEW-07 | Phase 4 | Pending |
| SYNC-01 | Phase 1 | Pending |
| PWA-01 | Phase 5 | Pending |
| PWA-02 | Phase 5 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 — phase assignments finalized (PWA-01, PWA-02, UI-01 moved from Phase 6 to Phase 5)*
