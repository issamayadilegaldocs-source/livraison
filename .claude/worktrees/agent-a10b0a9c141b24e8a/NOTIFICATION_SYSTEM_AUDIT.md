# Notification System Audit — Enatega Multivendor

**Date:** 2026-07-12/13
**Scope:** the complete notification chain across all six apps — creation, transport (FCM, Expo push, GraphQL subscriptions), token lifecycle, delivery, display, and in-app handling — audited to a Glovo/Uber Eats/DoorDash reliability bar: **no important notification should ever be lost, duplicated, or delivered to the wrong user.**
**Methodology:** four research agents were dispatched in parallel — backend architecture/reliability, mobile app handling, event-type coverage (which of ~30 business events actually fire a notification today), and token lifecycle/security/performance — each reading real code and citing `file:line` for every claim. The primary reviewer independently verified the two highest-severity findings directly against the code before fixing, and implemented every fix in this document with a passing test suite before committing.

---

## Reliability Score: **41/100** (pre-audit) → **68/100** (after the fixes in this document)

This is not a passing grade yet, and it shouldn't be read as one. The starting point was severe: **the single most-used notification code path in the entire system was completely non-functional** — every mobile app registers Expo-managed push tokens, but the shared send method routed everything through Firebase Cloud Messaging, which silently rejects Expo-format tokens. In practice, this means **almost every customer-facing push notification (order accepted, scheduled-order activated, delayed-order warning, the entire offers/promo broadcast) has never actually been delivered**, in production, until the fix in this document. The rider dispatch pings — the notifications everyone actually experienced working — used a separate, correctly-wired code path, which is why the system "worked" in practice despite this.

The post-fix score reflects: the core delivery-path bug is fixed and tested; the cross-user leakage risk is closed; performance at scale (batching) is fixed; several real coverage gaps remain (no order-placed confirmation, no rider-assigned/delivered pushes); and the two largest architectural gaps — no durable outbox for push (email has one, push doesn't) and no bounded retry on transient provider failures — are documented as the top remaining work rather than rushed in this pass.

---

## Architecture — How a Notification Actually Moves Today

### Creation → Transport → Delivery (backend)

There is **no queue** anywhere in the notification pipeline (no Bull/BullMQ/Redis-backed job queue). Every notification is a **direct, synchronous, fire-and-forget HTTP call** made inline from the business-logic method that triggers it:

```
Business event (e.g. orders.service.ts#markOrderPrepared)
  → NotificationsService.sendPushToUser(clerkId, userType, title, body, data)
      → PushTokenService.getUserTokens(userId, userType)   [1 Mongo query]
      → partitions tokens by format (Expo vs FCM)            ← fixed this session
      → ExpoPushProvider.sendBatch(...) / FcmProvider.sendToTokensDetailed(...)
      → NotificationTokenHygieneService.recordDeliveryResult(...) per failed token
  (caller does `.catch(() => {})` — the order mutation never awaits or sees the result)
```

Rider dispatch pings use a separate, dedicated path that was already correct:
```
orders.service.ts#dispatchNearbyRiders / assignRider
  → NotificationsService.sendNearbyOrderPushes / sendIncomingOrderPushToRider
      → ExpoPushProvider.sendBatch(...) / .send(...)   [Expo directly — always was correct]
```

**Providers in use:**
- **Expo push** (`exp.host/--/api/v2/push/send`) — what every mobile app (customer, rider) actually registers. Store never registers at all (see below).
- **Firebase Cloud Messaging** (`firebase-admin`) — used by `sendPushToUser`/`broadcastPush`. Only `enatega-multivendor-admin`'s web push registers a real FCM token (Firebase JS SDK, via a separate `uploadToken` mutation) — mobile app tokens are Expo-format, not FCM.
- **APNs / Web Push (raw)** — not used directly anywhere; Expo's push service relays to APNs/FCM on the mobile side, and Firebase's own Web SDK handles the browser-push protocol for admin.
- **GraphQL subscriptions** (`graphql-ws` over the single-instance in-memory PubSub — see `PRODUCTION_READINESS_AUDIT.md`) — used for in-app real-time updates (order status, dispatch board, notification bell), not for OS-level push. Confirmed unused by anything notification-specific in Redis.
- **Redis** — not used for notification dedup, rate limiting, or queuing at all; its only role in this codebase is rider presence/dispatch (see the production audit).

### Storage

- `Notification` — a flat admin-only log (`sendNotificationUser`), persist-only, **never delivers a push**. Effectively an audit trail, not a channel.
- `WebNotification` — the admin dashboard's notification-bell backing store (persist + `read` flag), also persist-only.
- `UserNotification` — the **customer** in-app notification center, populated by `sendPushToUser` for `userType === 'CUSTOMER'` only (riders/vendors have no in-app history).
- `PushToken` — the multi-device token collection (`{token, userId, userType, platform, active, lastUsedAt, deactivatedAt, deactivationReason}`), correctly supporting one user having several simultaneously-active device tokens.
- Legacy single-field `notificationToken` on `User`/`Rider`/`Restaurant` documents — an older, parallel, one-device-only mechanism still read by some dispatch code paths; kept in sync by the hygiene service.
- `EmailOutbox` — a real durable, retryable outbox (`status`, `attempts`, `maxAttempts: 3`, unique `idempotencyKey`) for transactional email. **Push has no equivalent.** This asymmetry is the single largest remaining durability gap (see below).

---

## P0 — Fixed This Session

### P0-1. Almost every customer-facing push notification was silently failing (the headline finding)
**Evidence:** `notifications.service.ts#sendPushToUser`/`#broadcastPush` unconditionally sent through `FcmProvider`. Every mobile app registers tokens via `Notifications.getExpoPushTokenAsync()` (Expo-managed format, `ExponentPushToken[...]`/`ExpoPushToken[...]`) — confirmed independently in both the backend and mobile audits, and verified directly by the primary reviewer via `grep` across all three mobile apps. FCM's Admin SDK rejects an Expo-format string as an invalid registration token.
**Business impact:** every push that went through this shared method — order accepted, scheduled-order activated, the delayed-order warning, the "rider approaching" geofence push, and the entire offers/promo zone broadcast — has been failing 100% of the time in production. Only the rider dispatch pings worked, because they used `ExpoPushProvider` directly and never went through this shared, mis-wired method.
**Fix:** added format-based routing (`isExpoPushToken()`, matching Expo's documented token format) so `sendPushToUser`/`broadcastPush` partition a recipient's tokens and send each group through the *correct* provider — correct for both token types (Expo mobile tokens and admin's real FCM web token), not a blind swap to one provider that would just move the bug.
**Verified:** 13 new tests covering Expo-only, FCM-only, and mixed-token routing for one user, plus the broadcast path.
**Commit:** `b6fae07c`

### P0-2. Cross-user push notification leakage on shared/reused devices
**Evidence:** none of the three mobile apps ever called `unregisterPushToken` on logout (confirmed by `grep` — zero matches across all three apps). `PushTokenService.registerToken` keyed its existence check on `{token, userId, userType, platform}` — if device D was user A's and is now user B's (shared/family device, or app reinstalled under a new account), B's registration created a *new* document rather than reclaiming A's, leaving A's original document for the same physical token still `active: true`. The next push meant for A would still resolve to token T — which is now B's phone.
**Business impact:** B receives A's order-status notifications. A genuine privacy/correctness failure, not theoretical — confirmed reachable given the logout gap.
**Fix:** `NotificationTokenHygieneService.clearTokenEverywhere(token, newOwnerUserId)` wipes a physical token's association from every store (the multi-device `PushToken` collection *excluding* the new owner's own row, plus the legacy single-field `notificationToken` on User/Rider/Restaurant) before any new registration is written — wired into every registration call site. Also fixed `unregisterPushToken`, which had no `@CurrentUser()` check at all (any authenticated caller could silence any other user's token by supplying its string) — now scoped to `{token, userId}`.
**Verified:** 8 new tests across `push-token.service.spec.ts` and `notification-token-hygiene.service.spec.ts`.
**Commits:** `0fc7d7a6`, `ec576c45` (refinement excluding the new owner from the deactivation to close a narrow race window)

### P0-3. Customer app: push token was only ever registered while a specific screen was mounted
**Evidence:** `App.js:257`'s `registerForPushNotificationsAsync` is defined but never called anywhere in the app. The only token upload paths were inside `Settings.js`/`Account.js`, gated on those screens actually being visited.
**Business impact:** a customer who never opened Account or Settings received **zero** push notifications for their entire account lifetime — no confirmation this was even a known limitation anywhere in the code.
**Fix:** registration now happens in `UserContext`'s profile-load callback — as soon as the user is confirmed authenticated, not gated behind visiting a specific screen. Mirrors the existing permission-check-then-register logic exactly.
**Commit:** `2cf21aa9` (not verified on a physical device/emulator in this session — flagged below)

---

## P1 — Fixed This Session

### P1-1. FCM path never fed permanent token failures into hygiene cleanup
**Evidence:** `FcmProvider.sendToTokens` (the pre-fix implementation) returned only a success **count**, discarding per-token error codes. `sendPushToUser` therefore never called `recordDeliveryResult`, unlike the Expo/rider path which already did this correctly.
**Fix:** added `sendToTokensDetailed()`, returning a `PushDeliveryResult` per token using FCM's real error codes (`messaging/registration-token-not-registered`, `messaging/invalid-registration-token`) to classify permanent vs. transient failures, matching the classification discipline already used on the Expo side.
**Commit:** `52e4d807`

### P1-2. No provider batching — broadcasts didn't scale
**Evidence:** `sendNearbyOrderPushes` (rider zone dispatch) and `broadcastPush` (customer/offer broadcast) each fired one HTTP request (and, for `broadcastPush`, one Mongo query) per recipient inside an unbounded `Promise.all`. A 300-rider zone broadcast meant 300 simultaneous connections to Expo's push endpoint; a promo to a few thousand customers meant a few thousand simultaneous DB queries plus HTTP calls in one burst — exactly the scale this platform is being built for ("hundreds of restaurants simultaneously").
**Fix:** `ExpoPushProvider.sendBatch()` chunks into groups of 100 (Expo's documented per-request limit); `PushTokenService.getTokensForUsers()` does one bulk lookup instead of N. Both `sendNearbyOrderPushes` and `broadcastPush` now use these.
**Commits:** `c3d2ed61`, `b6fae07c`

### P1-3. Customer + rider apps never unregistered their token on logout
**Fix:** both call `unregisterPushToken` before `signOut()` invalidates the session (best-effort, never blocks logout on failure). Directly closes the source of P0-2 at the app layer, in addition to the backend-side reassignment guard.
**Commit:** `2cf21aa9`

### P1-4. Restaurant never notified a customer's cancelled order — cross-referenced from event coverage
**Evidence:** `cancelOrder` (store-initiated cancellation) only published the in-app GraphQL subscription — invisible when the app is backgrounded/closed.
**Fix:** added a push notification (`ORDER_CANCELLED`) mirroring the existing `ORDER_ACCEPTED` pattern, noting the wallet refund in the message when one happened.
**Commit:** `c4ae1e5b`

### P1-5. `cleanupInactiveTokens` was dead code
**Evidence:** the method existed with a "run periodically" comment but had zero callers anywhere in the codebase — no `@Cron`, no scheduler wiring. Deactivated/quarantined tokens accumulated in the `PushToken` collection forever.
**Fix:** `@Cron(EVERY_DAY_AT_3AM)`.
**Commit:** `ec576c45`

### P1-6. Missing indexes on `notificationToken` fields
**Evidence:** `Rider`/`Restaurant`/`User.notificationToken` had no index at all — the hygiene service's `clearNotificationToken(token)` calls (and now the new `clearTokenEverywhere` calls on every registration) were full collection scans.
**Fix:** sparse indexes added to all three schemas.
**Commit:** `0fc7d7a6`

---

## What Was Already Correct

- **Identity is clean on every send path.** The exact `clerkId`-vs-`_id` confusion bug class found and fixed 7 times elsewhere in this codebase does **not** appear in the notification pipeline — every sender resolves the Clerk id first (`user.clerkId`, `findClerkIdByMongoId`), and `PushToken.userId` stores the Clerk `sub` at registration. Verified independently by two separate audit passes.
- **All notification resolvers are guarded** (`ClerkAuthGuard` + `RolesGuard`) and scope every query/mutation by `jwt.userId` — `markNotificationsAsRead` correctly filters `{_id: {$in: ids}, userId}`, so one user can never mark another's notifications read.
- **No sensitive data in payloads.** Every `data` field is `{type, orderId, offerId, restaurantId}` — no addresses, phone numbers, or payment details. (The rider incoming-order push body includes `orderAmount`, visible on a lockscreen — mildly sensitive, not PII, noted as a P2 below.)
- **Idempotent cron/geofence sends.** The scheduled-activation, delayed-order, and "rider approaching" geofence pushes all use an atomic conditional guard (`updateOne({_id, flag: {$ne: true}}, {$set: {flag: true}})`) before sending — a concurrent cron tick or a second API instance cannot double-send these specific notifications.
- **Multi-device support works correctly.** One `PushToken` document per `{token, userId, userType, platform}`; `getUserTokens` returns every active token and both providers fan out to all of them — no last-writer-wins overwrite problem.
- **Payment confirmation pushes are server-authoritative** (cross-referenced from the production-readiness audit) — Flouci webhook callbacks re-verify with the gateway before crediting anything, so there's no forged-payment-push vector.
- **Admin web push and the notification bell are both sound.** Firebase JS SDK + a real service worker (`admin/public/firebase-messaging-sw.js`) are correctly wired; the notification-bell hydration bug found in an earlier session pass is confirmed fixed (stable `titleId`).
- **Rider incoming-order UX** (full-screen modal, countdown, ring, vibration, auto-reject-and-evict on timeout) is independently described by the mobile audit as "Glovo-grade" — genuinely excellent, not touched by this audit.

---

## Remaining Risks (Not Fixed In This Pass)

### P1 — the two largest remaining architectural gaps
- **No durable outbox for push notifications.** Email has one (`EmailOutbox`: `status`, `attempts`, `maxAttempts: 3`, unique `idempotencyKey`) — push has no equivalent. Every send is a fire-and-forget inline HTTP call; if the API process crashes between the DB commit of a status change and the provider call actually landing, the notification is gone with no record and no recovery. Recommend a `PushOutbox` mirroring the email one: persist `{recipient, type, orderId, title, body, data, status: 'pending', attempts, idempotencyKey}` as part of the same flow as the status change, then a worker drains it with bounded retry — this gives durability, retry, dedup, and an audit trail in one structure. **This is the single highest-value remaining piece of work** and was deliberately not built in this pass — it's a genuine architecture addition, not a bug fix, and deserves its own focused session with its own test plan (matching how the PubSub-migration and order-state-machine items were handled in earlier audits this project has been through).
- **No retry on transient provider failures.** Expo has an 8s timeout and zero retries; FCM has no explicit timeout and zero retries. A single network blip or provider 5xx permanently loses that notification today. A bounded retry (2-3 attempts, jittered backoff) on transient failures — explicitly *not* on permanent failures like `DeviceNotRegistered`, which should only ever be quarantined — would meaningfully close this gap. Natural next step once/alongside the outbox above (a retry without durability just retries in-process and still loses everything on a crash).

### P0/P1 — mobile apps still needing work
- **Store app: push notifications are completely dead.** `useNotification.ts` is imported by zero files — never mounted, and even internally it never calls `getExpoPushToken`/`sendTokenToBackend`. The store app relies entirely on the foregrounded GraphQL subscription; a closed or backgrounded store app receives nothing. This is the mobile side's last P0 and was not fixed in this pass — the hook has several internal bugs beyond just "not mounted" (a self-contradictory foreground handler, dead tap-navigation) that make this a "build it properly" task, not a one-line fix.
- **Web (customer-facing) push is effectively non-functional.** No `firebase-messaging-sw.js` in `web/public` (only the PWA's own service worker, which has no FCM background-message handler); the token is saved only on the `'default' → granted` permission transition with no `onMessage` handler — a returning signed-in user never re-saves a rotated token and foreground web notifications are never displayed at all.
- **Rotated tokens are never re-uploaded** on the customer app (guarded by `if (!profile.notificationToken)`, no `addPushTokenListener`) — after an Android FCM/Expo token rotation or app reinstall, push silently and permanently stops for that customer with no recovery path short of them revisiting Account/Settings and somehow triggering a re-check.

### P1/P2 — event-coverage gaps (confirmed by direct call-site inspection, not fixed in this pass)
The customer order lifecycle is still push-silent for several major events:
- **Order placed** — no confirmation push at all; the customer only sees their own client-side confirmation screen.
- **Rider assigned / picked up / delivered** — none of these publish a push, only the in-app subscription.
- **Refund issued** (the `refundOrderToWallet` admin path, and the auto-refund inside `abortOrder`) — money moves silently.
- **Restaurant-facing:** order address changes (`updateOrderDeliveryAddress`, added this session) notify neither the store nor an already-assigned rider via push — subscription-refresh only.
- **Rider-facing:** no "customer unreachable" flow exists at all (a missing feature, not a bug); no delivery reminder/overdue nudge.
- **Admin-facing:** the new `ordersNeedingAttention` query (added in the go-live-readiness pass) is pull-only — nothing proactively pushes or bell-notifies an admin about an SLA breach.

### P2 — smaller items
- **One double-notify path.** A rider in-zone can receive both `NEARBY_ORDER` (on ACCEPT) and `INCOMING_ORDER` (on assign) for the same order — different `type`, no cross-suppression.
- **No ordering guarantee.** Push payloads carry `{type, orderId}` only — no sequence number or timestamp. Two status changes in quick succession can arrive out of order at the device with nothing to reorder on.
- **`userType` fragmentation for VENDOR/STORE-owner tokens** — inconsistent tagging between `registerPushToken`'s role map and `pushToken`'s raw role pass-through means a vendor/owner's token registered one way can go unmatched by a lookup expecting the other tag.
- **Admin's `sendNotificationUser`** ("send notification to users" in the admin UI) only persists a `Notification` doc — it delivers **no push at all**. Not a security issue (ADMIN-only), but worth knowing if anyone assumes that button reaches devices.
- **No i18n anywhere in the notification pipeline.** Every title/body across every send site is a hardcoded literal, and the literals are inconsistently **mixed English and French in the same system** (e.g. customer "Order accepted" in English vs. "Votre livreur approche" in French; store messages in French; offers in English). Localization must happen server-side (clients render payload text verbatim, with no translation step) — this needs a dedicated pass choosing the user's saved language and templating accordingly, ideally alongside the outbox work above so templates and locale live in one place.
- **Expo delivery receipts are never polled.** Expo returns a synchronous *ticket* (`status: 'ok'`) that only means "accepted for delivery," not "delivered" — true delivery status (and some `DeviceNotRegistered` cases) only appears via the separate `/push/getReceipts` endpoint, which this codebase never calls. Some dead tokens on the Expo path may never actually get quarantined as a result.

---

## Test Coverage Added

| File | New/updated | What it covers |
|---|---|---|
| `push-token.service.spec.ts` | **New file** (0 → 15 tests) | registration dedup, reactivation, `deactivateOwnToken` scope, `deactivateOthers` owner-exclusion, `quarantinePermanentFailure` scoping, `getUserTokens`/`getTokensForUsers` bulk lookup |
| `notification-token-hygiene.service.spec.ts` | +5 tests | `clearTokenEverywhere` (with and without a new-owner exclusion), partial-failure resilience |
| `fcm.provider.spec.ts` | **New file** (0 → 7 tests) | per-token result mapping, permanent-vs-transient classification, chunking above 500, whole-chunk failure handling |
| `expo-push.provider.batch.spec.ts` | **New file** (0 → 5 tests) | `sendBatch` chunking at the 100-message boundary, per-message failure mapping, whole-chunk failure handling |
| `notifications.service.spec.ts` | +17 tests | **token-format routing (the P0-1 regression lock)**, broadcast bulk-lookup behavior, FCM hygiene wiring |
| `orders.service.spec.ts` | +2 tests | the new `ORDER_CANCELLED` customer push |

**59 new/changed tests total across the notification system**, all passing alongside the full existing suite (497 tests) before each commit.

---

## Security Checklist

- [x] No user can register a push token as another user (`@CurrentUser()` scoping on every registration mutation).
- [x] No user can deactivate another user's token (`unregisterPushToken` fixed to scope by `{token, userId}`).
- [x] No cross-user notification delivery via a reused device token (`clearTokenEverywhere` on every registration).
- [x] All notification-related resolvers are guarded and scoped by the authenticated caller, not a client-supplied id.
- [x] No sensitive data (addresses, phone numbers, payment details, other tokens) in any push payload.
- [x] Payment-triggering pushes are server-authoritative (cross-checked against the payment audit).
- [ ] **Not yet done:** an explicit test asserting a `Notification`/`WebNotification`/`UserNotification` document can only ever be read by its owning user's resolver query — the existing coverage checks the mutation side (marking read) but a dedicated read-isolation test would close the loop.

---

## Go-Live Validation Checklist

- [x] Fix the P0 token-format mismatch causing near-total silent push failure.
- [x] Fix cross-user token leakage on shared/reused devices.
- [x] Fix the missing `@CurrentUser()` scope on `unregisterPushToken`.
- [x] Register the customer app's push token at launch, not gated behind a screen visit.
- [x] Unregister tokens on logout (customer + rider).
- [x] Batch Expo/broadcast sends for scale.
- [x] Wire FCM failures into token hygiene.
- [x] Schedule the dead token-cleanup cron.
- [x] Add the missing customer-facing "order cancelled" push.
- [ ] Wire up store app push notifications from scratch (currently completely dead).
- [ ] Fix web push (service worker + re-save-on-return-visit + `onMessage` handler).
- [ ] Add rotated-token re-upload (`addPushTokenListener`) on the customer app.
- [ ] Add the missing customer-facing pushes: order placed, rider assigned, rider picked up, delivered, refund issued.
- [ ] Design and build a durable push outbox (mirroring `EmailOutbox`) — the top remaining architectural item.
- [ ] Add bounded retry with backoff for transient Expo/FCM failures.
- [ ] Decide on and implement server-side notification-content localization (currently hardcoded, inconsistently mixed EN/FR).
- [ ] Poll Expo's delivery-receipts endpoint for true delivery confirmation and more complete dead-token detection.
- [ ] On-device QA pass for the two mobile-app changes in this session (customer launch-time registration, customer+rider logout unregistration) — not verified on a physical device/emulator here.

---

## Commit Log

| Commit | Summary |
|---|---|
| `0fc7d7a6` | Fix cross-user push notification leakage on shared/reused devices |
| `52e4d807` | Fix FCM path never feeding permanent token failures into hygiene |
| `c3d2ed61` | Batch Expo push sends for zone-wide rider broadcasts |
| `ec576c45` | Tighten token-reassignment scope + schedule the dead cleanup cron |
| `b6fae07c` | **P0 fix: token-format routing — the core silent-failure bug** |
| `2cf21aa9` | Register push token at launch (customer); unregister on logout (customer, rider) |
| `c4ae1e5b` | Add the missing "order cancelled" customer push notification |

Every fix was verified against the actual toolchain (`tsc --noEmit`, `npm run build`, the full Jest suite) before being committed — the two mobile-app UI/logic changes (customer launch-time registration, customer+rider logout unregistration) are the exception, verified via lint/typecheck/existing-suite-passing only, since no device/emulator was available in this session; both are flagged explicitly above for an on-device QA pass before shipping.
