import { useState, useContext, useEffect, useRef } from 'react'
import { useAuth, useSignIn } from '@clerk/clerk-expo'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import analytics from '../../utils/analytics'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

export const useLogin = () => {
  const { t, i18n } = useTranslation()
  const Analytics = analytics()

  const navigation = useNavigation()
  const [email, setEmail] = useState('')
  const emailRef = useRef('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [emailError, setEmailError] = useState(null)
  const [passwordError, setPasswordError] = useState(null)
  const [registeredEmail, setRegisteredEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn, isLoaded: isAuthLoaded, signOut } = useAuth()

  useEffect(() => {
    if (isAuthLoaded && isSignedIn) {
      navigation.navigate({ name: 'Main', merge: true })
    }
  }, [isAuthLoaded, isSignedIn, navigation])

  const handleSetEmail = (newEmail) => {
    setEmail(newEmail)
    emailRef.current = newEmail
    if (emailError) setEmailError(null)
  }

  function validateEmail() {
    setEmailError(null)
    if (!email.trim()) {
      setEmailError(t('emailErr1'))
      return false
    }
    const emailRegex = /^\w+([\\.-]?\w+)*@\w+([\\.-]?\w+)*(\.\w{2,3})+$/
    if (!emailRegex.test(email)) {
      setEmailError(t('emailErr2'))
      return false
    }
    return true
  }

  function validateCredentials() {
    let result = validateEmail()
    setPasswordError(null)
    if (!password && registeredEmail) {
      setPasswordError(t('passErr1'))
      result = false
    }
    return result
  }

  // Step 1: validate email format only, advance to password field
  function checkEmailExist() {
    if (validateEmail()) {
      setRegisteredEmail(true)
    }
  }

  async function loginAction(emailVal, passwordVal) {
    if (!isLoaded || !isAuthLoaded || !validateCredentials()) return
    if (isSignedIn) {
      navigation.navigate({ name: 'Main', merge: true })
      return
    }
    setLoading(true)
    try {
      let result
      try {
        result = await signIn.create({
          identifier: emailVal,
          password: passwordVal
        })
      } catch (error) {
        // Clerk's client still has a stale session (isSignedIn hadn't finished
        // loading yet, or the user is intentionally switching accounts from an
        // already-signed-in browser tab). That stale session is NOT necessarily
        // the account being signed into here, so drop it and retry the sign-in
        // instead of silently continuing as whoever was previously signed in.
        if (error.errors?.[0]?.code === 'session_exists') {
          await signOut()
          result = await signIn.create({
            identifier: emailVal,
            password: passwordVal
          })
        } else {
          throw error
        }
      }

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        await Analytics.identify({ userId: result.createdSessionId }, result.createdSessionId)
        await Analytics.track(Analytics.events.USER_LOGGED_IN, { email: emailVal })
        navigation.navigate({ name: 'Main', merge: true })
      }
    } catch (error) {
      const msg = error.errors?.[0]?.longMessage ?? error.errors?.[0]?.message ?? t('errorInLoginError')
      // Clerk returns "password is incorrect" for wrong password, "Couldn't find your account" for unknown user
      if (msg.toLowerCase().includes("couldn't find") || msg.toLowerCase().includes('no account')) {
        navigation.navigate('Register', { email: emailRef.current })
      } else {
        FlashMessage({ message: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  function onBackButtonPressAndroid() {
    navigation.navigate({ name: 'Main', merge: true })
    return true
  }

  return {
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    emailError,
    passwordError,
    registeredEmail,
    currentTheme,
    loading,
    loginLoading: loading,
    loginAction,
    checkEmailExist,
    onBackButtonPressAndroid,
    emailRef,
    themeContext,
    handleSetEmail
  }
}
