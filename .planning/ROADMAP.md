# Roadmap: Wishlist

## Milestones

- ✅ **v1.0 PWA** — Phases 1-5 (shipped 2026-04-10)

## Phases

<details>
<summary>✅ v1.0 PWA (Phases 1-5) — SHIPPED 2026-04-10</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-04-07
- [x] Phase 2: Authentication (3/3 plans) — completed 2026-04-08
- [x] Phase 3: Child Wishlist (3/3 plans) — completed 2026-04-09
- [x] Phase 4: Viewer Flow (5/5 plans) — completed 2026-04-09
- [x] Phase 5: PWA + Polish (3/3 plans) — completed 2026-04-10

Full phase details archived in `.planning/milestones/v1.0-ROADMAP.md`

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-04-07 |
| 2. Authentication | v1.0 | 3/3 | Complete | 2026-04-08 |
| 3. Child Wishlist | v1.0 | 3/3 | Complete | 2026-04-09 |
| 4. Viewer Flow | v1.0 | 5/5 | Complete | 2026-04-09 |
| 5. PWA + Polish | v1.0 | 3/3 | Complete | 2026-04-10 |
| 6. Parent Administration | v1.1 | 0/4 | Planned | — |

### Phase 1: Onboarding flow, child account creation, and Swedish localization

**Goal:** Parent registers at /register, navigates to /onboarding, creates a child account with display name and age via a 3-step wizard (create account → name wishlist → share link), then lands on the child's viewer page ready to share. Adding more children uses /add-child. All app text is consistent Swedish.
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11
**Depends on:** Phase 0
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Type extensions + Admin SDK routes (update-title, create-for-child)
- [x] 01-02-PLAN.md — register-child API extension + ChildAccountForm + /onboarding wizard
- [x] 01-03-PLAN.md — /add-child page + dashboard updates + /register Swedish localization

### Phase 6: Parent administration and role distinction — parent can manage child wishlist (share link, rename, add items) and app distinguishes parent role from anhörig (family member)

**Goal:** Parent can manage child wishlist (share link, rename, add items) and app distinguishes parent role from anhörig (family member). Parents are tracked in parentUids[] and see a distinct two-section dashboard. Co-parents can be added via a parent invite link.
**Requirements**: D-01 through D-24 (from 06-CONTEXT.md)
**Depends on:** Phase 1
**Plans:** 4 plans

Plans:
- [ ] 06-01-PLAN.md — Types (parentUids, InviteDoc.type) + set-parent-claim route + register-child fix + Firestore rules (Wave 1)
- [ ] 06-02-PLAN.md — create-for-parent invite route + redeem route parent branch (Wave 2, parallel with 06-03)
- [ ] 06-03-PLAN.md — subscribeToParentWishlists + two-section dashboard + ParentWishlistDashboardCard (Wave 2, parallel with 06-02)
- [ ] 06-04-PLAN.md — add-item API + update-title fix + viewer page parent controls + settings page (Wave 3)
