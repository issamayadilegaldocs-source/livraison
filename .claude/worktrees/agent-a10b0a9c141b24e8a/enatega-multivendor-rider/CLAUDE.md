# enatega-multivendor-rider — Claude Code Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Expo (managed workflow) · Expo Router · React Native · Apollo Client · GraphQL · NativeWind · Firebase · `expo-secure-store` · `expo-location`

## Best Practices Docs

Read before writing or reviewing code:

- `../raw/best-practices-react-native.md` — project structure, navigation, state, lists, animations, secure storage, Expo SDK conventions, testing
- `../raw/best-practices-mobile.md` — offline-first, network awareness, performance, platform rules, accessibility, security, update strategy
- `../wiki/src-best-practices-react-native.md` — synthesized decisions for this stack
- `../wiki/src-best-practices-mobile.md` — offline-first architecture, mutation queues, conflict resolution
- `../wiki/engineering-best-practices-overview.md` — cross-stack engineering standards adapted for Enatega
- `../wiki/graphql-schema-compatibility.md` — rider app GraphQL contract and compatibility constraints

## Project Layout

```
app/
  _layout.tsx           ← root Expo Router layout + providers
  (tabs)/               ← bottom-tab navigator group
  login/
  chat/
  order-detail/
  location/
lib/
  api/                  ← Apollo queries, mutations, subscriptions
  apollo/               ← Apollo client setup
  assets/               ← static assets
  context/              ← React context providers
  hooks/                ← custom hooks
  services/             ← Firebase, location, non-GraphQL integrations
  ui/                   ← shared presentational components
  utils/                ← pure utility functions
```

## Navigation (Expo Router)

- All routing is **file-based** via Expo Router. Do not add `react-navigation` stacks manually — use `app/` file structure.
- Use `(tabs)` route group for bottom-tab sections. Use `(protected)` / `(un-protected)` groups for auth gating at the layout level.
- Type all route params. Use `useLocalSearchParams<T>()` with an explicit type argument — never untyped `any`.
- `navigation.replace()` after login so riders cannot swipe back to the login screen.

## State & Data Fetching

- Apollo Client for all GraphQL operations (queries, mutations, real-time subscriptions for order assignments).
- Order-assignment subscriptions must be cleaned up when the screen unmounts or the rider goes offline.
- Global client state (auth session, active order, availability toggle) in React Context (`lib/context/`).
- Use `expo-secure-store` for all tokens. Never `AsyncStorage` for sensitive data.

## NativeWind / Styling

- NativeWind is the styling system — use Tailwind class strings on RN components. Do not mix `StyleSheet.create` and NativeWind on the same component unless there is no alternative.
- Classes must be **static strings** — never construct class names dynamically (`` `text-${color}-500` ``).
- Platform-specific styles: use `Platform.select({ ios: '...', android: '...' })` in a variant map, not inline `Platform.OS ===` conditionals in render.

## Location & Maps

- `expo-location` for GPS tracking. Request `foreground` permission before use; request `background` permission only when the rider is on an active delivery and the feature requires it.
- Always release location subscriptions when the rider goes offline or the app backgrounds.
- Never hardcode polling intervals — use `expo-task-manager` for background location updates, not `setInterval`.

## Offline / Network Awareness

- Subscribe to `@react-native-community/netinfo` for real-time connectivity state.
- Distinguish three states: **offline**, **connected but API unreachable**, **fully online**.
- Show a non-blocking banner for offline/unstable — never a modal that blocks the rider's view.
- Outgoing status updates (accept, pick up, deliver) must be queued locally and retried on reconnect — do not drop them silently on network failure.

## Security

- Tokens → `expo-secure-store` with `keychainAccessible: WHEN_UNLOCKED`. Never log token values, even in `__DEV__`.
- Enforce HTTPS. Never disable certificate validation.
- Location data is PII — do not log raw GPS coordinates.

## Lists

- Never `ScrollView` + `.map()` for order history or any list of unknown length.
- Use `FlashList` (`@shopify/flash-list`) for large lists. Use `FlatList` for short stable lists (< 50 items).
- Always provide `keyExtractor` with a stable entity ID. Always provide `estimatedItemSize` (FlashList) or `getItemLayout` (FlatList).

## Accessibility

- Every interactive element needs `accessibilityLabel` and `accessibilityRole`.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` when the visual element is smaller.
- Immediately call `AccessibilityInfo.announceForAccessibility()` on new order assignment — rider may not be looking at the screen.

## Expo SDK Conventions

| Need | Use | Do not use |
|------|-----|-----------|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Location | `expo-location` | bare RN location APIs |
| Notifications | `expo-notifications` | FCM/APNs SDK directly |
| Background tasks | `expo-task-manager` | `setInterval` |
| Animations | `react-native-reanimated` | `Animated` API |
| Images | `expo-image` | RN `Image` |

## Testing

- `jest-expo` preset for unit tests. Test store/context logic, queue flush, and retry backoff.
- React Native Testing Library for component tests — assert by `accessibilityRole` and visible text.
- Physical device test on iOS + Android before every release build — simulators do not replicate GPS, haptics, or background behaviour.
