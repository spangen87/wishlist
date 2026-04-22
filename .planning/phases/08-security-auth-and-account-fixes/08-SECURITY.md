---
phase: 08
slug: security-auth-and-account-fixes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-22
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client → Firestore | Unauthenticated or authenticated clients can attempt to write wishlist docs directly | Wishlist documents (childUid, parentUids, viewerUids) |
| Browser → Next.js server | HTTP responses carry security headers from this phase onward | All HTML/JS responses |
| Parent browser → /api/wishlist/add-item | Authenticated parent POSTs wish items including user-supplied URLs | productUrl, imageUrl (potential XSS vectors) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Elevation of Privilege | firestore.rules wishlists allow create | mitigate | Rule enforces `auth.uid == childUid && viewerUids == [] && parentUids == []` — forged docs rejected (`firestore.rules:40-43`) | closed |
| T-08-02 | Tampering | firestore.rules purchaseStatus allow write | mitigate | Write rule requires `purchasedBy == auth.uid || purchasedBy == null` — claim theft rejected (`firestore.rules:57-60`) | closed |
| T-08-03 | Spoofing | HTTP responses (X-Frame-Options) | mitigate | `X-Frame-Options: DENY` on `/:path*` blocks clickjacking (`next.config.ts:11`) | closed |
| T-08-04 | Tampering | HTTP responses (CSP) | mitigate | CSP header present; `unsafe-eval` dev-only via `isDev`; `unsafe-inline` retained for Next.js hydration (`next.config.ts:15-27`) | closed |
| T-08-05 | Tampering | HTTP responses (X-Content-Type-Options) | mitigate | `nosniff` prevents MIME-type confusion attacks (`next.config.ts:12`) | closed |
| T-08-06 | Tampering | add-item route productUrl/imageUrl | mitigate | `SAFE_URL_PREFIXES` scheme check returns 400 before any Firestore write (`route.ts:71-90`) | closed |
| T-08-07 | Tampering | addWishItem/updateWishItem client lib | mitigate | Scheme check throws before `addDoc`/`updateDoc` (`wishlist.ts:49-55, 70-75`) | closed |
| T-08-08 | Tampering | WishItemCard/ViewerWishItemCard anchor render | mitigate | `isSafeUrl()` render guard applied at render time — defence in depth for stored items | closed |
| T-08-09 | Information Disclosure | img src=imageUrl pixel tracking | accept | `<img>` cannot execute JS; `data:` URI blocked upstream by T-08-06/07; residual risk is IP disclosure to image host (standard browser behaviour) | closed |
| T-08-10 | Spoofing | ChildAccountForm silent token fail | mitigate | `getIdToken(true)` force-refreshes; catch shows error + blocks submit (`ChildAccountForm.tsx:44-49`) | closed |
| T-08-11 | Denial of Service | Dashboard unbounded onSnapshot listeners | mitigate | `statsUnsubsRef` Map cleanup closes all per-wishlist listeners on unmount (`dashboard/page.tsx:111-116`) | closed |
| T-08-12 | Tampering | add-item position string corruption | mitigate | `generateKeyBetween` from `fractional-indexing` produces well-formed keys | closed |
| T-08-13 | Denial of Service | activity page onSnapshot+unsub race | mitigate | `getDocs` one-shot read — no subscription, no race (`viewer.ts:116`) | closed |
| T-08-14 | Information Disclosure | src/app/test/page.tsx production route | mitigate | File deleted — route no longer exists | closed |
| T-08-15 | Tampering | test page Firestore seed button | mitigate | File deleted — write button removed from production | closed |
| T-08-16 | Tampering | _settingsFrozen internal SDK property | mitigate | Module-level `emulatorConnected` boolean replaces SDK internal dependency (`client.ts:24`) | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-09 | `<img src=imageUrl>` cannot execute JS. `data:` URI blocked server-side by T-08-06/07. Residual risk is IP disclosure to third-party image host — standard browser behaviour, not a product-level threat. | Claude (gsd-security-auditor) | 2026-04-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-22 | 16 | 16 | 0 | Claude (gsd-security-auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-22
