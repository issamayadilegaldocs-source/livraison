# AGENTS.md

Guidance for Claude Code (and any agent) working in this repository.

## Project

This repo contains a single app: `livreur-site/`, a Next.js storefront sold to independent delivery riders ("livreurs"). Each copy of the site shows a whole city's restaurants (imported from a dump), takes orders, emails them to the rider, and has the customer send them to the rider on WhatsApp (pre-written message). The legacy Hamma platform (API, admin, web, mobile apps) was removed on 2026-11-17; it lives in git history before branch `feat/livreur-site`.

- How it works, decisions and lessons: `livreur-site/ARCHITECTURE.md`.
- Running, configuring a copy for a rider, deploying: `livreur-site/README.md`.

## Git Rules

- **Never commit `.env` files** (`.env`, `.env.local`, …). Only `.env.example` is tracked.
- When a change makes `livreur-site/ARCHITECTURE.md` or `livreur-site/README.md` stale, update it in the same commit.

## Task Completion Rules

For any non-trivial change (feature, contract change, bug fix with a reusable root cause):

- **Document in the same turn** in `livreur-site/ARCHITECTURE.md` (or the README for setup/deploy steps).
- **Add or update a focused test** (`vitest`, files next to the code in `livreur-site/lib/` and `app/api/`).
- **Verify runtime behaviour** (dev server + browser), or say plainly that you didn't.

## Running Locally

```bash
cd livreur-site
npm install
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build
```

Env (`livreur-site/.env.local`, never committed): `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL`, `MEDIA_BASE_URL`, optional `CALLMEBOT_APIKEY`.

## Mobile first

The site is built for phones first. Keep screen headers clear of the status bar / notch (`env(safe-area-inset-*)`), and test layouts at 390 px width.
