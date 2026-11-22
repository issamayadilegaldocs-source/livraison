# enatega-multivendor-app — AI Agent Instructions

## Feature Parity

- If a query/mutation here needs an argument or field the backend (`enatega-multivendor-api`) doesn't support, **adapt the backend** to support it — do not strip the argument or feature from this app to silence schema errors.

## Stack

Expo (managed workflow) · React Navigation (Stack + Drawer + Bottom Tabs) · Apollo Client · GraphQL · React Native Reanimated · Firebase · `expo-secure-store` · `@shopify/flash-list`

## TypeScript Migration (gradual)

This app is mid-migration from JavaScript to TypeScript. The foundation is in place: `tsconfig.json` (`allowJs: true`, `strict: true`), `typescript` installed, and shared types under `src/types/` (`navigation.d.ts`, `theme.ts`). `.ts`/`.tsx` and `.js` coexist — never do a big-bang rewrite.

**Agent default:** JavaScript is legacy in this app. Existing `.js` files are compatibility debt, not a pattern to copy. When creating or touching source under `src/`, assume TypeScript is required unless a rule below explicitly allows deferring conversion.

Rules:
- **Every new source file is TypeScript** (`.ts` / `.tsx`). Do not create new `.js` or `.jsx` files in `src/`. If you accidentally create one, stop and convert it before continuing.
- **Convert every touched source file to TS by default** (`.ts` / `.tsx`) as part of normal work. Skip or defer only when the conversion would be harmful at that time, such as widening the behavioral blast radius, blocking an urgent fix, destabilizing generated/vendor-style code, or forcing a large cross-file migration that belongs in its own task. If you defer, state the reason explicitly in your final response.
- Keep TS migration gradual and scoped. Do not perform a repo-wide or directory-wide rewrite just to move to TypeScript. When converting, do it **properly** (real types, no blanket `any`) and keep behavioral changes easy to review; split conversion-only work into a separate commit when it would otherwise obscure the functional change.
- **Prefer converting leaf/shared modules first** — `utils/`, constants, `context/`, hooks — since typing them gives consumers types for free.
- Use the shared types: navigation params live in `src/types/navigation.d.ts` (route names already registered globally via `ReactNavigation.RootParamList` — use `useNavigation()` / `useRoute()` and they are typed). When you touch a screen, tighten its `UnrefinedParams` placeholder to the real param shape.
- Type theme via `ThemeColors` / `ThemeName` from `src/types/theme.ts`.
- Run `npm run typecheck` (`tsc --noEmit`) before committing TS changes. It must pass.
- Never use `any` to silence the compiler — use `unknown` + narrowing, a real type, or a `// TODO` placeholder type. This matches the existing rule: navigation params are never untyped `any`.

## Before Coding — Read the Docs

| Document | Content |
|---|---|
| `../raw/best-practices-react-native.md` | Project structure, navigation, state, lists, animations, secure storage, Expo SDK table, testing |
| `../raw/best-practices-mobile.md` | Offline-first, network awareness, performance, platform rules, security, update strategy |
| `../wiki/src-best-practices-react-native.md` | Synthesized Expo/RN decisions |
| `../wiki/src-best-practices-mobile.md` | Mutation queues, conflict resolution, network states |
| `../wiki/engineering-best-practices-overview.md` | Cross-stack engineering standards adapted for Enatega |
| `../wiki/graphql-schema-compatibility.md` | Client GraphQL contract and compatibility constraints |

## Project Structure

```
src/
  apollo/               ← ALL GraphQL documents + Apollo client setup
  components/           ← shared presentational components
  context/              ← auth, cart, location, active order
  routes/               ← React Navigation stack/drawer/tab definitions
  screens/              ← screen components by domain
  services/             ← Firebase, payment, non-GraphQL
  ui/                   ← primitive UI components
  utils/                ← pure functions
App.js                  ← root entry; providers + NavigationContainer
```

## Rules

### Navigation

- Navigation stacks defined in `src/routes/` — no navigation logic inside screens.
- Typed route params — never `any` for `route.params`.
- `navigation.reset()` after login (no back to auth with hardware back button).
- `useFocusEffect` to clean up subscriptions, camera, and location when screen loses focus.

### Data & State

- All GraphQL documents live in `src/apollo/`. Never inline queries in screen components.
- Subscriptions (order tracking, rider location, chat) must be cleaned up on unmount.
- Tokens → `expo-secure-store`. Never `AsyncStorage` for auth tokens.
- Global state in `src/context/` (auth, cart, active order, selected address).

### Styling

- Follow the newly added design system for all touched UI. Prefer existing `src/ui/` primitives, shared theme tokens, spacing, typography, colors, and component variants over local one-off styles.
- Refactor gradually toward the design system when touching old UI. Do not pause feature work for a sweeping redesign, but leave touched screens/components closer to the system unless doing so would create avoidable risk or a much larger diff.
- `StyleSheet.create` — no NativeWind/Tailwind in this project.
- Platform differences: `Platform.select({ ios: …, android: … })` in style objects.
- Wrap every screen in `SafeAreaView` or `useSafeAreaInsets()`. No hardcoded inset values.
- Mobile screen headers must always reserve top safe-area space for the status bar, phone clock, notch, and system indicators. Never place a custom header flush to the physical top edge.

### Offline / Network

- Subscribe to `netinfo` for connectivity state.
- Order and payment mutations must not be silently dropped on failure — queue or surface retry.
- Cart persists across restarts (`AsyncStorage` is acceptable for non-sensitive cart data).

### Expo SDK Conventions

| Need | Use | Avoid |
|---|---|---|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Notifications | `expo-notifications` | FCM SDK directly |
| Location | `expo-location` | bare RN APIs |
| Animations | `react-native-reanimated` | `Animated` |
| Images | `expo-image` | RN `Image` |
| Lists | `@shopify/flash-list` | `ScrollView` + map |
| Haptics | `expo-haptics` | `Vibration` |

### Lists

- Never `ScrollView` + `.map()` for restaurants, menu items, or order history.
- `FlashList` with `estimatedItemSize` and stable `keyExtractor` (entity ID, not index).
- `FlatList` for short stable lists (< 50 items).

### Animations

- `react-native-reanimated` only. No legacy `Animated` API.
- `useSharedValue` + `useAnimatedStyle` — all animation work on the UI thread.

### Accessibility

- `accessibilityLabel` + `accessibilityRole` on every interactive element.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` for smaller elements.
- `AccessibilityInfo.announceForAccessibility()` on order status changes.

## Common Mistakes to Avoid

| Mistake | Correct |
|---|---|
| `AsyncStorage` for auth tokens | `expo-secure-store` |
| Inline GraphQL in screen | Move to `src/apollo/` |
| Navigation logic in a screen | Move to `src/routes/` |
| Subscription without cleanup | `useFocusEffect` cleanup or `useEffect` cleanup |
| Legacy `Animated` API | `react-native-reanimated` |
| `ScrollView` + map for lists | `FlashList` with `estimatedItemSize` |
| Hardcoded safe area insets | `useSafeAreaInsets()` |
| Payment details in local state | Payment SDK only — never store card data |
