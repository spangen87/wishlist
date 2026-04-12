# Milestones

## v1.0 PWA (Shipped: 2026-04-10)

**Phases completed:** 5 phases, 17 plans
**Timeline:** 2026-04-06 → 2026-04-10 (4 days)
**LOC:** ~3,335 TypeScript/TSX | 36 feat commits

**Key accomplishments:**

1. Next.js 16 + Firebase scaffold with correct subcollection schema — `purchaseStatus` separated from `items`, enforcing the child privacy boundary at the database layer from day one (irreversible architecture decision landed correctly in Phase 1).
2. Dual Firebase SDK split: `client.ts` (HMR-guarded browser singleton) and `admin.ts` (`server-only` guarded Admin SDK) establishing the import boundary all future phases depend on.
3. Full dual-role auth: child login via synthetic email shim, viewer registration with forced token refresh, `proxy.ts` route protection, and persistent sessions — all auth lifecycle complete.
4. Real-time wishlist management with item CRUD, fractional-indexing drag-and-drop (one Firestore write per reorder), and a privacy-safe child view that cannot access `purchaseStatus` even via DevTools.
5. Complete viewer flow: share link generation/redemption, mark-as-purchased coordination, viewer-only notes, activity log, and multi-child viewer dashboard.
6. PWA installability (standalone mode on iOS/Android), Workbox offline cache, pastel family-friendly UI, and 13 Firestore security rule tests confirming the privacy boundary holds in production rules.

---
