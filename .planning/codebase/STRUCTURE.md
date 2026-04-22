# Codebase Structure
_Last updated: 2026-04-22_

## Summary

The project follows the Next.js App Router convention with `src/app` as the routing root. Source code is split across four directories under `src/`: `app` (routes and API handlers), `components` (UI components grouped by feature domain), `lib` (Firebase client/admin singletons and Firestore helpers), and `types` (shared TypeScript interfaces). Configuration files live at the project root. Tests are in a top-level `tests/` directory separate from source.

---

## Directory Tree

```
wishlist/
├── src/
│   ├── app/                        # Next.js App Router — pages and API routes
│   │   ├── layout.tsx              # Root layout (RSC): AuthProvider wrapper, fonts, metadata
│   │   ├── page.tsx                # Root redirect: routes to /login, /wishlist, or /dashboard based on role
│   │   ├── globals.css             # Global Tailwind CSS
│   │   ├── manifest.ts             # PWA web manifest (Next.js route)
│   │   ├── favicon.ico
│   │   │
│   │   ├── login/page.tsx          # Email+password login for viewers/parents
│   │   ├── register/page.tsx       # New viewer/parent account registration
│   │   ├── onboarding/page.tsx     # 3-step wizard: create child account → name list → share link
│   │   ├── add-child/page.tsx      # Alternative entry point for adding a child account
│   │   ├── dashboard/page.tsx      # Viewer/parent home: lists all managed and invited wishlists
│   │   │
│   │   ├── wishlist/
│   │   │   ├── page.tsx            # Child's own wishlist view with drag-and-drop reorder
│   │   │   └── [wishlistId]/
│   │   │       └── settings/
│   │   │           └── page.tsx    # Share link panel, co-parent invite, danger zone (delete list/account)
│   │   │
│   │   ├── viewer/
│   │   │   └── [wishlistId]/
│   │   │       ├── page.tsx        # Viewer/parent wishlist view: item list, purchase toggle, notes
│   │   │       └── activity/
│   │   │           └── page.tsx    # Paginated activity log for a wishlist
│   │   │
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       └── page.tsx        # Invite redemption: inline auth + redeem flow
│   │   │
│   │   ├── test/page.tsx           # Unknown purpose — not read
│   │   ├── offline/                # Directory exists, no page.tsx — PWA stub/leftover
│   │   │
│   │   └── api/                    # Route Handlers (server-only, Admin SDK)
│   │       ├── auth/
│   │       │   ├── register-child/route.ts     # POST — create child Auth account + Firestore docs
│   │       │   ├── set-parent-claim/route.ts   # POST — promote caller to parent role
│   │       │   ├── set-viewer-claim/route.ts   # POST — assign viewer role on registration
│   │       │   └── user/[uid]/route.ts         # DELETE — delete user account + cascade
│   │       ├── invite/
│   │       │   ├── create/route.ts             # POST — create viewer invite
│   │       │   ├── create-for-child/route.ts   # POST — create viewer invite (parent session)
│   │       │   ├── create-for-parent/route.ts  # POST — create parent-level invite
│   │       │   ├── current/route.ts            # GET — fetch active invite token
│   │       │   ├── redeem/route.ts             # POST — join wishlist via token
│   │       │   └── regenerate/route.ts         # POST — revoke + reissue invite token
│   │       ├── viewer/
│   │       │   ├── mark-purchased/route.ts     # POST — toggle purchased + write activity log
│   │       │   └── update-note/route.ts        # POST — write viewer note
│   │       └── wishlist/
│   │           ├── [wishlistId]/route.ts        # DELETE — recursive wishlist delete
│   │           ├── add-item/route.ts            # POST — add wish item (parent session)
│   │           └── update-title/route.ts        # POST — set wishlist title
│   │
│   ├── components/                 # UI components, grouped by feature domain
│   │   ├── AuthProvider.tsx        # 'use client' — AuthContext + useAuth hook
│   │   ├── onboarding/
│   │   │   └── ChildAccountForm.tsx  # Form: create child account (step 1 of onboarding wizard)
│   │   ├── viewer/                 # Components for viewer/parent-facing views
│   │   │   ├── ActivityLogEntry.tsx
│   │   │   ├── OtherViewerNotes.tsx
│   │   │   ├── ParentAddItemForm.tsx         # Add-item form shown to parent in viewer view
│   │   │   ├── ParentWishlistDashboardCard.tsx
│   │   │   ├── PurchasedBadge.tsx
│   │   │   ├── ShareLinkPanel.tsx            # Viewer share link UI + regenerate
│   │   │   ├── ViewerNoteField.tsx
│   │   │   ├── ViewerWishItemCard.tsx        # Wish item card with purchase toggle and notes
│   │   │   └── WishlistDashboardCard.tsx
│   │   └── wishlist/              # Components for child-facing wishlist view
│   │       ├── AddItemForm.tsx
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSkeleton.tsx
│   │       └── WishItemCard.tsx   # Sortable wish item card (dnd-kit)
│   │
│   ├── lib/
│   │   └── firebase/
│   │       ├── admin.ts           # Firebase Admin SDK singleton (server-only)
│   │       ├── client.ts          # Firebase client SDK singleton (HMR-safe)
│   │       ├── wishlist.ts        # Client-side Firestore helpers for wish items
│   │       └── viewer.ts          # Client-side Firestore helpers for viewer/parent data
│   │
│   └── types/
│       └── firestore.ts           # TypeScript interfaces for all Firestore documents
│
├── tests/
│   └── api/
│       └── auth/                  # Firestore rules unit tests (jest + @firebase/rules-unit-testing)
│
├── scripts/
│   ├── generate-icons.ts          # PWA icon generation
│   ├── seed-emulator.ts           # Seed local Firebase emulator with test data
│   └── purge-orphans.ts           # Cleanup script for orphaned Firestore documents
│
├── public/
│   └── icons/                     # PWA icon assets
│
├── docs/
│   └── superpowers/plans/         # Project planning documents (not consumed by runtime)
│
├── .planning/                     # GSD planning artefacts (phases, codebase maps, research)
├── proxy.ts                       # Next.js 16 proxy (replaces middleware.ts) — auth pass-through
├── next.config.ts                 # Minimal Next.js config (no customization yet)
├── firestore.rules                # Firestore security rules
├── firestore.indexes.json         # Firestore composite index definitions
├── firebase.json                  # Firebase project config (emulator ports, rules file ref)
├── .firebaserc                    # Firebase project alias
├── jest.config.ts                 # Jest config (for rules tests only)
├── tsconfig.json                  # TypeScript config — path alias: @/ → src/
├── postcss.config.mjs             # Tailwind CSS v4 PostCSS config
└── eslint.config.mjs              # ESLint flat config
```

---

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` — root RSC layout, wraps everything in `AuthProvider`
- `src/app/page.tsx` — role-based redirect dispatcher (login / wishlist / dashboard)
- `proxy.ts` — Next.js 16 proxy (project root, not inside `src/`)

**Configuration:**
- `next.config.ts` — Next.js configuration (currently empty)
- `tsconfig.json` — TypeScript; defines `@/` alias pointing to `src/`
- `firestore.rules` — Firestore security rules
- `firebase.json` — emulator configuration (Firestore port 8080, Auth port 9099)
- `jest.config.ts` — Jest, used only for `tests/` (Firestore rules tests)

**Core Logic:**
- `src/lib/firebase/admin.ts` — Admin SDK singleton; imported only inside Route Handlers
- `src/lib/firebase/client.ts` — Client SDK singleton; imported by pages and components
- `src/lib/firebase/wishlist.ts` — Firestore read/write helpers for wish items (child view)
- `src/lib/firebase/viewer.ts` — Firestore subscription helpers for viewer/parent view
- `src/types/firestore.ts` — All Firestore document type definitions

**Auth:**
- `src/components/AuthProvider.tsx` — context provider + `useAuth()` hook

**Testing:**
- `tests/api/auth/` — Firestore rules unit tests

---

## File Naming Conventions

**Pages:** `page.tsx` — required by Next.js App Router convention. All are `'use client'`.

**Route Handlers:** `route.ts` — required by Next.js App Router convention. All import `'server-only'`.

**Components:** PascalCase, `.tsx` extension. No `index.tsx` barrel files — files are imported by full name.
- Examples: `AuthProvider.tsx`, `ViewerWishItemCard.tsx`, `ShareLinkPanel.tsx`

**Library files:** camelCase, `.ts` extension.
- Examples: `admin.ts`, `client.ts`, `wishlist.ts`, `viewer.ts`

**Types:** camelCase, `.ts` extension.
- Example: `firestore.ts`

**Scripts:** camelCase, `.ts` extension, run via `tsx`.

---

## Module Organization Pattern

Components are **grouped by feature domain**, not by type:
- `src/components/viewer/` — all components specific to the viewer/parent experience
- `src/components/wishlist/` — all components specific to the child's wishlist view
- `src/components/onboarding/` — components used in the onboarding wizard

Library helpers follow the **service pattern**: one file per data domain (`wishlist.ts`, `viewer.ts`), each exporting named functions. There are no default exports from library files.

There are **no barrel `index.ts` files** in components or lib. Imports use full paths: `@/components/viewer/ViewerWishItemCard`.

The `@/` path alias resolves to `src/` and is used throughout (defined in `tsconfig.json`).

---

## Where to Add New Code

**New page route:**
- Implementation: `src/app/{route-name}/page.tsx` (mark `'use client'` if it uses hooks or Firestore)
- If the route is authenticated, add `useEffect` auth guard at the top following the existing pattern

**New API route (server-side mutation):**
- Implementation: `src/app/api/{domain}/{action}/route.ts`
- Always add `import 'server-only'` at the top
- Always call `adminAuth.verifyIdToken(idToken)` before any Firestore write

**New component for viewer/parent UI:**
- Implementation: `src/components/viewer/{ComponentName}.tsx`

**New component for child wishlist UI:**
- Implementation: `src/components/wishlist/{ComponentName}.tsx`

**New Firestore document type:**
- Add interface to `src/types/firestore.ts`

**New client-side Firestore helper:**
- Add to `src/lib/firebase/wishlist.ts` (for wish item operations) or `src/lib/firebase/viewer.ts` (for viewer/parent operations)
- If a new domain warrants its own file, add `src/lib/firebase/{domain}.ts`

**New Firestore rules test:**
- Add to `tests/api/auth/` following the existing jest + `@firebase/rules-unit-testing` pattern

---

## Gaps & Unknowns

- `src/app/test/page.tsx` exists but was not read — purpose unknown. Likely a development scratch page.
- `src/app/offline/` directory exists without a `page.tsx` — may be an empty stub from a prior PWA phase.
- `src/app/add-child/page.tsx` was not read — its relationship to the `/onboarding` wizard is unconfirmed. It may be a standalone route for adding a second child after initial setup.
- `docs/superpowers/plans/` contents were not read — not relevant to runtime structure.
