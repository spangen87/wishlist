# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 01-foundation
**Mode:** discuss

## Gray Areas Presented

| Area | Selected |
|------|----------|
| Firestore collection hierarchy | All delegated to Claude |
| Firebase emulator setup | All delegated to Claude |
| Next.js scaffolding choices | All delegated to Claude |
| Real-time proof-of-concept | All delegated to Claude |

## User Response

User response: "Kör på det du rekommenderar. Jag kan dessa tjänster för dåligt."
(Translation: "Go with what you recommend. I don't know these services well enough.")

All decisions delegated to Claude. No corrections made.

## Decisions Made (Claude's Recommendations)

### Firestore Collection Hierarchy
- `wishlists/{wishlistId}` as top-level entity (wishlist-centric, not user-centric)
- `items` and `purchaseStatus` as subcollections under wishlist
- Root collections: `usernames`, `users`, `invites`

### Firebase SDK Split
- `lib/firebase/client.ts` (client SDK, browser only)
- `lib/firebase/admin.ts` (Admin SDK, `server-only` guard)
- Standard `NEXT_PUBLIC_FIREBASE_*` env var naming

### Next.js Scaffolding
- App Router, TypeScript strict mode, `@/` path alias

### Firebase Emulator
- Full setup in Phase 1: `firebase.json`, emulator ports, test script
- `tests/firestore.rules.test.ts` must pass before phase is complete

### Real-Time Proof of Concept
- Isolated `/test` route with `onSnapshot` listener
- Not part of app shell — verify and remove/repurpose later

## No Corrections Applied
All decisions are Claude's recommendations accepted by user delegation.
