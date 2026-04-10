---
phase: 01-foundation
plan: 01
subsystem: foundation
tags: [next.js, firebase, typescript, firestore-rules, security]
dependency_graph:
  requires: []
  provides:
    - next-js-app-scaffold
    - firestore-security-rules
    - firebase-emulator-config
    - typescript-schema-types
  affects:
    - all-downstream-phases
tech_stack:
  added:
    - next@16.2.2
    - react@19.2.4
    - firebase@^12.11.0
    - firebase-admin@^13.7.0
    - server-only@^0.0.1
    - firebase-tools@^15.13.0
    - "@firebase/rules-unit-testing@^5.0.0"
    - tailwindcss@^4
    - typescript@^5
  patterns:
    - App Router (Next.js)
    - TypeScript strict mode
    - Fractional index for drag ordering (position: string)
    - Subcollection privacy boundary (purchaseStatus viewer-only)
    - Admin SDK server-only guard pattern
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - .env.example
    - .gitignore
    - firebase.json
    - .firebaserc
    - firestore.rules
    - firestore.indexes.json
    - src/types/firestore.ts
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/app/globals.css
  modified: []
decisions:
  - "D-01 through D-04: Firestore collection hierarchy implemented as planned — wishlists/{id}, items subcollection (child-writable), purchaseStatus subcollection (viewer-only)"
  - "D-08/D-09: App Router with TypeScript strict mode and @/ path alias confirmed in tsconfig.json"
  - "D-11: Firestore emulator port 8080, Auth emulator port 9099 in firebase.json"
  - ".gitignore updated to ignore .env.local specifically (not .env*) so .env.example can be committed"
metrics:
  duration_seconds: 260
  completed_date: "2026-04-07T16:59:49Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 1
---

# Phase 1 Plan 1: Next.js Scaffold + Firebase Foundation Summary

Next.js 14+ app scaffolded with TypeScript strict mode, Tailwind CSS, Firebase client/admin/dev dependencies, firebase.json emulator config, and Firestore security rules enforcing the purchaseStatus child/viewer privacy boundary.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Scaffold Next.js app with TypeScript, Tailwind, @/ alias | 1e36b37 | package.json, tsconfig.json, .env.example, .gitignore, src/app/ |
| 2 | Firebase emulator config and Firestore security rules | 8bb6082 | firebase.json, firestore.rules, src/types/firestore.ts |

## Files Created

| File | Purpose |
|------|---------|
| `package.json` | Next.js project with firebase, firebase-admin, server-only, firebase-tools, @firebase/rules-unit-testing |
| `tsconfig.json` | TypeScript strict mode, @/ path alias to src/ |
| `next.config.ts` | Next.js configuration |
| `.env.example` | Safe template with placeholder Firebase config values (committed to git) |
| `.env.local` | Local dev secrets file (gitignored, filled in by user) |
| `.gitignore` | Ignores .env.local specifically; .env.example allowed through |
| `firebase.json` | Firestore emulator port 8080, Auth emulator port 9099, UI port 4000 |
| `.firebaserc` | Firebase project alias "wishlist-dev" (placeholder for user's project ID) |
| `firestore.rules` | Explicit match blocks for all collections including purchaseStatus privacy boundary |
| `firestore.indexes.json` | Empty indexes scaffold |
| `src/types/firestore.ts` | TypeScript types: WishlistDoc, WishItemDoc, PurchaseStatusDoc, UserDoc, UsernameDoc, InviteDoc |
| `src/app/page.tsx` | Minimal placeholder (replaced Next.js default) |

## Security Rules Summary

### What Is Allowed
- **wishlists/{id}**: Authenticated child (owner) or viewers can read; owner can update/delete; any authenticated user can create
- **wishlists/{id}/items/{id}**: Owner and viewers can read; owner can write
- **wishlists/{id}/purchaseStatus/{id}**: Viewers only can read and write — child UID explicitly denied
- **usernames/{username}**: Any authenticated user can read; write is `false` (Admin SDK only)
- **users/{uid}**: User can read/write their own profile only
- **invites/{token}**: `allow read, write: if false` — Admin SDK only, client never touches

### What Is Denied (Critical Privacy Boundary)
- Child UID cannot read `purchaseStatus` subcollection — `isOwner()` is NOT referenced in the purchaseStatus match block
- No client SDK access to `usernames` write or `invites` read/write
- Subcollection rules are EXPLICIT — no inheritance from parent wishlist rule

## Decisions Made

### D-01 through D-04: Firestore Collection Hierarchy
Implemented exactly as planned. The purchaseStatus subcollection is separate from items and has an explicit, standalone match block with no isOwner() reference.

### D-08/D-09: TypeScript and Alias
`"strict": true` confirmed in tsconfig.json. `"@/*": ["./src/*"]` path alias set.

### D-11: Emulator Ports
Firestore emulator port 8080, Auth emulator port 9099 in firebase.json per plan.

### .gitignore Fix (Deviation)
The default `create-next-app` .gitignore uses `.env*` which would ignore `.env.example` too. Changed to `.env.local` (and `.env.local.*`, `.env.*.local`) to allow committing `.env.example` while keeping secrets out of git.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed .gitignore blocking .env.example from being committed**
- **Found during:** Task 1
- **Issue:** Default `create-next-app` .gitignore uses `.env*` pattern which matches `.env.example`. The plan requires `.env.example` to be committed to git as a safe template.
- **Fix:** Changed `.env*` to `.env.local`, `.env.local.*`, `.env.*.local` — specifically ignores the secrets file while allowing the example template through.
- **Files modified:** `.gitignore`
- **Commit:** 1e36b37

**2. [Rule 3 - Blocking] Scaffolded in temp directory due to .planning/ conflict**
- **Found during:** Task 1
- **Issue:** `create-next-app` refuses to scaffold into a directory containing existing files (`.planning/`). The worktree already had `.planning/`.
- **Fix:** Scaffolded in `/tmp/next-scaffold` then rsync'd all non-git files to the worktree. No functional impact.
- **Files modified:** None (process change only)

## Blockers/Concerns for Plan 02

1. **User must fill in `.env.local`** before Plan 02 can test Firebase connectivity. Plan 02 tests the emulator locally (no live Firebase needed), but the Admin SDK initialization requires valid env vars at runtime.
2. **Plan 02 critical:** `tests/firestore.rules.test.ts` must verify `assertFails` for child UID reading purchaseStatus. Until that test passes, the privacy boundary is rules-only, not verified.
3. **`.firebaserc` placeholder:** The project alias is `wishlist-dev` — user must update this with their actual Firebase project ID before deploying.

## Known Stubs

None — this plan creates infrastructure only (no UI rendering, no data wiring).

## Threat Flags

None — all STRIDE threats from the plan's threat model are addressed:
- T-01-01/T-01-02: purchaseStatus rule is explicit, isOwner absent from block
- T-01-03: .env.local gitignored, FIREBASE_PRIVATE_KEY uses non-NEXT_PUBLIC_ prefix
- T-01-05: `usernames` write rule is `if false`
- T-01-06: `invites` read/write rule is `if false`
- T-01-07: wishlist update/delete guarded by `isOwner()`

T-01-04 (Admin SDK server-only guard) deferred to Plan 02 when `lib/firebase/admin.ts` is created.

## Self-Check: PASSED

Files verified present:
- package.json: FOUND
- tsconfig.json: FOUND
- firebase.json: FOUND
- firestore.rules: FOUND
- .env.example: FOUND
- src/types/firestore.ts: FOUND

Commits verified:
- 1e36b37: FOUND (Task 1 — scaffold)
- 8bb6082: FOUND (Task 2 — emulator config + rules + types)
