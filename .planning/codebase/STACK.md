# Technology Stack
_Last updated: 2026-04-22_

## Summary
This is a Next.js 16 application written in TypeScript, using React 19, Firebase (Firestore + Auth) as the backend, and Tailwind CSS v4 for styling. It is a family wishlist manager where children own wishlists and parents/viewers interact with them through an invite-link system.

## Languages

**Primary:**
- TypeScript 5 — all source files under `src/`

**Secondary:**
- JavaScript — config files (`eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js (version not pinned — no `.nvmrc` or `.node-version` detected)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.2.2 — App Router, API routes, server components
  - Forced to run with Webpack (`next dev --webpack`, `next build --webpack`) — Turbopack explicitly opted out in scripts

**UI:**
- React 19.2.4 — core rendering
- React DOM 19.2.4

## Key Dependencies

**Drag and Drop:**
- `@dnd-kit/core` 6.3.1 — drag context
- `@dnd-kit/sortable` 10.0.0 — sortable list primitives
- `@dnd-kit/utilities` 3.2.2 — helpers
- Used in: `src/app/wishlist/page.tsx`, `src/components/wishlist/WishItemCard.tsx`

**Database & Auth:**
- `firebase` 12.11.0 — client SDK (Firestore, Auth)
- `firebase-admin` 13.7.0 — server-side Admin SDK (used exclusively in API routes via `src/lib/firebase/admin.ts`)

**Ordering:**
- `fractional-indexing` 3.2.0 — fractional position keys for drag-and-drop item ordering

**Server Boundary Enforcement:**
- `server-only` 0.0.1 — imported at top of server-only modules to prevent accidental client bundle inclusion

## Styling

- Tailwind CSS 4 (via `@tailwindcss/postcss` 4) — utility-first CSS
- PostCSS config: `postcss.config.mjs`
- No component library detected (no shadcn, Radix, Chakra, MUI, etc.)

## Build & Dev Tools

- TypeScript compiler: strict mode, target ES2017, `moduleResolution: bundler`
- Path alias: `@/*` → `./src/*` (defined in `tsconfig.json`)
- ESLint 9 with `eslint-config-next` 16.2.2 (core-web-vitals + typescript rules)
- Config: `eslint.config.mjs`

## Testing

- Jest 29 (`jest.config.ts`)
- ts-jest 29 — TypeScript transform for Jest
- `@firebase/rules-unit-testing` 5.0.0 — Firestore security rules testing
- Tests live in `tests/` directory, matching `**/tests/**/*.test.ts`
- Run command: `npm run test:rules` (uses Firebase emulator)

## Firebase Local Development

- Firebase Emulator Suite (Auth on port 9099, Firestore on port 8080, UI on port 4000)
- `firebase-tools` 15.13.0 (dev dependency)
- Emulator enabled via `NEXT_PUBLIC_USE_EMULATOR=true`
- Run command: `npm run emulator`

## Scripts

| Script | Command |
|--------|---------|
| `dev` | `next dev --webpack` |
| `build` | `next build --webpack` |
| `start` | `next start` |
| `lint` | `eslint` |
| `emulator` | `firebase emulators:start --only firestore,auth` |
| `test:rules` | Firestore rules unit tests via emulator |
| `seed` | Seed emulator with test data |
| `purge-orphans` | Admin script via tsx |
| `generate:icons` | Icon generation script |

## Gaps & Unknowns

- Node.js version is not pinned (no `.nvmrc`, `.node-version`, or `engines` field in `package.json`).
- No Vercel config file (`vercel.json`) detected — deployment configuration may rely on Vercel defaults.
- No image optimization config in `next.config.ts` (file is essentially empty).
- Tailwind config file not visible at root — configuration may be inline or auto-detected by Tailwind v4.
