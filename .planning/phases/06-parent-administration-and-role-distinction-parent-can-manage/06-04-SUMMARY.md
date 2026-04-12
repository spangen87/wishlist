---
phase: 06-parent-administration-and-role-distinction-parent-can-manage
plan: "04"
subsystem: ui-api
tags: [parent-controls, viewer-page, settings-page, add-item-route, update-title-route]
dependency_graph:
  requires:
    - 06-01-parentUids-field
    - 06-02-create-for-parent-route
    - 06-03-two-section-dashboard
  provides:
    - add-item-route
    - parent-controls-viewer-page
    - settings-page-parent-gate
    - co-parent-invite-section
  affects:
    - src/app/api/wishlist/add-item/route.ts
    - src/app/api/wishlist/update-title/route.ts
    - src/app/viewer/[wishlistId]/page.tsx
    - src/app/wishlist/[wishlistId]/settings/page.tsx
tech_stack:
  added: []
  patterns:
    - parentUids-gate-api-route
    - isParent-conditional-render
    - context-aware-back-navigation
    - initialToken-prop-pattern
key_files:
  created:
    - src/app/api/wishlist/add-item/route.ts
    - src/components/viewer/ParentAddItemForm.tsx
  modified:
    - src/app/api/wishlist/update-title/route.ts
    - src/app/viewer/[wishlistId]/page.tsx
    - src/app/wishlist/[wishlistId]/settings/page.tsx
decisions:
  - update-title auth gate changed from isViewer to isParent — viewers (anhörig) can no longer rename wishlists (D-23)
  - ParentAddItemForm extracted to separate component file (viewer page would exceed 250 lines inline)
  - initialParentToken read in loadSettings() and passed as prop — avoids redundant Firestore read in CoParentInviteSection
  - CoParentInviteSection placed inline in settings page file — no need for separate component given single usage
metrics:
  duration: ~20min
  completed: 2026-04-12
  tasks: 3
  files: 5
---

# Phase 06 Plan 04: Parent UX Culmination — Add-Item API, Viewer Controls, Settings Gate

**One-liner:** POST /api/wishlist/add-item (parentUids-gated), extended update-title (parentUids replaces viewerUids), viewer page with parent-conditional add-item form + inline rename + settings link, and settings page with parentUids gate + CoParentInviteSection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create add-item route + extend update-title | 4953df9 | src/app/api/wishlist/add-item/route.ts, src/app/api/wishlist/update-title/route.ts |
| 2 | Add parent controls to viewer page | abab0ab | src/app/viewer/[wishlistId]/page.tsx, src/components/viewer/ParentAddItemForm.tsx |
| 3 | Update settings page — ownership gate + Co-förälder section | 143248c | src/app/wishlist/[wishlistId]/settings/page.tsx |

## What Was Built

- **POST /api/wishlist/add-item**: New API route. Auth gate: caller UID must be in `parentUids[]`. Writes identical WishItemDoc schema to child-created items (D-21 — items are indistinguishable). Server-side position append when not supplied. Returns `{ ok: true, itemId }` with 201.

- **update-title auth change**: Replaced `isViewer` check with `isParent`. Only childUid (owner) and parentUids members can rename — viewers (anhörig) are now correctly blocked (D-23).

- **ParentAddItemForm** (`src/components/viewer/ParentAddItemForm.tsx`): Thin client component POSTing to `/api/wishlist/add-item` with idToken. Fields: title (required), price, productUrl, note. Calls `onClose()` on success, `onError(msg)` on failure.

- **Viewer page parent controls**: On mount reads wishlist doc to set `isParent` from `parentUids.includes(user.uid)`. When `isParent`:
  - Inline rename button (click to edit → blur/Enter to save via `/api/wishlist/update-title`)
  - "Lägg till önskemål" toggle button showing/hiding ParentAddItemForm
  - "Inställningar" link to `/wishlist/[wishlistId]/settings`
  - Viewers (anhörig) see identical page as before (D-15)

- **Settings page gate extended** (D-17): `callerIsOwner || callerIsParent` check before redirect. Both child owners and parent members can now access settings.

- **Context-aware back navigation** (D-19): `accessType` state ('child' | 'parent') set after gate check. Back link points to `/viewer/[wishlistId]` for parents, `/wishlist` for children.

- **CoParentInviteSection** (D-13, D-18): Inline component in settings page. Reads `currentParentInviteToken` via `initialToken` prop (loaded in `loadSettings()`). Shows copy link if token exists, "Skapa co-förälderlänk" button if not. Calls `/api/invite/create-for-parent` (idempotent — returns existing active token).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all parent controls are wired to real API routes. Items added by parents appear in the child's wishlist via real-time Firestore subscriptions. The CoParentInviteSection calls the real `/api/invite/create-for-parent` route from Plan 02.

## Threat Flags

No new security surface beyond what the plan's threat model covers.

| Mitigation | Status |
|-----------|--------|
| T-06-04-01: add-item auth gate (parentUids check via Admin SDK) | Applied — route verifies caller is in parentUids[] |
| T-06-04-02: update-title — viewers now blocked | Applied — isViewer removed, only isOwner and isParent accepted |
| T-06-04-03: settings page client-side gate | Applied — parentUids check before setIsOwner; write ops gated server-side |
| T-06-04-04: settings shows parent invite link | Accepted — 192-bit token entropy, only shown to parentUids members |

## Self-Check: PASSED

- src/app/api/wishlist/add-item/route.ts: EXISTS
- src/components/viewer/ParentAddItemForm.tsx: EXISTS
- src/app/api/wishlist/update-title/route.ts: EXISTS (modified)
- src/app/viewer/[wishlistId]/page.tsx: EXISTS (modified)
- src/app/wishlist/[wishlistId]/settings/page.tsx: EXISTS (modified)
- Commit 4953df9: verified
- Commit abab0ab: verified
- Commit 143248c: verified
- TypeScript: npx tsc --noEmit exits 0
