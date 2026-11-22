import { ApolloProvider } from '@apollo/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import 'react-native-get-random-values';
// import 'expo-dev-client'
import * as Device from 'expo-device'
import * as Font from 'expo-font'
import * as Localization from 'expo-localization'
import * as Notifications from 'expo-notifications'
import * as Updates from 'expo-updates'
import React, { useEffect, useReducer, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, I18nManager, LogBox, Platform, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import FlashMessage from 'react-native-flash-message'
import 'react-native-gesture-handler'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
// import * as Sentry from '@sentry/react-native';
import { ClerkProvider } from '@clerk/clerk-expo'
import Constants from 'expo-constants'
import { tokenCache } from './src/utils/clerkTokenCache'
import useEnvVars, { isProduction } from './environment'
import setupApolloClient from './src/apollo/index'
import { MessageComponent } from './src/components/FlashMessage/MessageComponent'
import ReviewModal from './src/components/Review'
import { AuthProvider } from './src/context/Auth'
import { ConfigurationProvider } from './src/context/Configuration'
import { LocationProvider } from './src/context/Location'
import { OrdersProvider } from './src/context/Orders'
import { UserProvider } from './src/context/User'
import AppContainer from './src/routes'
import ThemeContext from './src/ui/ThemeContext/ThemeContext'
import ThemeReducer from './src/ui/ThemeReducer/ThemeReducer'
import { exitAlert } from './src/utils/androidBackButton'
import { NOTIFICATION_TYPES } from './src/utils/enums'
import { theme as Theme } from './src/utils/themeColors'
import { requestTrackingPermissions } from './src/utils/useAppTrackingTrasparency'
import { useKeepAwake } from 'expo-keep-awake'
import AnimatedSplashScreen from './src/components/Splash/AnimatedSplashScreen'
import useWatchLocation from './src/ui/hooks/useWatchLocation'
import { languageResources } from './i18next'
import * as SplashScreen from 'expo-splash-screen'
import TextDefault from './src/components/Text/TextDefault/TextDefault'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import * as Clarity from '@microsoft/react-native-clarity';

const CLERK_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.clerkPublishableKey ?? ''

if (!__DEV__) {
  Clarity.initialize('mcdyi6urgs', {
    logLevel: Clarity.LogLevel.None
  })
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    return {
      shouldShowAlert: notification?.request?.content?.data?.type !== NOTIFICATION_TYPES.REVIEW_ORDER,
      shouldPlaySound: false,
      shouldSetBadge: false
    }
  }
})

function AppContent() {
  const reviewModalRef = useRef()
  const [appIsReady, setAppIsReady] = useState(false)
  const [location, setLocation] = useState(null)
  const [orderId, setOrderId] = useState()
  const [isUpdating, setIsUpdating] = useState(false)
  const client = setupApolloClient()

  useKeepAwake()

  // The redesigned screens are light-only: surfaces are hardcoded white while
  // text colors come from the active theme. The `Dark` palette's gray tokens are
  // near-white, so following the device's dark mode makes that text vanish
  // (white-on-white). Pin to the light `Pink` theme until dark mode is fully
  // designed across the redesigned screens.
  const [theme, themeSetter] = useReducer(ThemeReducer, 'Pink')

  useEffect(() => {
    const loadAppData = async () => {
      await Font.loadAsync({
        MuseoSans300: require('./src/assets/font/MuseoSans/MuseoSans300.ttf'),
        MuseoSans500: require('./src/assets/font/MuseoSans/MuseoSans500.ttf'),
        MuseoSans700: require('./src/assets/font/MuseoSans/MuseoSans700.ttf')
      })

      // Keep native layout direction aligned with the app language. This must
      // default to English; forcing Arabic here persists RTL across restarts.
      const savedLang = await AsyncStorage.getItem('enatega-language')
      const systemLang = Localization?.locale?.split('-')[0]
      const availableLangs = Object.keys(languageResources)
      const effectiveLang =
        savedLang && availableLangs.includes(savedLang)
          ? savedLang
          : availableLangs.includes(systemLang)
            ? systemLang
            : 'en'
      const RTL_LANGS = ['ar', 'fa', 'ur', 'ps', 'ku']
      const shouldBeRTL = RTL_LANGS.includes(effectiveLang ?? '')
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL)
      }

      await getActiveLocation()
      setAppIsReady(true)
    }

    loadAppData()
    const backHandler = BackHandler.addEventListener('hardwareBackPress', exitAlert)

    if (!__DEV__) {
      Clarity.initialize('mcdyi6urgs', {
        logLevel: Clarity.LogLevel.None
      })
    }

    return () => {
      backHandler.remove()
    }
  }, [])

  useEffect(() => {
    if (!appIsReady) return
    const hideSplashScreen = async () => {
      await SplashScreen.hideAsync()
    }
    hideSplashScreen()
  }, [appIsReady])

  useEffect(() => {
    if (!location) return
    const saveLocation = async () => {
      await AsyncStorage.setItem('location', JSON.stringify(location))
    }
    saveLocation()
  }, [location])

  useEffect(() => {
    // eslint-disable-next-line no-undef
    if (__DEV__) return
    ;(async () => {
      const { isAvailable } = await Updates.checkForUpdateAsync()
      if (isAvailable) {
        try {
          setIsUpdating(true)
          const { isNew } = await Updates.fetchUpdateAsync()
          if (isNew) {
            await Updates.reloadAsync()
          }
        } catch (error) {
          console.log('error while updating app', JSON.stringify(error))
        } finally {
          setIsUpdating(false)
        }
      }
    })()
  }, [])

  useEffect(() => {
    const notifSub = Notifications.addNotificationReceivedListener((notification) => {
      if (notification?.request?.content?.data?.type === NOTIFICATION_TYPES.REVIEW_ORDER) {
        const id = notification?.request?.content?.data?._id
        if (id) {
          setOrderId(id)
          reviewModalRef?.current?.open()
        }
      }
    })

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response?.notification?.request?.content?.data?.type === NOTIFICATION_TYPES.REVIEW_ORDER) {
        const id = response?.notification?.request?.content?.data?._id
        if (id) {
          setOrderId(id)
          reviewModalRef?.current?.open()
        }
      }
    })
    return () => {
      notifSub.remove()
      responseSub.remove()
    }
  }, [])

  async function getActiveLocation() {
    try {
      const locationStr = await AsyncStorage.getItem('location')
      if (locationStr) {
        setLocation(JSON.parse(locationStr))
      }
    } catch (err) {
      console.log(err)
    }
  }

  const onOverlayPress = () => {
    reviewModalRef?.current?.close()
  }

  if (isUpdating) {
    return (
      <View style={[styles.flex, styles.mainContainer, { backgroundColor: Theme[theme].startColor }]}>
        <TextDefault textColor={Theme[theme].white} bold>
          Please wait while app is updating
        </TextDefault>
        <ActivityIndicator size='large' color={Theme[theme].white} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
    <ErrorBoundary>
      <AnimatedSplashScreen>
        <ApolloProvider client={client}>
          <ThemeContext.Provider value={{ ThemeValue: theme, dispatch: themeSetter }}>
            <StatusBar backgroundColor={Theme[theme].menuBar} barStyle={theme === 'Dark' ? 'light-content' : 'dark-content'} />
            <LocationProvider>
              <ConfigurationProvider>
                <AuthProvider>
                  <UserProvider>
                    <OrdersProvider>
                      <AppContainer />
                      <ReviewModal ref={reviewModalRef} onOverlayPress={onOverlayPress} theme={Theme[theme]} orderId={orderId} />
                    </OrdersProvider>
                  </UserProvider>
                </AuthProvider>
              </ConfigurationProvider>
            </LocationProvider>
            <FlashMessage MessageComponent={MessageComponent} />
          </ThemeContext.Provider>
        </ApolloProvider>
      </AnimatedSplashScreen>
    </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AppContent />
    </ClerkProvider>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  mainContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  }
})

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    const { status } = await Notifications.requestPermissionsAsync()

    if (existingStatus !== 'granted') {
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!')
    }
  } else {
    alert('Must use physical device for Push Notifications')
  }
}
