import React, { useLayoutEffect, useEffect, useRef } from 'react'
import {
  View,
  TouchableOpacity,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import styles from '../styles'
import Spinner from '../../../components/Spinner/Spinner'
import TextDefault from '../../../components/Text/TextDefault/TextDefault'
import { alignment } from '../../../utils/alignment'
import screenOptions from '../screenOptions'
import { OtpInput } from 'react-native-otp-entry'
import usePhoneOtp from './usePhoneOtp'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { scale } from '../../../utils/scaling'
import SignUpSvg from '../../../assets/SVG/imageComponents/SignUpSvg'

function PhoneOtp(props) {
  const {
    phone,
    otp,
    setOtp,
    otpError,
    seconds,
    loading,
    updateUserLoading,
    onCodeFilled,
    resendOtp,
    currentTheme,
    themeContext
  } = usePhoneOtp()

  const { t } = useTranslation()

  // react-native-otp-entry is uncontrolled; mirror externally-set codes
  // (e.g. the test-mode auto-fill when skipMobileVerification is on) into the
  // field via the ref, and skip the resulting onFilled so we don't submit twice
  // (the hook already submits the test code on its own timer).
  const otpRef = useRef(null)
  const lastTyped = useRef('')
  const skipNextFilled = useRef(false)

  const handleTextChange = (code) => {
    lastTyped.current = code
    setOtp(code)
  }

  const handleFilled = (code) => {
    if (skipNextFilled.current) {
      skipNextFilled.current = false
      return
    }
    onCodeFilled(code)
  }

  useEffect(() => {
    if (otp && otp !== lastTyped.current) {
      skipNextFilled.current = otp.length === 6
      otpRef.current?.setValue(otp)
      lastTyped.current = otp
    }
  }, [otp])

  useLayoutEffect(() => {
    props?.navigation.setOptions(
      screenOptions({
        iconColor: currentTheme.newIconColors,
        backColor: currentTheme.themeBackground,
        fontColor: currentTheme.newFontcolor,
        navigation: props?.navigation
      })
    )
  }, [props?.navigation])

  return (
    <SafeAreaView style={styles(currentTheme).safeAreaViewStyles}>
      <StatusBar
        backgroundColor={currentTheme.themeBackground}
        barStyle={
          themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
        }
      />

      <ScrollView
        style={styles().flex}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles(currentTheme).mainContainer}>
          <View style={styles().subContainer}>
            <View>
              <SignUpSvg fillColor={currentTheme.svgFill} strokeColor={currentTheme.newIconColor} />
            </View>
            <View>
              <TextDefault
                H2
                bolder
                textColor={currentTheme.newFontcolor}
                style={{
                  ...alignment.MTlarge,
                  ...alignment.MBmedium
                }}
                isRTL
              >
                {t('verifyPhone')}
              </TextDefault>
              <TextDefault
                H5
                bold
                textColor={currentTheme.color6}
                isRTL
                // style={{
                //   paddingBottom: scale(5)
                // }}
              >
                {t('enterOtp')}
              </TextDefault>
              {/* <TextDefault H5 bold textColor={currentTheme.fontfourthColor}>
                {phone}
              </TextDefault> */}
            </View>
            <View>
              <OtpInput
                ref={otpRef}
                numberOfDigits={6}
                autoFocus
                hideStick
                focusColor={currentTheme.iconColorPink}
                onTextChange={handleTextChange}
                onFilled={handleFilled}
                theme={{
                  containerStyle: styles().otpInput,
                  pinCodeContainerStyle: [
                    styles(currentTheme).otpBox,
                    otpError && styles(currentTheme).errorInput
                  ],
                  pinCodeTextStyle: {
                    color: currentTheme.newFontcolor
                  }
                }}
              />
              {otpError && (
                <TextDefault
                  style={styles().error}
                  bold
                  textColor={currentTheme.textErrorColor}
                >
                  {t('wrongOtp')}
                </TextDefault>
              )}
            </View>
          </View>
          <View>
            {loading ||
              (updateUserLoading && (
                <Spinner
                  backColor={currentTheme.themeBackground}
                  spinnerColor={currentTheme.main}
                  size='large'
                />
              ))}
          </View>
          <View style={styles().btnContainer}>
            <View style={alignment.MBxSmall}>
              <TextDefault
                center
                H4
                bold
                textColor={currentTheme.fontNewColor}
                style={alignment.MTsmall}
              >
                {seconds !== 0 ? `${t('retry')} ${seconds}s` : ''}
              </TextDefault>
            </View>
            <View>
              {loading || updateUserLoading ? (
                <Spinner
                  backColor={currentTheme.color3}
                  spinnerColor={currentTheme.color3}
                  size='small'
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles(currentTheme).btn,
                    seconds !== 0 && styles(currentTheme).disabledBtn
                  ]}
                  disabled={seconds !== 0}
                  onPress={() => resendOtp()}
                >
                  <TextDefault
                    H4
                    textColor={currentTheme.black}
                    style={alignment.MLsmall}
                    bold
                  >
                    {t('resendOtpBtn')}
                  </TextDefault>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
export default PhoneOtp
