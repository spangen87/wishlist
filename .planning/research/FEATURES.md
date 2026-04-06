# Feature Research

**Domain:** Family wishlist / gift coordination app (children + relatives)
**Researched:** 2026-04-06
**Confidence:** MEDIUM (training knowledge through Aug 2025; WebSearch/WebFetch unavailable — competitor claims based on documented product knowledge, not live verification)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wish item with title + URL | Core primitive — every wishlist app has this | LOW | URL lets relatives buy the exact item |
| Item image | Visual scanning is how people browse lists | LOW | Can be auto-fetched from URL or manually set via URL input |
| Price / price range | Relatives need budget context; avoid duplicating effort | LOW | Approximate is fine; exact is not required |
| Item notes / description | Child wants to specify size, color, variant | LOW | Free-text; critical for avoiding wrong-item purchases |
| Mark item as purchased | Core purchase-coordination primitive | LOW | Must be hidden from the wisher (see privacy below) |
| Purchase hidden from wisher | Preserving surprise is the entire value proposition of gift coordination | MEDIUM | Requires two distinct read-paths for the same list |
| Shareable link to a list | How relatives get access without complex account setup | LOW | Link-based access is now the standard; email-invite is heavy for this use case |
| Multi-person viewing of same list | Gift coordination requires multiple relatives on the same list | LOW | Fundamental to coordination |
| Mobile-friendly UI | Most users browse and manage on phone, especially during shopping | MEDIUM | Responsive design minimum; PWA strongly preferred |
| Basic sorting / ordering | Users want to signal priority; relatives want to buy "the most wanted" item | LOW | Manual drag-and-drop ordering is the standard pattern |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Child-owned list (child logs in themselves) | Child's agency and engagement — they manage their own wishlist, not a proxy | MEDIUM | Most apps are adult-centric; child-as-first-class-user is uncommon |
| Parent-managed child account | Safety / compliance — parent creates account with their email | MEDIUM | Critical for COPPA/GDPR-K compliance; child uses username+password, parent email is the recovery/consent anchor |
| One relative manages multiple children | Grandparent UX — single view across several grandchildren | MEDIUM | Dashboard showing all watched lists at a glance |
| Activity log (who did what) | Transparency between relatives; prevents duplicate buying | MEDIUM | Especially valuable in large families where coordination happens across time zones |
| Viewer-visible notes on purchased items | Relatives can record "I'm buying X, anyone want to go halves?" coordination | LOW | Different from child's item notes — buyer notes are between relatives only |
| Drag-and-drop priority reordering | Child can express what they want most; clearer signal than a star rating | MEDIUM | Touch drag-and-drop on mobile is the tricky part (see pitfalls) |
| PWA / add to home screen | Relatives open before gift-buying trips; persistent icon = habitual use | LOW | Service worker + manifest; works in Next.js with next-pwa or similar |
| Pastel / child-friendly visual design | Emotional fit — the app looks like it belongs to a child | LOW | Competitors (Amazon, MyRegistry) are adult-focused, utilitarian |
| Real-time sync | Two relatives in same room can coordinate without stale data | MEDIUM | Firebase Firestore makes this relatively straightforward |
| No required account for viewers | Lower friction for less tech-savvy relatives (grandparents) | LOW | Join via link, optionally create account — anonymous viewing with identity on purchase |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Reserve" / "claim" item (soft hold) | Prevent two people buying same gift | Creates anxiety: relative sees item claimed, feels excluded; wisher may notice reservation count | Show "already purchased" only; use buyer notes for soft coordination |
| Email notifications / push alerts | "Tell me when someone adds something" | Requires email infrastructure or push permission; high friction; often becomes spam | Activity log that relatives check voluntarily; push notifications deferred to v2 |
| Multiple wishlists per child (by occasion) | "Separate birthday vs Christmas list" | Fragments the list; relatives need to know which list to look at; adds navigation complexity | Single always-on list with optional item tagging; occasion lists are v2 |
| "Buy now" / store integration | One-click purchase | Requires affiliate/commerce infra; affiliates change constantly; items move/disappear | URL field pointing to retailer; keep commerce out of the app |
| Price tracking / alerts | Notify when item price drops | Significant scraping/API complexity; goes stale fast | Price shown as static approximate field entered by child |
| Social features (likes, comments on items) | Makes it feel interactive | Children may feel surveilled; relatives may feel pressured; complicates privacy model | Activity log covers coordination; buyer notes cover communication |
| Image auto-fetch from URL (OG/meta scraping) | Easier than pasting an image URL | Requires server-side scraping, CORS issues, frequent breakage as sites change meta tags | Image URL field — user pastes direct image URL; simpler and more reliable |
| Group gifting / pooled purchases | Split cost of expensive item | Requires payment coordination, trust, and financial infrastructure | Buyer notes field: "I'm putting in 500 SEK, who wants to join?" — coordinate offline |

---

## Feature Dependencies

```
Child account (parent-created)
    └──requires──> Firebase Auth (email+password, child uses username wrapper)
                       └──enables──> Child login (username + PIN or password)

Share link (viewer access)
    └──requires──> Child account / list exists
    └──enables──> Viewer (relative) joining the list
                      └──enables──> Mark as purchased
                                        └──requires──> Purchased hidden from child view
                                        └──enables──> Activity log entry

Drag-and-drop ordering
    └──requires──> Item list exists
    └──enhances──> List priority signal for relatives

Activity log
    └──requires──> Viewer accounts (to attribute actions)
    └──requires──> Mark as purchased (to have events to log)

One viewer manages multiple children
    └──requires──> Viewer account (not anonymous)
    └──requires──> Multiple share links accepted / stored per account

Buyer notes on purchased items
    └──requires──> Mark as purchased
    └──conflicts──> Child can see notes (child must not see buyer notes)
```

### Dependency Notes

- **Mark as purchased requires purchased-hidden-from-child:** These are the same feature from two angles — you cannot implement one without the other. The data model must track purchase state separately from the child's read-path from day one.
- **Activity log requires viewer accounts:** Anonymous viewers cannot be attributed in the log. The app needs at minimum a display name collected at join-via-link time.
- **Image auto-fetch conflicts with simplicity:** Server-side OG scraping is a frequent source of fragility. The decision to use an image URL field instead of auto-fetch is validated by competitor pain points (broken images, CORS failures).
- **Drag-and-drop on mobile requires careful library choice:** Touch drag-and-drop in React is solved by @dnd-kit but has real edge cases on iOS Safari. Must be tested on real devices, not just emulator.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Parent creates child account (parent email, child username + password) — identity and safety anchor
- [x] Child logs in and adds wish items (title, URL, image URL, notes, approximate price) — core wisher flow
- [x] Drag-and-drop reordering of items — priority signaling
- [x] Share link generates for a child's list — relative onboarding without friction
- [x] Relative joins via link, sees list, marks items purchased, adds buyer notes — core coordination flow
- [x] Purchased items hidden from child's view — the core surprise-preservation guarantee
- [x] Activity log (who marked what, when) visible to relatives but not child — coordination transparency
- [x] One relative account can follow multiple children's lists — grandparent/parent UX
- [x] Real-time sync via Firebase — multi-device, no stale data
- [x] PWA manifest + service worker — installable on home screen

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Push notifications for activity — add when users request it; requires FCM setup
- [ ] Image preview from URL (thumbnail rendering) — add if image URL field feels too bare; keep server-side for OG fetch
- [ ] Item status beyond binary (e.g., "partially funded") — add if group gifting is requested
- [ ] List archive / seasonal organization — add if users request occasion-based separation

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multiple lists per child (birthday, Christmas, etc.) — deferred; adds navigation and link-sharing complexity
- [ ] Email-based invitations — deferred; share link covers v1
- [ ] Native app (iOS/Android via React Native/Expo) — deferred; PWA covers the need
- [ ] Store integrations / affiliate links — requires commerce infrastructure
- [ ] Price tracking / drop alerts — requires scraping infrastructure
- [ ] Group gifting / payment coordination — requires financial infrastructure

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Child adds wish item (title, URL, image, price, notes) | HIGH | LOW | P1 |
| Mark as purchased (hidden from child) | HIGH | MEDIUM | P1 |
| Share link for viewer access | HIGH | LOW | P1 |
| Drag-and-drop reordering | HIGH | MEDIUM | P1 |
| Activity log | MEDIUM | MEDIUM | P1 |
| Viewer manages multiple children | HIGH | LOW | P1 |
| Real-time sync | HIGH | LOW (Firebase handles it) | P1 |
| PWA installability | MEDIUM | LOW | P1 |
| Buyer notes on purchased items | MEDIUM | LOW | P1 |
| Pastel / child-friendly visual design | MEDIUM | LOW | P1 |
| Push notifications | LOW | HIGH | P3 |
| Image auto-fetch from URL | LOW | HIGH | P3 |
| Multiple lists per child | LOW | MEDIUM | P3 |
| Email invitations | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Giftster | Elfster | Amazon Wishlist | Our Approach |
|---------|----------|---------|-----------------|--------------|
| Child-as-primary-user | No (adult-centric) | No | No | Yes — child logs in, owns list |
| Parent-created child account | No | No | No (requires adult) | Yes — parent email, child username |
| Purchase hidden from wisher | Yes | Yes | Yes (partial) | Yes — hard requirement |
| Share via link | Yes | Yes (also groups) | Yes | Yes — link-only in v1 |
| Activity log | Partial (purchase history) | Partial | No | Yes — full who/what/when log |
| Drag-and-drop ordering | No (star priority) | No | No | Yes — explicit ordering |
| One user manages multiple wishlists | Yes | Yes (group-based) | Yes (family lists) | Yes — viewer follows multiple children |
| PWA / installable | No (mobile web only) | No | No | Yes |
| Item fields (title, URL, image, price, notes) | Yes | Yes | Yes | Yes |
| Group gifting | No | Yes (via groups) | No | No (deferred) |
| Email invitations | Yes | Yes | Yes | No (link-only v1) |
| Occasion-based lists | No | Yes (events) | Yes | No (always-on list v1) |
| Real-time sync | No (poll) | No (poll) | No | Yes (Firebase) |
| Child-friendly design | No | No | No | Yes |

**Note on Elfster:** Elfster is primarily a Secret Santa organizer with wishlists as a secondary feature. The group-gift-exchange model is different from the always-on family coordination model this app targets.

**Note on confidence:** Giftster and Elfster feature sets are based on documented product knowledge as of mid-2025. Specific UI details may have changed. MEDIUM confidence.

---

## Privacy Model Analysis

This is the central design challenge for gift coordination apps, and how it's solved determines the entire data architecture.

### The Two-Read-Path Problem

A single wishlist item has two distinct views:
- **Wisher view:** Title, image, URL, notes, price — no purchase state visible
- **Viewer/buyer view:** All of the above PLUS purchase state, buyer notes, activity log

The naive approach (single document with a `purchased: true` flag) can accidentally leak purchase state if client-side filtering is wrong or gets bypassed. The safe approach is architectural separation.

**Recommended pattern:** Store `wishItems` collection (child-readable) separately from `purchases` collection (viewer-only, Firestore security rules block child UID). Child never queries `purchases`. Even if the child inspects network traffic, they see no purchase data.

### Viewer Identity for Activity Log

Viewers who join via link need an identity to be named in the activity log. Two options:

1. **Anonymous with display name:** Viewer sets a name when joining ("Enter your name to join this list"). No Firebase account required. Display name stored in local session + Firestore viewer record.
2. **Require account:** Viewer must create a Firebase Auth account to join.

Option 1 has lower friction (important for grandparents). Option 2 is more reliable for multi-child management (viewer account can be linked to multiple lists persistently). PROJECT.md has decided: separate viewer accounts that can manage multiple children — so Option 2 is the right call, but the join flow should make account creation feel lightweight.

---

## Wishlist Item Fields — Comprehensive Mapping

Based on analysis of the competitive landscape, these are the fields that appear across wishlist apps:

| Field | Used By | Required? | Notes |
|-------|---------|-----------|-------|
| Title / name | All apps | Yes | Free text, 1-100 chars |
| URL / link | All apps | No | Where to buy; opens in new tab |
| Image URL | Most apps | No | Direct image URL or auto-fetched; PROJECT.md uses manual URL |
| Approximate price | All apps | No | Number or text ("around 500 kr"); helps relatives budget |
| Notes / description | All apps | No | Size, color, variant, specific wishes |
| Priority / order | Few apps (usually stars) | No | This app uses explicit drag-and-drop ordering |
| Category / tag | Some apps (Giftster) | No | Not in scope for v1 |
| Quantity wanted | Some apps | No | "I want 3 of these" — rarely used, deferred |
| Age range (gift guides) | Some apps | No | Not relevant here |
| Added date | Most apps (system) | Auto | Useful for activity log |

**Verdict for this app:** Title (required), URL (optional), image URL (optional), approximate price (optional), notes (optional). This matches the PROJECT.md spec exactly and is aligned with table stakes.

---

## Mobile UX Patterns for Key Interactions

### Drag-and-Drop on Mobile (Critical)

Touch drag-and-drop is harder than desktop drag-and-drop. Key patterns observed in production apps:

- **Long-press to activate drag handle** — prevents accidental drags while scrolling. Most common pattern on iOS/Android native apps.
- **Visible drag handle icon** — explicit affordance (three horizontal lines, "hamburger" handle). Less frustrating than invisible touch targets.
- **Haptic feedback on lift** — signals drag mode started. Web API: `navigator.vibrate()` — limited support but progressive enhancement.
- **Snap animation on drop** — smooth reorder animation prevents disorientation. @dnd-kit provides this.
- **Scroll while dragging** — if list exceeds viewport, dragged item must scroll the container. This is the most common failure mode in custom implementations.

### Share Link / Join Flow (Relatives)

The join flow is the first impression for most relatives (not the main app). Patterns:

- Landing page explains what the list is before prompting sign-up — "You've been invited to see Emma's wishlist"
- Display name collection before account creation — immediate gratification; account details secondary
- Show a preview of the list (blurred or partial) to motivate completing join — social proof
- Skip / minimal account creation for anonymous viewing — controversial; makes activity log attribution harder

### Onboarding (Child First Use)

Children in school age (6-14) need:
- Immediate "add a wish" CTA on first login — empty state is the main drop-off point
- Simple item form — not a modal sheet, just inline fields
- Visual feedback when item is added — animation, color, celebration
- No configuration / settings on first use — get to the list fast

---

## Sources

- Giftster product knowledge (training data, mid-2025) — MEDIUM confidence
- Elfster product knowledge (training data, mid-2025) — MEDIUM confidence
- Amazon Wishlist product knowledge (training data, mid-2025) — MEDIUM confidence
- MyRegistry product knowledge (training data, mid-2025) — MEDIUM confidence
- Santa's Bag app product knowledge (training data, mid-2025) — LOW confidence (less documented)
- @dnd-kit library documentation — HIGH confidence (well-documented, stable API)
- Firebase Firestore security rules patterns — HIGH confidence
- PWA/service worker patterns for Next.js — HIGH confidence
- WebSearch/WebFetch unavailable — no live competitor verification performed

---
*Feature research for: Family wishlist app (children + relatives, gift coordination)*
*Researched: 2026-04-06*
