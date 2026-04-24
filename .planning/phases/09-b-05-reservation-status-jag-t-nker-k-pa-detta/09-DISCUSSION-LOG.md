# Phase 9: B-05: Reservation status — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 09 — B-05: Reservation status — Jag tänker köpa detta
**Areas discussed:** Reservation vs purchase relationship, Who sees what — privacy and visibility, UI placement on the card, Reservation lifecycle

---

## Reservation vs purchase relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Två separata steg | Reserve first, mark purchased later — reservation persists until cleared or replaced | ✓ |
| Markera som köpt rensar reservation auto | Marking purchased auto-removes reservation | |

**User's choice:** Två separata steg
**Notes:** Reservation and purchase are independent actions. However, when the reserver themselves marks as purchased, the reservation is automatically cleared in the same API call.

| Option | Description | Selected |
|--------|-------------|----------|
| Bara en reservation åt gången | First to reserve locks the item — others see it as reserved | ✓ |
| Flera kan reservera oberoende | Anyone can signal intent independently | |
| Claude bestämmer | Choose simpler implementation | |

**User's choice:** Bara en reservation åt gången

---

## Who sees what — privacy and visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Nej — barnet ser ingenting | Reservation in purchaseStatus subcollection, child cannot read | ✓ |
| Ja — barnet ser ett diskret tecken | A small icon hinting someone is "looking at" the item | |

**User's choice:** Barnet ser ingenting — full surprise effect preserved

| Option | Description | Selected |
|--------|-------------|----------|
| Vem som reserverat visas | "Reserverad av Anna" — helps family coordinate | ✓ |
| Bara "Reserverad" utan namn | Anonymous reservation | |

**User's choice:** Vem som reserverat visas — same pattern as purchasedBy display

---

## UI placement on the card

| Option | Description | Selected |
|--------|-------------|----------|
| Separat knapp ovanför "Markera som köpt" | Two distinct buttons, clear hierarchy: intent → confirmed purchase | ✓ |
| Inbyggd i samma knapp — ett steg-flöde | One button cycling through states | |
| Claude bestämmer layout | Let planner decide | |

**User's choice:** Separat knapp ovanför — tydlig hierarki

| Option | Description | Selected |
|--------|-------------|----------|
| Badge "Reserverad av [namn]" + knappen inaktiverad | Same pattern as isOthersPurchase on purchase button | ✓ |
| Badge "Reserverad av [namn]" + knappen kvar aktiv | Can still override reservation | |

**User's choice:** Badge + knappen inaktiverad — förhindrar dubbel-reservation

---

## Reservation lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Samma knapp togglar av/på | Click "Du tänker köpa detta" again to remove reservation | ✓ |
| Separat "Avboka reservation"-knapp | Explicit cancel button when reserved | |
| Reservation är permanent tills köpt | Must buy to remove reservation | |

**User's choice:** Toggle-knapp — symmetriskt med köp-knappen

| Option | Description | Selected |
|--------|-------------|----------|
| Ja — logga både reservera och av-reservera | Consistent with existing activity log pattern | ✓ |
| Nej — ingen loggning av reservation | Keeps activity log cleaner | |

**User's choice:** Logga reservation-händelser — konsekvent med befintligt mönster

---

## Claude's Discretion

- Exact Tailwind classes for each button state
- Whether to hide reserve button entirely when item is already purchased by someone else
- Animation/transition on state change
- Error handling copy for edge cases

## Deferred Ideas

- Reservation expiry / auto-release after N days
- Push notifications when someone reserves an item
- Aggregated "Köp-lista" view across all wishlists
