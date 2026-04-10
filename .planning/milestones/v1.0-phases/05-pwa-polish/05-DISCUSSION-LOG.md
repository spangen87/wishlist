# Phase 5: PWA + Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-09
**Phase:** 05-pwa-polish
**Mode:** discuss
**Areas discussed:** Color palette & UI tokens, PWA implementation approach, Update prompt strategy

## Gray Areas Presented

| Area | Selected |
|------|----------|
| Color palette & UI tokens | ✓ |
| PWA implementation approach | ✓ |
| Offline indicator & stale data UX | — (not selected) |
| Update prompt strategy | ✓ |

## Decisions Made

### Color Palette & UI Tokens
| Question | Answer |
|----------|--------|
| Which palette direction? | Dual-tone warm pastels (peach/rose) — keep warmth, soften harshness |
| Which pages get UI polish? | All user-facing pages |

### PWA Implementation
| Question | Answer |
|----------|--------|
| Service worker approach | @ducanh2912/next-pwa (serwist-based) |
| App name on home screen | "Min önskelista" |
| PWA icon approach | Programmatic generation (Canvas/sharp) — pastel BG + emoji |

### Update Prompt
| Question | Answer |
|----------|--------|
| New deployment notification UX | Toast + reload button — "Ny version tillgänglig — uppdatera nu" |

## Offline Indicator (Not Discussed — Claude's Discretion)
User did not select this area for discussion. Claude captured a sensible default:
- Sticky banner at top when offline: "Du är offline — data kan vara föråldrad"
- Auto-dismisses on reconnect
- Applies on wishlist and viewer pages

## Corrections Applied

None — all options were accepted as presented.
