# Phase 3: Child Wishlist - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-09
**Phase:** 03-child-wishlist
**Mode:** discuss
**Areas analyzed:** Routing, Add Item UX, Card Layout, Editing, Drag-and-Drop, Empty State

## Assumptions Presented

### Routing
| Question | Answer | Note |
|----------|--------|------|
| Var hamnar barnet efter inloggning? | Direkt till önskelistan | `/wishlist` — ingen mellansida |

### Add Item UX
| Question | Answer | Note |
|----------|--------|------|
| Hur lägger barnet till ett nytt önskemål? | Inline formulär | Expanderar på plats i listan |

### Card Layout
| Question | Answer | Note |
|----------|--------|------|
| Hur ser ett önskemål ut i listan? | Bred kort med alla fält synliga | Titel, pris, URL, anteckning, bild direkt |

### Editing
| Question | Answer | Note |
|----------|--------|------|
| Hur redigerar barnet ett önskemål? | Inline-redigering | Kortet blir redigerbart vid klick/tryck |

### Drag-and-Drop
| Question | Answer | Note |
|----------|--------|------|
| Hur visar du drag-handtaget på mobil? | Alltid synligt handtag | Grip-ikon alltid synlig |

### Empty State
| Question | Answer | Note |
|----------|--------|------|
| Vad ser barnet när listan är tom? | Illustration + uppmuntran + knapp | Barnvänlig empty state |

## Corrections Made

No corrections — all decisions captured as answered.

## Technical Decisions (Claude's discretion)
- DnD library: `@dnd-kit/core` + `@dnd-kit/sortable` (modern, accessible, touch-native)
- Fractional indexing: `fractional-indexing` npm package (matches `position: string` schema)
- Exactly one Firestore write per reorder (only moved item's `position` updated)
