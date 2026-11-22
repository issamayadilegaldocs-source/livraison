# enatega-multivendor-rider — AI Agent Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Expo (managed workflow) · Expo Router · React Native · Apollo Client · GraphQL · NativeWind · Firebase · `expo-secure-store` · `expo-location`

## Before Coding — Read the Docs

| Document | Content |
|---|---|
| `../raw/best-practices-react-native.md` | Project structure, navigation, state, lists, animations, secure storage, Expo SDK table, testing |
| `../raw/best-practices-mobile.md` | Offline-first, network awareness, performance, platform rules, security, update strategy |
| `../wiki/src-best-practices-react-native.md` | Synthesized Expo/RN decisions |
| `../wiki/src-best-practices-mobile.md` | Mutation queues, conflict resolution, network states |
| `../wiki/engineering-best-practices-overview.md` | Cross-stack engineering standards adapted for Enatega |
| `../wiki/graphql-schema-compatibility.md` | Rider app GraphQL contract and compatibility constraints |

## Project Structure

```
app/
  _layout.tsx           ← root layout + providers
  (tabs)/               ← bottom-tab group
  login/
  chat/
  order-detail/
  location/
lib/
  api/                  ← Apollo queries, mutations, subscriptions
  apollo/               ← Apollo client setup
  context/              ← auth session, active order state
  hooks/                ← custom hooks
  services/             ← Firebase, location, non-GraphQL
  ui/                   ← shared presentational components
  utils/                ← pure functions
```

## Rules

### Navigation

- File-based routing via Expo Router. Do not add manual `react-navigation` stacks.
- Type all route params with `useLocalSearchParams<T>()` — never untyped.
- `router.replace()` after login so riders can't navigate back to the login screen.

### Data & State

- Apollo Client for all GraphQL. Order-assignment subscriptions must be cleaned up on unmount.
- Auth tokens → `expo-secure-store` (`keychainAccessible: WHEN_UNLOCKED`). Never `AsyncStorage`.
- Global state in `lib/context/` (auth, active order, availability).

### NativeWind

- Static class strings only — never `` `text-${color}-500` ``.
- Do not mix `StyleSheet.create` and NativeWind on the same component.
- Platform differences: `Platform.select({ ios: '...', android: '...' })` — not inline `Platform.OS ===` in JSX.

### Location

- `expo-location` only. Release subscriptions when rider goes offline or app backgrounds.
- Background location requires `expo-task-manager` — never `setInterval`.
- Foreground permission before use; background permission only when actively delivering.

### Offline / Network

- Subscribe to `netinfo` for three-state connectivity: offline · unstable · online.
- Non-blocking banner for offline state — never a blocking modal.
- Queue outgoing status mutations locally; retry on reconnect. Do not silently drop updates.

### Expo SDK Conventions

| Need | Use | Avoid |
|---|---|---|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Location | `expo-location` | bare RN APIs |
| Notifications | `expo-notifications` | FCM SDK directly |
| Background | `expo-task-manager` | `setInterval` |
| Animations | `react-native-reanimated` | `Animated` |
| Images | `expo-image` | RN `Image` |

### Accessibility

- `accessibilityLabel` + `accessibilityRole` on every interactive element.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` when visual size is smaller.
- `AccessibilityInfo.announceForAccessibility()` on new order assignment.

### Lists

- Never `ScrollView` + `.map()` for variable-length lists.
- `FlashList` for large lists, `FlatList` for < 50 items.
- Stable `keyExtractor` (entity ID, not index). `estimatedItemSize` on FlashList.

## Common Mistakes to Avoid

| Mistake | Correct |
|---|---|
| `AsyncStorage` for tokens | `expo-secure-store` with `WHEN_UNLOCKED` |
| Inline GraphQL in component | Move to `lib/api/` |
| `setInterval` for location | `expo-task-manager` background task |
| Subscription without cleanup | Return cleanup function from `useEffect` |
| Dynamic NativeWind classes | Static complete class strings |
| Missing `accessibilityRole` | Explicit role on every interactive element |
| `ScrollView` + map for orders | `FlashList` with `estimatedItemSize` |
