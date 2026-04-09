# Roadmap: Wishlist

## Overview

Build a family wishlist PWA where children own their wishlists and parents/relatives can coordinate purchases without spoiling the surprise. The architecture must be established correctly in Phase 1 — the separation of purchase status into its own subcollection is an irreversible schema decision. From there: auth for both child and viewer accounts, the core wishlist experience, the viewer-side sharing and coordination flow, and finally PWA installability and visual polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Next.js scaffolding, Firebase project, Firestore schema, security rules, dual SDK split, and real-time architecture
- [x] **Phase 2: Authentication** - Child account creation via synthetic email, viewer registration, session persistence, login/logout (completed 2026-04-08)
- [ ] **Phase 3: Child Wishlist** - Item CRUD with all fields, drag-and-drop reordering via fractional indexing, child view that hides purchase status
- [ ] **Phase 4: Viewer Flow** - Share link generation and redemption, mark-as-purchased, viewer notes, activity log, multi-child dashboard
- [ ] **Phase 5: PWA + Polish** - Service worker, installable manifest, pastel UI design system, responsive layout, security hardening verification

## Phase Details

### Phase 1: Foundation
**Goal**: The project is scaffolded with a correct, irreversible Firestore data model and security rules that enforce the child/viewer privacy boundary at the database layer
**Depends on**: Nothing (first phase)
**Requirements**: SYNC-01
**Success Criteria** (what must be TRUE):
  1. The Next.js app builds and runs locally with no SSR errors from Firebase SDK
  2. Firestore schema separates `items/{itemId}` (child-readable) from `purchaseStatus/{itemId}` (viewer-only) as distinct subcollections
  3. Firestore security rules deny a child UID read access to `purchaseStatus` — verified via emulator test
  4. Real-time Firestore listeners work in a client component and reflect document changes without a page refresh
  5. `lib/firebase/client.ts` and `lib/firebase/admin.ts` exist as separate modules; admin file is guarded with `server-only`
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Next.js scaffold, Firebase emulator config, Firestore security rules, TypeScript schema types
- [x] 01-02-PLAN.md — Firebase SDK split: client.ts singleton and admin.ts with server-only guard
- [x] 01-03-PLAN.md — Security rule unit tests (emulator) and real-time listener PoC at /test route

### Phase 2: Authentication
**Goal**: A parent can create a child account and the child can log in with just a username and password; viewers can register their own accounts; sessions persist across refreshes
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Parent submits a child username + password and a Firebase Auth account is created with a synthetic email; the child's role claim is set to "child"
  2. Child can log in at /login with only their username and password (no email visible)
  3. Viewer can register at /register with email + password and receives role claim "viewer"
  4. Logged-in user remains authenticated after a hard browser refresh
  5. User can log out and is redirected to the login page
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Auth Route Handlers (register-child, set-viewer-claim), AuthProvider context, emulator connection
- [x] 02-02-PLAN.md — Login page (child username+password) and viewer registration page
- [x] 02-03-PLAN.md — proxy.ts route protection, dashboard stub with logout, end-to-end checkpoint

### Phase 3: Child Wishlist
**Goal**: A logged-in child can build and manage their wishlist — adding items with full details, reordering via drag-and-drop, editing and deleting — and their view never reveals purchase status
**Depends on**: Phase 2
**Requirements**: WISH-01, WISH-02, WISH-03, WISH-04, WISH-05, WISH-06, WISH-07, WISH-08, UI-02
**Success Criteria** (what must be TRUE):
  1. Child can add a wish item with title (required), product URL, image URL, personal note, and approximate price
  2. Child can edit any field on an existing wish item and delete the item entirely
  3. Child can drag items to a new position; the order persists after a page refresh and required exactly one Firestore write per reorder
  4. Child's wishlist view does not show purchased status, viewer notes, or buyer names — even when inspecting the raw Firestore response in browser DevTools (because purchase fields are in a separate subcollection the child cannot read)
  5. Layout is responsive and usable on a 375px mobile screen and a 768px tablet
**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — npm package install, Firestore helpers (wishlist.ts), role-aware login redirect
- [ ] 03-02-PLAN.md — WishlistPage, WishItemCard (read mode), AddItemForm, EmptyState, LoadingSkeleton, color tokens
- [ ] 03-03-PLAN.md — WishItemCard inline edit + delete confirmation, DndContext/SortableContext drag-and-drop

### Phase 4: Viewer Flow
**Goal**: A viewer with a share link can join a child's wishlist, coordinate purchases with other viewers, and review an activity log — all without the child seeing any of it
**Depends on**: Phase 3
**Requirements**: SHARE-01, SHARE-02, SHARE-03, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07
**Success Criteria** (what must be TRUE):
  1. A parent can generate a share link for a child's wishlist; visiting the link (after login) adds the visitor as a viewer
  2. Regenerating the share link invalidates the old token — visiting the old URL no longer grants access
  3. Viewer can see the full wishlist including which items are marked purchased and by whom
  4. Viewer can mark an item as purchased (their name recorded) and undo that marking
  5. Viewer can leave a note on any item visible to other viewers but not to the child
  6. Activity log shows each viewer action (marked purchased, added note, etc.) with username and timestamp
  7. A viewer account can access multiple children's wishlists from a single dashboard
**Plans**: TBD
**UI hint**: yes

### Phase 5: PWA + Polish
**Goal**: The app is installable on a phone home screen, works offline for cached data, renders with the pastel family-friendly visual design, and passes a final security hardening review
**Depends on**: Phase 4
**Requirements**: PWA-01, PWA-02, UI-01
**Success Criteria** (what must be TRUE):
  1. Visiting the app on iOS Safari and Android Chrome presents an "Add to Home Screen" prompt; the installed app opens in standalone mode
  2. When offline, a previously loaded wishlist remains readable from cache; a clear offline indicator is shown when data may be stale
  3. The UI uses a consistent pastel color palette with rounded cards and soft shadows — visually child-friendly and gender-neutral
  4. After a new deployment, a user on the old version sees an update prompt or is automatically refreshed within 30 seconds (no stale JS bundles served silently)
  5. Firestore rules review confirms child UID cannot access `purchaseStatus` or `activity` subcollections in production (emulator re-run against final rules)
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-04-07 |
| 2. Authentication | 3/3 | Complete   | 2026-04-08 |
| 3. Child Wishlist | 0/3 | Not started | - |
| 4. Viewer Flow | 0/TBD | Not started | - |
| 5. PWA + Polish | 0/TBD | Not started | - |
