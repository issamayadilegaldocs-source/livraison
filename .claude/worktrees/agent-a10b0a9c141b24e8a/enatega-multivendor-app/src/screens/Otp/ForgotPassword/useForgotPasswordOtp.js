import { useState, useContext, useEffect } from 'react'
import { useSignIn } from '@clerk/clerk-expo'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { theme } from '../../../utils/themeColors'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

export const useForgotPasswordOtp = () => {
  const { t, i18n } = useTranslation()
  const route = useRoute()
  const navigation = useNavigation()
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [email] = useState(route?.params?.email)
  const [seconds, setSeconds] = useState(30)
  const [loading, setLoading] = useState(false)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const { signIn, isLoaded } = useSignIn()

  const onCodeFilled = async (code) => {
    if (!isLoaded) return
    setLoading(true)
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code
      })
      if (result.status === 'needs_new_password') {
        navigation.navigate('SetYourPassword', { email })
      } else {
        setOtpError(true)
      }
    } catch {
      setOtpError(true)
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (!isLoaded) return
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.toLowerCase().trim()
      })
      setSeconds(30)
      FlashMessage({ message: t('otpResentToEmail') })
    } catch {
      FlashMessage({ message: t('somethingWentWrong') })
    }
  }

  useEffect(() => {
    const myInterval = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1)
      }
      if (seconds === 0) {
        clearInterval(myInterval)
      }
    }, 1000)
    return () => {
      clearInterval(myInterval)
    }
  })

  return {
    otp,
    setOtp,
    otpError,
    setOtpError,
    seconds,
    setSeconds,
    currentTheme,
    loading,
    onCodeFilled,
    email,
    themeContext,
    resendOtp
  }
}
