// useCreateAccount.web.js — web variant. Mirrors the native Clerk OAuth flow so
// authentication goes through Clerk on every platform (no legacy `login` mutation,
// no removed AuthContext.setTokenAsync). Apple sign-in stays disabled on web.

import { useState, useContext } from 'react'
import { StatusBar } from 'react-native'
import { useAuth, useOAuth } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { useTranslation } from 'react-i18next'
import useEnvVars from '../../../environment'

// The OAuth flow reopens this app inside a popup once Google/Clerk finish. On
// web that popup must report the redirect back to the opener window and
// close itself — without this call the popup just sits there fully loaded
// (and already signed in), the opener's startOAuthFlow() promise never
// resolves, and a retry from the opener hits Clerk's "session already
// exists" error since the popup's OAuth already created the session.
WebBrowser.maybeCompleteAuthSession()

const REDIRECT_URL = Linking.createURL('/', { scheme: 'enategamultivendor' })

export const useCreateAccount = () => {
  const navigation = useNavigation()
  const { i18n } = useTranslation()
  const [enableApple] = useState(false) // Apple auth not available on web
  const [loginButton, loginButtonSetter] = useState(null)
  const [loading, setLoading] = useState(false)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const { TERMS_AND_CONDITIONS, PRIVACY_POLICY } = useEnvVars()

  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const { signOut } = useAuth()

  const navigateToLogin = () => navigation.navigate('Login')
  const navigateToRegister = () => navigation.navigate('Register')
  const navigateToMain = () => navigation.navigate({ name: 'Main', merge: true })

  const signIn = async () => {
    try {
      loginButtonSetter('Google')
      setLoading(true)
      let oauthResult
      try {
        oauthResult = await startGoogleOAuthFlow({ redirectUrl: REDIRECT_URL })
      } catch (error) {
        // A prior session (possibly a different account, e.g. the popup
        // completed sign-in but this tab wasn't notified, or the browser
        // already had a session from an earlier account) is blocking the new
        // sign-in attempt. Drop it and retry rather than silently continuing
        // as whoever was previously signed in.
        if (error?.errors?.[0]?.code === 'session_exists') {
          await signOut()
          oauthResult = await startGoogleOAuthFlow({ redirectUrl: REDIRECT_URL })
        } else {
          throw error
        }
      }
      const { createdSessionId, setActive } = oauthResult
      if (createdSessionId) {
        await setActive({ session: createdSessionId })
        navigateToMain()
      }
    } catch (error) {
      FlashMessage({ message: 'Google sign-in failed. Please try again.' })
    } finally {
      setLoading(false)
      loginButtonSetter(null)
    }
  }

  // Apple sign-in is unavailable on web; kept as a no-op so the shared
  // CreateAccount screen can destructure it safely.
  const appleSignIn = async () => {}

  useFocusEffect(() => {
    StatusBar.setBarStyle(themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content')
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
