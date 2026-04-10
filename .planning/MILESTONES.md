# Milestones

## v1.0 MVP (Shipped: 2026-04-10)

**Phases completed:** 5 phases, 17 plans, 16 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] Fixed .gitignore blocking .env.example from being committed
- Dual Firebase SDK split: client.ts (HMR-guarded browser singleton) and admin.ts (server-only guarded Admin SDK) establishing the import boundary all future phases depend on.
- 1. [Rule 2 - Missing] Added `emulator` npm script
- Firebase Route Handlers for child account creation (atomic username claim + role:'child') and viewer claim setting, plus AuthProvider context wrapping the entire app via useAuth()
- Client-side login page (child username+password with synthetic email shim) and viewer registration page (email+password with forced token refresh after claim is set)
- Next.js 16 proxy.ts replacing middleware.ts, plus protected dashboard page with loading guard, auth redirect, and signOut logout flow completing the full authentication lifecycle
- Six Firestore helpers for wishlist CRUD with fractional-index ordering, plus role-aware child redirect on login — data layer and routing foundation for Phase 3 UI plans.
- Real-time wishlist page with read-mode item cards, inline add form with Swedish validation, empty state, and pulse skeleton — complete read+add child experience on mobile and tablet.
- Full wishlist management UX: inline edit mode with 5 fields, inline delete confirmation without a modal, and drag-and-drop reordering via dnd-kit with fractional indexing and one Firestore write per drag.
- One-liner:
- One-liner:
- One-liner:

---
