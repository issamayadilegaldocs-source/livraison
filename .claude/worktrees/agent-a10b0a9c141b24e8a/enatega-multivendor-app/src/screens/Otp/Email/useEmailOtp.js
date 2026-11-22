import { useState, useContext, useEffect } from 'react'
import { useSignUp } from '@clerk/clerk-expo'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { theme } from '../../../utils/themeColors'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import UserContext from '../../../context/User'
import { useNavigation, useRoute } from '@react-navigation/native'
import analytics from '../../../utils/analytics'
import { useTranslation } from 'react-i18next'

const useEmailOtp = () => {
  const Analytics = analytics()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [seconds, setSeconds] = useState(30)
  const [user] = useState(route.params?.user)
  const { profile } = useContext(UserContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  const { signUp, setActive, isLoaded } = useSignUp()

  const onCodeFilled = async (otp_code) => {
    if (!isLoaded) return
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: otp_code })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })

        await Analytics.identify({ userId: result.createdSessionId }, result.createdSessionId)
        await Analytics.track(Analytics.events.USER_CREATED_ACCOUNT, {
          userId: result.createdSessionId,
          email: user?.email,
          type: 'email'
        })

        FlashMessage({ message: t('accountCreated') })

        navigation.navigate('PhoneOtp', {
          name: user?.name,
          phone: user?.phone
        })
      } else {
        setOtpError(true)
      }
    } catch {
      setOtpError(true)
    }
  }

  const resendOtp = async () => {
    if (!isLoaded) return
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setSeconds(30)
      FlashMessage({ message: t('otpSentToEmail') })
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
    seconds,
    profile,
    loading: !isLoaded,
    updateUserLoading: false,
    onCodeFilled,
    resendOtp,
    currentTheme,
    themeContext
  }
}

export default useEmailOtp
