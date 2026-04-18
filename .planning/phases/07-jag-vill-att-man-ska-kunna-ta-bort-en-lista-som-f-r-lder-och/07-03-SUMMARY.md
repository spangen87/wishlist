---
phase: "07"
plan: "03"
subsystem: "ui"
tags: ["delete", "danger-zone", "settings", "dashboard", "parent", "viewer"]
dependency_graph:
  requires:
    - "07-01"  # DELETE /api/wishlist/[wishlistId] and DELETE /api/auth/user/[uid]
  provides:
    - "DangerZone UI on settings page (parent-only)"
    - "Self-delete button on dashboard (parent/viewer only)"
  affects:
    - "src/app/wishlist/[wishlistId]/settings/page.tsx"
    - "src/app/dashboard/page.tsx"
tech_stack:
  added: []
  patterns:
    - "window.confirm() for destructive action guard"
    - "Disabled buttons during in-flight requests (no double-submit)"
    - "Role-conditional rendering (accessType === 'parent', role !== 'child')"
key_files:
  created: []
  modified:
    - "src/app/wishlist/[wishlistId]/settings/page.tsx"
    - "src/app/dashboard/page.tsx"
decisions:
  - "childUid === wishlistId: For all child accounts in this app, wishlist document ID equals child UID (set in register-child), so passing wishlistId as childUid in DangerZone is correct"
  - "Silent fail on handleDeleteSelf: dashboard delete failure is low-risk; toast notification deferred to future phase"
  - "No loading state for dashboard delete button: confirm dialog already adds friction; mitigates double-submit risk adequately at this phase"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-13"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 07 Plan 03: Delete UI — DangerZone + Self-delete Summary

**One-liner:** Parent-only DangerZone on settings page (delete wishlist / delete child account) and parent/viewer self-delete button on dashboard, both with Swedish confirm dialogs wired to cascade-delete API routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DangerZone on settings page (parent-only) | c6dbbd6 | src/app/wishlist/[wishlistId]/settings/page.tsx |
| 2 | Self-delete button on dashboard (parent/viewer) | bbca132 | src/app/dashboard/page.tsx |
| 3 | checkpoint:human-verify | — | (awaiting human verification) |

## What Was Built

### Task 1: DangerZone component (settings page)

Added `DangerZone` function component to `src/app/wishlist/[wishlistId]/settings/page.tsx`:

- Red-tinted section (`bg-[#FFF5F5] border border-[#FECACA]`) with heading "Fara"
- Two red destructive buttons: "Ta bort önskelistan" and "Ta bort barnkonto"
- Each button shows a Swedish `window.confirm()` before making any API call
- "Ta bort önskelistan" calls `DELETE /api/wishlist/${wishlistId}` then redirects to `/dashboard`
- "Ta bort barnkonto" calls `DELETE /api/auth/user/${childUid}` (where `childUid === wishlistId`) then redirects to `/dashboard`
- Both buttons disabled while either deletion is in-flight (no double-submit, T-07-17)
- Rendered only when `accessType === 'parent'` — child owners see nothing (T-07-15)

### Task 2: Self-delete button (dashboard page)

Added `handleDeleteSelf` function and "Ta bort mitt konto" button to `src/app/dashboard/page.tsx`:

- Swedish `window.confirm()` before API call
- Calls `DELETE /api/auth/user/${user.uid}`, then `signOut(auth)`, then `router.push('/login')`
- Button wrapped in `{role !== 'child' && ...}` guard (T-07-16)
- Dashboard already redirects `role === 'child'` to `/wishlist` at mount — defense in depth
- Placed in a `flex flex-col items-end gap-1` group below the "Logga ut" button

## Decisions Made

1. **childUid === wishlistId:** For all child accounts in this app, the Firestore wishlist document ID equals the child's Firebase Auth UID (established in `register-child/route.ts`). Passing `wishlistId` as both `wishlistId` and `childUid` props in DangerZone is correct and consistent with the existing codebase convention.

2. **Silent fail on dashboard delete:** A failed `handleDeleteSelf` catch block logs nothing and shows nothing to the user. This matches the plan's note ("could add toast in future phase") and is acceptable at this phase because the confirm dialog already prevents accidental triggers.

3. **No loading state for dashboard delete button:** The plan noted this is low-risk given the confirm dialog adds friction. Deferred to a future phase.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-07-14 | Two separate `window.confirm()` calls in DangerZone; one in dashboard |
| T-07-15 | `{accessType === 'parent' && <DangerZone ... />}` render condition |
| T-07-16 | Dashboard redirects child at mount + `{role !== 'child' && ...}` on button |
| T-07-17 | Both DangerZone buttons disabled while `deletingList \|\| deletingAccount` |

## Known Stubs

None. Both delete flows are fully wired to the API routes from Plan 07-01.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All surface was established in Plan 07-01.

## Self-Check: PASSED

- [x] `src/app/wishlist/[wishlistId]/settings/page.tsx` exists and contains `function DangerZone`, "Fara", "Ta bort önskelistan", "Ta bort barnkonto"
- [x] `src/app/dashboard/page.tsx` exists and contains `handleDeleteSelf`, "Ta bort mitt konto"
- [x] Commit `c6dbbd6` exists (Task 1)
- [x] Commit `bbca132` exists (Task 2)
- [x] TypeScript: `npx tsc --noEmit` exits 0
- [x] `grep -c "window.confirm" settings/page.tsx` = 2
- [x] `grep -c "method: 'DELETE'" settings/page.tsx` = 2
- [x] `grep -n "method: 'DELETE'" dashboard/page.tsx` = 1 match
