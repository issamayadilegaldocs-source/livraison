# Enatega Multivendor API

Single NestJS backend for the existing Enatega apps. Admin, customer, rider,
store, and web APIs should be organized as modules/routes inside this one
service rather than separate deployable backends.

## Structure

```text
src/
  main.ts              # API bootstrap
  app.module.ts        # Root Nest module
  common/              # Shared backend config/bootstrap utilities
  health/              # Health check endpoint
```

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run start
```

The API exposes `GET /api/health` by default.

## Pricing and settlement

See [the pricing and settlement guide](../docs/pricing-and-settlement.md) for
the server-authoritative delivery, service-fee, rider-bonus, and restaurant
commission model.

## Dokploy

Deploy this directory with `docker-compose.yml`. The service joins the external
`dokploy-network`, exposes port `4000`, and serves the health check at
`/api/health`.

Configure production variables in the Dokploy environment editor. Dokploy writes
those variables to a `.env` file beside `docker-compose.yml`, and Compose uses
that file for `${VAR}` interpolation.

If `FIREBASE_PRIVATE_KEY` is configured through a `.env`-style field, store it
as one line with escaped newlines (`\n`), not as a raw multiline PEM block.
Alternatively set `FIREBASE_PRIVATE_KEY_BASE64` to a base64-encoded PEM.

```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FIREBASE_PRIVATE_KEY_BASE64=
```

Required production variables:

```bash
MONGO_URI=
REDIS_URL=rediss://<user>:<password>@<managed-redis-host>:<port>
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
```

Optional runtime variables include `PORT`, `GLOBAL_PREFIX`, `CORS_ORIGINS`,
Clerk publishable/authorized-party values, Scaleway email/SMS values, Firebase
credentials, OTP limits, and Cloudinary credentials. If `PORT` and `API_PORT`
are both set, `PORT` takes precedence.

Redis backs cross-replica GraphQL subscriptions, order-scoped rider tracking,
and short-lived rider dispatch presence. If Redis is unavailable, `/api/health`
reports `tracking: "degraded"`; MongoDB-backed ordering remains available.

After deploying the breaking tracking migration, remove legacy GPS fields once:

```bash
npm run cleanup:rider-locations
```
