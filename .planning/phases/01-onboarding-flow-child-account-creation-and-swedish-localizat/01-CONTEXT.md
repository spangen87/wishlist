# Phase 1: Onboarding flow, child account creation, and Swedish localization - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A first-time parent who has just registered at `/register` is guided through a multi-step onboarding wizard to create their first child account and wishlist, and is then shown the share link so they can invite relatives immediately. Additionally, a dedicated `/add-child` page handles adding further children post-onboarding. All existing UI text is audited and standardized to consistent Swedish; all new pages are written in Swedish from the start. No i18n library is introduced — Swedish stays hardcoded.

</domain>

<decisions>
## Implementation Decisions

### Onboarding flow structure
- **D-01:** `/onboarding` is a dedicated route, always accessible (not only shown on first login)
- **D-02:** Multi-step wizard — three steps in sequence:
  - Step 1: Create child account (username + password + display name + age)
  - Step 2: Name the wishlist (parent gives the wishlist a title, e.g., "Elsas önskelista")
  - Step 3: Share link screen — reuse the existing `ShareLinkPanel` component
- **D-03:** Entry point is post-login — parent registers at the existing `/register` page first, then navigates to `/onboarding`. Onboarding does not include parent registration.
- **D-04:** After completing the wizard, redirect parent to the newly created child's wishlist in viewer mode (i.e., `/viewer/{wishlistId}`)

### Child account creation fields
- **D-05:** Four fields collected when creating a child account: username (login credential), password, display name (shown in dashboard, e.g., "Elsa"), and age (stored in Firestore for future use, not displayed in v1.1)
- **D-06:** Backend: the existing `/api/auth/register-child` route must be extended to accept and store `displayName` and `age` alongside the existing username/password fields

### Post-onboarding child management
- **D-07:** Adding additional children (after onboarding) lives at a dedicated `/add-child` page — not a modal — to keep the form accessible and uncluttered on mobile
- **D-08:** The viewer `/dashboard` gets a prominent "Lägg till barn" button/link pointing to `/add-child`
- **D-09:** `/add-child` collects the same four fields as Step 1 of the onboarding wizard (username, password, display name, age) — same form component, reused

### Localization
- **D-10:** No i18n library — all Swedish text stays hardcoded inline (current pattern). App is Swedish-only in v1.1.
- **D-11:** Audit and standardize Swedish text across ALL existing pages: `/login`, `/register`, `/dashboard`, `/wishlist`, `/viewer`, and all components. Produce a consistent Swedish voice (see Specific Ideas for terminology anchors).

### Claude's Discretion
- Exact progress indicator style for the multi-step wizard (step dots, numbered steps, or stepper bar)
- Visual transition between wizard steps (slide, fade, or static)
- Exact wording for error states in the wizard forms (follow existing error patterns from login/register)
- Where the "Lägg till barn" button sits in the dashboard layout

</decisions>

<specifics>
## Specific Ideas

- The wizard should feel like a natural continuation of registration — same visual style as `/register` (centered card, max-w-sm, pastel UI already established in v1.0)
- Step 3 (share link) should use the existing `ShareLinkPanel` component directly — no need to redesign
- Display name is what appears in `WishlistDashboardCard` on the viewer dashboard — it should replace or supplement the current username display
- Age is stored in Firestore (`users/{uid}.age` as a number) but has no UI in v1.1
- Swedish terminology to standardize (use these consistently across all pages):
  - Login action: "Logga in" (not "Logga in på ditt konto")
  - Registration: "Registrera" or "Skapa konto"
  - Child account: "Barnkonto"
  - Wishlist: "Önskelista"
  - Viewer/relative: "Betraktare" or "Inbjuden" — pick one and stick with it
  - Share link: "Delningslänk"
  - Error messages: concise, friendly, Swedish ("Användarnamnet är taget" etc.)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing auth backend (extend, don't replace)
- `src/app/api/auth/register-child/route.ts` — The child creation API. Handles atomic username claim, synthetic email, Firestore writes for `usernames/`, `users/`, `wishlists/` and sets the `child` role claim. Must be extended to store `displayName` and `age`.
- `src/app/api/auth/set-viewer-claim/route.ts` — Viewer role claim setter. Reference for how role claims are applied.

### Reusable components (use as-is or extend)
- `src/components/viewer/ShareLinkPanel.tsx` — Share link display component. Reuse as-is for wizard Step 3.
- `src/components/viewer/WishlistDashboardCard.tsx` — Per-child card in viewer dashboard. May need to show `displayName` instead of / alongside username.
- `src/components/AuthProvider.tsx` — Auth context (`useAuth()` hook). Used by all pages for role-based redirects.

### Existing pages (reference for patterns + localization audit targets)
- `src/app/login/page.tsx` — Swedish text patterns, form layout, error handling patterns
- `src/app/register/page.tsx` — Viewer registration flow. Entry point before `/onboarding`. Reference for form structure.
- `src/app/dashboard/page.tsx` — Viewer dashboard. Gets "Lägg till barn" button pointing to `/add-child`.

### Types (extend for new fields)
- `src/types/firestore.ts` — Firestore document types. Need to add `displayName: string` and `age: number` to the user/child document type.

### No external specs
No ADRs or design docs exist — all requirements are captured in decisions above and in PROJECT.md / ROADMAP.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShareLinkPanel` (`src/components/viewer/ShareLinkPanel.tsx`): Drop-in for wizard Step 3 — renders share link with copy button
- `register-child` API (`src/app/api/auth/register-child/route.ts`): Complete backend for child account creation. Extend with `displayName` + `age`, do not rewrite.
- `useAuth()` from `AuthProvider`: Provides `user`, `role`, `loading` — pattern used in every page for auth-gating and redirects

### Established Patterns
- Page layout: `<main className="flex min-h-screen items-center justify-center p-4"><div className="w-full max-w-sm">` — used in login and register; follow for onboarding and add-child
- Form pattern: controlled inputs with `useState`, `onSubmit` handler, inline error display via `{error && <p>…</p>}`, loading state on submit button
- Role-based redirect: `useEffect` on `[loading, user, role, router]` — all pages follow this pattern
- Swedish errors: `setError('…')` with concise Swedish message, displayed below form

### Integration Points
- `/onboarding` needs the parent to be logged in as a viewer — add auth-gate redirect to `/login` if not authenticated
- After wizard Step 1 creates child account via `register-child` API, the returned wishlist ID is needed for Step 2 (name wishlist) and Step 3 (share link) — pass through wizard state
- `/add-child` page: same auth requirements as `/onboarding`, same API call
- `WishlistDashboardCard` in dashboard shows child wishlists — after adding `displayName`, this card may need a prop update

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-onboarding-flow-child-account-creation-and-swedish-localizat*
*Context gathered: 2026-04-12*
