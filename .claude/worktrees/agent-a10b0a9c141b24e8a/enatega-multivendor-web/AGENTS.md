# enatega-multivendor-web — AI Agent Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Next.js (App Router) · Apollo Client · GraphQL · Tailwind CSS · `tailwind-merge` · Firebase · `next-intl` · `next-pwa` · Cypress

## Before Coding — Read the Docs

| Document | Content |
|---|---|
| `../raw/best-practices-next-js.md` | App Router, Server/Client boundaries, TypeScript, Tailwind, data fetching, PWA, image/font, security |
| `../raw/best-practices-web.md` | Performance, security, accessibility, Core Web Vitals, error handling |
| `../wiki/src-best-practices-next-js.md` | Synthesized decisions for this stack |
| `../wiki/src-best-practices-web.md` | General web quality, accessibility, API communication, and error handling |
| `../wiki/engineering-best-practices-overview.md` | Cross-stack engineering standards adapted for Enatega |
| `../wiki/graphql-schema-compatibility.md` | Client GraphQL contract and compatibility constraints |

## Project Structure

```
app/(localized)/        ← locale-wrapped App Router routes
lib/
  api/graphql/          ← ALL GraphQL documents (queries, mutations, subscriptions)
  config/               ← Apollo client init, env config
  context/              ← React context providers
  hooks/                ← useQueryQL, useLazyQueryQL, …
  services/             ← Firebase, push notifications, upload
  states/               ← global client state
  ui/                   ← shared presentational components
  utils/                ← pure functions
```

## Rules

### Server vs Client Components

- Default to Server Components. Add `'use client'` only for interactivity, effects, browser APIs, or Apollo hooks.
- Never put primary page fetches in `useEffect`. Use `useQueryQL` in a Client Component.
- Public browsing pages (restaurant list, menus, banners) benefit most from Server Component fetching — prefer it when feasible.

### Apollo / GraphQL

- All GraphQL documents live in `lib/api/graphql/`. Never inline documents in components.
- Use `useQueryQL` / `useLazyQueryQL` wrappers — not raw Apollo hooks.
- Send `Idempotency-Key` (UUID v4) on order-placement mutations.
- Clean up subscriptions (order tracking, rider location) on unmount.

### Tailwind

- Classes must be **static strings** — never `` `text-${variant}-500` ``.
- Map variants to complete class strings; `twMerge`/`cn()` at final composition only.
- `tailwind.config.ts` content must explicitly cover all component directories.

### Performance & PWA

| Rule | Detail |
|---|---|
| Images | `next/image` everywhere; `priority` on LCP image |
| Fonts | `next/font` — no `<link>` Google Fonts |
| `remotePatterns` | Lock to actual CDN hostnames in `next.config.mjs` |
| Long lists | Virtualize lists > 100 items |
| Core Web Vitals | LCP < 2.5 s · INP < 200 ms · CLS < 0.1 |

### Security

| Rule | Detail |
|---|---|
| Security headers | `headers()` in `next.config.mjs` — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| JWT storage | `httpOnly` cookie or in-memory only — never `localStorage` |
| Env vars | `lib/config/` helpers only — never `process.env.*` in components |
| Error messages | Never expose raw GraphQL errors to UI |

### i18n

- All user-facing strings use `next-intl`. No hard-coded English.
- Add keys to ALL locale files in `locales/` when adding UI copy.
- Client: `useTranslations`. Server: `getTranslations`.

### Accessibility

- `<input>` → visible `<label>` or `aria-label`
- Icon-only buttons → `aria-label`
- `<button>` for actions, `<a>` for links — never `<div onClick>`
- Color alone must not convey state

## Common Mistakes to Avoid

| Mistake | Correct |
|---|---|
| Inline GraphQL in component | Move to `lib/api/graphql/` |
| Raw `useQuery` in component | Use `useQueryQL` wrapper |
| `<img>` for restaurant/banner photos | `next/image` with `priority` on LCP |
| `localStorage` for JWT | `httpOnly` cookie or in-memory |
| Dynamic Tailwind class strings | Static complete class strings |
| Hard-coded English copy | `next-intl` key in all locale files |
| Subscription without cleanup | Return unsubscribe from `useEffect` |
