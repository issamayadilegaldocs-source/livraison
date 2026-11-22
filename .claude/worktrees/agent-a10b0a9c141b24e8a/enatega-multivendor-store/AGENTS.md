# enatega-multivendor-store — AI Agent Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Expo (managed workflow) · Expo Router · React Native · Apollo Client · GraphQL · NativeWind · Firebase · `expo-secure-store` · `expo-print`

## Before Coding — Read the Docs

| Document | Content |
|---|---|
| `../raw/best-practices-react-native.md` | Project structure, navigation, state, lists, animations, secure storage, Expo SDK table, testing |
| `../raw/best-practices-mobile.md` | Offline-first, network awareness, performance, platform rules, security, update strategy |
| `../wiki/src-best-practices-react-native.md` | Synthesized Expo/RN decisions |
| `../wiki/src-best-practices-mobile.md` | Mutation queues, conflict resolution, network states |
| `../wiki/engineering-best-practices-overview.md` | Cross-stack engineering standards adapted for Enatega |
| `../wiki/graphql-schema-compatibility.md` | Store app GraphQL contract and compatibility constraints |

## Project Structure

```
app/
  _layout.tsx           ← root layout + providers
  (protected)/          ← auth-gated dashboard, orders, menu
  (un-protected)/       ← login
  index.tsx
lib/
  api/                  ← Apollo queries, mutations, subscriptions
  apollo/               ← Apollo client setup
  context/              ← auth, active order queue
  hooks/                ← custom hooks
  services/             ← Firebase, print, non-GraphQL
  ui/                   ← shared presentational components
  utils/                ← pure functions
```

## Rules

### Navigation

- File-based routing via Expo Router. Do not add manual `react-navigation` stacks.
- Auth gating happens in `(protected)/_layout.tsx`.
- Type all route params with `useLocalSearchParams<T>()` — never untyped.
- `router.replace()` after login — no back navigation to login.

### Data & State

- Apollo Client for all GraphQL. Real-time order subscriptions drive the dashboard.
- Subscriptions must be cleaned up on unmount.
- Tokens → `expo-secure-store` (`keychainAccessible: WHEN_UNLOCKED`). Never `AsyncStorage`.
- Global state in `lib/context/` (auth, active orders, store info).

### Orders & Real-Time

- New orders arrive via both Firebase push and GraphQL subscription — both update the same order queue; do not duplicate state.
- Order acceptance/rejection mutations must include `Idempotency-Key` (UUID v4).
- Print failures (`expo-print`) must never block the order flow — log the error and continue.

### NativeWind

- Static class strings only — never `` `text-${color}-500` ``.
- Do not mix `StyleSheet.create` and NativeWind on the same component.
- Platform variants: `Platform.select({ ios: '...', android: '...' })` in a map — not inline conditionals.

### Offline / Network

- Subscribe to `netinfo` for three-state connectivity.
- Non-blocking banner for offline — never a blocking modal.
- Queue outgoing order-status mutations locally; retry on reconnect.

### Expo SDK Conventions

| Need | Use | Avoid |
|---|---|---|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Notifications | `expo-notifications` | FCM SDK directly |
| Printing | `expo-print` | bare RN print libs |
| Background | `expo-task-manager` | `setInterval` |
| Animations | `react-native-reanimated` | `Animated` |
| Images | `expo-image` | RN `Image` |
| Lists | `FlashList` | `ScrollView` + map |

### Accessibility

- `accessibilityLabel` + `accessibilityRole` on every interactive element.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` for smaller elements.
- `AccessibilityInfo.announceForAccessibility()` on new order arrival.

### Lists

- Never `ScrollView` + `.map()` for order or menu lists.
- `FlashList` with `estimatedItemSize`; `FlatList` for < 50 items. Stable `keyExtractor`.

## Common Mistakes to Avoid

| Mistake | Correct |
|---|---|
| `AsyncStorage` for tokens | `expo-secure-store` |
| Inline GraphQL in component | Move to `lib/api/` |
| Subscription without cleanup | Return cleanup from `useEffect` |
| Print error blocking order flow | Catch, log, and continue |
| Dynamic NativeWind classes | Static complete class strings |
| Separate state for push + subscription orders | One shared order queue in context |
| Missing `Idempotency-Key` on acceptance | Send UUID v4 header on every mutation |
