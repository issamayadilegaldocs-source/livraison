# enatega-multivendor-store — Claude Code Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Expo (managed workflow) · Expo Router · React Native · Apollo Client · GraphQL · NativeWind · Firebase · `expo-secure-store` · `expo-print`

## Best Practices Docs

Read before writing or reviewing code:

- `../raw/best-practices-react-native.md` — project structure, navigation, state, lists, animations, secure storage, Expo SDK conventions, testing
- `../raw/best-practices-mobile.md` — offline-first, network awareness, performance, platform rules, accessibility, security, update strategy
- `../wiki/src-best-practices-react-native.md` — synthesized decisions for this stack
- `../wiki/src-best-practices-mobile.md` — offline-first architecture, network states, mutation queues
- `../wiki/engineering-best-practices-overview.md` — cross-stack engineering standards adapted for Enatega
- `../wiki/graphql-schema-compatibility.md` — store app GraphQL contract and compatibility constraints

## Project Layout

```
app/
  _layout.tsx           ← root Expo Router layout + providers
  (protected)/          ← auth-gated routes (store dashboard, orders, menu)
  (un-protected)/       ← public routes (login)
  index.tsx             ← entry redirect
lib/
  api/                  ← Apollo queries, mutations, subscriptions
  apollo/               ← Apollo client setup
  assets/               ← static assets
  context/              ← React context providers (auth, active orders)
  hooks/                ← custom hooks
  services/             ← Firebase, print, non-GraphQL integrations
  ui/                   ← shared presentational components
  utils/                ← pure utility functions
```

## Navigation (Expo Router)

- All routing is **file-based** via Expo Router. Do not add manual navigator stacks.
- Use `(protected)` route group for auth-gated layouts and `(un-protected)` for the login flow. Auth check happens in the group `_layout.tsx`.
- Type all route params with `useLocalSearchParams<T>()` — never untyped `any`.
- `router.replace()` after login — store staff must not be able to navigate back to login.

## State & Data Fetching

- Apollo Client for all GraphQL operations. Real-time subscriptions (new orders, order status updates) drive the store dashboard.
- Order-status subscriptions must be cleaned up when the screen unmounts.
- Global state (auth session, store info, active order queue) in React Context (`lib/context/`).
- Tokens go in `expo-secure-store`. Never `AsyncStorage` for authentication state.

## NativeWind / Styling

- NativeWind is the styling system. Use Tailwind class strings on RN components. Do not mix `StyleSheet.create` and NativeWind on the same component without a clear reason.
- Classes must be **static strings** — never construct class names dynamically.
- Platform differences: `Platform.select({ ios: '...', android: '...' })` — not inline `Platform.OS ===` conditionals in render.

## Orders & Real-Time

- New order notifications arrive via Firebase (push) and GraphQL subscriptions. Both paths must update the same order queue in context — do not duplicate state.
- Order acceptance/rejection is a mutation — send `Idempotency-Key` (UUID v4) to prevent duplicate processing on reconnect.
- `expo-print` is used for printing receipts. Confirm print permission and handle print errors gracefully; never block order flow on a print failure.

## Offline / Network Awareness

- Subscribe to `@react-native-community/netinfo` for connectivity.
- Show a non-blocking amber banner when offline or API is unreachable — never a modal that blocks store operations.
- Order status mutations must be queued locally and retried on reconnect; a network drop must never silently lose an order update.

## Security

- Tokens → `expo-secure-store` (`keychainAccessible: WHEN_UNLOCKED`). Never log token values.
- Never expose raw GraphQL or Apollo error objects in the UI — map to safe user-facing messages.
- Firebase tokens are device identifiers — do not log or transmit outside the notification flow.

## Lists

- Never `ScrollView` + `.map()` for order lists or menu item lists of unknown length.
- Use `FlashList` for large datasets. Use `FlatList` for short stable lists (< 50 items).
- Always `keyExtractor` with a stable entity ID. Always `estimatedItemSize` on FlashList.

## Accessibility

- Every interactive element needs `accessibilityLabel` and `accessibilityRole`.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` when the visual element is smaller.
- New order arrivals must be announced via `AccessibilityInfo.announceForAccessibility()` — store staff may not be watching the screen.

## Expo SDK Conventions

| Need | Use | Do not use |
|------|-----|-----------|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Notifications | `expo-notifications` | FCM SDK directly |
| Printing | `expo-print` | bare RN print libs |
| Background tasks | `expo-task-manager` | `setInterval` |
| Animations | `react-native-reanimated` | `Animated` API |
| Images | `expo-image` | RN `Image` |
| Lists | `@shopify/flash-list` | `ScrollView` + map |

## Testing

- `jest-expo` preset for unit tests. Test context logic, order queue, retry logic.
- React Native Testing Library for component tests — assert by `accessibilityRole` and visible text.
- Physical device test on iOS + Android before every release build.
