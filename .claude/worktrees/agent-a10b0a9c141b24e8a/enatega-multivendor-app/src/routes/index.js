import React, { useCallback, useContext, useEffect } from 'react'
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import navigationService from './navigationService'
import * as Notifications from 'expo-notifications'
import Login from '../screens/Login/Login'
import Register from '../screens/Register/Register'
import ForgotPassword from '../screens/ForgotPassword/ForgotPassword'
import SetYourPassword from '../screens/ForgotPassword/SetYourPassword'
import CreateAccount from '../screens/CreateAccount/CreateAccount'
import ItemDetail from '../screens/ItemDetail/ItemDetail'
import MyOrders from '../screens/MyOrders/MyOrders'
import Cart from '../screens/Cart/Cart'
import SaveAddress from '../screens/SaveAddress/SaveAddress'
import RateAndReview from '../screens/RateAndReview/RateAndReview'
import Payment from '../screens/Payment/Payment'
import Help from '../screens/Help/Help'
import Paypal from '../screens/Paypal/Paypal'
import StripeCheckout from '../screens/Stripe/StripeCheckout'
import FlouciCheckout from '../screens/Flouci/FlouciCheckout'
import WalletTopUp from '../screens/Flouci/WalletTopUp'
import Profile from '../screens/Profile/Profile'
import Addresses from '../screens/Addresses/Addresses'
import NewAddress from '../screens/NewAddress/NewAddress'
import EditAddress from '../screens/EditAddress/EditAddress'
import CartAddress from '../screens/CartAddress/CartAddress'
import FullMap from '../screens/FullMap/FullMap'
import OrderDetail from '../screens/OrderDetail/OrderDetail'
import Settings from '../screens/Settings/Settings'
import HelpBrowser from '../screens/HelpBrowser/HelpBrowser'
import Home from '../screens/Home/Home'
import Restaurant from '../screens/Restaurant/Restaurant'
import About from '../screens/About'
import SelectLocation from '../screens/SelectLocation'
import AddNewAddress from '../screens/SelectLocation/AddNewAddress'
import CurrentLocation from '../screens/CurrentLocation'
import ThemeContext from '../ui/ThemeContext/ThemeContext'
import { theme } from '../utils/themeColors'
import screenOptions from './screenOptions'
import { LocationContext } from '../context/Location'
import Reorder from '../screens/Reorder/Reorder'
import NotificationsScreen from '../screens/Notifications/Notifications'
import Favourite from '../screens/Favourite/Favourite'
import ChatScreen from '../screens/ChatWithRider/ChatScreen'
import { DarkBackButton } from '../components/Header/HeaderIcons/HeaderIcons'
import EmailOtp from '../screens/Otp/Email/EmailOtp'
import PhoneOtp from '../screens/Otp/Phone/PhoneOtp'
import ForgotPasswordOtp from '../screens/Otp/ForgotPassword/ForgetPasswordOtp'
import PhoneNumber from '../screens/PhoneNumber/PhoneNumber'
import { useApolloClient, gql } from '@apollo/client'
import { myOrders } from '../apollo/queries'
import Checkout from '../screens/Checkout/Checkout'
import Menu from '../screens/Menu/Menu'
import Reviews from '../screens/Reviews'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import BottomTabIcon from '../components/BottomTabIcon/BottomTabIcon'
import { useTranslation } from 'react-i18next'
import Collection from '../screens/Collection/Collection'
import MapSection from '../screens/MapSection'
import Account from '../screens/Account/Account'
import EditName from '../components/Account/EditName/EditName'
import SearchScreen from '../screens/Search/SearchScreen'
import UserContext from '../context/User'
import { Animated, InteractionManager, Platform, StatusBar, StyleSheet, View } from 'react-native'
import CategoryPage from '../components/SubCategoryPage/SubCategoryPage'
import NewRestaurantDetailDesign from '../components/NewRestaurantDetailDesign/RestaurantDetailDesign'
import { SLIDE_RIGHT_WITH_CURVE_ANIM, SLIDE_UP_RIGHT_ANIMATION, AIMATE_FROM_CENTER, SLIDE_UP_RIGHT_ANIMATION_FIXED_HEADER, FAST_PROFILE_NAVIGATION_ANIMATION } from '../utils/constants'
import * as LocationImport from 'expo-location'
import TextDefault from '../components/Text/TextDefault/TextDefault'
import { BottomTabBarVisibilityProvider } from '../context/BottomTabBarVisibility'
import { floatingTabBarBottom } from '../utils/useTabBarSpace'

const NavigationStack = createStackNavigator()
const Tab = createBottomTabNavigator()

function MainNavigator({ initialRouteName = 'Main' }) {
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  return (
    <NavigationStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={screenOptions({
        theme: themeContext.ThemeValue,
        headerMenuBackground: currentTheme.headerMenuBackground,
        backColor: currentTheme.headerBackground,
        lineColor: currentTheme.horizontalLine,
        textColor: currentTheme.headerText,
        iconColor: currentTheme.iconColorPink,
        headerShown: false
      })}
    >
      {/* Location onboarding — entered first when permission/location is missing */}
      <NavigationStack.Screen name='CurrentLocation' component={CurrentLocation} options={{ header: () => null }} />
      <NavigationStack.Screen
        name='Main'
        component={BottomTabNavigator}
        options={{
          headerShown: false,
          gestureDirection: 'vertical-inverted',
          cardStyleInterpolator: CardStyleInterpolators.forScaleFromCenterAndroid
        }}
      />
      <NavigationStack.Screen name='Menu' component={Menu} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen
        name='NewRestaurantDetailDesign'
        component={NewRestaurantDetailDesign}
        options={{
          header: () => null,
          ...AIMATE_FROM_CENTER
        }}
      />
      <NavigationStack.Screen
        name='CategoryPage'
        component={CategoryPage}
        options={{
          header: () => null,
          ...SLIDE_RIGHT_WITH_CURVE_ANIM
        }}
      />
      <NavigationStack.Screen
        name='Restaurant'
        component={Restaurant}
        options={{
          header: () => null,
          ...AIMATE_FROM_CENTER
        }}
      />
      <NavigationStack.Screen name='ItemDetail' component={ItemDetail} options={{ animationEnabled: false }} />
      <NavigationStack.Screen name='Cart' component={Cart} options={SLIDE_UP_RIGHT_ANIMATION_FIXED_HEADER} />
      <NavigationStack.Screen name='Checkout' component={Checkout} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Profile' component={Profile} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='Addresses' component={Addresses} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='NewAddress' component={NewAddress} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='EditAddress' component={EditAddress} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='FullMap' component={FullMap} options={SLIDE_UP_RIGHT_ANIMATION} />
      <NavigationStack.Screen name='CartAddress' component={CartAddress} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Payment' component={Payment} />
      <NavigationStack.Screen
        name='OrderDetail'
        component={OrderDetail}
        options={{
          // headerTransparent: true,
          // headerRight: null,
          // title: '',
          headerBackImage: () =>
            DarkBackButton({
              iconColor: currentTheme.backIcon,
              iconBackground: currentTheme.backIconBackground
            }),
          ...SLIDE_RIGHT_WITH_CURVE_ANIM
        }}
      />
      <NavigationStack.Screen name='Settings' component={Settings} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='MyOrders' component={MyOrders} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='Reorder' component={Reorder} />
      <NavigationStack.Screen name='Notifications' component={NotificationsScreen} options={{ title: 'Notifications', ...FAST_PROFILE_NAVIGATION_ANIMATION }} />
      <NavigationStack.Screen name='Help' component={Help} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='HelpBrowser' component={HelpBrowser} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='About' component={About} options={{ header: () => null, ...SLIDE_RIGHT_WITH_CURVE_ANIM }} />
      <NavigationStack.Screen name='Reviews' component={Reviews} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Paypal' component={Paypal} />
      <NavigationStack.Screen name='RateAndReview' component={RateAndReview} />

      <NavigationStack.Screen name='StripeCheckout' component={StripeCheckout} />
      <NavigationStack.Screen name='FlouciCheckout' component={FlouciCheckout} />
      <NavigationStack.Screen name='WalletTopUp' component={WalletTopUp} />

      {/* Authentication Login */}
      <NavigationStack.Screen name='CreateAccount' component={CreateAccount} />
      <NavigationStack.Screen name='Login' component={Login} />
      <NavigationStack.Screen name='Register' component={Register} />
      <NavigationStack.Screen name='PhoneNumber' component={PhoneNumber} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='ForgotPassword' component={ForgotPassword} />
      <NavigationStack.Screen name='SetYourPassword' component={SetYourPassword} />
      <NavigationStack.Screen name='EmailOtp' component={EmailOtp} />
      <NavigationStack.Screen name='PhoneOtp' component={PhoneOtp} />
      <NavigationStack.Screen name='ForgotPasswordOtp' component={ForgotPasswordOtp} />
      <NavigationStack.Screen name='SelectLocation' component={SelectLocation} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='AddNewAddress' component={AddNewAddress} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='SaveAddress' component={SaveAddress} />
      <NavigationStack.Screen name='Favourite' component={Favourite} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='ChatWithRider' component={ChatScreen} />
      <NavigationStack.Screen name='Collection' component={Collection} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='MapSection' component={MapSection} options={SLIDE_UP_RIGHT_ANIMATION} />
      <NavigationStack.Screen name='Account' component={Account} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='EditName' component={EditName} options={FAST_PROFILE_NAVIGATION_ANIMATION} />
      <NavigationStack.Screen name='SearchScreen' component={SearchScreen} />
    </NavigationStack.Navigator>
  )
}

function BottomTabNavigator() {
  const { t } = useTranslation()
  const { profile: userProfile } = useContext(UserContext)
  const insets = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const isDark = themeContext.ThemeValue === 'Dark'
  const activeTabContentColor = currentTheme.white
  const [tabBarHidden, setTabBarHidden] = React.useState(false)
  const [activeTabName, setActiveTabName] = React.useState('Home')
  const forceTabBarVisible = activeTabName !== 'Home'
  const displayedTabBarHidden = forceTabBarVisible ? false : tabBarHidden
  // Tabs are lazy by default so the cold-start renders Home alone (fast). Once
  // Home has settled we flip to eager mounting so Map / Orders / Profile build
  // their component trees (and Map's native MapView) offscreen in the
  // background — making the first tab tap snappy instead of paying the mount
  // cost on tap. The extra delay after InteractionManager keeps the heavy
  // MapView out of Home's first paint.
  const [preloadTabs, setPreloadTabs] = React.useState(false)
  const tabBarAnimation = React.useRef(new Animated.Value(0)).current
  const tabBarBottom = floatingTabBarBottom(insets.bottom)
  const tabBarTranslateY = tabBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 76 + tabBarBottom]
  })
  const tabBarOpacity = tabBarAnimation.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [1, 0.92, 0]
  })

  React.useEffect(() => {
    Animated.timing(tabBarAnimation, {
      // Snap in when appearing, ease out more gently when hiding.
      toValue: displayedTabBarHidden ? 1 : 0,
      duration: displayedTabBarHidden ? 240 : 120,
      useNativeDriver: true
    }).start()
  }, [displayedTabBarHidden, tabBarAnimation])

  React.useEffect(() => {
    let timeoutId
    const task = InteractionManager.runAfterInteractions(() => {
      // Give Home's initial queries a beat to paint before mounting the rest.
      timeoutId = setTimeout(() => setPreloadTabs(true), 600)
    })
    return () => {
      task.cancel()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  return (
    <BottomTabBarVisibilityProvider hidden={displayedTabBarHidden} setHidden={setTabBarHidden} forceVisible={forceTabBarVisible}>
    <Tab.Navigator
      screenListeners={{
        state: (event) => {
          const state = event.data.state
          setActiveTabName(state.routes[state.index]?.name ?? 'Home')
        }
      }}
      screenOptions={({ route }) => ({
        // Lazy until Home settles, then eager so inactive tabs pre-mount in the
        // background (see preloadTabs). Already-mounted tabs are unaffected.
        lazy: !preloadTabs,
        tabBarIcon: ({ focused, color, size }) => {
          // synced with BottomTabIcon, make sure to have the same name as icon in BottomTabIcon
          const label = route.name === 'Profile' ? t('titleProfile') : route.name === 'Map' ? t('map') : t(route.name)
          return (
            <View
              style={[
                styles.tabPill,
                focused && [
                  styles.activeTabPill,
                  {
                    backgroundColor: currentTheme.black
                  }
                ]
              ]}
            >
              <BottomTabIcon name={route.name.toLowerCase()} size={18} color={focused ? activeTabContentColor : color} />
              {focused && (
                <TextDefault bold textColor={activeTabContentColor} numberOfLines={1} style={{ fontSize: 13 }}>
                  {label}
                </TextDefault>
              )}
            </View>
          )
        },
        tabBarStyle: [
          styles.floatingTabBar,
          {
            bottom: tabBarBottom,
            backgroundColor: currentTheme.cardBackground,
            borderColor: isDark ? currentTheme.lightHorizontalLine : currentTheme.borderColor,
            shadowColor: isDark ? currentTheme.white : currentTheme.shadowColor,
            opacity: tabBarOpacity,
            transform: [{ translateY: tabBarTranslateY }]
          }
        ],
        tabBarActiveTintColor: activeTabContentColor,
        tabBarInactiveTintColor: currentTheme.fontSecondColor,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center'
        },
        headerShown: false
      })}
    >
      <Tab.Screen
        name='Home'
        component={Home}
        options={{
          tabBarLabel: t('Home')
        }}
      />
      <Tab.Screen
        name='Map'
        component={MapSection}
        options={{
          tabBarLabel: t('map')
        }}
      />
      <Tab.Screen
        name='Orders'
        component={MyOrders}
        options={{
          tabBarLabel: t('Orders')
        }}
      />
      <Tab.Screen
        name='Profile'
        component={userProfile ? Profile : CreateAccount}
        options={{
          tabBarLabel: t('titleProfile')
        }}
      />
    </Tab.Navigator>
    </BottomTabBarVisibilityProvider>
  )
}

const styles = StyleSheet.create({
  floatingTabBar: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 52,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 26,
    borderTopWidth: 0,
    borderWidth: 1,
    elevation: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0,
    shadowRadius: 16
  },
  tabPill: {
    minWidth: 44,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  activeTabPill: {
    minWidth: 86,
    paddingHorizontal: 13
  }
})

// Global status-bar background. Expo SDK 56 enforces Android edge-to-edge, so
// the window draws behind the status bar on every screen and the legacy
// `StatusBar.setBackgroundColor()` calls in screens are silent no-ops. This
// opaque, theme-coloured strip reserves the top safe-area inset across the
// whole app so content (hero images, headers, lists) never sits under the
// phone clock/battery. Icon colour follows the active theme.
function StatusBarSpacer() {
  const insets = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const isDark = themeContext.ThemeValue === 'Dark'
  return (
    <>
      <StatusBar translucent backgroundColor='transparent' barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: currentTheme.themeBackground,
          zIndex: 9999,
          elevation: 9999
        }}
      />
    </>
  )
}

function AppContainer() {
  const client = useApolloClient()
  const { permissionState, setPermissionState, location } = useContext(LocationContext)
  const lastNotificationResponse = Notifications.useLastNotificationResponse()

  const [isLoadingPermission, setIsLoadingPermission] = React.useState(true)

  const handleNotification = useCallback(
    async(response) => {
      const data = response.notification.request.content.data
      // Order-status pushes (see orders.service.ts sendPushToUser calls) send
      // { type: 'ORDER_XXX', orderId } rather than { type: 'order', _id } —
      // fall back to orderId so every ORDER_* push (accepted/cancelled/
      // arrived/delayed/etc.) deep-links, not just a hypothetical 'order' type.
      const _id = data?.orderId ?? data?._id
      if (!_id) return
      const lastNotificationHandledId = await AsyncStorage.getItem('@lastNotificationHandledId')
      await client.query({
        query: gql`
          ${myOrders}
        `,
        fetchPolicy: 'network-only'
      })
      const identifier = response.notification.request.identifier
      if (lastNotificationHandledId === identifier) return
      await AsyncStorage.setItem('@lastNotificationHandledId', identifier)
      navigationService.navigate('OrderDetail', {
        _id
      })
    },
    [lastNotificationResponse]
  )

  // Handlers
  const init = async() => {
    try {
      const permissionStateResult = await LocationImport.getForegroundPermissionsAsync()
      console.log({ permissionStateResult })

      setPermissionState(permissionStateResult)
      setIsLoadingPermission(false)
    } finally {
      setIsLoadingPermission(false)
    }
  }

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    const notificationType = lastNotificationResponse?.notification.request.content.data?.type
    const isOrderNotification = notificationType === 'order' || (typeof notificationType === 'string' && notificationType.startsWith('ORDER_'))
    if (lastNotificationResponse && isOrderNotification && lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      handleNotification(lastNotificationResponse)
    }
  }, [lastNotificationResponse])

  console.log('-------------')
  console.log('-------------')
  console.log({ permissionState, location })

  if (isLoadingPermission) return

  // Single navigator for the whole app. When location/permission is missing we
  // simply start on the location-onboarding route; every screen (auth, cart,
  // etc.) stays registered so cross-screen navigation never hits an
  // "action not handled by any navigator" error.
  const needsLocation = !permissionState?.granted || !location

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <NavigationContainer
        ref={(ref) => {
          navigationService.setGlobalRef(ref)
        }}
      >
        <MainNavigator initialRouteName={needsLocation ? 'CurrentLocation' : 'Main'} />
      </NavigationContainer>
      {/* Rendered after the navigator so it overlays every screen's top inset. */}
      <StatusBarSpacer />
    </SafeAreaProvider>
  )
}

export default AppContainer
