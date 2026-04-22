# Coding Conventions
_Last updated: 2026-04-22_

## Summary
The project is a Next.js 16 (App Router) application written in TypeScript with strict mode enabled. ESLint is configured with the Next.js recommended rule sets. There is no Prettier config — formatting is not enforced by tooling beyond ESLint. Code style is consistent across files: named exports for components, `function` declarations for handlers, camelCase throughout, and inline Tailwind CSS for all styling. API routes follow a uniform pattern of validating input, verifying Firebase ID tokens, and returning `NextResponse.json(...)`.

## Linting and Formatting

**ESLint:**
- Config: `eslint.config.mjs` using `eslint/config` `defineConfig`
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Run command: `npm run lint` (invokes `eslint`)
- No custom rule overrides beyond the Next.js defaults

**Prettier:**
- No `.prettierrc` or Prettier configuration present
- Formatting is not enforced automatically

**TypeScript:**
- Config: `tsconfig.json` with `"strict": true`
- Target: `ES2017`, module resolution: `bundler`
- Path alias: `@/*` maps to `./src/*`
- `isolatedModules: true` — no const enums, no namespace merges
- `noEmit: true` — TS is used for type-checking only, not compilation

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` — e.g. `WishItemCard.tsx`, `AuthProvider.tsx`
- Next.js route files: lowercase `route.ts`, `page.tsx`, `layout.tsx`
- Library/utility modules: camelCase — e.g. `wishlist.ts`, `viewer.ts`, `admin.ts`
- Type definition files: camelCase — e.g. `firestore.ts`
- Test files: camelCase matching the module under test — e.g. `set-viewer-claim.test.ts`

**Directories:**
- Feature directories: kebab-case — e.g. `add-child/`, `register-child/`, `mark-purchased/`
- Component groupings: lowercase noun — e.g. `components/viewer/`, `components/wishlist/`

**Components:**
- Named exports only — no default exports for components
- PascalCase for component function names — e.g. `export function WishItemCard(...)`
- Default exports only for Next.js page components — e.g. `export default function DashboardPage()`

**Functions:**
- camelCase for all functions and methods
- Event handlers prefixed with `handle` — e.g. `handleStartEdit`, `handleSave`, `handleConfirmDelete`
- Firebase subscription functions prefixed with `subscribe` — e.g. `subscribeToItems`, `subscribeToViewerWishlists`
- Firebase one-shot reads prefixed with `get` or `getOrCreate` — e.g. `getOrCreateWishlist`
- Firestore mutation helpers use verb prefix — e.g. `addWishItem`, `updateWishItem`, `deleteWishItem`

**Variables:**
- camelCase throughout
- Boolean state variables use descriptive names — e.g. `editMode`, `editSaving`, `showDeleteConfirm`
- Error state variables suffixed with `Error` — e.g. `editSaveError`, `editTitleError`
- Loading state variables suffixed with `Loading` — e.g. `editSaving`, `parentDataLoading`

**TypeScript types and interfaces:**
- Interfaces use PascalCase with descriptive names — e.g. `WishlistDoc`, `WishItemCardProps`, `AuthContextValue`
- Firestore document types suffixed with `Doc` — e.g. `WishlistDoc`, `WishItemDoc`, `PurchaseStatusDoc`
- Prop interfaces named `{ComponentName}Props` — e.g. `WishItemCardProps`

## Import Organization

Imports are not enforced by tooling but follow a consistent pattern observed across files:

1. Next.js / React framework imports — e.g. `'use client'`, then `import { ... } from 'next/server'`
2. Firebase SDK imports
3. Internal library imports using `@/` alias — e.g. `@/lib/firebase/admin`, `@/types/firestore`
4. Type-only imports last — e.g. `import type { WishItemDoc } from '@/types/firestore'`

The `server-only` sentinel import always appears as the first line in server-only modules:
```ts
import 'server-only';
```

## Component Patterns

**Client components** are declared with `'use client'` as the first line.

**Server components** (pages that use server data) have no directive — they are server by default.

**Context pattern** — `AuthProvider.tsx`:
- Context created at module level with a typed default value
- Provider and consumer hook exported from the same file
- Hook: `export const useAuth = () => useContext(AuthContext)`

**State co-location** — form state, loading state, and error state are all co-located inside the component that owns the form. No external state management library is used.

**Real-time subscriptions** — managed with `useEffect` + cleanup return:
```ts
useEffect(() => {
  const unsub = subscribeToItems(wishlistId, setItems);
  return () => unsub();
}, [wishlistId]);
```

**Callback stability** — `useCallback` used explicitly when a function is a dependency of a subscription `useEffect` to prevent re-subscription loops (e.g. `fetchChildName` in `dashboard/page.tsx`).

## Error Handling Conventions

**API routes:**
- `request.json().catch(() => ({}))` — malformed body returns empty object, not a thrown error
- Input validation returns `NextResponse.json({ error: '...' }, { status: 400 })`
- Token verification wrapped in try/catch; on failure returns `{ error: '...' }` with 401
- Unexpected errors re-thrown with bare `throw err` — not swallowed
- Cleanup operations on failure use `.catch(() => {})` to suppress secondary errors:
  ```ts
  await usernameRef.delete().catch(() => {});
  ```

**Client components:**
- Async handlers wrapped in try/catch
- Error state set to a user-facing Swedish string on failure — e.g. `'Något gick fel. Försök igen.'`
- `catch {}` with empty block used for silent failures (e.g. `fetchChildName`)

**TypeScript error typing:**
- `err as Error` cast for message access
- `err as { code?: string }` cast for Firebase error codes — no use of `unknown` narrowing guards

## Logging

- `console.warn` used for recoverable anomalies in library code — e.g. skipped reorder in `wishlist.ts`
- No structured logging framework
- No `console.log` statements in source (only `console.warn` found)

## Comment and Documentation Conventions

**File-level comments:**
- JSDoc-style block comment at the top of test files explaining scope and isolation strategy
- `'// --- section label ---'` dividers used within complex functions to separate phases of logic

**Inline comments:**
- Used to explain non-obvious decisions and cross-reference design decisions — e.g. `// Pattern 1 (RESEARCH.md)`, `// Pitfall 3`, `// D-05`, `// D-10`
- Privacy boundaries explicitly called out with `// PRIVACY BOUNDARY:` in type definitions
- Short explanatory comments on optional/dead props — e.g. `// optional, unused but kept for API compatibility`

**No TSDoc/JSDoc** on exported functions — documentation is via inline comments only.

## Git Commit Message Patterns

Commits follow Conventional Commits format:

- `feat(scope): description` — new features
- `fix(scope): description` — bug fixes
- `chore: description` — tooling and dependency changes
- `docs(scope): description` — documentation updates

Scope is a short identifier matching the phase or area — e.g. `feat(07-03)`, `docs(07)`. Branch names use kebab-case with issue number prefix — e.g. `12-åtgärda-databas-strul`, `claude/fix-account-creation-bugs-xgCZC`.

## Gaps & Unknowns

- No Prettier config — it is unclear whether formatting is enforced by editor settings or left entirely to developer preference.
- The `src/app/test/page.tsx` file exists — its purpose and whether it should be committed is unknown.
- `eslint-config-next/typescript` rules are inherited but no audit of which specific TS rules are active has been done.
