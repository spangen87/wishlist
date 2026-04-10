---
phase: 04-viewer-flow
plan: 04
subsystem: viewer-notes-and-activity
tags: [viewer, notes, activity-log, api-route, components, pagination]
dependency_graph:
  requires: [04-01, 04-03]
  provides: [viewer-note-field, other-viewer-notes, update-note-api, activity-log-page, activity-log-entry]
  affects: [04-05]
tech_stack:
  added: []
  patterns: [Admin SDK batch write with merge dotted-path key, click-to-expand textarea auto-save, onSnapshot pagination with cursor]
key_files:
  created:
    - src/app/api/viewer/update-note/route.ts
    - src/components/viewer/ViewerNoteField.tsx
    - src/components/viewer/OtherViewerNotes.tsx
    - src/components/viewer/ActivityLogEntry.tsx
    - src/app/viewer/[wishlistId]/activity/page.tsx
  modified:
    - src/components/viewer/ViewerWishItemCard.tsx
    - src/app/viewer/[wishlistId]/page.tsx
decisions:
  - "update-note uses dotted-path key [`viewerNotes.${uid}`] with merge:true — avoids overwriting purchasedBy or other viewer notes in the same doc"
  - "activityLog entry only written when note.trim().length > 0 — clearing a note does not spam the log"
  - "savingRef debounce in ViewerNoteField prevents double-save on rapid blur events (T-04-25)"
  - "OtherViewerNotes receives pre-resolved display names from parent — keeps component pure and testable"
  - "Activity log pagination uses unsub() one-shot pattern — avoids accumulating live subscriptions on each loadMore call"
metrics:
  duration: ~20min
  completed: 2026-04-09
  tasks: 2
  files: 7
requirements: [VIEW-04, VIEW-07]
---

# Phase 04 Plan 04: Viewer Notes and Activity Log Summary

One-liner: Per-viewer click-to-expand auto-save note fields on each wish item, read-only display of other viewers' notes, atomic update-note API route writing viewerNotes + activityLog, and a paginated Swedish-language activity log page at /viewer/[wishlistId]/activity.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ViewerNoteField, OtherViewerNotes, update-note API, extend ViewerWishItemCard | 47b632f | src/app/api/viewer/update-note/route.ts, src/components/viewer/ViewerNoteField.tsx, src/components/viewer/OtherViewerNotes.tsx, src/components/viewer/ViewerWishItemCard.tsx |
| 2 | Activity log page and ActivityLogEntry component | 919960e | src/components/viewer/ActivityLogEntry.tsx, src/app/viewer/[wishlistId]/activity/page.tsx, src/app/viewer/[wishlistId]/page.tsx |

## What Was Built

### update-note API Route (src/app/api/viewer/update-note/route.ts)
- `POST /api/viewer/update-note` accepts `{ idToken, wishlistId, itemId, itemTitle, note }`
- Verifies caller via `adminAuth.verifyIdToken(idToken)` — rejects forged tokens (T-04-20)
- Checks caller is in `wishlistDoc.viewerUids` — returns 403 if not (T-04-21)
- Uses `adminDb.batch()` for atomic write; dotted-path key `` [`viewerNotes.${uid}`] `` with `merge: true` — only the calling viewer's note is written, no overwrite of other fields (T-04-22)
- Only appends activityLog entry when `note.trim().length > 0` — clearing a note is silent

### ViewerNoteField (src/components/viewer/ViewerNoteField.tsx)
- Three render states: collapsed/no-note (shows "Lämna en anteckning" button), collapsed/has-note (shows truncated text + "Redigera" link in accent color), expanded (textarea rows=3, auto-focus)
- `onBlur` triggers save via `onSave(value)` prop — no separate save button
- `savingRef` prevents double-save on rapid blur events
- Save error shown with `role="alert"` for accessibility
- Syncs value from parent when not expanded (handles real-time updates)

### OtherViewerNotes (src/components/viewer/OtherViewerNotes.tsx)
- Read-only list; returns `null` when no notes — no empty-state noise
- Receives pre-resolved `{ uid, displayName, note }` array from parent

### ViewerWishItemCard (src/components/viewer/ViewerWishItemCard.tsx)
- Extended with `onUpdateNote` and `otherViewerNotes` props
- Renders `<ViewerNoteField>` and `<OtherViewerNotes>` below the purchase toggle section

### ActivityLogEntry (src/components/viewer/ActivityLogEntry.tsx)
- Formats three action types in Swedish: "markerade X som köpt", "avmarkerade X", "lämnade en anteckning på X"
- Uses `<time dateTime={isoString}>` element for machine-readable timestamps
- `toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })` for display

### Activity Log Page (src/app/viewer/[wishlistId]/activity/page.tsx)
- Client component using `use(params)` for Next.js 16 dynamic params
- Auth guards: unauthenticated → /login, role === 'child' → /wishlist
- Real-time subscription via `subscribeToActivityLog` (50 entries/page, newest-first)
- "Inga händelser ännu" empty state; "Visa fler" button when `hasMore` is true
- Pagination: one-shot `subscribeToActivityLog` with cursor, immediately unsubscribed after first snapshot
- Display names fetched from `users/{uid}` collection, cached in `Map<string, string>` state

### Viewer Page (src/app/viewer/[wishlistId]/page.tsx)
- Added `handleUpdateNote` function calling `/api/viewer/update-note`
- Passes `onUpdateNote={handleUpdateNote}` and `otherViewerNotes` to `ViewerWishItemCard`
- `otherViewerNotes` built inline: filters out current user's UID, resolves display names from cached `displayNames` map

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components and API routes are fully wired to real Firestore data.

## Threat Flags

No new security surface introduced beyond what is modeled in the plan's threat register. All seven STRIDE threats (T-04-20 through T-04-26) are mitigated or accepted as designed.

## Self-Check: PASSED

Files created/exist:
- src/app/api/viewer/update-note/route.ts — FOUND
- src/components/viewer/ViewerNoteField.tsx — FOUND
- src/components/viewer/OtherViewerNotes.tsx — FOUND
- src/components/viewer/ActivityLogEntry.tsx — FOUND
- src/app/viewer/[wishlistId]/activity/page.tsx — FOUND

Files modified:
- src/components/viewer/ViewerWishItemCard.tsx — FOUND (ViewerNoteField + OtherViewerNotes imported and rendered)
- src/app/viewer/[wishlistId]/page.tsx — FOUND (handleUpdateNote + new props passed)

Commits verified:
- 47b632f — feat(04-04): add ViewerNoteField, OtherViewerNotes, update-note API, extend ViewerWishItemCard
- 919960e — feat(04-04): add ActivityLogEntry, activity log page, wire viewer page with note handlers

Verification checks:
- [`viewerNotes.${uid}`] dotted-path key with merge:true — CONFIRMED (route.ts line 50)
- note.trim().length > 0 guard before activityLog write — CONFIRMED (route.ts line 54)
- <time dateTime={isoString}> — CONFIRMED (ActivityLogEntry.tsx line 39)
- "Inga händelser ännu" empty state — CONFIRMED (activity/page.tsx line 99)
- "Visa fler" button — CONFIRMED (activity/page.tsx line 119)
- onUpdateNote + otherViewerNotes in viewer page — CONFIRMED (page.tsx lines 150, 156)
- TypeScript: npx tsc --noEmit exits 0 — PASS
