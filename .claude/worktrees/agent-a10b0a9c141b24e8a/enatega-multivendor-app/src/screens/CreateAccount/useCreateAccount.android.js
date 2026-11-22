import { useEffect, useState, useContext } from 'react'
import { StatusBar, Platform } from 'react-native'
import { useOAuth } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import analytics from '../../utils/analytics'
import { useTranslation } from 'react-i18next'
import useEnvVars from '../../../environment'

WebBrowser.maybeCompleteAuthSession()

const REDIRECT_URL = Linking.createURL('/', { scheme: 'enategamultivendor' })

export const useCreateAccount = () => {
  const Analytics = analytics()
  const navigation = useNavigation()
  const { t, i18n } = useTranslation()
  const [enableApple, setEnableApple] = useState(false)
  const [loginButton, loginButtonSetter] = useState(null)
  const [loading, setLoading] = useState(false)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const { TERMS_AND_CONDITIONS, PRIVACY_POLICY } = useEnvVars()

  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' })

  useEffect(() => {
    checkIfSupportsAppleAuthentication()
  }, [])

  async function checkIfSupportsAppleAuthentication() {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync()
      setEnableApple(isAvailable)
    } catch {
      setEnableApple(false)
    }
  }

  const navigateToLogin = () => navigation.navigate('Login')
  const navigateToRegister = () => navigation.navigate('Register')
  const navigateToMain = () => navigation.navigate({ name: 'Main', merge: true })

  const signIn = async () => {
    try {
      loginButtonSetter('Google')
      setLoading(true)
      const { createdSessionId, setActive } = await startGoogleOAuthFlow({
        redirectUrl: REDIRECT_URL
      })
      if (createdSessionId) {
        await setActive({ session: createdSessionId })
        navigateToMain()
      }
    } catch {
      FlashMessage({ message: 'Google sign-in failed. Please try again.' })
    } finally {
      setLoading(false)
      loginButtonSetter(null)
    }
  }

  const appleSignIn = async () => {
    try {
      loginButtonSetter('Apple')
      setLoading(true)
      const { createdSessionId, setActive } = await startAppleOAuthFlow({
        redirectUrl: REDIRECT_URL
      })
      if (createdSessionId) {
        await setActive({ session: createdSessionId })
        navigateToMain()
      }
    } catch {
      FlashMessage({ message: 'Apple sign-in failed. Please try again.' })
    } finally {
      setLoading(false)
      loginButtonSetter(null)
    }
  }

  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.main)
    }
    StatusBar.setBarStyle(
      themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
    )
  })

  const openTerms = () => Linking.openURL(TERMS_AND_CONDITIONS)
  const openPrivacyPolicy = () => Linking.openURL(PRIVACY_POLICY)

  return {
    enableApple,
    loginButton,
    loginButtonSetter,
    loading,
    setLoading,
    themeContext,
    currentTheme,
    navigateToLogin,
    navigateToRegister,
    openTerms,
    openPrivacyPolicy,
    navigateToMain,
    navigation,
    signIn,
    appleSignIn
  }
}
