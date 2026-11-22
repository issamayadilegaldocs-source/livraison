# enatega-multivendor-web — Claude Code Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from the frontend to silence schema errors.

## Stack

Next.js (App Router) · Apollo Client · GraphQL · Tailwind CSS · `tailwind-merge` · Firebase · `next-intl` · `next-pwa` · Cypress

## Best Practices Docs

Read before writing or reviewing code:

- `../raw/best-practices-next-js.md` — App Router, Server/Client components, TypeScript, Tailwind, state, testing, security headers, PWA/image/font
- `../raw/best-practices-web.md` — performance, security, accessibility, error handling, Core Web Vitals
- `../wiki/src-best-practices-next-js.md` — synthesized decisions for this stack
- `../wiki/src-best-practices-web.md` — general web quality, accessibility, API communication, and error handling
- `../wiki/engineering-best-practices-overview.md` — cross-stack engineering standards adapted for Enatega
- `../wiki/graphql-schema-compatibility.md` — client GraphQL contract and compatibility constraints

## Project Layout

```
app/
  (localized)/          ← next-intl locale route group
    layout.tsx
    not-found.tsx
    NotificationInitialzer.tsx
lib/
  api/graphql/          ← Apollo queries, mutations, subscriptions
  config/               ← Apollo client setup, env config
  context/              ← React context providers
  hooks/                ← custom hooks (useQueryQL, useLazyQueryQL, …)
  services/             ← Firebase, upload, non-GraphQL integrations
  states/               ← global client state
  ui/                   ← shared presentational components
  utils/                ← pure utility functions
```

## Rendering Rules

- Default to **Server Components** for route composition and public-browsing data (banners, restaurant listings, zones). Add `'use client'` only for components with event handlers, browser APIs, or Apollo hooks.
- Apollo Client runs in Client Components. Unauthenticated read-heavy pages (restaurant lists, menus) should prefer Server Component fetches through Route Handlers when feasible, falling back to `useQueryQL` client-side.
- Do not fetch primary page data in `useEffect`. Use Apollo `useQuery` (via `useQueryQL`) in a Client Component for client-driven freshness.
- `next-pwa` is enabled — avoid adding large non-cacheable resources that will bloat the service worker cache manifest.

## Apollo / GraphQL Rules

- All queries, mutations, and subscriptions live in `lib/api/graphql/`. Never define GraphQL documents inline in components.
- Use `useQueryQL` and `useLazyQueryQL` project wrappers (in `lib/hooks/`) rather than raw Apollo hooks.
- Send `Idempotency-Key` (UUID v4) on order-placement mutations to prevent duplicate orders on reconnect.
- Real-time order tracking and rider location subscriptions must be cleaned up on unmount.

## Tailwind Rules

- Keep all Tailwind classes **static and explicit**. Never construct class names with template strings (`` `bg-${color}-500` `` — the scanner cannot detect these).
- Map color/variant/size variants to complete static strings. Use `twMerge`/`cn()` only at the final composition boundary.
- `tailwind.config.ts` content paths must explicitly include all directories containing classes (`app/**`, `lib/ui/**`, etc.).

## PWA / Performance

- Use `next/image` for all product images, restaurant photos, and banners. Never `<img>` for large above-the-fold content.
- Mark the LCP image (hero restaurant photo / top banner) with `priority`.
- Lock down `images.remotePatterns` in `next.config.mjs` to the CDN hostnames actually in use.
- Use `next/font` for all fonts — do not load Google Fonts via a `<link>` tag.
- Target Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- Virtualize any list that may exceed 100 items (search results, full restaurant lists).

## Security

- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`) must be configured in `next.config.mjs` via `headers()`.
- Never store authentication tokens in `localStorage`. The customer JWT must live in an `httpOnly` cookie or in-memory only.
- Never read `process.env.*` inside components — route through `lib/config/` helpers validated at startup.
- Never expose raw GraphQL errors to the UI — map to safe user-facing messages.
- Firebase push notification tokens are device identifiers — never log or expose them outside the notification flow.

## i18n

- All user-facing strings go through `next-intl`. No hard-coded English strings in components.
- Translation keys live in `locales/`. Add to all locale files when adding new UI copy.
- Client Components: `useTranslations`. Server Components: `getTranslations`.

## Accessibility

- Every `<input>` has a visible `<label>` or `aria-label`.
- Icon-only buttons require `aria-label`. `<button>` for actions, `<a>` for navigation — never `<div onClick>`.
- Minimum contrast ratio 4.5:1 for body text. Color alone must not convey state.
- Loading states: use `aria-busy="true"` on the container, not a spinner that replaces content silently.

## Testing

- Cypress for E2E. Critical paths: browse restaurants, add to cart, checkout/order placement, order tracking, customer login/register, address management.
- Unit-test pure utilities in `lib/utils/` with Jest/Vitest.
- Do not test implementation details — assert what the user sees and what the API receives.
