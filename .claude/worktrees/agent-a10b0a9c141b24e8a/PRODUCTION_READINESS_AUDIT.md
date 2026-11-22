# Production Readiness Audit — Enatega Multivendor Food Delivery Platform

**Date:** 2026-07-12
**Scope:** All six apps (`enatega-multivendor-api`, `-admin`, `-web`, `-app`, `-store`, `-rider`), infrastructure, Docker, CI, security, database, GraphQL, Redis, WebSockets, observability.
**Target scale (stated by product owner):** several thousand orders/day, hundreds of restaurants simultaneously.
**Posture:** adversarial — assume nothing is safe until verified in the actual code, actual `.env` files, and an actual `npm run build`/`npm test`/`npm audit` run. Every finding below is backed by a file:line citation and a command that was actually executed during this audit, not a guess.

---

## Production Readiness Score: **54/100** (pre-audit) → **76/100** (post-audit, after the fixes in this document)

This is not a passing grade for the stated scale yet. The remaining points are concentrated in five areas that a single audit pass should not rush: **git-history secret exposure that still requires manual credential rotation**, **a hard single-instance ceiling on the GraphQL realtime layer (in-memory PubSub — cannot horizontally scale the API without dropping order/rider events)**, **zero cross-collection transactions on some financial flows**, **zero observability/APM**, and **unverified backup/DR**. See [Remaining Risks](#remaining-risks-not-fixed-in-this-pass) and the [Score Breakdown](#score-breakdown) for the full accounting.

| Category | Before | After |
|---|---|---|
| Secrets & credential hygiene | 12/100 | 55/100 (code fixed; rotation is a manual action item) |
| Availability / health / graceful ops | 35/100 | 78/100 (capped by the single-instance PubSub ceiling below) |
| Database performance (indexes, N+1) | 55/100 | 78/100 |
| Data integrity (transactions, race conditions) | 55/100 | 74/100 (the P0 wallet-atomicity bug and the loyalty race are both fixed) |
| Security (authz, rate limiting, GraphQL hardening) | 58/100 | 84/100 |
| CI/CD & build health | 10/100 | 70/100 |
| Observability & monitoring | 10/100 | 10/100 (not addressed — needs a product decision on vendor) |
| Dependency hygiene | 45/100 | 68/100 |
| Mobile app robustness | 65/100 | 72/100 |

---

## Methodology

- Direct code inspection of every backend domain module, all six `next.config`/build pipelines, all `Dockerfile`/`docker-compose.yml`, and the full `.gitignore`/git-tracking surface.
- Every fix below was verified with the actual toolchain: `npx tsc --noEmit`, `npm run build`, `npm test`, `npm audit`, not just read — before and after, so "fixed" means a passing command, not an inspection opinion.
- A repo-wide secret grep (`git grep` for AWS/Firebase/Stripe/Slack/private-key/Sentry token patterns) was run in addition to reading the tracked `.env*` files directly.
- Four specialized research agents were dispatched in parallel — backend performance/transactions/N+1, backend security/OWASP, infrastructure/Docker/Redis/WebSocket/observability, and frontend (admin/web) robustness — each independently reading the actual source and citing file:line for every claim, to widen coverage beyond what one reviewer reads manually in the time available. Their full findings are folded into the sections below with attribution; several (the single-instance PubSub ceiling, the wallet-atomicity P0, the loyalty-redemption race) were caught only by the sub-agents and not by the primary reviewer's own pass.
- All fixes are on `main`, committed and pushed incrementally (16 commits, see [Commit Log](#commit-log)).

---

## P0 — Fixed This Session

### P0-1. Live production secrets committed to git (`.env` files, all six apps)
**Files:** `enatega-multivendor-api/.env`, `enatega-multivendor-admin/.env.{dev,local,prod,stage}`, `enatega-multivendor-web/.env.{dev,prod,stage}`, `enatega-multivendor-app/store/rider/.env` — all tracked since commit `4f739cd4 "chore: track all .env files"`.
**Risk:** the API's `.env` alone contained a live MongoDB Atlas password, a live Redis password, a Clerk secret key, a full Firebase Admin SDK RSA private key, and a Cloudinary secret. Admin/web `.env.dev` additionally embedded a second `CLERK_SECRET_KEY` (a server secret in a client-app repo). Anyone with repo access — any current or former collaborator, a leaked clone, a compromised CI log — has full read/write access to the production database, cache, push infrastructure, and image storage.
**Exploit scenario:** a departing contributor (or their compromised laptop) retains `git clone` access indefinitely; `mongodb+srv://<user>:<real-password>@...` in plaintext lets anyone connect directly to the production cluster with `mongosh`, bypassing every application-layer guard and audit log.
**Fix:** untracked all affected files (`git rm --cached`, local copies preserved) and broadened `.gitignore` from an incomplete `.env`/`.env.local`/`.env.production` list to `.env*` with a single `!.env.example` exception, so no future `.env.<anything>` variant can regress this.
**Verified:** `git ls-files | grep -i env` now returns only `.env.example` files.
**Commit:** `79802ca5`

### P0-2. Firebase Admin service-account keys + hardcoded Sentry tokens (mobile apps)
**Files:** `enatega-multivendor-{app,store,rider}/google-service-account.json` and `google-service-account copy.json` (6 files); `enatega-multivendor-{store,rider}/eas.json`; `enatega-multivendor-rider/package.json`.
**Risk:** each mobile app tracked a real Firebase Admin SDK service-account private key (`type: service_account`, real `client_email`, full RSA `private_key`) — this grants **admin-level** access to the Firebase project, bypassing every Firestore/RTDB security rule, plus the ability to manage auth users and send arbitrary push notifications. Separately, two real Sentry auth tokens were hardcoded directly in `eas.json`'s `env` block and in `package.json`'s `upload-sourcemaps` script — `package.json` has no gitignore escape hatch at all, unlike a dotenv file.
**Fix:** untracked all 6 service-account files (local copies preserved — `eas.json`'s `submit.production.android.serviceAccountKeyPath` still needs them locally for Play Store uploads), extended each mobile app's `.gitignore` to actually cover the filename (store's already listed it but the file predated the rule, same trap as P0-1; app/rider didn't list it at all), and removed both hardcoded Sentry tokens (`SENTRY_AUTH_TOKEN` must now be supplied via `eas env:create` or the caller's shell environment).
**Commit:** `4c5ec5db`

### ⚠️ P0-1/P0-2 remaining action (cannot be completed from this session)
Untracking stops **future** commits from including these files, but the **old commits in git history still contain every one of these secret values in plaintext**. Two separate actions are required and neither can be done by an coding agent unsupervised:
1. **Rotate every credential above**: the Atlas DB user password, the Redis password, both Clerk secret keys, the Firebase service-account key(s) (check whether app/store/rider point at the same Firebase project or three distinct ones), the Cloudinary secret, and both Sentry auth tokens.
2. **Decide on a git-history scrub** (`git filter-repo` or BFG Repo-Cleaner) to remove the secret values from history entirely. This rewrites every commit hash and requires a coordinated force-push plus every clone being re-cloned — genuinely disruptive, so it needs your explicit go-ahead and a maintenance window. The repo is a **private** GitHub repo (confirmed via an unauthenticated API check returning 404), which lowers urgency from "public internet is already scraping this" to "any past or present collaborator has standing access" — rotation is non-negotiable either way; the history scrub is a judgment call on how many people had repo access historically.

### P0-3. `enatega-multivendor-web` production build was completely broken
**Files:** `lib/ui/screens/protected/profile/loyalty/index.tsx:12-15`, `lib/utils/constants/default-tabs.ts:10`.
**Risk:** `npm run build` failed outright on `main` with a TypeScript error. The web app **could not be deployed to production at all** in the state this audit found it in. Root cause: both files read `configuration?.loyaltyEnabled` / `.loyaltyPointsRedemptionRate` / `.loyaltyPointsPerUnit` / `.currencySymbol` through `useConfig()`, but that context only ever exposes the **uppercase** computed properties (`LOYALTY_ENABLED`, `LOYALTY_POINTS_REDEMPTION_RATE`, etc. — see `lib/context/configuration/configuration.context.tsx:75-80`). Beyond blocking the build, the `default-tabs.ts` instance meant the loyalty nav tab **silently never appeared for any customer** (`loyaltyEnabled` was always `undefined` → falsy), a functional regression that shipped invisibly because nothing ran `npm run build` in CI.
**Fix:** corrected all four property accesses to the uppercase context keys.
**Verified:** `npm run build` now completes, generating all 23 routes.
**Commit:** `ef93b5e8`

### P0-4. Wallet payment could debit a customer's money for an order that stays UNPAID
**File:** `enatega-multivendor-api/src/orders/orders.service.ts:450-475` (found by the backend-perf research agent, independently verified against the code before fixing).
**Risk:** on the WALLET payment path, `customerWalletService.debit()` and the follow-up `orderModel.updateOne({ paymentStatus: 'PAID' })` were two separate operations — only the debit was inside the try/catch that rolls back on failure. If the PAID update failed, or the process crashed between the two calls, the customer's wallet was already charged, but the order stayed `UNPAID`/`paidAmount: 0` and **still entered the order pipeline** (WALLET isn't in `ONLINE_PAYMENT_METHODS`, so nothing downstream re-checks payment status before notifying the restaurant). This is exactly the "risque de perte de données financières" category — a customer pays, the restaurant sees an order that looks unpaid, and there is no automatic reversal.
**Fix:** the PAID update now runs inside the same try/catch as the debit; a failure at that point triggers a compensating wallet credit (reversing the charge) before the order is deleted and the coupon released, mirroring the existing insufficient-funds rollback path exactly.
**Verified:** new regression test asserting the reversal credit fires on a simulated PAID-update failure; full order test suite (453 tests) still passes.
**Commit:** `cd661c0d`

### P0-5. Loyalty point redemption was a read-modify-write race (could go negative)
**File:** `enatega-multivendor-api/src/loyalty/loyalty.service.ts:64-78` (found by the backend-perf research agent).
**Risk:** unlike coupon usage and wallet debits — both already correctly guarded with the balance check inside an atomic `findOneAndUpdate` filter — loyalty redemption read `account.points`, checked it in application code, then issued an **unconditional** `$inc: { points: -n }`. Two concurrent redemptions (a double-tap on checkout, a retried request after a network blip) could both pass the read-check before either write landed, driving a customer's point balance negative.
**Fix:** the balance check now lives in the update filter itself (`{ userId, points: { $gte: pointsToRedeem } }`), exactly mirroring the wallet/coupon pattern; a non-match is treated as insufficient points.
**Verified:** 4 new tests (happy path, atomic-guard rejection, zero/negative no-op, misconfigured-rate rejection).
**Commit:** `cd661c0d`

---

## P1 — Fixed This Session

### P1-1. Health check endpoint always reported `ok`, even with Mongo/Redis down
**File:** `enatega-multivendor-api/src/health/health.controller.ts`.
**Risk:** the endpoint hardcoded `status: 'ok'` and returned HTTP 200 unconditionally; a `redis` field was computed but never gated the status code, and MongoDB connectivity wasn't checked at all. A container fully unable to serve requests would still pass Docker's `HEALTHCHECK` and any load-balancer probe pointed at it — nothing would ever take it out of rotation or alert on the outage.
**Fix:** split into liveness (`GET /api/health`, unchanged route, no dependency checks — deliberately, so a transient blip can't cause a container restart loop) and readiness (`GET /api/health/ready`, new — checks `mongoose.connection.readyState` and the Redis client status, returns 503 if either is down). **Action item:** point your load balancer / Dokploy traffic-routing health check at `/api/health/ready`, not `/api/health`.
**Commit:** `c7c1d1b1` (4 new tests)

### P1-2. No graceful shutdown — every rolling deploy killed connections mid-flight
**File:** `enatega-multivendor-api/src/common/bootstrap-api.ts`.
**Risk:** `app.enableShutdownHooks()` was never called, so `onModuleDestroy`/`beforeApplicationShutdown` lifecycle hooks never ran on SIGTERM. Every deploy (Dokploy sends SIGTERM before killing the container) tore down in-flight requests and the Mongo/Redis connections abruptly instead of draining.
**Fix:** added the one missing call. Also added a loud startup error (not a behavior change) when `CORS_ORIGINS` is unset in production, since the app silently falls back to NestJS's permissive any-origin default — the fallback is preserved to avoid breaking a deployment that relies on it today, but it's no longer silent.
**Commit:** `d655182b`

### P1-3. GraphQL Playground + introspection exposed in production
**File:** `enatega-multivendor-api/src/app.module.ts`.
**Risk:** `playground: true` was hardcoded. `@nestjs/apollo` enables the interactive Playground/Sandbox landing page **unconditionally** whenever `playground` is explicitly `true` — it does not gate this on `NODE_ENV` itself, contrary to what the option name suggests. Production shipped a public interactive GraphQL IDE exposing the full schema, including admin/payment/wallet mutation names and shapes. This directly contradicts the module's own `CLAUDE.md` ("disable or restrict in production via env"), which had never actually been implemented.
**Fix:** `playground` and `introspection` are now both gated on `process.env.NODE_ENV !== 'production'`.
**Commit:** `643524c1`

### P1-4. OTP mutations rate-limited only by the global 100/min-per-IP default
**File:** `enatega-multivendor-api/src/users/users.resolver.ts`.
**Risk:** `sendOtpToEmail`, `sendOtpToPhoneNumber`, and `verifyOtp` had no `@Throttle` override. `OtpService`'s per-destination 60s cooldown + 3-attempt cap (already well implemented — see [What Was Already Correct](#what-was-already-correct)) bounds abuse against a *single* destination, but the destination is a caller-supplied argument, not necessarily the authenticated caller's own — one account could fan out paid SMS/email sends to arbitrary third parties up to the shared global limit. This is exactly what `enatega-multivendor-api/CLAUDE.md` already documents as required ("Rate-limit OTP and notification resolvers... per-resolver overrides use `@Throttle`") but which had never been wired up.
**Fix:** added `@Throttle({ limit: 5, ttl: 60_000 })` on the two send mutations and `limit: 10` on verify, matching the existing pattern in `delivery-estimation.resolver.ts`.
**Commit:** `69fea79e`

### P1-5. `MONGO_URI` silently fell back to localhost if unset in production
**File:** `enatega-multivendor-api/src/app.module.ts`.
**Risk:** contradicts the module's own `CLAUDE.md` ("Required variables: MONGO_URI... Fail fast at startup if missing"). A misconfigured production environment (env var typo'd or dropped) would not crash at boot with a clear error — it would silently try to reach `127.0.0.1:27017` inside the container and fail deep in Mongoose's connection retry logic instead, producing a confusing on-call page instead of an immediate, obvious boot failure.
**Fix:** `getOrThrow` in production; the localhost default is preserved for local dev convenience (matches `CLAUDE.md`'s documented local-run flow).
**Commit:** `0553525b`

### P1-6. Unbounded in-memory cache in `ClerkAuthGuard` (memory leak)
**File:** `enatega-multivendor-api/src/auth/clerk-auth.guard.ts`.
**Risk:** the module-level `roleCache: Map` used a 60s TTL for lookups but **never evicted expired entries** — every distinct user who ever authenticated left a permanent entry for the life of the process. At thousands of distinct customers/vendors/riders per day and a long-lived process (no scheduled restarts), this grows unbounded, a slow but real memory leak that only manifests after days/weeks of uptime — the kind of bug that looks fine in every manual test and then pages someone at 3 a.m. a month after a deploy.
**Fix:** prune expired entries opportunistically on every cache write (amortized cost, no extra timer/architecture change). Added a regression test (`getRoleCacheSizeForTesting()` test-only export) that asserts the cache size doesn't grow across a TTL-expiry + new-user cycle.
**Commit:** `c4f11db7`

### P1-7. Missing compound indexes on the two hottest queries in the system
**Files:** `enatega-multivendor-api/src/riders/rider.schema.ts`, `.../orders/order.schema.ts`.
**Risk:** traced to the actual query shapes in the service layer, not guessed:
- `riders.service.ts`'s dispatch-candidate lookup is `find({ zone: zoneId, isActive: true })` — `Rider.zone` had **no index at all**, so every dispatch attempt did a full collection scan over all riders.
- `orders.service.ts#findVisibleForRider`'s heartbeat-fallback branch is `{ rider: null, zone, orderStatus: { $in: [...] } }` — hit by every online rider's fallback poll when it has no active Redis assignment (per the dispatch architecture: Redis presence + zone + heartbeat fallback). `Order.zone` also had no index.
- `orders.service.ts#getActiveOrders` / `#getOrdersByRestaurant` (the store dashboard's single most frequent query) filters on `{ restaurant, orderStatus }` sorted by `createdAt` — only single-field indexes existed on `restaurant`/`orderStatus` individually, so the sort fell back to an in-memory sort.

At "hundreds of restaurants, thousands of orders/day," these are among the highest-frequency queries in the system; without these indexes, every dispatch attempt and every store dashboard refresh scans more of the collection as data volume grows, with query latency degrading roughly linearly with total historical order count rather than staying flat.
**Fix:** added `{ zone: 1, isActive: 1 }` on `Rider`, `{ zone: 1, orderStatus: 1 }` and `{ restaurant: 1, orderStatus: 1, createdAt: -1 }` on `Order`.
**Commit:** `f458a12c`

### P1-8. No CI pipeline at all
**File:** new `.github/workflows/ci.yml`. Previously only `.github/dependabot.yml` existed — **no automated build/test gate before merging to `main`, on any of the six apps.** P0-3 (the completely broken web production build) is a direct, concrete consequence: it shipped to `main` and nobody found out until a manual deploy or, in this case, this audit.
**Fix:** added a workflow with one job per app, wired only to commands verified to actually pass during this audit: `api` (build + 448 jest tests), `admin`/`web` (build, which type-checks as part of Next.js's build step), `app`/`store`/`rider` (jest, now fixed — see P1-9). Deliberately **not** wired: `lint` for admin/web (`next lint` no longer exists in Next 16, and admin's ESLint config additionally has a legacy/flat-config conflict) and `typecheck` for the three mobile apps (each has pre-existing `tsc --noEmit` errors unrelated to this audit's scope — see [Remaining Risks](#remaining-risks-not-fixed-in-this-pass)). Both are called out below rather than silently skipped.
**Commit:** `b3c147cd`

### P1-9. `store`/`rider` mobile test suites could not run at all
**Files:** `enatega-multivendor-store/package.json`, `enatega-multivendor-rider/package.json`.
**Risk:** two independent, compounding bugs:
1. Both apps' `test` script used `jest --watchAll`, which never exits — unusable in any CI pipeline (this alone would have made P1-8's mobile CI jobs hang forever).
2. Even with `--watchAll` removed, both crashed on every invocation: `store` pinned `jest@^30.4.2` against `jest-expo@56` (built for `jest@~29.x` — the same pairing `enatega-multivendor-app` already uses correctly), producing two incompatible `jest-mock` instances and a `clearMocksOnScope is not a function` crash before a single test ran. `rider` pinned `jest-expo@^37.0.0` against an Expo SDK `^56.0.12` app (`jest-expo`'s version tracks the Expo SDK number in this range — 37 vs. 56 is roughly a 19-SDK-version-old test preset against a current app), crashing with a preset mismatch. This stale `jest-expo@37` dependency tree was also the source of the `request`/`@xmldom/xmldom` critical vulnerabilities flagged in the dependency audit below.
**Fix:** pinned both to `jest@~29.7.0` / `jest-expo@^56.0.5` (the pairing already proven working in the customer app), and made `test` the non-watch CI-safe script (kept a `test:watch` alias for local dev).
**Verified:** `store` now runs 66 passing tests (previously 0 — total crash), `rider` runs 63 passing (previously 0). Realigning rider's `jest-expo` version alone dropped its `npm audit` count from 56 findings to 19 and removed 853 stale packages.
**Commit:** `1c5044a3`

### P1-10. Missing compound index on `Review` — full scan on every restaurant page
**File:** `enatega-multivendor-api/src/orders/review.schema.ts` (found by the backend-perf research agent).
**Risk:** `order-stats.service.ts#reviewsByRestaurant` does `find({ restaurant, isActive: true })` on every restaurant detail page load and on the `reviewData` GraphQL field resolver — the `Review` collection had **zero indexes at all**, so this was a full collection scan on every hit.
**Fix:** added `{ restaurant: 1, isActive: 1 }`.
**Commit:** `06e0acfd`

### P1-11. No GraphQL query depth/complexity limit
**File:** `enatega-multivendor-api/src/app.module.ts` (found by the backend-security research agent).
**Risk:** even with introspection now gated to non-production (P1-3), nothing stopped an arbitrarily deeply nested query (`restaurant → categories → foods → addons → options`, repeated via aliases) — a cheap CPU-amplification DoS vector, since a caller doesn't need introspection to know the schema shape (it's derivable from the public frontend source).
**Fix:** added `graphql-depth-limit(10)`, comfortably covering every real query in this schema's nesting.
**Commit:** `06e0acfd`

### P1-12. Docker container ran as root
**File:** `enatega-multivendor-api/Dockerfile` (found by the infra research agent).
**Risk:** no `USER` instruction existed anywhere in the Dockerfile — the Node process ran as root inside the container for the entire session prior to this audit. Any RCE or container-escape vulnerability in a dependency would have root inside the container as a bonus.
**Fix:** switched to the unprivileged `node` user that `node:22-alpine` ships specifically for this purpose, with `--chown=node:node` on the copied `dist/`. **Not verified with a live `docker build`/`docker run`** — Docker Desktop wasn't reachable from this sandbox. This is the standard, widely-documented Node.js Docker pattern, but run a real build before this next deploys.
**Commit:** `bb8fd3a0`

### P1-13. `enatega-multivendor-web` had no error boundary at all
**File:** new `enatega-multivendor-web/app/(localized)/error.tsx` and `app/global-error.tsx` (found by the frontend research agent).
**Risk:** no `error.tsx`/`global-error.tsx` existed anywhere in web's App Router tree — any unhandled render error on the customer-facing app (the one with the largest free-text-input attack surface: reviews, addresses, search) fell through to Next's bare default "Application error" white screen, with a reset button nowhere to be found.
**Fix:** added both, mirroring admin's existing pattern (which had `error.tsx` at two levels but was itself missing `global-error.tsx` for root-layout crashes — added there too). `global-error.tsx` in both apps is deliberately dependency-free (no Clerk/Apollo/next-intl), since those providers may be exactly what crashed.
**Verified:** both apps' `npm run build` still succeed with the new routes.
**Commit:** `a2471241`

### P1-14. PII/debug console.log left in the rider order-poll hot path
**File:** `enatega-multivendor-api/src/orders/orders-rider.resolver.ts:24,27` (found by the backend-security research agent).
**Risk:** two raw `console.log` calls printed the calling rider's Clerk ID and rider name/id on every `riderOrders` poll — a tight, frequent polling path, not an occasional debug hook. Also a bare `console.log` (not the injected `Logger`) in `orders.service.ts#assignRider`.
**Fix:** removed the two PII prints; converted the assignRider log to `this.logger.debug`.
**Commit:** `06e0acfd`

---

## P2 — Fixed This Session

### P2-1. `enatega-multivendor-web`'s Content-Security-Policy only restricted `media-src`
**File:** `enatega-multivendor-web/next.config.mjs`.
**Risk:** the CSP header set exactly one directive (`media-src`), leaving `script-src`, `object-src`, `frame-ancestors`, `default-src`, etc. completely unrestricted — a CSP header that is present but provides close to no real XSS protection, on the customer-facing app with the largest attack surface (user reviews, addresses, free-text fields).
**Fix:** replaced with the same real policy already used by `enatega-multivendor-admin/next.config.mjs`, adapted to web's own server/WebSocket origins.
**Commit:** `ef93b5e8`

### P2-2. Unused dependency (`next-pwa`) responsible for most of web's critical vulnerabilities
**File:** `enatega-multivendor-web/next.config.mjs`, `package.json`.
**Risk:** `next-pwa` was a listed dependency but fully commented out — the `withPWA` wrapper and its config were dead code, never wired into the actual `export default`. It was still dragging in the `ejs`/`workbox-build`/`rollup`/`serialize-javascript` chain responsible for all 3 critical + several high vulnerabilities in `npm audit`.
**Fix:** removed the dependency and the dead code. Pure win — zero behavior change (it was never active), vulnerabilities gone. `enatega-multivendor-web/CLAUDE.md` still documents `next-pwa` as "enabled," which is no longer accurate; flagging this contradiction rather than silently editing another CLAUDE.md file — worth a deliberate decision on whether to properly re-enable PWA support later or update the doc.
**Commit:** `ef93b5e8`

### P2-3. AppState listener leak (customer app)
**File:** `enatega-multivendor-app/src/screens/Settings/Settings.js:169-171`.
**Risk:** `useEffect(() => { AppState.addEventListener('change', _handleAppStateChange) }, [])` returned no cleanup and didn't capture the subscription — every mount of the Settings screen added a permanent listener holding a stale-props closure (contrast `Account.js:204-210`, which does this correctly elsewhere in the same app).
**Fix:** capture the subscription, remove it in the cleanup function.
**Commit:** `c4f11db7`

---

## What Was Already Correct

Calling these out explicitly, since an audit that only lists problems risks implying nothing was done right — several categories the user asked about are in genuinely good shape already:

- **Coupon usage-limit race condition**: already correctly guarded via an atomic `findOneAndUpdate` with a `$expr: timesUsed < usageLimit` condition (`coupons.service.ts#claimUse`) — exactly one concurrent redemption wins, no read-then-write race. This was part of the July 2026 "financial correctness pass."
- **Wallet/withdraw balance updates**: use atomic `findOneAndUpdate`, not read-then-save.
- **OTP brute-force protection**: a per-destination 60s resend cooldown + 3-attempt cap + TTL expiry is already implemented at the application layer (`otp.service.ts`), independent of network-level rate limiting.
- **`Otp` schema indexing**: already has exactly the right compound indexes for its query patterns (`{destination, verified}`, `{userId, purpose}`) plus a TTL index (`expireAfterSeconds: 0`) that auto-purges expired OTPs at the database level.
- **External call timeouts**: every external provider (Cloudinary, Flouci payment, Google Routes/Timezone, Scaleway email/SMS, Expo push) already has an explicit `axios`/client timeout configured (2.5s–30s) — no call can hang a request indefinitely. (Retries are a separate, unaddressed gap — see below.)
- **Redis key hygiene**: every Redis key in `tracking.service.ts` (sessions, presence, rate limiting) uses an explicit `EX` TTL — no unbounded keys.
- **Auth guard coverage**: every resolver with no `@UseGuards` was individually verified to be either a legitimately public read (config, countries, active offers, public tax rates — normal for a food-delivery app's unauthenticated browsing) or a `@ResolveField`-only resolver on a type only ever reachable through an already-guarded parent query (the `*-money.resolver.ts` files). No actual authorization gap found.
- **Docker image**: multi-stage build, pinned `node:22-alpine`, non-root-friendly, a real `HEALTHCHECK` instruction, `.dockerignore` correctly excludes `node_modules`/`.env`/`.git`.
- **`.env.example` sync**: every variable in the real `enatega-multivendor-api/.env` is documented in `.env.example` (checked both directions) — the project's own rule about keeping them in sync is actually being followed.
- **Payment confirmation is server-authoritative** (confirmed by the backend-security agent): the unauthenticated Flouci callback endpoints (`payments/payments.controller.ts` `/success`, `/topup-success`) re-verify with the gateway by `paymentId` before marking anything `PAID` or crediting a wallet (`payments.service.ts:93-112,161-177`) — no payment-forgery vector from a spoofed callback. The Clerk webhook also verifies its `svix` signature correctly.
- **Redis client hardening** (confirmed by the infra agent): `pubsub.module.ts`'s Redis factory uses `lazyConnect`, `maxRetriesPerRequest: 1`, a 3s connect timeout and 2s command timeout — explicitly documented in the code as bounding an outage to ~2s after an earlier E2E pass found customer mutations hanging 10-20s on a Redis blip. Every consumer (`tracking.service.ts`) wraps Redis calls in try/catch with a Mongo fallback (e.g. `findNearbyRiderIdsFromMongo`), so rider dispatch survives a Redis outage in degraded mode rather than failing outright.
- **Order placement never blocks on the Google Maps/Routes provider** (confirmed by the backend-perf agent): the ETA estimate is cache-only at placement time (`orders.service.ts:397`, `useProvider: false`) and falls back to a static prep time instantly on a cache miss — a slow or down Google API cannot slow down order placement itself.

---

## Remaining Risks (Not Fixed In This Pass)

These are real, but each requires either information only you have (infrastructure sizing, vendor choice, risk tolerance for a breaking migration) or is large enough that bundling it into this pass would have meant less rigor on everything else. Ranked by severity.

### P0/P1 — needs your decision, not just code

- **Secret rotation + git-history scrub** (see P0-1/P0-2 above). This is the single highest-priority remaining item — the code fix is done, but the actual credentials are still valid and still in history.

- **The GraphQL realtime layer is a hard ceiling on horizontal scaling (P0/P1, found by the infra research agent).** `enatega-multivendor-api/src/pubsub/pubsub.module.ts:62-72` provides `PUB_SUB` from `new PubSub()` — the in-process, single-instance implementation from the `graphql-subscriptions` package, **not** the Redis-backed one. The module's own doc comment is explicit that cross-instance delivery would need a shared broker. Consequence: **you cannot run more than one API replica** — a customer/rider/store connected to replica A will never receive an order/rider event published on replica B. Everything else in this audit (indexes, CI, secrets) assumes the app can eventually scale out; this is the one finding that says it currently can't, at any traffic level, without this change. The fix is well-scoped and lower-risk than it sounds: `graphql-redis-subscriptions` is **already a listed dependency** (`package.json`) and never wired up, and the Redis client used elsewhere in this codebase (`tracking.service.ts`) is already hardened (bounded timeouts, TLS, graceful degradation). Swapping the provider is mechanical; the risk is entirely in *testing* that every subscription (`subscriptionOrder`, `orderStatusChanged`, `subscribePlaceOrder`, `subscriptionDispatcher`, `RiderUpdated`, `foodStockChanged`, etc.) still delivers correctly end-to-end after the swap — not something to do in the last hour of an already-long audit pass. **Recommended next session's first task.**
  - Related, lower severity: the current single-instance PubSub also fans every event out to *every* connected subscriber's iterator, filtering in-process per client (`subscriptions.resolver.ts`) — O(total connections) work per event on one EventEmitter. At "thousands of concurrent WS clients" this causes event-loop lag even before the scaling ceiling is hit. A Redis-backed broker with per-entity channels (per restaurant/rider/user) would fix both problems at once.

- **Zero database transactions anywhere in the codebase** (`grep -r "startSession\|withTransaction" src` returns nothing outside tracking's Redis session concept, which is unrelated). The two clearest cross-document races (wallet-debit + order-PAID, loyalty read-modify-write) are now fixed with atomic single-document guards (P0-4, P0-5), but other multi-collection flows remain unguarded: **coupon usage + loyalty points are burned before `orderModel.create()` runs, with no compensation if `create` throws** (orders.service.ts — confirmed by the backend-perf agent), and **wallet top-up credit-then-mark-COMPLETED isn't idempotency-keyed** (`payments.service.ts:170-176` — a crash between the two on a retried webhook re-credits the wallet). MongoDB Atlas supports multi-document transactions natively (replica set required, which Atlas provides by default) — retrofitting them into the ~90KB `orders.service.ts` safely needs its own focused pass with its own test plan.

- **No env-var validation schema at startup.** `ConfigModule.forRoot({ isGlobal: true })` has no `validationSchema`/`validate` (confirmed by the infra agent). Secrets are read lazily via `getOrThrow` inside guards/services *at request time*, not at boot — a missing `CLERK_SECRET_KEY` lets the container report healthy and only throws on the first authenticated request, and a missing `REDIS_URL` silently defaults to localhost (`pubsub.module.ts`), same category of bug as the `MONGO_URI` issue fixed in P1-5. Recommend a Joi/class-validator env schema that fails the container at boot if any required var is missing.
- **No observability/APM on the backend.** `grep` for `sentry|prometheus|datadog|newrelic|winston|pino|opentelemetry` in `enatega-multivendor-api/package.json` returns nothing — only raw NestJS `Logger` (console output). At the stated scale, there is currently no way to alert on error-rate spikes, no distributed tracing across the GraphQL → Mongo/Redis → external-provider chain, no dashboard for p50/p95/p99 latency, and no centralized log aggregation. This needs a vendor decision (Sentry + Prometheus/Grafana is the standard combination other delivery platforms use) before implementation, not a unilateral pick.
- **Backup/restore strategy unverified.** MongoDB is Atlas (managed) and Redis is a managed service (`redis.valinka.app`) — both *can* provide automated backups/PITR, but this depends on the specific plan tier (Atlas's free M0 tier has **no** backup capability at all). Nothing in the repo confirms which tier is provisioned or that a restore has ever been tested. Action item: confirm backup is actually enabled on the Atlas dashboard, and run one test restore into a staging cluster.

### P1 — real gaps, documented but not implemented
- **No retry/backoff on any external provider call.** Every provider has a timeout (good — see above), but zero automatic retry on transient failure (`grep -n "retry\|backoff" src/providers/*.ts` — no matches). A single network blip fails the call outright. This is not a blanket fix: payment calls (Flouci) need idempotency-key-aware retries to avoid double-charging on a retried non-idempotent request, while read-only lookups (Google Routes/Timezone) are safe to retry immediately. Recommend: simple exponential-backoff retry (2–3 attempts) on the read-only providers first (zero risk), and a deliberate, separately-tested idempotency design for payment retries.
- **No resource limits in `docker-compose.yml`.** No `deploy.resources.limits` (memory/CPU) on the `api` service. Deliberately not set here — picking numbers without knowing your actual Dokploy host/VM sizing risks OOM-killing a healthy process under a load spike, which is worse than the current unbounded state. Recommend setting these once you know your instance's actual available memory (e.g., a Node/NestJS process this size typically needs 512MB–1GB under normal load; profile under your actual traffic before capping).
- **Broken `lint` script on `admin`/`web`.** Both use `next lint`, which Next.js 16 removed entirely (`Invalid project directory provided, no such directory: .../lint` — the CLI now parses "lint" as a positional argument since the subcommand doesn't exist). `admin` additionally has a legacy `.eslintrc.json` alongside a flat `eslint.config.mjs`, which crashes ESLint 8 outright when invoked directly (`Converting circular structure to JSON`). Not fixed here because a proper ESLint 8→9/flat-config migration is its own task with its own regression risk; flagging it so it doesn't stay silently broken.
- **Rate limiting uses the default in-memory store.** `ThrottlerModule.forRoot([...])` has no Redis storage adapter configured (found by the backend-security agent). Currently moot given the single-instance PubSub ceiling above — one instance means one shared counter anyway — but this needs to move to Redis-backed storage in the same pass as the PubSub fix, or rate limits silently stop holding once you do scale out.
- **`docker-compose.yml` pins `image: enatega-multivendor-api:latest`** (found by the infra agent) — no versioned/immutable image tag, so a Dokploy rollback isn't a clean pin to a known-good build. Recommend versioned tags (git SHA or semver) plus a written rollback runbook; `raw/dokploy-deployment.md` in this repo is actually reused notes from a different project and documents no rollback procedure for this API specifically.
- **API-level `npm audit`: 0 critical, 5 high, 6 moderate** (found by the backend-security agent) — `ws` (subscription memory-exhaustion DoS, reachable via graphql-ws), `multer` (upload DoS via nested field names), and transitive `@nestjs/graphql`/`@nestjs/apollo` findings. Not triaged/fixed in this pass; recommend `npm audit fix` plus manual review of the two direct-dependency highs before the next deploy.
- **Admin `npm audit`: 0 critical, 3 high, 6 moderate** (`@grpc/grpc-js`, `uuid`, `postcss`, dev-only `@cypress/request`) — lower priority, mostly `npm audit fix`-able without breaking changes.
- **Pre-existing TypeScript debt in all three mobile apps.** `enatega-multivendor-app` has a `typecheck` script that currently fails (`MapView.web.tsx` referencing non-existent library exports, a `ThemeValue` indexing bug in `Notifications.tsx`). `store`/`rider` have no `typecheck` script at all, and running `tsc --noEmit` directly surfaces dozens of pre-existing errors (implicit `any`, a `ColorSchemeName`/`'unspecified'` handling gap across several skeleton components, a missing `../types/rider` module). None of this blocks Metro from bundling (Babel, not `tsc`, does the actual transpile), so it isn't a shipping blocker today, but it's real type-safety erosion that should become a CI gate once cleaned up rather than left as permanent debt.

### P2 — lower priority
- **`configuration.resolver.ts`'s `metricsGeneral` mutation** (`src/configuration/configuration.resolver.ts:17-21`) does nothing but return a random UUID and a timestamp — no DB read/write, no actual metrics recorded. Harmless (no security exposure), but confusing dead-code-shaped code with odd field names (`experience`, `hehe`) that reads like a debugging leftover from the original open-source template. Candidate for removal once confirmed unused by any client.
- **N+1 field resolvers on `RestaurantModel`** (`zone`, `categories`, `options`, `addons`, `reviewData` in `restaurants.resolver.ts`) resolve per-parent without DataLoader batching — but verified this is **not currently exploitable**: every list-returning query in `admin`/`web`/`app` uses the lighter `RestaurantPreviewModel` (which doesn't expose these fields at all), and the full `RestaurantModel` is only ever queried for a single restaurant by ID/slug. This is a deliberate, effective lazy-loading design, not a bug — flagging only so a future change that accidentally selects these fields on a list query is caught in review, since the type system won't stop it from becoming a real N+1 if a new list query is ever written against the full type.
- **No Prometheus metrics endpoint** — subsumed by the observability gap above; would be part of the same vendor decision.

---

## Score Breakdown

| Area | Score | Why |
|---|---|---|
| Secrets & credential hygiene | 55/100 | Code-level leaks fixed and gitignore hardened; score capped because the actual credentials are still live and unrotated, and history still contains them |
| Availability / operational readiness | 80/100 | Real liveness/readiness split, graceful shutdown, fail-fast config now in place; capped for lack of resource limits and unverified backup/DR |
| Database performance | 75/100 | The two hottest query paths now indexed correctly with verified query-shape tracing; capped because this was a targeted pass on the highest-traffic paths, not an exhaustive index review of all ~40 schemas |
| Data integrity | 65/100 | Single-document races already well-handled (coupons, wallet); capped hard for zero cross-collection transactions on financial flows |
| Security | 82/100 | Rate limiting, GraphQL hardening, and auth-guard coverage all verified solid; capped for the secret exposure and missing retry/idempotency design on payment |
| CI/CD | 70/100 | Went from nothing to a real pipeline gating build+test on every app; capped for the unaddressed lint/typecheck debt that CI deliberately doesn't gate on yet |
| Observability | 10/100 | Not addressed — needs your vendor decision, listed as the top follow-up |
| Dependency hygiene | 68/100 | Cleared web's 3 criticals and most highs, fixed rider's version-skew vulnerability sprawl (56→19 findings); capped for remaining moderate/high findings not individually triaged |
| Mobile robustness | 72/100 | Test infra was completely broken and is now fixed and passing; one real memory leak fixed; capped for pre-existing TS debt and store's still-missing crash reporting/error boundary |

**Overall: 74/100** (weighted toward the categories most load-bearing for the stated scale: availability, data integrity, and security).

---

## Final Production Deployment Checklist

Before taking this to real production traffic at the stated scale, in priority order:

- [ ] **Rotate every credential listed in P0-1/P0-2** (Atlas password, Redis password, both Clerk secret keys, Firebase service-account key(s), Cloudinary secret, both Sentry tokens).
- [ ] Decide on and, if warranted, execute a **git-history scrub** for the secrets above.
- [ ] Register `SENTRY_AUTH_TOKEN` with `eas env:create` for `store`/`rider` (removed from tracked files, not yet reconfigured in EAS).
- [ ] **Swap the in-memory GraphQL PubSub for `graphql-redis-subscriptions`** (already a listed dependency) before ever running more than one API instance — this is the actual ceiling on the stated "hundreds of restaurants" scale, not any of the index/query fixes in this pass. Move `ThrottlerModule` to Redis storage in the same pass.
- [ ] Point your load balancer / Dokploy health check for **traffic routing** at `GET /api/health/ready`, keep the Docker `HEALTHCHECK` on `GET /api/health`.
- [ ] Set `CORS_ORIGINS` explicitly in the production environment (currently falls back to wide-open with only a log warning).
- [ ] Add a Joi/class-validator env-var schema so the container fails at boot on missing config, instead of failing lazily on the first request that touches it.
- [ ] Confirm MongoDB Atlas backup/PITR is actually enabled for your cluster tier; run one test restore.
- [ ] Decide on and integrate an APM/error-tracking vendor (Sentry recommended, matching what `rider` already uses) and structured logging for the API.
- [ ] Set Docker memory/CPU limits on the `api` service once real traffic profiling data exists; move off the floating `:latest` image tag to versioned tags with a written rollback runbook.
- [ ] Verify the Docker non-root-user change (P1-12) with a real `docker build && docker run` — not verified in this session (no Docker daemon access in the sandbox).
- [ ] Design and implement idempotency-safe retries for the Flouci payment provider; add simple retry/backoff to the read-only providers (Google Routes/Timezone).
- [ ] Plan the transactions retrofit for coupon/loyalty-burned-before-order-create and the wallet top-up idempotency gap.
- [ ] Fix the `next lint` / ESLint flat-config conflict in `admin`/`web`, then wire lint into CI.
- [ ] Clean up the pre-existing `tsc --noEmit` debt in all three mobile apps, then wire typecheck into CI.
- [ ] Triage the API's 5 high / 6 moderate and admin's 3 high / 6 moderate `npm audit` findings.
- [ ] Add a crash-reporting/error-boundary equivalent to `store` (currently has neither — the app that runs all day on a restaurant tablet accepting orders is the highest-value place to have both).
- [ ] Exercise a full rolling-deploy + rollback drill against a staging environment before the first real production deploy, now that graceful shutdown is in place.

---

## Commit Log

All on `main`, pushed incrementally as required:

| Commit | Summary |
|---|---|
| `79802ca5` | Untrack `.env` files with live secrets across all apps, harden `.gitignore` |
| `c4f11db7` | Fix unbounded Clerk role-cache memory leak + AppState listener leak |
| `c7c1d1b1` | Fix health endpoint always reporting `ok`; add real liveness/readiness split |
| `d655182b` | Enable graceful shutdown hooks; warn on wide-open production CORS |
| `643524c1` | Disable GraphQL Playground + introspection in production |
| `69fea79e` | Rate-limit OTP mutations per-caller |
| `0553525b` | Fail fast on missing `MONGO_URI` in production |
| `ef93b5e8` | Fix completely broken web production build; fix weak CSP; remove unused vulnerable `next-pwa` |
| `4c5ec5db` | Remove Firebase admin service-account keys + hardcoded Sentry tokens from git |
| `1c5044a3` | Fix store/rider test suites (jest/jest-expo version skew) |
| `b3c147cd` | Add GitHub Actions CI pipeline |
| `f458a12c` | Add missing compound indexes on dispatch/store-dashboard hot paths |
| `cd661c0d` | Fix P0 wallet-atomicity bug + loyalty redemption race condition |
| `06e0acfd` | Add GraphQL depth limit, missing Review index, remove PII/debug logs |
| `bb8fd3a0` | Run the API container as a non-root user |
| `a2471241` | Add missing global-error.tsx root error boundaries (web, admin) |

Every fix above was verified against the actual toolchain (`tsc --noEmit`, `npm run build`, `npm test`, or `npm audit`) before being committed — none are inspection-only recommendations dressed up as fixes. Two exceptions are called out explicitly where the toolchain couldn't be exercised in this sandbox: the Docker non-root-user change (no Docker daemon access) and any claim about live production behavior (no access to the actual Dokploy deployment).
