/**
 * Central navigation param list for the customer app.
 *
 * Route names mirror `src/routes/index.js`. Params for most routes are not yet
 * typed — they are placeholders (`UnrefinedParams`) so navigation type-checks
 * without blocking the gradual migration. When you touch a screen, replace its
 * placeholder with the real param shape (or `undefined` if it takes none).
 *
 * Tightening a route here makes every `navigation.navigate(...)` call to it
 * type-checked across the whole app.
 */

/** Temporary stand-in for routes whose params have not been typed yet. */
type UnrefinedParams = Record<string, unknown> | undefined

export type RootStackParamList = {
  // Location onboarding
  CurrentLocation: undefined
  SelectLocation: UnrefinedParams
  AddNewAddress: UnrefinedParams

  // Bottom-tab container
  Main: undefined

  // Restaurant / catalog
  Menu: UnrefinedParams
  NewRestaurantDetailDesign: UnrefinedParams
  CategoryPage: UnrefinedParams
  Restaurant: UnrefinedParams
  ItemDetail: UnrefinedParams
  Collection: UnrefinedParams
  SearchScreen: UnrefinedParams

  // Cart / checkout
  Cart: UnrefinedParams
  Checkout: UnrefinedParams
  CartAddress: UnrefinedParams
  Payment: UnrefinedParams
  Paypal: UnrefinedParams
  StripeCheckout: UnrefinedParams
  FlouciCheckout: { _id: string }
  WalletTopUp: { link: string }

  // Orders
  MyOrders: UnrefinedParams
  OrderDetail: { _id: string }
  Reorder: UnrefinedParams
  RateAndReview: UnrefinedParams
  Reviews: UnrefinedParams
  ChatWithRider: UnrefinedParams

  // Addresses
  Addresses: UnrefinedParams
  NewAddress: UnrefinedParams
  EditAddress: UnrefinedParams
  SaveAddress: UnrefinedParams
  FullMap: UnrefinedParams
  MapSection: UnrefinedParams

  // Account / profile / settings
  Profile: UnrefinedParams
  Account: UnrefinedParams
  EditName: UnrefinedParams
  Settings: UnrefinedParams
  About: undefined
  Favourite: UnrefinedParams
  Help: UnrefinedParams
  HelpBrowser: UnrefinedParams

  // Authentication
  CreateAccount: UnrefinedParams
  Login: UnrefinedParams
  Register: UnrefinedParams
  PhoneNumber: UnrefinedParams
  ForgotPassword: UnrefinedParams
  SetYourPassword: UnrefinedParams
  EmailOtp: UnrefinedParams
  PhoneOtp: UnrefinedParams
  ForgotPasswordOtp: UnrefinedParams
}

export type BottomTabParamList = {
  Home: undefined
  Orders: undefined
  Profile: UnrefinedParams
}

// Makes `useNavigation()` / `navigation.navigate(...)` aware of the routes
// globally, without importing RootStackParamList in every screen.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export {}
