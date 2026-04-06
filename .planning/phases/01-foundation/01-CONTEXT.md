# Phase 1: Foundation - Context

**Gathered:** 2026-04-06 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the Next.js app, initialize Firebase, establish the Firestore schema with the child/viewer privacy boundary enforced at the database layer via security rules, split client/admin SDKs into separate modules, and verify real-time listeners work. No user-facing features are built in this phase — this is infrastructure and data model only.

</domain>

<decisions>
## Implementation Decisions

### Firestore Collection Hierarchy
- **D-01:** Top-level collection is `wishlists/{wishlistId}`. This is the core entity — both child and viewers access a wishlist, not a user.
- **D-02:** Items subcollection: `wishlists/{wishlistId}/items/{itemId}` — child-readable, child-writable
- **D-03:** Purchase status subcollection: `wishlists/{wishlistId}/purchaseStatus/{itemId}` — viewer-only, child cannot read. This is the irreversible privacy boundary.
- **D-04:** Supporting collections at root: `usernames/{username}` (username→uid mapping for child login), `users/{uid}` (user profile + role claim), `invites/{token}` (share link tokens)

### Firebase SDK Split
- **D-05:** `lib/firebase/client.ts` — Firebase client SDK singleton, initialized with `getApps()`/`initializeApp()` guard. Used in client components only.
- **D-06:** `lib/firebase/admin.ts` — Firebase Admin SDK, guarded with `import 'server-only'`. Used only in API routes and Server Components.
- **D-07:** Environment variables: Firebase client config in `.env.local` using `NEXT_PUBLIC_FIREBASE_*` prefix. Admin SDK credentials via `FIREBASE_ADMIN_SDK_KEY` (JSON string) or service account file path.

### Next.js Scaffolding
- **D-08:** App Router (Next.js 14), TypeScript strict mode (`"strict": true` in tsconfig).
- **D-09:** Path alias `@/` pointing to `src/` — all imports use `@/lib/...`, `@/components/...` etc.
- **D-10:** No database migration tooling needed — Firestore is schemaless; schema is enforced via security rules.

### Firebase Emulator Setup
- **D-11:** Firestore emulator configured in `firebase.json` with port 8080. Auth emulator on port 9099.
- **D-12:** A security rule test script (`tests/firestore.rules.test.ts`) verifies the privacy boundary: child UID cannot read `purchaseStatus`. This test must pass before Phase 1 is considered complete.
- **D-13:** `npm run test:rules` script added to `package.json` that runs the emulator-based rule tests.

### Real-Time Proof of Concept
- **D-14:** An isolated `/test` route (`app/test/page.tsx`) that mounts a Firestore `onSnapshot` listener on a hardcoded wishlist document and renders live updates. This route exists only to verify real-time works — it is not part of the app shell and will be removed or repurposed in a later phase.

### Claude's Discretion
- Exact Firestore security rules syntax (beyond the privacy boundary constraint)
- ESLint configuration
- Tailwind CSS setup (install now for future phases, no design work in Phase 1)
- Firebase project ID and naming

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in ROADMAP.md Phase 1 section.

### Phase requirements
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 criteria, all must be met)
- `.planning/REQUIREMENTS.md` — SYNC-01 (real-time sync requirement mapped to this phase)
- `.planning/STATE.md` — Key architectural decisions (synthetic email scheme, fractional indexing note, Admin SDK constraint)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project is greenfield. No existing components, hooks, or utilities.

### Established Patterns
- None yet — patterns established in this phase become the baseline for all subsequent phases.

### Integration Points
- Phase 1 output is the foundation all other phases build on:
  - `lib/firebase/client.ts` → used by Phase 2 auth, Phase 3 wishlist CRUD, Phase 4 viewer flow
  - `lib/firebase/admin.ts` → used by Phase 2 custom claims, Phase 4 share link API route
  - Firestore schema → Phase 2 writes `users/{uid}` + `usernames/{username}`, Phase 3 writes `wishlists/{id}/items/{id}`, Phase 4 writes `purchaseStatus` and `invites`
  - Security rules → must accommodate all future phases; Phase 1 rules are a starting skeleton

</code_context>

<specifics>
## Specific Ideas

- User has limited Firebase/Next.js experience — stick to documented patterns and avoid clever abstractions. Vanilla `initializeApp` guard, standard `.env.local` variable names.
- The `purchaseStatus` subcollection separation is the single most important correctness decision in the entire project. Plans must treat this as a hard constraint, not a preference.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-06*
