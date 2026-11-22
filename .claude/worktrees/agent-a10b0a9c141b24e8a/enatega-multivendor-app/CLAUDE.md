# enatega-multivendor-app — Claude Code Instructions

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

## Best Practices Docs

Read before writing or reviewing code:

- `../raw/best-practices-react-native.md` — project structure, navigation, state, lists, animations, secure storage, Expo SDK conventions, testing
- `../raw/best-practices-mobile.md` — offline-first, network awareness, performance, platform rules, accessibility, security, update strategy
- `../wiki/src-best-practices-react-native.md` — synthesized decisions for this stack
- `../wiki/src-best-practices-mobile.md` — offline-first architecture, network states, mutation queues
- `../wiki/engineering-best-practices-overview.md` — cross-stack engineering standards adapted for Enatega
- `../wiki/graphql-schema-compatibility.md` — client GraphQL contract and compatibility constraints

## Project Layout

```
src/
  apollo/               ← Apollo client setup, queries, mutations, subscriptions
  assets/               ← static assets
  components/           ← shared presentational components
  context/              ← React context providers (auth, cart, location, …)
  routes/               ← React Navigation stack/drawer/tab definitions
  screens/              ← screen components grouped by domain
  services/             ← Firebase, payment, non-GraphQL integrations
  ui/                   ← primitive UI components
  utils/                ← pure utility functions
App.js                  ← root entry; providers + NavigationContainer
environment.js          ← env var access (use `.example` as reference)
```

## Navigation (React Navigation)

- Navigation stacks are defined in `src/routes/`. Do not add navigation logic inside screen components.
- Keep all route names and params in a single typed `RootStackParamList` (or per-navigator param lists). Never pass params as untyped `any`.
- Use `navigation.reset()` after login so customers cannot navigate back to auth screens with the hardware back button.
- Drawer and bottom tabs are top-level navigators — do not nest tab navigators inside tab navigators.
- `useFocusEffect` for subscriptions and camera/location handles that must be released when a screen loses focus.

## State & Data Fetching

- Apollo Client for all GraphQL operations (queries, mutations, real-time subscriptions for order tracking and rider location).
- All GraphQL documents live in `src/apollo/`. Never define queries or mutations inline in screen components.
- Subscriptions (order status, rider location, chat) must be cleaned up when the screen unmounts or loses focus.
- Global state (auth session, cart, selected address, active order) in React Context (`src/context/`).
- Tokens go in `expo-secure-store`. Never `AsyncStorage` for authentication tokens.

## Styling

- Follow the newly added design system for all touched UI. Prefer existing `src/ui/` primitives, shared theme tokens, spacing, typography, colors, and component variants over local one-off styles.
- Refactor gradually toward the design system when touching old UI. Do not pause feature work for a sweeping redesign, but leave touched screens/components closer to the system unless doing so would create avoidable risk or a much larger diff.
- This project does not use NativeWind/Tailwind. Styles are defined with `StyleSheet.create` per component or in `src/ui/`.
- Platform differences: use `Platform.select({ ios: …, android: … })` in the style object — not inline `Platform.OS ===` conditionals in JSX.
- Safe area: use `SafeAreaView` or `useSafeAreaInsets()` on every screen. Never hardcode status bar or notch offsets.
- Mobile screen headers must always reserve top safe-area space for the status bar, phone clock, notch, and system indicators. Never place a custom header flush to the physical top edge.

## Offline / Network Awareness

- Subscribe to `@react-native-community/netinfo` for real-time connectivity.
- Order placement and payment mutations must not be silently dropped on network failure. Queue locally or surface a retry prompt.
- Cart state must survive an app restart — persist to `AsyncStorage` (non-sensitive) or context re-hydration.

## Security

- Tokens → `expo-secure-store` (`keychainAccessible: WHEN_UNLOCKED`). Never log token values, even in `__DEV__`.
- Payment details are handled by the payment SDK — never store card numbers or CVV in local state or `AsyncStorage`.
- Never expose raw Apollo/GraphQL error messages to the user — map to safe, actionable copy.

## Lists

- Never `ScrollView` + `.map()` for restaurant listings, menu items, or order history.
- Use `FlashList` (`@shopify/flash-list`) for large data sets. Provide `estimatedItemSize` and a stable `keyExtractor` (entity ID, not array index).
- Use `FlatList` for short, stable lists (< 50 items) where `FlashList` is overkill.

## Animations

- Use `react-native-reanimated` for all animations. Do not use the legacy `Animated` API.
- All animation work runs on the UI thread via `useSharedValue` + `useAnimatedStyle`.

## Accessibility

- Every interactive element needs `accessibilityLabel` and `accessibilityRole`.
- Minimum tap target: 44 × 44 dp. Use `hitSlop` when the visual size is smaller.
- Order status changes must be announced via `AccessibilityInfo.announceForAccessibility()`.

## Expo SDK Conventions

| Need | Use | Do not use |
|------|-----|-----------|
| Tokens | `expo-secure-store` | `AsyncStorage` |
| Notifications | `expo-notifications` | FCM SDK directly |
| Location | `expo-location` | bare RN location APIs |
| Animations | `react-native-reanimated` | `Animated` API |
| Images | `expo-image` | RN `Image` |
| Lists | `@shopify/flash-list` | `ScrollView` + map |
| Haptics | `expo-haptics` | `Vibration` API |

## Testing

- `jest-expo` preset for unit tests. Test context logic, cart calculations, retry logic.
- React Native Testing Library for component tests — assert by `accessibilityRole` and visible text. Do not test implementation details.
- Physical device test on iOS + Android before every release build.
