# Enatega Multivendor App Structure

This document summarizes the file layout and component organization for the `enatega-multivendor-app` mobile project.

## Project Type

`enatega-multivendor-app` is an Expo React Native application with generated native projects for Android and iOS. The app uses React Navigation, Apollo Client, React Context providers, Expo services, and feature-based screen/component folders.

## Top-Level Structure

```text
enatega-multivendor-app/
├── App.js                         # Root app component and provider composition
├── index.js                       # React Native entry registration
├── package.json                   # App scripts and dependencies
├── app.config.js                  # Expo dynamic config
├── app.json                       # Expo static config
├── babel.config.js                # Babel configuration
├── metro.config.js                # Metro bundler configuration
├── tsconfig.json                  # TypeScript configuration
├── environment.js                 # Runtime environment helper
├── i18n.js / i18next.js           # Internationalization setup
├── android/                       # Native Android project
├── ios/                           # Native iOS project
├── assets/                        # App-level static assets used by Expo/native config
├── patches/                       # patch-package dependency patches
├── plugins/                       # Expo config plugins
├── stubs/                         # Web/test/native module stubs
├── translations/                  # Locale translation files
└── src/                           # Main application source
```

Generated or dependency-heavy folders such as `.expo/`, `dist/`, `node_modules/`, native build outputs, and native dependency folders should not be treated as primary source structure.

## Source Structure

```text
src/
├── apollo/        # GraphQL client setup, queries, mutations, subscriptions
├── assets/        # Source-level images, SVGs, icons, gifs, and fonts
├── components/    # Shared and feature-specific reusable components
├── context/       # React Context providers for app-wide state
├── routes/        # Navigation stacks, tabs, screen options, navigation service
├── screens/       # Screen-level containers registered in navigation
├── services/      # Service modules for external/public access flows
├── types/         # Type definitions
├── ui/            # Lower-level UI primitives, theme context/reducer, custom hooks
└── utils/         # Utility functions, constants, styling helpers, maps, analytics
```

## Application Entry Flow

```text
index.js
└── App.js
    ├── ClerkProvider
    ├── ApolloProvider
    ├── ThemeContext.Provider
    ├── LocationProvider
    ├── ConfigurationProvider
    ├── AuthProvider
    ├── UserProvider
    ├── OrdersProvider
    ├── AppContainer from src/routes
    ├── ReviewModal
    └── FlashMessage
```

`App.js` is responsible for loading fonts, restoring stored location data, checking OTA updates, initializing analytics in production, configuring notifications, and composing global providers before rendering navigation.

## Navigation Structure

Navigation is centralized in `src/routes/index.js`.

```text
src/routes/
├── index.js              # Main stack navigator and bottom tab navigator
├── navigationService.js  # Imperative navigation helpers
└── screenOptions.js      # Shared screen option configuration
```

The app uses:

- A stack navigator for authentication, onboarding, restaurant, checkout, order, profile, address, map, help, and detail screens.
- A bottom tab navigator for the main user-facing tabs.
- Route-specific animation constants from `src/utils/constants.js`.
- Theme-aware screen options and tab styling through `ThemeContext`.

## Screen Folders

Screens live under `src/screens/`. Each folder usually contains one primary screen component plus local styles and optional hooks/options.

```text
src/screens/
├── About/
├── Account/
├── Addresses/
├── Cart/
├── CartAddress/
├── ChatWithRider/
├── Checkout/
├── Collection/
├── CreateAccount/
├── CurrentLocation/
├── EditAddress/
├── Favourite/
├── ForgotPassword/
├── FullMap/
├── Help/
├── HelpBrowser/
├── Home/
├── Hyp/
├── ItemDetail/
├── Login/
├── Main/
├── MapSection/
├── Menu/
├── MyOrders/
├── NewAddress/
├── OrderDetail/
├── Otp/
├── Payment/
├── Paypal/
├── PhoneNumber/
├── Profile/
├── RateAndReview/
├── Register/
├── Reorder/
├── Restaurant/
├── Reviews/
├── SaveAddress/
├── Search/
├── SelectLocation/
├── Settings/
└── Stripe/
```

Common screen file patterns:

- `<ScreenName>.js` for the main screen component.
- `styles.js` or `Styles.js` for screen-local styles.
- `screenOptions.js` or `navigationOptions.js` for navigation configuration.
- `use<ScreenName>.js` for screen-specific hooks.
- Platform-specific hooks such as `useCreateAccount.android.js`, `useCreateAccount.ios.js`, and `useCreateAccount.web.js`.

Some folders include legacy or alternate implementations such as `V2`, `Old`, `Temp`, `copy`, or backup files. Treat the route imports in `src/routes/index.js` as the source of truth for which screen variant is active.

## Component Folders

Reusable and feature-scoped components live under `src/components/`.

```text
src/components/
├── About/
├── Accordion/
├── Account/
├── Address/
├── BottomTabIcon/
├── Button/
├── Cart/
├── CartItem/
├── Checkout/
├── CollectionCard/
├── CustomizeComponents/
├── DeleteEditModal/
├── Drawer/
├── EmptyView/
├── ErrorBoundary/
├── ErrorView/
├── FavButton/
├── Filter/
├── FlashMessage/
├── Header/
├── Help/
├── ItemCards/
├── ItemDetail/
├── LanguageModalize/
├── Lists/
├── Main/
├── MyOrders/
├── NewRestaurantDetail/
├── NewRestaurantDetailDesign/
├── OrderDetail/
├── Picker/
├── Pickup/
├── Profile/
├── ReorderItem/
├── Restaurant/
├── RestaurantProductsScreenLoader/
├── Review/
├── SearchOverlay/
├── ShimmerImage/
├── Sidebar/
├── Spinner/
├── Splash/
├── SubCategoryPage/
├── Text/
├── Update/
└── WrapperView/
```

Component folder conventions:

- Most component folders contain a main component file and a colocated `styles.js`.
- Feature components are grouped by the screen or domain they support, such as `Cart`, `Checkout`, `Main`, `MyOrders`, `OrderDetail`, and `Restaurant`.
- Shared primitives are kept in folders such as `Button`, `Text`, `Spinner`, `EmptyView`, `ErrorView`, `WrapperView`, and `ShimmerImage`.
- Navigation-specific visual elements live in `BottomTabIcon`, `Header`, `Drawer`, and `Sidebar`.
- Restaurant browsing and ordering components are concentrated in `Main`, `Restaurant`, `NewRestaurantDetailDesign`, `SubCategoryPage`, `ItemCards`, and `ItemDetail`.
- Modal and overlay behavior is grouped in folders such as `DeleteEditModal`, `LanguageModalize`, `SearchOverlay`, `Review`, and `Update`.

## UI Primitives and Hooks

`src/ui/` contains lower-level UI building blocks, theme state, and reusable hooks.

```text
src/ui/
├── FdCheckbox/
├── FdRadioBtn/
├── FdSocialBtn/
├── FlashMessage/
├── ThemeContext/
├── ThemeReducer/
├── Triangle/
└── hooks/
```

Important hook files include:

- `useLocation.js`
- `useWatchLocation.js`
- `useGeocoding.js`
- `useRestaurant.js`
- `useRestaurantQueries.js`
- `useRestaurantOrderInfo.js`
- `useRestaurantScreenData.js`
- `useRestaurantScreenNewDesign.js`
- `useTheme.js`

## State and Data Layers

### GraphQL

```text
src/apollo/
├── index.js          # Apollo Client setup
├── queries.js        # GraphQL queries
├── mutations.js      # GraphQL mutations
├── subscriptions.js  # GraphQL subscriptions
└── publicAccess.js   # Public access GraphQL helpers
```

### Context Providers

```text
src/context/
├── Auth.js
├── BottomTabBarVisibility.js
├── Configuration.js
├── Location.js
├── Orders.js
└── User.js
```

These providers manage app-wide authentication, user profile, location, configuration, order state, and bottom tab visibility.

### Services

```text
src/services/
└── publicAcccessService.js
```

Service modules hold integration logic that does not belong directly inside screens or presentational components.

## Assets and Localization

```text
src/assets/
├── SVG/
├── font/
├── gifs/
├── icons/
└── images/

translations/
├── en.js
├── ar.js
├── de.js
├── es.js
└── ...
```

`src/assets/font/` includes bundled fonts loaded by `App.js`. `translations/` contains locale dictionaries used by the i18n setup.

## Utility Modules

`src/utils/` contains cross-cutting helpers and constants, including:

- App constants and enums.
- Theme colors, font styles, text styles, scaling, and alignment helpers.
- Map styles and location utilities.
- Analytics helpers.
- Authentication helpers such as Clerk token caching and JWT decoding.
- Network, country, currency, phone, and formatting helpers.
- App tracking transparency hooks.

## Practical Guidelines

- Add new navigable screens under `src/screens/<FeatureName>/` and register them in `src/routes/index.js`.
- Add reusable UI pieces under `src/components/<ComponentName>/` when they are feature-aware, or under `src/ui/` when they are low-level primitives.
- Keep screen-specific styles colocated with the screen folder.
- Keep shared app-wide state in `src/context/` only when multiple unrelated screens need it.
- Keep GraphQL operations in `src/apollo/` rather than embedding large query or mutation definitions inside components.
- Check `src/routes/index.js` before deleting or renaming screen/component files because route imports define the active app surface.
