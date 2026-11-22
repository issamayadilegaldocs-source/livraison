import { useState, useContext } from 'react'
import { useSignIn } from '@clerk/clerk-expo'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

export const useResetYourPassword = () => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { signIn, setActive, isLoaded } = useSignIn()

  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  function validateCredentials() {
    let result = true
    setPasswordError(null)
    setConfirmPasswordError(null)
    if (!password) {
      setPasswordError(t('passErr1'))
      result = false
    } else {
      const passRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{7,}$/
      if (!passRegex.test(password)) {
        setPasswordError(t('passErr2'))
        result = false
      }
    }
    if (!confirmPassword) {
      setConfirmPasswordError(t('confirmPassRequired'))
      result = false
    }
    return result
  }

  async function resetYourPassword() {
    if (!isLoaded || !validateCredentials()) return
    if (password !== confirmPassword) {
      setConfirmPasswordError(t('passwordMustMatch'))
      return
    }
    setLoading(true)
    try {
      const result = await signIn.resetPassword({ password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        FlashMessage({ message: t('passwordResetSuccessfully') })
        navigation.navigate({ name: 'Main', merge: true })
      }
    } catch (error) {
      const msg = error.errors?.[0]?.longMessage ?? error.errors?.[0]?.message ?? t('somethingWentWrong')
      FlashMessage({ message: msg })
    } finally {
      setLoading(false)
    }
  }

  return {
    password,
    setPassword,
    confirmPassword,
    confirmPasswordError,
    setConfirmPassword,
    passwordError,
    resetYourPassword,
    currentTheme,
    themeContext,
    loading
  }
}
