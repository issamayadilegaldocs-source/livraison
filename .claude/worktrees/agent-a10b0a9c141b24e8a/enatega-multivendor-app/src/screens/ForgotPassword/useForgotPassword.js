import { useState, useContext } from 'react'
import { useSignIn } from '@clerk/clerk-expo'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

export const useForgotPassword = () => {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const [email, setEmail] = useState(route.params?.email || '')
  const [emailError, setEmailError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { signIn, isLoaded } = useSignIn()

  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  function validateCredentials() {
    setEmailError(null)
    if (!email) {
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

  async function forgotPassword() {
    if (!isLoaded || !validateCredentials()) return
    setLoading(true)
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.toLowerCase().trim()
      })
      navigation.navigate('ForgotPasswordOtp', { email })
    } catch (error) {
      const msg = error.errors?.[0]?.longMessage ?? error.errors?.[0]?.message ?? t('somethingWentWrong')
      FlashMessage({ message: msg })
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    setEmail,
    emailError,
    forgotPassword,
    themeContext,
    currentTheme,
    loading
  }
}
