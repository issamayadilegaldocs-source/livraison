import { useState, useContext } from 'react'
import { useSignUp } from '@clerk/clerk-expo'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { emailRegex, passRegex, nameRegex, phoneRegex } from '../../utils/regex'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { useCountryFromIP } from '../../utils/useCountryFromIP'

const useRegister = () => {
  const navigation = useNavigation()
  const { t, i18n } = useTranslation()
  const route = useRoute()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState(route.params?.email || '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [firstnameError, setFirstnameError] = useState(null)
  const [lastnameError, setLastnameError] = useState(null)
  const [emailError, setEmailError] = useState(null)
  const [passwordError, setPasswordError] = useState(null)
  const [phoneError, setPhoneError] = useState(null)
  const [loading, setLoading] = useState(false)

  const {
    country,
    setCountry,
    currentCountry: countryCode,
    setCurrentCountry: setCountryCode,
    ipAddress,
    isLoading: isCountryLoading,
    error: countryError,
    refetch
  } = useCountryFromIP()

  const { signUp, isLoaded } = useSignUp()

  const onCountrySelect = (country) => {
    setCountryCode(country.cca2)
    setCountry(country)
  }

  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  function validateCredentials() {
    let result = true

    setEmailError(null)
    setPasswordError(null)
    setPhoneError(null)
    setFirstnameError(null)
    setLastnameError(null)

    if (!email) {
      setEmailError(t('emailErr1'))
      result = false
    } else if (!emailRegex.test(email.trim())) {
      setEmailError(t('emailErr2'))
      result = false
    }

    if (!password) {
      setPasswordError(t('passErr1'))
      result = false
    } else if (passRegex.test(password) !== true) {
      setPasswordError(t('passErr2'))
      result = false
    }

    if (!phone) {
      setPhoneError(t('mobileErr1'))
      result = false
    } else if (!phoneRegex.test(phone)) {
      setPhoneError(t('mobileErr2'))
      result = false
    }

    if (!firstname) {
      setFirstnameError(t('firstnameErr1'))
      result = false
    } else if (!nameRegex.test(firstname)) {
      setFirstnameError(t('firstnameErr2'))
      result = false
    }

    if (!lastname) {
      setLastnameError(t('lastnameErr1'))
      result = false
    } else if (!nameRegex.test(lastname)) {
      setLastnameError(t('lastnameErr2'))
      result = false
    }

    return result
  }

  async function registerAction() {
    if (!isLoaded || !validateCredentials()) return
    setLoading(true)
    try {
      const fullPhone = '+'.concat(country.callingCode[0], phone)

      await signUp.create({
        emailAddress: email.toLowerCase().trim(),
        password,
        firstName: firstname,
        lastName: lastname
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      navigation.navigate('EmailOtp', {
        user: {
          phone: fullPhone,
          email: email.toLowerCase().trim(),
          name: `${firstname} ${lastname}`
        }
      })
    } catch (error) {
      const msg = error.errors?.[0]?.longMessage ?? error.errors?.[0]?.message ?? t('phoneCheckingError')
      FlashMessage({ message: msg })
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    setEmail,
    emailError,
    firstname,
    setFirstname,
    firstnameError,
    lastname,
    setLastname,
    lastnameError,
    password,
    setPassword,
    passwordError,
    phone,
    setPhone,
    phoneError,
    showPassword,
    setShowPassword,
    country,
    countryCode,
    registerAction,
    onCountrySelect,
    themeContext,
    currentTheme,
    setPhoneError,
    isCountryLoading,
    loading
  }
}

export default useRegister
