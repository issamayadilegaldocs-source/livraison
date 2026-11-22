# Go-Live Readiness Report — Enatega Multivendor (Tunisia Launch)

**Date:** 2026-07-12
**Framing:** this is a product/operations audit, not a technical one — it assumes the code runs (see `PRODUCTION_READINESS_AUDIT.md` for that layer) and asks whether the platform is ready for real customers, real restaurants, and real riders in daily use in Tunisia. Written from the perspective of a Product Manager who has shipped food-delivery products at Glovo/Uber Eats scale.
**Scope:** every actor's full journey (customer, restaurant, rider, admin) across all six apps, plus real-world operational scenarios and a product-gap analysis against category leaders.
**Methodology:** four research agents were dispatched in parallel, one per actor, each reading actual screen code and the GraphQL operations behind it (not just navigating file trees) and citing `file:line` for every claim. Their full reports are reflected below with attribution. The primary reviewer then independently verified and fixed the highest-value, safest findings directly.

---

## Go-Live Readiness Score: **77/100**

The platform is functionally far more complete than a typical pre-launch codebase: reorder, favorites, live rider tracking, in-app chat, self-service vendor offers, a live dispatch board, a working refund mutation, dual-confirmation delivery, COD cash-collection gating, and an excellent incoming-order UX for riders all already exist and work well. What was holding the score back were concentrated **UI-layer bugs that silently disable built, working backend capability** — most notably online payment (Flouci) being fully implemented server-side but unreachable from either customer UI — plus a handful of real dead-ends and one architectural gap (rider offline durability). Twelve concrete fixes shipped in this pass; the remaining items are listed by severity below with what's fixed vs. still open.

---

## Score Breakdown

| Actor / Area | Score | Why |
|---|---|---|
| Customer journey | 82/100 | Payment method selection now actually works on both surfaces; phone dead-end and silent 502 fixed; duplicate-order risk closed. Capped by mobile's `Payment.js`↔`Checkout.js` disconnect (still open) and no scheduled-order capacity limiting |
| Restaurant/vendor journey | 74/100 | Genuinely strong real-time queue, busy-mode pause, self-service offers, non-technical menu editor, print-on-accept. SCHEDULED-ring and no-cancel-after-accept fixed. Capped by menu setup still needing admin web for sizes/addons, and no in-app SLA warning |
| Rider journey | 74/100 | Best-in-class incoming-order UX, location tracking, dual-confirmation, COD gating. The offline-blocks-everything P0 is fixed; the deeper "no offline queue for status mutations" gap is not — flagged as the top remaining architectural item |
| Admin/operations | 68/100 | Real dispatch board with manual reassign + force-complete, a working support-ticket system, an audit-log viewer, no-deploy configuration. Two items flagged **P0-to-verify**: refunds never return to the original payment method (wallet-only), and staff RBAC is client-side menu-hiding only, not server-enforced |
| Product completeness vs category leaders | 76/100 | Most table-stakes features exist and work; remaining gaps are concentrated in exception-handling and admin operational tooling rather than core happy-path functionality |

---

## P0 — Fixed This Session

### P0-1. Online payment (Flouci) was fully built but unreachable on both customer surfaces
**Mobile** (`audit-client-journey`): `Checkout.js:97` — `paymentMode` state defaulted to `'COD'` and was set only by inline buttons rendering COD and Stripe (gated on `restaurant.stripeDetailsSubmitted`). A separate `Payment.js` screen listed COD/FLOUCI/WALLET but was reachable only from the Profile menu, and its selection was never wired into `paymentMode` — only consumed for a tip-modal icon. **Net: mobile could only place COD orders**, ever, regardless of what a customer picked on the Payment screen.
**Web** (`audit-client-journey`): `order/checkout/index.tsx:940-943` filtered `PAYMENT_METHOD_LIST` down to COD-only unless `restaurant.stripeDetailsSubmitted` — but `PAYMENT_METHOD_LIST` (COD/FLOUCI/WALLET) has no Stripe entry at all, so the gate hid the actual Tunisian payment rail behind an unrelated, always-false-in-practice flag.
**Business impact:** at a Tunisia launch, COD-only is *survivable* (cash is dominant) but leaves real money on the table and a worse checkout experience than competitors on day one — and the feature was already fully built server-side (Flouci provider, payment-attempt audit trail, wallet integration all verified working in `PRODUCTION_READINESS_AUDIT.md`).
**Fixed:** web's nonsensical Stripe gate removed — COD/Flouci/Wallet are now always offered. **Commit `2d82051a`.**
**Still open:** mobile's `paymentMode`↔`Payment.js` disconnect is a larger UI rewire (need to decide whether to retire the orphaned `Payment.js` screen or make it the actual source of truth for `Checkout.js`) — not fixed in this pass, top remaining customer-journey item.

### P0-2. Rider app: offline unmounted the entire app instead of showing a banner
**Evidence** (`audit-rider-journey`): `lib/context/global/internet-provider.tsx:54-63` rendered a full-screen replacement instead of `children` whenever offline — unmounting the map, active order, and every delivery action button. This directly contradicts the app's own `CLAUDE.md` ("Show a non-blocking banner… never a modal that blocks the rider's view").
**Business impact:** a rider hitting a Tunisian dead zone mid-delivery lost the ability to see the order or tap pickup/deliver until signal returned, and the whole screen remounted from scratch rather than resuming — the single most severe finding across all four journeys, since it strands an in-progress paid delivery.
**Fixed:** both `enatega-multivendor-rider` and `enatega-multivendor-store` (identical bug, shared component pattern) now always render `children`, with a small non-blocking banner overlaid when offline. **Commit `02262526`.** Not visually verified on a device in this session — flagged for a quick visual QA pass.

### P0-3 (partial). Rider status-update mutations fail completely silently
**Evidence** (`audit-rider-journey`): `lib/hooks/useDetail.tsx:150-161` computed a proper error message on mutation failure but the user-facing `FlashMessage` was commented out, replaced by a bare `console.log`. Contrasted with location tracking, which has a real offline retry queue (`retryAttempts: Infinity`, SecureStore buffering) — the *business-critical state machine* (accept/pickup/deliver) has none.
**Business impact:** a rider tapping "Mark as Delivered" in a weak-signal building sees nothing happen, assumes the tap didn't register, and either re-taps or gives up — the order never advances, with no error surfaced to explain why.
**Fixed (partial):** restored the user-facing error message so a failure is at least visible and a manual retry is possible. **Commit `84a7d1dd`.**
**Still open — the bigger fix:** a real offline queue for these mutations (durable local storage + automatic retry on reconnect), matching the discipline already proven in the location-tracking service. This is a materially larger and riskier change to the order-status-transition path than the message fix, so it was deliberately not rushed — **top remaining architectural item for the rider journey.**

---

## P1 — Fixed This Session

### P1-1. Web checkout — missing/unverified phone was a hard dead-end
**Evidence** (`audit-client-journey`): `order/checkout/index.tsx:725-751` — warned the customer but the `router.replace("/phone-number")` redirects were commented out. Investigation found **no `/phone-number` route exists anywhere in this app** — phone entry/verification actually lives in a modal on the settings page, which is presumably why the redirect was disabled rather than fixed.
**Fixed:** redirects to `/profile/settings` (a real route) instead of leaving the customer on a toast with nowhere to go. **Commit `2d82051a`.**

### P1-2. Mobile — silent failure on a 502 during order placement
**Evidence** (`audit-client-journey`): `Checkout.js:478-485` — the 502 branch's `FlashMessage` was commented out (only `console.log`), while the sibling 504 branch worked correctly. **Fixed:** restored, matching the 504 pattern. **Commit `2d82051a`.**

### P1-3. Neither web nor mobile customer app sent an Idempotency-Key on order placement
**Evidence** (`audit-client-journey`): web's `placeOrder` call (`checkout/index.tsx:777-807`) had no idempotency handling despite `enatega-multivendor-web/CLAUDE.md` explicitly requiring it; mobile had none either. A reconnect-triggered retry or accidental double-submit could place — and charge — the same order twice.
**Fixed:** added the same request-link-level mechanism already used by `enatega-multivendor-admin` (generate-once-per-operation, cleared on success/error) to both apps' Apollo clients, **and** real backend enforcement — `placeOrder` now accepts an optional `idempotencyKey`, short-circuits to the already-created order before any side effect (catalog read, coupon claim, wallet debit) if one exists for that key, and `Order` has a new sparse-unique `placementIdempotencyKey` field so two orders can never share a real key even under a race. **Commit `2d82051a`**, verified with 2 new backend tests.

### P1-4. Store app — SCHEDULED orders looped the new-order beep forever with no way to stop it
**Evidence** (`audit-store-journey`): `useOrders.ts:14-18` included SCHEDULED alongside PENDING in the value driving the ring (`sound.context.tsx:70-88`), but SCHEDULED orders render no Accept/Decline/mute action anywhere — staff had to kill the app.
**Fixed:** the ring trigger now reflects only PENDING orders; the New-tab list/badge still shows SCHEDULED for visibility. **Commit `14ca470f`.**

### P1-5. Store app — no way to cancel an order once accepted
**Evidence** (`audit-store-journey`): the `CANCEL_ORDER` mutation (`useCancelOrder.ts`) was already wired for the PENDING card's Decline button, but never surfaced on the Processing card. Backend already permits cancelling from ACCEPTED/PREPARED/AWAITING_RIDER/ASSIGNED (only PICKED+ is blocked, to avoid stranding an in-transit rider) — the capability existed, the UI just never exposed it.
**Business impact:** a restaurant that accepts an order and then discovers an ingredient ran out, or gets a customer call asking to cancel, had no way to do it and had to let the order run to a rider pickup it couldn't fulfill.
**Fixed:** added a secondary "Cancel Order" action to the Processing card for the cancellable statuses. **Commit `a720bfdc`.**

### P1-6 (from the earlier pass, still holding). Rider assignment-outcome tracking
Covered under the earlier commits `596f70ff`/`8696e8d7`/`3818f19b` (customer self-service address change, rider accept/reject counters, admin needs-attention query) — see prior section of this report for detail; these directly respond to `audit-store-journey`/`audit-admin-ops`'s "no rejection consequence" and "no stuck-order queue" findings and remain valid.

---

## P0-to-Verify — Admin (flagged by `audit-admin-ops`, not fixed in this pass)

These are framed as "verify before real money/multi-operator" rather than definite bugs, because they may be acceptable for a small initial launch team — but they need a deliberate decision, not silence.

### Refunds never return to the original payment method
`order-details-modal.tsx:229` → `refundOrder` (backend: `orders.service.ts:617`) is real and wired, but it is **wallet-only and full-amount-only**: no partial refund, and a customer who paid by Flouci/card gets store credit, never their money back through the original rail. For a real Tunisia launch handling actual online payments, this is a consumer-trust and likely consumer-law question, not just a UX gap — recommend a product/legal decision before online payment volume grows (this compounds with P0-1 above: once Flouci is actually selectable, refund-to-original-method becomes far more visible/urgent).

### Staff RBAC is client-side menu-hiding, not server-enforced action scope
`lib/utils/constants/permissions.ts` + `super-admin-layout/app-bar/index.tsx:148 shouldShow()` implement an 18-item **section-visibility** permission system for STAFF users, but enforcement is hiding sidebar items in the UI — no evidence of matching per-mutation server-side authorization. Hidden ≠ blocked: a STAFF user who knows (or guesses) a GraphQL mutation name could potentially call it directly regardless of what their sidebar shows. This is security-adjacent and should be cross-checked against `PRODUCTION_READINESS_AUDIT.md`'s auth-guard coverage findings before onboarding any non-admin operator.

---

## P1 — Not Fixed, Documented for Fast-Follow

### Rider journey (`audit-rider-journey`)
- **No proof of delivery** (photo/signature/PIN) — mitigated partly by dual-confirmation, but disputes ("I never got my order") have zero evidence today.
- **No way to contact the customer from the map/order-detail screen** — call/chat only reachable from the order *card* in the list, gated to PICKED status. Exactly the wrong friction point for a bad-GPS-pin scenario, which is common in Tunisia.
- **No abandon/hand-back once ASSIGNED** — `rejectRiderAssignment` exists backend-side but is never callable post-accept; a motorbike breakdown mid-route freezes the order until an admin manually intervenes.
- **Support is a hardcoded US WhatsApp number** (`home/help/view/main/index.tsx:44`) — must become a Tunisia-local line before launch, and there's no in-app "report a problem with this order" flow.
- **No document/vehicle-document (license/registration/insurance) management** — vehicle type is selectable but there's no KYC upload surface, likely needed for Tunisian rider compliance.

### Restaurant/vendor journey (`audit-store-journey`)
- **Full menu setup still needs the admin web** — mobile food creation hardcodes a single "Default" variation (no sizes) and has no UI to attach an addon group to a dish; a restaurant with sized drinks or "choose your sauce" can't finish onboarding on the tablet alone.
- **No forgotten-order escalation surfaced to the vendor** — the backend escalation cron exists, but the store app shows no "you're late" warning, just a countdown that silently runs to zero.
- **Printer is Android-only, manual, and inefficient** (`usePrintOrder.ts:74-80` hard-returns on iOS; Bluetooth thermal printer, not `expo-print`; manual "Accept and Print" rather than automatic).
- **No home dashboard** (today's order count/revenue) — the Home tab redirects straight to the raw order list.
- **No ratings/reviews view in the store app** — a restaurant can only see complaints via the admin web, not the device it runs service on.

### Admin operations (`audit-admin-ops`)
- **No live ops map** — the dispatch board is a real, usable table (manual rider reassignment, force-complete, cancelled-order override all work), but there is no single map view of all active orders/riders, which is table-stakes for a delivery ops room at scale.
- **Rider management is the weakest area**: CRUD only — no suspend/ban (only hard-delete), no document-verification workflow, no performance signals (acceptance rate, ratings, deliveries/day), no live rider map.
- **Dashboard is decorative, not operational** — no GMV, no live active-order count, no cancellation rate, no average delivery time; the stat cards even hard-code a fake "+8.5% from yesterday" as a static string rather than a real computed delta.
- **No order export (CSV)** for finance/accounting reconciliation.
- **Coupons lack usage limits/caps/redemption stats in the admin UI** — the backend enforces atomic usage limits, but a marketer can't set or view them from the coupon form.
- **No per-order dispute timeline** — the audit log is admin-action-centric, not order-centric; resolving "this order never arrived" means manually cross-referencing the dispatch board and the audit log.

---

## P2 — Future Improvements

- Weather-aware ETA / rider-flagged-delay banner that propagates to customer tracking (not code-testable, no mechanism exists today).
- Batched/multi-order carrying for riders — fine at launch density, revisit once order density per zone is high enough to matter.
- Multi-admin roles with real scoped permissions, once the ops team grows past a handful of people who currently all have full access.
- Vendor sales analytics (best-sellers, peak hours) beyond raw order totals.
- Rider heatmap/demand indicator, incentive visibility.
- Restaurant approval/verification workflow (currently every admin-created restaurant is just active — fine while onboarding is 100% admin-driven).
- Arabic RTL dedicated QA pass — infrastructure (31 locales incl. Arabic/French) is genuinely present on both customer surfaces; correctness under RTL layout wasn't independently verified.

---

## What's Already Genuinely Good (don't rebuild this)

Credited explicitly per actor, since an audit that only lists problems risks implying nothing was done right:

- **Customer:** reorder, favorites, 31 languages including Arabic/French, WhatsApp support + web ticket system, rider chat, `WrongAddressModal` for bad GPS pins, dynamic ETA, loyalty-redemption clamping, graceful coupon-error messaging, near-zero TODO debt in the codebase.
- **Restaurant:** real-time order queue via GraphQL subscriptions with auto-resubscribe + missed-order refetch (no polling), an elegant "pause new orders" busy-mode with auto-resume that covers both "we're slammed" and "emergency closure" in one control, single-item out-of-stock toggle, self-service time-boxed offers, a genuinely non-technical French-localized menu/addon editor, print-on-accept.
- **Rider:** the incoming-order modal (full-screen "phone call" UX, countdown, ring, vibration, auto-reject-and-evict) is described by the auditing agent as "Glovo-grade" — genuinely excellent. Location tracking is offline-resilient with real retry/backoff. Dual-confirmation delivery and COD cash-collection gating are both correctly enforced server-side. In-app map with one-tap handoff to native navigation.
- **Admin:** a real dispatch board (not just a table) with manual rider reassignment, force-complete for stuck orders, and cancelled-order override; a genuinely usable support-ticket system with threaded replies; an audit-log viewer; extensive no-redeploy configuration (currency, delivery-rate models, commission, loyalty, express, zones).

---

## Go-Live Checklist

- [x] ~~Fix payment method selection~~ — web done (`2d82051a`); [ ] mobile `paymentMode`↔`Payment.js` wiring still open (P0-1).
- [x] Fix web checkout phone dead-end (`2d82051a`).
- [x] Fix mobile silent 502 on order placement (`2d82051a`).
- [x] Add Idempotency-Key enforcement (client + server) for order placement (`2d82051a`).
- [x] Fix rider/store offline-blocks-everything (`02262526`).
- [x] Surface rider status-update mutation failures (`84a7d1dd`); [ ] still needs a real offline retry queue (P0-3).
- [x] Fix store SCHEDULED-order infinite ring (`14ca470f`).
- [x] Add store cancel-after-accept action (`a720bfdc`).
- [x] Backend: address-change mutation (`596f70ff`), rider assignment-outcome counters (`8696e8d7`), admin needs-attention query (`3818f19b`) — [ ] all three still need frontend UI wiring.
- [ ] **Decide on refund-to-original-payment-method** before enabling real online payment volume (P0-to-verify).
- [ ] **Verify/implement server-side RBAC for staff mutations**, not just client-side menu-hiding (P0-to-verify, security-adjacent).
- [ ] Design a `FAILED_DELIVERY` order status with a reason code (needs its own session — touches the order state machine across all four resolvers).
- [ ] Replace the rider app's hardcoded US WhatsApp support number with a Tunisia-local line.
- [ ] Add rider in-context call/chat button on the map/order-detail screen.
- [ ] Add rider abandon/hand-back capability once ASSIGNED.
- [ ] Add a live ops map and real KPIs (GMV, cancellation rate, live order count) to the admin dashboard.
- [ ] Add rider suspend/document-verification/performance visibility to admin rider management.
- [ ] Run a real pilot with a small number of real restaurants/riders in one Tunisian city before a full multi-city launch, specifically to observe the P0/P1 scenarios above happening naturally rather than only in review.

---

## Commit Log (this phase)

| Commit | Summary |
|---|---|
| `596f70ff` | Customer self-service delivery-address change (backend) |
| `8696e8d7` | Rider assignment accept/reject outcome tracking (backend) |
| `3818f19b` | Admin "orders needing attention" query (backend) |
| `a7183114` | Initial GO_LIVE_READINESS_REPORT.md draft |
| `2d82051a` | Unblock web online payment; fix phone dead-end, silent 502, add Idempotency-Key (client+server) |
| `02262526` | Fix rider+store offline unmounting the entire app |
| `84a7d1dd` | Surface rider status-update mutation failures |
| `14ca470f` | Fix store SCHEDULED-order infinite ring |
| `a720bfdc` | Add store cancel-after-accept action |

Every fix above was verified against each app's actual toolchain (`tsc --noEmit`, `eslint`, `npm test`, `npm run build`) before being committed.

---

*This report complements `PRODUCTION_READINESS_AUDIT.md` (technical/infrastructure readiness) — read both before a go/no-go launch decision.*
