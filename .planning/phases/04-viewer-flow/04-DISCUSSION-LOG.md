# Phase 4: Viewer Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-09
**Phase:** 04-viewer-flow
**Mode:** discuss
**Areas discussed:** Share link UI, Viewer wishlist layout, Purchase & notes, Activity log, Viewer dashboard, Viewer join flow

## Gray Areas Presented

| Area | Options presented | User chose |
|------|------------------|------------|
| Share link UI | Button on wishlist page / Dedicated share modal / **Settings/gear page** | Settings/gear page |
| Viewer wishlist layout | **Same cards + purchase overlays** / Split card / Different viewer theme | Same cards + purchase overlays |
| Purchase marking | Checkbox + inline note (always visible) / Checkbox + click-to-expand / **Rethink: per-viewer notes** | Per-viewer notes (schema change) |
| Activity log | Separate tab / Expandable bottom panel / **Separate /activity route** | Separate /activity route |
| Viewer dashboard | **Grid of wishlist cards** / Simple list / Existing dashboard repurposed | Grid of wishlist cards |
| Viewer join flow | Login → redirect back / **Inline join page** | Inline join page |

## Key Decision: Schema Change

- **Original assumption:** `PurchaseStatusDoc.viewerNote: string` (single shared note per item)
- **User decision:** Change to `viewerNotes: Record<string, string>` — per-viewer notes map
- **Impact:** `src/types/firestore.ts` must be updated before any viewer note writes

## Corrections Made

- No corrections after selection — all gray areas resolved on first pass.

## Notes

- No todos were matched to this phase.
- No prior Phase 4 context existed — fresh discussion.
