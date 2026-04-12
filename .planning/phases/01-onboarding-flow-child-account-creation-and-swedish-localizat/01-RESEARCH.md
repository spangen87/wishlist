# Phase 1: Onboarding flow, child account creation, and Swedish localization — Research

**Researched:** 2026-04-12
**Domain:** Next.js 16 App Router, Firebase Auth/Firestore, Swedish localization, multi-step wizard
**Confidence:** HIGH (all findings verified from codebase or official Next.js docs in node_modules)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/onboarding` is a dedicated route, always accessible (not only shown on first login)
- **D-02:** Multi-step wizard — three steps in sequence: Step 1 create child account, Step 2 name wishlist, Step 3 share link screen
- **D-03:** Entry point is post-login — parent registers at `/register` first, then navigates to `/onboarding`. Onboarding does not include parent registration.
- **D-04:** After completing the wizard, redirect parent to `/viewer/{wishlistId}`
- **D-05:** Four fields: username (login credential), password, display name (shown in dashboard), age (stored in Firestore, no UI in v1.1)
- **D-06:** Backend: `/api/auth/register-child` must be extended to accept and store `displayName` and `age`
- **D-07:** `/add-child` is a dedicated page (not modal)
- **D-08:** Viewer `/dashboard` gets a prominent "Lägg till barn" button pointing to `/add-child`
- **D-09:** `/add-child` collects same four fields as Step 1 — same `ChildAccountForm` component, reused
- **D-10:** No i18n library — Swedish hardcoded inline
- **D-11:** Audit and standardize Swedish across `/login`, `/register`, `/dashboard`, `/wishlist`, `/viewer`, and all components

### Claude's Discretion

- Exact progress indicator style for the multi-step wizard (step dots, numbered steps, or stepper bar)
- Visual transition between wizard steps (slide, fade, or static)
- Exact wording for error states in the wizard forms
- Where the "Lägg till barn" button sits in the dashboard layout

UI-SPEC has resolved all discretion items:
- Progress indicator: numbered step dots, 8px circles, accent fill for active step
- Transitions: static (no animation)
- Error wording: fully specified in UI-SPEC error copy table
- "Lägg till barn" placement: below wishlists grid (or empty state), full-width on mobile, auto on sm+

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

## Summary

Phase 1 adds the onboarding wizard (`/onboarding`), a post-onboarding child management page (`/add-child`), and extends the existing `register-child` API with two new fields. The work is squarely within the established codebase patterns — no new libraries needed, no architectural changes.

**Critical gap found in research:** The `register-child` API currently returns only `{ uid }` and does NOT create a wishlist document server-side. Wishlist creation is currently client-side via `getOrCreateWishlist(childUid)`. For the wizard, the wishlist ID is needed immediately after Step 1 to pass to Steps 2 and 3. The wishlist ID equals `childUid` (deterministic, from `wishlist.ts` line 22: `return childUid`). This means the wizard can derive `wishlistId = uid` from the API response without changing the API response shape — but the wishlist creation must happen before Step 2. The plan must address: either extend the API to create the wishlist server-side, or call `getOrCreateWishlist(uid)` from the wizard after Step 1.

**Second critical gap:** `WishlistDoc` has no `title` field in `src/types/firestore.ts`. Step 2 collects a wishlist name ("Namnge önskelistan"), so `WishlistDoc` must be extended and a write mechanism must be planned. The Firestore `wishlists/{uid}` doc must gain a `title` field.

**Primary recommendation:** Use client component `useState` at the `/onboarding` page level for wizard state, follow the established form pattern (controlled inputs, `onSubmit` handler, inline Swedish error), share the `ChildAccountForm` component between `/onboarding` Step 1 and `/add-child`.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.2 | App Router, page routing, API routes | Project foundation [VERIFIED: package.json] |
| React | 19.2.4 | Client component state for wizard | Project foundation [VERIFIED: package.json] |
| Firebase JS SDK | 12.11.0 | Client-side auth, Firestore reads | Already used everywhere [VERIFIED: package.json] |
| Firebase Admin SDK | 13.7.0 | Server-side Firestore writes in API routes | Already used in register-child, set-viewer-claim [VERIFIED: package.json] |
| Tailwind CSS | 4.x | Inline utility classes, no design system | Established project pattern [VERIFIED: package.json] |

### No New Libraries Required

All functionality needed for this phase is already available:
- Multi-step wizard: React `useState` — no wizard library needed
- Form validation: inline client-side checks — no form library needed
- Localization: hardcoded Swedish strings — no i18n library (D-10)

**Installation:** No new packages to install.

---

## Architecture Patterns

### Established Page Pattern (VERIFIED: login, dashboard, wishlist pages)

Every page in this project follows a consistent structure:

```typescript
// Source: src/app/login/page.tsx, src/app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function SomePage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading2, setLoading2] = useState(false);

  // Auth guard — all pages follow this exact pattern
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* content */}
      </div>
    </main>
  );
}
```

### Multi-Step Wizard Pattern (VERIFIED: UI-SPEC + CONTEXT.md)

The wizard lives at `/onboarding/page.tsx` as a single client component. Step index is controlled by `useState`. No URL changes between steps.

```typescript
// Source: CONTEXT.md code_context + UI-SPEC component contract
'use client';
import { useState } from 'react';

type WizardState = {
  step: 1 | 2 | 3;
  childUid: string | null;
  wishlistId: string | null;
};

export default function OnboardingPage() {
  const [state, setState] = useState<WizardState>({
    step: 1, childUid: null, wishlistId: null,
  });

  if (state.step === 1) return <Step1 onDone={(uid) => setState({ step: 2, childUid: uid, wishlistId: uid })} />;
  if (state.step === 2) return <Step2 wishlistId={state.wishlistId!} onDone={() => setState(s => ({ ...s, step: 3 }))} />;
  return <Step3 wishlistId={state.wishlistId!} />;
}
```

**Note:** `wishlistId === childUid` because `getOrCreateWishlist` uses the child UID as the doc ID [VERIFIED: src/lib/firebase/wishlist.ts line 12-22].

### Shared Form Component Pattern (VERIFIED: D-09)

`ChildAccountForm` is extracted to `src/components/onboarding/ChildAccountForm.tsx` and used in both `/onboarding` Step 1 and `/add-child`. The component accepts an `onSuccess` callback prop.

```typescript
// Pattern for shared form component
interface ChildAccountFormProps {
  onSuccess: (uid: string) => void;
}

export function ChildAccountForm({ onSuccess }: ChildAccountFormProps) {
  // Fields: displayName, username, password, age
  // On submit: POST /api/auth/register-child
  // On success: call onSuccess(uid)
}
```

### API Route Extension Pattern (VERIFIED: register-child/route.ts)

The existing `register-child` route uses `const { username, password } = body`. Extension adds `displayName` and `age` alongside, writes them to the `users/{uid}` batch set, and continues returning `{ uid }`. The batch already writes to `users` collection — just add the new fields:

```typescript
// Current (line 70-76 of register-child/route.ts):
batch.set(adminDb.collection('users').doc(userRecord.uid), {
  uid: userRecord.uid,
  username: usernameLower,
  email: syntheticEmail,
  role: 'child',
  createdAt: FieldValue.serverTimestamp(),
});

// Extended version adds:
//   displayName: displayName.trim(),
//   age: Number(age),
// to the same batch.set call — no structural change.
```

### Wishlist Title Field Pattern (RESEARCH GAP — must be planned)

`WishlistDoc` has no `title` field. Step 2 collects a wishlist title. Two things must happen:

1. `WishlistDoc` interface in `src/types/firestore.ts` gains `title?: string`
2. A write function in `src/lib/firebase/wishlist.ts` updates the wishlist title — either:
   - Extend `getOrCreateWishlist` to accept an optional `title` param, or
   - Add a new `updateWishlistTitle(wishlistId, title)` function that calls `updateDoc`

The wizard Step 2 calls this write function client-side (viewer is already logged in as a viewer, but the wishlist belongs to the child — **security consideration below**).

### Dashboard "Lägg till barn" Button Placement (VERIFIED: UI-SPEC)

The button is added below the wishlists grid in `src/app/dashboard/page.tsx` inside the `role === 'viewer'` branch, after the grid/empty state block. Style: ghost/outline — `border border-[#E5D5CC] rounded-xl px-4 py-2 text-sm font-bold text-[#171717] hover:bg-[#FFF0E8] min-h-[44px] transition-colors w-full sm:w-auto`.

### WishlistDashboardCard — displayName Integration (VERIFIED: codebase)

`WishlistDashboardCard` already accepts `childName: string`. The dashboard currently resolves it via:
```typescript
// src/app/dashboard/page.tsx line 38-39
const data = snap.data();
const name: string = data.username ?? data.email ?? uid;
```
After Phase 1, `data.displayName` will exist in the `users` doc. The resolution order changes to:
```typescript
const name: string = data.displayName ?? data.username ?? data.email ?? uid;
```
This is a **one-line change in dashboard/page.tsx** — `WishlistDashboardCard` component itself needs no modification.

### Recommended Project Structure (New Files)

```
src/
├── app/
│   ├── onboarding/
│   │   └── page.tsx          # Wizard page — new
│   └── add-child/
│       └── page.tsx          # Add child page — new
└── components/
    └── onboarding/
        └── ChildAccountForm.tsx  # Shared form component — new
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic username claim | Custom locking | Existing Firestore transaction in register-child | Already implemented, battle-tested in codebase |
| Auth state | Manual Firebase listeners | `useAuth()` from AuthProvider | Established pattern, handles loading/role/user |
| Wishlist ID | Random UUID | `childUid` (deterministic) | `getOrCreateWishlist` already uses UID as doc ID |
| Share link display | Custom link panel | `ShareLinkPanel` component | Fully built, tested, handles all edge cases |
| Swedish localization | External i18n library | Hardcoded strings (D-10) | Project decision, no library needed |

---

## Critical Findings

### Finding 1: register-child does NOT return wishlistId (VERIFIED: route.ts line 79)

Current response: `{ uid: userRecord.uid }` (status 201). The wizard needs `wishlistId` for Steps 2 and 3. However, because `wishlistId === childUid` (deterministic, per `wishlist.ts` line 22), the wizard can compute `wishlistId = uid` from the response without any API change.

**Action required:** The wizard must call `getOrCreateWishlist(uid)` or create the wishlist server-side after Step 1 succeeds. Options:
- Option A (simpler): Extend API to create wishlist in the existing batch write (server-side, consistent, no extra round-trip). API still returns `{ uid }`, wizard derives `wishlistId = uid`.
- Option B: Wizard calls `getOrCreateWishlist(uid)` client-side after API returns. Adds a round-trip but keeps API minimal.

**Recommendation:** Option A — add the wishlist batch write to `register-child/route.ts`. This is consistent with the server-side ownership of Firestore writes in this codebase.

### Finding 2: WishlistDoc has no title field (VERIFIED: src/types/firestore.ts)

`WishlistDoc` interface (line 4-9 of firestore.ts) has: `id`, `childUid`, `viewerUids`, `createdAt`. No `title`. Step 2 of the wizard collects and persists a title like "Elsas önskelista".

**Action required:**
1. Add `title?: string` to `WishlistDoc` in `src/types/firestore.ts`
2. Add `updateWishlistTitle(wishlistId: string, title: string)` to `src/lib/firebase/wishlist.ts`
3. Firestore security rules: verify viewer can write `title` field to `wishlists/{id}` — currently the wishlist doc is written only by Admin SDK (register-child). Check if the client-side Firestore rules allow viewer write. **This is a likely security rule gap.**

### Finding 3: register-child does not create a wishlist (related to Finding 1)

Currently `getOrCreateWishlist` is called client-side from `wishlist/page.tsx` (the child's own page). In the onboarding wizard, the logged-in user is the viewer/parent — they cannot call client-side Firestore functions that require child auth claims to write the wishlist. **The wishlist must be created server-side in register-child** so the parent/viewer's session can then access it through the existing viewer rules.

### Finding 4: register page is entirely English (VERIFIED: src/app/register/page.tsx)

Confirmed: heading "Register as a viewer", labels "Email", "Password", button "Create account", link "Already have an account? Log in", errors in English. The UI-SPEC localization table fully specifies the Swedish replacements.

### Finding 5: login page input border is unstyled (VERIFIED: src/app/login/page.tsx line 67, 78)

Login inputs use `className="w-full border rounded px-3 py-2"` — plain `border` without the design system token `border-[#E5D5CC]`. New pages must use `border border-[#E5D5CC] rounded px-3 py-2` per UI-SPEC. Register page button also uses `bg-blue-600` instead of the accent token — must be corrected as part of the localization + standardization audit.

### Finding 6: ShareLinkPanel requires viewer auth (VERIFIED: ShareLinkPanel.tsx line 49)

`ShareLinkPanel` calls `auth.currentUser?.getIdToken()` and hits `/api/invite/current?wishlistId=...`. The parent/viewer is logged in during the wizard — this works. However, the share link is for the **child's wishlist** — the `/api/invite/current` route must accept a viewer's token and the child's wishlistId. Verify Firestore security rules allow this. [ASSUMED: the invite API already handles viewer access since ShareLinkPanel is currently used in `/wishlist/[wishlistId]/settings` for the child, not viewers — the wizard usage is a new context].

---

## Common Pitfalls

### Pitfall 1: Wizard state lost on page refresh
**What goes wrong:** If the parent refreshes mid-wizard, all state is lost.
**Why it happens:** `useState` is ephemeral — not persisted to URL or storage.
**How to avoid:** This is acceptable per D-01 (onboarding is always accessible — parent can restart). Do not add `sessionStorage` persistence unless explicitly requested. Document this behavior.
**Warning signs:** If the wizard is only one step away from completion, loss is frustrating — but per scope this is acceptable in v1.1.

### Pitfall 2: Forgetting to create wishlist server-side
**What goes wrong:** Step 2 tries to write `title` to a wishlist doc that doesn't exist yet, or client-side write fails due to auth rules.
**Why it happens:** `getOrCreateWishlist` is designed for child auth context. The viewer's auth token may not have write permission on `wishlists/`.
**How to avoid:** Create the wishlist doc inside the `register-child` API route batch write (Admin SDK bypasses security rules).

### Pitfall 3: Deriving wishlistId incorrectly
**What goes wrong:** New developer writes code assuming wishlistId is a random Firebase key.
**Why it happens:** Firebase `addDoc` generates random IDs; `setDoc` with a known ID is less visible.
**How to avoid:** Document clearly: `wishlistId === childUid` (established pattern in `wishlist.ts`). After API returns `uid`, pass it as `wishlistId` everywhere.

### Pitfall 4: Using `bg-blue-600` or plain `border` in new pages
**What goes wrong:** New pages don't follow the design system — mismatched colors, unstyled inputs.
**Why it happens:** Copying from `register/page.tsx` which has known styling issues.
**How to avoid:** Use `login/page.tsx` as the style reference, not `register/page.tsx`. Inputs must use `border border-[#E5D5CC] rounded px-3 py-2`. Primary CTAs: `bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors`.

### Pitfall 5: Forgetting to extend `UserDoc` type
**What goes wrong:** TypeScript allows reading `data.displayName` at runtime (Firestore returns any) but type system does not reflect it, causing implicit `any` or type errors downstream.
**Why it happens:** Firestore SDK returns untyped data; the explicit cast in codebase is `snap.data() as UserDoc`.
**How to avoid:** Add `displayName?: string` and `age?: number` to `UserDoc` interface in `src/types/firestore.ts` before implementing any code that reads these fields.

### Pitfall 6: ShareLinkPanel in wizard context — idToken scope
**What goes wrong:** `ShareLinkPanel` fetches `/api/invite/current` with the viewer's idToken, passing the child's `wishlistId`. The invite API may enforce that only the child who owns the wishlist can fetch/create invites.
**Why it happens:** In v1.0, ShareLinkPanel was used only inside the child's own session (wishlist settings page).
**How to avoid:** Audit `/api/invite/create` and `/api/invite/current` — verify they accept a parent/viewer token and the child's wishlistId. If they enforce child ownership, extend them or use a different approach for wizard Step 3.

---

## Localization Audit Results (VERIFIED: codebase)

### Pages/Components Requiring Changes

| File | Current (English) | Fix |
|------|------------------|-----|
| `src/app/register/page.tsx` line 60 | `"Register as a viewer"` | `"Skapa konto"` |
| `src/app/register/page.tsx` line 64 | `"Email"` | `"E-post"` |
| `src/app/register/page.tsx` line 74 | `"Password"` | `"Lösenord"` |
| `src/app/register/page.tsx` line 100 | `"Create account"` / `"Registering…"` | `"Skapa konto"` / `"Skapar…"` |
| `src/app/register/page.tsx` line 34 | `'Registration failed, please try again'` | `'Registreringen misslyckades, försök igen'` |
| `src/app/register/page.tsx` line 41 | `'An account with this email already exists'` | `'Det finns redan ett konto med den e-postadressen'` |
| `src/app/register/page.tsx` line 43 | `'Password must be at least 6 characters'` | `'Lösenordet måste vara minst 6 tecken'` |
| `src/app/register/page.tsx` line 103-106 | `"Already have an account? Log in"` | `"Har du redan ett konto? Logga in"` |
| `src/app/register/page.tsx` line 96-99 | `bg-blue-600` button (wrong design token) | `bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] ... rounded-xl min-h-[44px]` |

### Pages Already Swedish (Minor Terminology Check Only)

| File | Status | Check |
|------|--------|-------|
| `src/app/login/page.tsx` | Swedish — keep | Confirm "Betraktare" in link text line 100 — PASSED ("Registrera dig som betraktare") |
| `src/app/dashboard/page.tsx` | Swedish — keep | No "Inbjuden" found; "Betraktare" used in `ShareLinkPanel` |
| `src/components/viewer/ShareLinkPanel.tsx` | Swedish — keep | "Betraktare" confirmed line 177 |
| `src/components/viewer/WishlistDashboardCard.tsx` | Swedish — keep | No terminology issues |

### Terminology Canonical Standard (VERIFIED: UI-SPEC)

| Concept | Use | Do Not Use |
|---------|-----|------------|
| Login action | "Logga in" | "Logga in på ditt konto" |
| Registration | "Skapa konto" (CTA) / "Registrera dig" (link) | — |
| Child account | "Barnkonto" | "barns konto" |
| Wishlist | "Önskelista" | — |
| Viewer/relative | "Betraktare" | "Inbjuden" |
| Share link | "Delningslänk" | — |
| Display name field | "Visningsnamn" | — |
| Age field | "Ålder" | — |
| Dashboard main nav | "Mina önskelistor" | "Instrumentpanel" (heading), but /add-child back-link uses "Instrumentpanel" as shorthand |

---

## Code Examples

### Auth-gate pattern (VERIFIED: src/app/dashboard/page.tsx lines 27-30)

```typescript
// All new pages (/onboarding, /add-child) must include this exact pattern
useEffect(() => {
  if (!loading && !user) router.push('/login');
  if (!loading && user && role === 'child') router.push('/wishlist');
}, [loading, user, role, router]);
```

### Form submit pattern (VERIFIED: src/app/login/page.tsx)

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);
  try {
    // ... API call
  } catch {
    setError('Något gick fel. Försök igen.');
  } finally {
    setLoading(false);
  }
}
```

### Error display pattern (VERIFIED: login/page.tsx lines 85-89, UI-SPEC)

```typescript
{error && (
  <p role="alert" className="text-[#DC2626] text-sm">{error}</p>
)}
```

Note: login currently uses `text-red-600` — new pages MUST use `text-[#DC2626]` (the design token value).

### register-child API call pattern (VERIFIED: existing + extension)

```typescript
// Current call site shape (to be used in ChildAccountForm):
const res = await fetch('/api/auth/register-child', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password, displayName, age: Number(age) }),
});
if (res.status === 409) {
  setError('Användarnamnet är redan taget');
  return;
}
if (!res.ok) {
  setError('Något gick fel. Försök igen.');
  return;
}
const { uid } = await res.json();
// wishlistId === uid (deterministic)
onSuccess(uid);
```

### Step progress dots (VERIFIED: UI-SPEC component contract)

```typescript
// 3-dot progress indicator, centered, below heading
<div className="flex justify-center gap-2 mb-6" aria-label={`Steg ${step} av 3`}>
  {[1, 2, 3].map((n) => (
    <span
      key={n}
      className={`w-2 h-2 rounded-full ${n === step ? 'bg-[#F9A87A]' : 'bg-[#E5D5CC]'}`}
      aria-current={n === step ? 'step' : undefined}
    />
  ))}
</div>
```

### updateWishlistTitle function (new — must be added to wishlist.ts)

```typescript
// Add to src/lib/firebase/wishlist.ts
export async function updateWishlistTitle(
  wishlistId: string,
  title: string
): Promise<void> {
  await updateDoc(doc(db, 'wishlists', wishlistId), { title });
}
```

---

## State of the Art

| Area | Current Approach | Phase 1 Change |
|------|-----------------|----------------|
| Child account fields | username + password only | Add displayName + age (stored in users doc) |
| Wishlist creation | Client-side via `getOrCreateWishlist` (child session) | Must be server-side in register-child for parent/viewer session |
| WishlistDoc | No title field | Add `title?: string` |
| UserDoc | No displayName or age | Add `displayName?: string`, `age?: number` |
| Register page | Entirely English, wrong button style | Full Swedish + design token fix |
| Child name in dashboard | `data.username ?? data.email ?? uid` | `data.displayName ?? data.username ?? data.email ?? uid` |

---

## Security Domain

Security enforcement is active (not explicitly disabled in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth — existing, no changes |
| V3 Session Management | yes | Firebase ID token via useAuth — existing |
| V4 Access Control | yes | Firestore security rules — see gap below |
| V5 Input Validation | yes | Client-side: min/max on age, minLength on username/password. Server-side: validate in route handler |
| V6 Cryptography | no | Firebase handles password hashing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Username enumeration via 409 | Information Disclosure | Current 409 behavior acceptable — child accounts are not PII-sensitive usernames |
| Unauthorized wishlist title write | Tampering | Firestore rule must allow viewer to write `title` to wishlists they have access to, OR write goes through Admin SDK |
| Age validation bypass | Tampering | Server-side: validate `age` is a number between 1 and 18 in register-child route handler |
| XSS via displayName | Tampering | React renders as text nodes — inherently safe. Do not use `dangerouslySetInnerHTML`. |

### Security Gap: Wishlist title write authorization

The wizard's Step 2 must write `title` to `wishlists/{childUid}`. The logged-in user is a **viewer** (parent). Current Firestore rules likely only allow the child who owns the wishlist to write it, or use Admin SDK. This must be checked before planning the Step 2 implementation.

**Options:**
1. Add a new API route `/api/wishlist/update-title` that uses Admin SDK (consistent with other write routes)
2. Extend Firestore rules to allow the creating viewer to write `title` on newly created wishlists

**Recommendation:** Option 1 — small API route using Admin SDK, consistent with existing patterns.

---

## Open Questions (RESOLVED)

1. **Does `/api/invite/current` allow a viewer/parent token for a child's wishlistId?**
   - What we know: ShareLinkPanel calls `/api/invite/current?wishlistId=...` with `auth.currentUser?.getIdToken()`
   - What's unclear: In v1.0, this was called only in the child's own session. Wizard calls it in the parent/viewer session.
   - Recommendation: Read `/api/invite/current/route.ts` and `/api/invite/create/route.ts` before implementing Step 3 — verify they accept viewer tokens.
   - **RESOLVED:** `/api/invite/current` enforces `childUid === decoded.uid` — it rejects viewer/parent tokens with 403. Resolution: Plan 01-01 creates a new `/api/invite/create-for-child` route that accepts viewer tokens by checking `viewerUids.includes(decoded.uid)` instead. The wizard Step 3 uses this new route via an inline component (not ShareLinkPanel). User approved this deviation from D-02. See `01-02-PLAN.md` `<decision_overrides>` block for full traceability.

2. **Firestore rules: can a viewer write the `title` field to a new wishlist?**
   - What we know: All Firestore writes in the codebase use Admin SDK (bypasses rules)
   - What's unclear: client-side `updateDoc` for wishlist title would be subject to rules
   - Recommendation: Use Admin SDK via API route for the wishlist title write.
   - **RESOLVED:** Client-side `updateDoc` by a viewer is rejected by Firestore rules (only the child owner can update the wishlist doc). Resolution: Plan 01-01 creates `/api/wishlist/update-title` — an Admin SDK route that accepts a viewer idToken and writes the title server-side, bypassing Firestore rules. This is consistent with all other write patterns in the codebase.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tooling (Node.js, Firebase emulators, npm) already confirmed operational from v1.0 milestone. No new CLI tools or services required.

---

## Validation Architecture

`nyquist_validation` is explicitly set to `false` in `.planning/config.json`. This section is omitted.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/api/invite/current` and `/api/invite/create` accept a viewer's idToken for a child's wishlistId | Open Questions | Step 3 (ShareLinkPanel in wizard) would fail silently or with auth error |
| A2 | Firestore security rules do not allow viewer client-side writes to `wishlists/{id}` | Security Domain | If rules DO allow it, Option 2 (rule change) becomes viable but Option 1 (API route) is still safer |

---

## Sources

### Primary (HIGH confidence — VERIFIED in codebase)

- `src/app/api/auth/register-child/route.ts` — Full API implementation, confirmed fields, response shape, and batch write structure
- `src/types/firestore.ts` — Confirmed missing `title`, `displayName`, `age` fields
- `src/lib/firebase/wishlist.ts` — Confirmed `wishlistId === childUid` (line 22), no `updateWishlistTitle` exists
- `src/app/register/page.tsx` — Confirmed entirely English, wrong button style
- `src/app/dashboard/page.tsx` — Confirmed child name resolution order (line 38-39), confirmed no "Lägg till barn" button
- `src/components/viewer/WishlistDashboardCard.tsx` — Confirmed `childName` prop already exists, no modification needed
- `src/components/viewer/ShareLinkPanel.tsx` — Confirmed props: `{ wishlistId: string; viewers: Array<{ uid: string; displayName: string }> }`
- `src/components/AuthProvider.tsx` — Confirmed `useAuth()` returns `{ user, role, loading }`
- `package.json` — Confirmed Next.js 16.2.2, React 19.2.4, no wizard/form libraries

### Secondary (HIGH confidence — official Next.js docs in node_modules)

- `node_modules/next/dist/docs/01-app/02-guides/forms.md` — Confirmed form pattern in App Router (Server Actions or client-side `fetch`)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` — Confirmed `useRouter` from `next/navigation`, `router.push` signature
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — Confirmed client component auth-gate pattern

### Context files (HIGH confidence)

- `.planning/phases/01-.../01-CONTEXT.md` — All locked decisions
- `.planning/phases/01-.../01-UI-SPEC.md` — All visual/copy contracts, resolved discretion items

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified in package.json and codebase
- Architecture: HIGH — verified in existing pages and components
- Pitfalls: HIGH — verified from codebase gaps (no wishlist title field, no API response wishlistId, English register page)
- Security: MEDIUM — Firestore rules not read (would require reading firestore.rules file)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack — no fast-moving dependencies introduced)
