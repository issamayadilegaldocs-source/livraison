import { View, StatusBar, Platform, KeyboardAvoidingView, TextInput, Share, TouchableOpacity, InteractionManager } from 'react-native'
import { Image } from 'expo-image'
import React, { useState, useContext, useLayoutEffect, useEffect, useRef, useCallback } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, useAnimatedRef, runOnJS } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, FontAwesome } from '@expo/vector-icons'

import styles from './styles'
import FrequentlyBoughtTogether from '../../components/ItemDetail/Section'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import ErrorView from '../../components/ErrorView/ErrorView'
import { theme } from '../../utils/themeColors'
import { scale } from '../../utils/scaling'
import analytics from '../../utils/analytics'
import navigationService from '../../routes/navigationService'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import UserContext from '../../context/User'
import ConfigurationContext from '../../context/Configuration'
import useNetworkStatus from '../../utils/useNetworkStatus'
import { confirmAction } from '../../utils/crossPlatformAlert'

function ItemDetail(props) {
  const { food, addons, options, restaurant } = props?.route?.params

  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const Analytics = analytics()
  const inset = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const isDarkTheme = themeContext.ThemeValue === 'Dark'
  const configuration = useContext(ConfigurationContext)
  const { restaurant: restaurantCart, setCartRestaurant, cart, addQuantity, addCartItem, instructions, setInstructions } = useContext(UserContext)
  const { isConnected: connect } = useNetworkStatus()

  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const S = styles(currentTheme)
  const P = S._palette

  // layout constants
  const NAV_H = scale(48)
  const HERO_H = scale(280)
  const TOP_OFFSET = inset.top + NAV_H

  // state
  const [selectedVariation, setSelectedVariation] = useState({
    ...food?.variations[0],
    addons: food?.variations[0].addons?.map((fa) => {
      const addon = addons?.find((a) => a._id === fa)
      const addonOptions = addon?.options?.map((ao) => options?.find((o) => o._id === ao))
      return { ...addon, options: addonOptions }
    })
  })
  const [selectedAddons, setSelectedAddons] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [scrolled, setScrolled] = useState(false)
  // Heavy parts of the screen (addon/option sections, related items) are deferred
  // until the push transition finishes so they don't build a large synchronous
  // tree on the JS thread mid-animation, which made entry feel laggy. The hero,
  // title, price and add-to-cart bar render immediately.
  const [bodyReady, setBodyReady] = useState(false)

  const scrollViewRef = useAnimatedRef()
  const addonRefs = useRef({})
  const scrolledRef = useRef(false)
  const scrollY = useSharedValue(0)

  const setScrolledState = (v) => {
    if (scrolledRef.current !== v) {
      scrolledRef.current = v
      setScrolled(v)
    }
  }

  // Only cross the UI→JS bridge when the "scrolled past hero" boolean flips,
  // not on every scroll frame (~60/s).
  const scrolledSV = useSharedValue(false)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
    const v = event.contentOffset.y > HERO_H - TOP_OFFSET
    if (v !== scrolledSV.value) {
      scrolledSV.value = v
      runOnJS(setScrolledState)(v)
    }
  })


  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setBodyReady(true))
    return () => task.cancel()
  }, [])

  useFocusEffect(
    useCallback(() => {
      // Status-bar area is now reserved by the global opaque StatusBarSpacer,
      // so icons follow the theme rather than the (no-longer-immersive) hero.
      StatusBar.setBarStyle(isDarkTheme ? 'light-content' : 'dark-content')
    }, [isDarkTheme])
  )
  useEffect(() => {
    StatusBar.setBarStyle(isDarkTheme ? 'light-content' : 'dark-content')
  }, [isDarkTheme])

  useEffect(() => {
    async function Track() {
      try {
        await Analytics.track(Analytics.events.OPENED_RESTAURANT_ITEM, {
          restaurantID: restaurant,
          foodID: food?._id,
          foodName: food?.title,
          foodRestaurantName: food?.restaurantName
        })
      } catch (e) {
        console.error('Analytics tracking failed:', e)
      }
    }
    Track()
    // eslint-disable-next-line
  }, [])

  // ── helpers ──
  const fmt = (n) => `${configuration?.currencySymbol ?? ''} ${parseFloat(n || 0).toFixed(2)}`

  function scrollToError(addonId, totalAddons) {
    setTimeout(() => {
      if (addonRefs.current[addonId] && scrollViewRef.current && totalAddons > 0) {
        addonRefs.current[addonId].measure((x, y, width, h, pageX, pageY) => {
          scrollViewRef.current.scrollTo({ y: Math.round(Math.max(0, pageY - HERO_H)), animated: true })
        })
      }
    }, 300)
  }

  function validateButton() {
    if (!selectedVariation) return false
    const validatedAddons = []
    selectedVariation?.addons?.forEach((addon) => {
      const selected = selectedAddons?.find((ad) => ad._id === addon._id)
      if (!selected && addon?.quantityMinimum === 0) validatedAddons.push(false)
      else if (selected && selected?.options?.length >= addon?.quantityMinimum && selected?.options?.length <= addon?.quantityMaximum) validatedAddons.push(false)
      else validatedAddons.push(true)
    })
    return validatedAddons.every((val) => val === false)
  }

  function validateOrderItem() {
    let hasError = false
    const validatedAddons = selectedVariation?.addons?.map((addon) => {
      const selected = selectedAddons?.find((ad) => ad._id === addon._id)
      if (!selected && addon?.quantityMinimum === 0) addon.error = false
      else if (selected && selected?.options?.length >= addon?.quantityMinimum && selected?.options?.length <= addon?.quantityMaximum) addon.error = false
      else {
        addon.error = true
        if (!hasError) {
          hasError = true
          scrollToError(addon._id, selectedVariation?.addons?.length)
        }
      }
      return addon
    })
    setSelectedVariation({ ...selectedVariation, addons: validatedAddons })
    return !hasError
  }

  async function onPressAddToCart() {
    if (!validateOrderItem()) return
    Analytics.track(Analytics.events.ADD_TO_CART, {
      title: food?.title,
      restaurantName: food?.restaurantName,
      variations: food?.variations
    })
    if (!restaurantCart || restaurant === restaurantCart) {
      await addToCart(quantity, restaurant !== restaurantCart)
    } else {
      // Cart belongs to another restaurant: confirm before starting over.
      // (Plain `else` — the old `else if (food?.restaurant !== restaurantCart)`
      // could match neither branch and silently drop the tap.)
      confirmAction({
        message: t('cartClearWarning'),
        cancelText: t('Cancel'),
        confirmText: t('okText'),
        onConfirm: () => addToCart(quantity, true),
        destructive: true
      })
    }
  }

  const addToCart = async(qty, clearFlag) => {
    const mappedAddons = selectedAddons.map((addon) => ({
      ...addon,
      options: addon?.options?.map(({ _id }) => ({ _id }))
    }))
    const cartItem = clearFlag
      ? null
      : cart.find((ci) => {
        if (ci?._id === food?._id && ci?.variation?._id === selectedVariation?._id) {
          if (ci?.addons?.length === mappedAddons?.length) {
            if (mappedAddons?.length === 0) return true
            return mappedAddons?.every((newAddon) => {
              const cartAddon = ci.addons?.find((ad) => ad._id === newAddon._id)
              if (!cartAddon) return false
              return newAddon?.options?.every((newOption) => cartAddon?.options?.find((op) => op._id === newOption._id))
            })
          }
        }
        return false
      })

    if (!cartItem) {
      await setCartRestaurant(restaurant)
      await addCartItem(food?._id, selectedVariation?._id, qty, mappedAddons, clearFlag, instructions)
    } else {
      await addQuantity(cartItem?.key, qty)
    }
    navigation.goBack()
  }

  const onSelectVariation = (variation) => {
    if (!variation?._id) return
    setSelectedVariation({
      ...variation,
      addons: variation?.addons?.map((fa) => {
        const addon = addons?.find((a) => a._id === fa)
        const addonOptions = addon?.options?.map((ao) => options?.find((o) => o._id === ao))
        return { ...addon, options: addonOptions }
      })
    })
  }

  async function onSelectOption(addon, option) {
    const index = selectedAddons?.findIndex((ad) => ad._id === addon._id)
    if (index > -1) {
      if (addon?.quantityMinimum === 1 && addon?.quantityMaximum === 1) {
        selectedAddons[index].options = [option]
      } else {
        const optionIndex = selectedAddons[index].options?.findIndex((opt) => opt._id === option._id)
        if (optionIndex > -1) selectedAddons[index].options = selectedAddons[index].options?.filter((opt) => opt._id !== option._id)
        else selectedAddons[index].options?.push(option)
        if (!selectedAddons[index].options?.length) selectedAddons.splice(index, 1)
      }
    } else {
      selectedAddons.push({ _id: addon._id, options: [option] })
    }
    setSelectedAddons([...selectedAddons])
  }

  const calculatePrice = useCallback(() => {
    const variation = selectedVariation.price
    let add = 0
    selectedAddons.forEach((addon) => {
      add += addon?.options?.reduce((acc, option) => acc + option?.price, 0)
    })
    return (variation + add).toFixed(2)
    // eslint-disable-next-line
  }, [selectedVariation, selectedAddons])

  const onShare = async() => {
    try {
      await Share.share({ message: `${food?.title}${food?.restaurantName ? ` · ${food?.restaurantName}` : ''}` })
    } catch (e) {
      // no-op
    }
  }

  if (!connect) return <ErrorView />

  const heroImg = food?.image && food.image.trim() !== '' ? food.image : null
  const unitPrice = parseFloat(calculatePrice())
  const totalPrice = unitPrice * quantity
  const canAdd = validateButton()

  const Badge = ({ required, label }) => (
    <View style={[S.badge, required ? S.badgeRequired : S.badgeOptional]}>
      {required && <Ionicons name='checkmark' size={scale(12)} color={P.positive} />}
      <TextDefault textColor={required ? P.positive : currentTheme.fontNewColor} style={{ fontSize: scale(12) }} bolder={required} bold>
        {label}
      </TextDefault>
    </View>
  )

  const OptionRow = ({ selected, multi, name, priceLabel, onPress }) => (
    <TouchableOpacity activeOpacity={0.7} style={S.optionRow} onPress={onPress} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }}>
      <View style={S.optionLeft}>
        {multi
          ? (
          <View style={[S.checkOuter, selected && S.checkOuterSelected]}>{selected && <Ionicons name='checkmark' size={scale(14)} color={P.onAccent} />}</View>
            )
          : (
          <View style={[S.radioOuter, selected && S.radioOuterSelected]}>{selected && <View style={S.radioInner} />}</View>
            )}
        <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(15), flexShrink: 1 }} bold isRTL numberOfLines={2}>
          {name}
        </TextDefault>
      </View>
      {!!priceLabel && (
        <TextDefault textColor={currentTheme.fontThirdColor} style={{ fontSize: scale(15) }} bold>
          {priceLabel}
        </TextDefault>
      )}
    </TouchableOpacity>
  )

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={S.screen}>
      <View style={S.screen}>
        {/* ── Fixed nav ── */}
        <View style={[S.navOverlay, { paddingTop: inset.top, height: TOP_OFFSET }, scrolled && S.navSolid]}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[S.circleBtn, scrolled ? S.circleBtnSolid : S.circleBtnScrim]}
            onPress={() => navigationService.goBack()}
            accessibilityRole='button'
            accessibilityLabel={t('back')}
          >
            <Ionicons name='chevron-back' size={scale(20)} color={scrolled ? currentTheme.newIconColor : '#fff'} />
          </TouchableOpacity>
          <View style={S.navTitle} pointerEvents='none'>
            {scrolled && (
              <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(15), textAlign: 'center' }} bolder numberOfLines={1}>
                {food?.title}
              </TextDefault>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[S.circleBtn, scrolled ? S.circleBtnSolid : S.circleBtnScrim]}
            onPress={onShare}
            accessibilityRole='button'
            accessibilityLabel={t('share')}
          >
            <Ionicons name='share-social-outline' size={scale(16)} color={scrolled ? currentTheme.newIconColor : '#fff'} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={S.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: scale(120) + inset.bottom }}
          keyboardShouldPersistTaps='handled'
        >
          {/* ── Hero ── */}
          <View style={S.hero}>
            {heroImg
              ? (
              <Image source={{ uri: heroImg }} style={S.heroImage} contentFit='cover' transition={150} cachePolicy='memory-disk' />
                )
              : (
              <View style={[S.heroImage, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name='fast-food-outline' size={scale(40)} color='rgba(255,255,255,0.25)' />
              </View>
                )}
            <LinearGradient colors={['transparent', P.surface]} style={S.heroFade} pointerEvents='none' />
          </View>

          {/* ── Item info ── */}
          <View style={S.infoCard}>
            <View style={S.infoTitleRow}>
              <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(22), letterSpacing: -0.5, flex: 1 }} bolder isRTL>
                {food?.title}
              </TextDefault>
              <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(18) }} bolder>
                {fmt(selectedVariation?.price)}
              </TextDefault>
            </View>
            {!!food?.description && (
              <TextDefault textColor={currentTheme.fontNewColor} style={{ fontSize: scale(13), lineHeight: scale(20), marginBottom: scale(13) }} isRTL>
                {food?.description}
              </TextDefault>
            )}
            <View style={S.tagsRow}>
              <View style={S.tag}>
                <FontAwesome name='star' size={scale(11)} color={P.star} />
                <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(12) }} bold>
                  {t('Popular')}
                </TextDefault>
              </View>
            </View>
          </View>

          {/* ── Variation ── */}
          {food?.variations?.length > 1 && (
            <View style={S.section}>
              <View style={S.sectionHead}>
                <View>
                  <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(16) }} bolder isRTL>
                    {t('SelectVariation')}
                  </TextDefault>
                  <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12), marginTop: scale(2) }} isRTL>
                    {t('SelectOne')}
                  </TextDefault>
                </View>
                <Badge required label={t('Required')} />
              </View>
              {food?.variations?.map((v) => (
                <OptionRow
                  key={v._id}
                  selected={selectedVariation?._id === v._id}
                  name={v.title}
                  priceLabel={fmt(v.price)}
                  onPress={() => onSelectVariation(food?.variations.find((x) => x._id === v._id))}
                />
              ))}
            </View>
          )}

          {/* ── Addons / modifiers ── (deferred until transition completes) */}
          {bodyReady && selectedVariation?.addons?.map((addon) => {
            const multi = !(addon?.quantityMinimum === 1 && addon?.quantityMaximum === 1)
            const required = addon?.quantityMinimum > 0
            const selectedAddon = selectedAddons?.find((ad) => ad._id === addon._id)
            return (
              <View
                key={addon?._id}
                style={S.section}
                ref={(r) => {
                  if (r) addonRefs.current[addon._id] = r
                }}
              >
                <View style={S.sectionHead}>
                  <View style={{ flex: 1 }}>
                    <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(16) }} bolder isRTL numberOfLines={1}>
                      {addon?.title}
                    </TextDefault>
                    {!!addon?.description && (
                      <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12), marginTop: scale(2) }} isRTL numberOfLines={1}>
                        {addon?.description}
                      </TextDefault>
                    )}
                  </View>
                  <Badge required={required} label={required ? `${addon?.quantityMinimum} ${t('Required')}` : t('optional')} />
                </View>
                {addon?.options?.map((option) => {
                  const isSel = !!selectedAddon?.options?.find((o) => o._id === option._id)
                  return (
                    <OptionRow
                      key={option._id}
                      selected={isSel}
                      multi={multi}
                      name={option.title}
                      priceLabel={option.price > 0 ? `+ ${fmt(option.price)}` : fmt(0)}
                      onPress={() => onSelectOption(addon, option)}
                    />
                  )
                })}
                {addon.error && (
                  <TextDefault small textColor={currentTheme.textErrorColor} style={S.errorText} isRTL>
                    {t('selectOptionforAddon')}
                  </TextDefault>
                )}
              </View>
            )
          })}

          {/* ── Special instructions ── */}
          <View style={[S.section, { paddingBottom: scale(20) }]}>
            <View style={S.sectionHead}>
              <View>
                <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(16) }} bolder isRTL>
                  {t('specialInstructions')}
                </TextDefault>
                <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12), marginTop: scale(2) }} isRTL>
                  {t('anySpecificPreferences')}
                </TextDefault>
              </View>
              <Badge label={t('optional')} />
            </View>
            <TextInput
              style={S.input}
              placeholder={t('noMayo')}
              placeholderTextColor={currentTheme.fontSecondColor}
              multiline
              maxLength={144}
              value={instructions}
              onChangeText={setInstructions}
            />
            <View style={S.instrHint}>
              <Ionicons name='information-circle-outline' size={scale(13)} color={currentTheme.fontSecondColor} style={{ marginTop: scale(1) }} />
              <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12), lineHeight: scale(17), flex: 1 }} isRTL>
                {t('youMayBeChargedForExtras', { defaultValue: 'You may be charged for extras.' })}
              </TextDefault>
            </View>
          </View>

          {/* ── Frequently bought together ── (deferred until transition completes) */}
          {bodyReady && <FrequentlyBoughtTogether itemId={food?._id} restaurantId={restaurant} />}
        </Animated.ScrollView>

        {/* ── Fixed bottom bar ── */}
        <View style={[S.bottomBar, { paddingBottom: inset.bottom + scale(12) }]}>
          <View style={S.stepper}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={S.stepperBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              accessibilityRole='button'
              accessibilityLabel={t('decrease')}
            >
              <Ionicons name='remove' size={scale(18)} color={quantity <= 1 ? '#D8D8D8' : P.accent} />
            </TouchableOpacity>
            <TextDefault textColor={currentTheme.fontMainColor} style={[{ fontSize: scale(16) }, S.stepperQty]} bolder>
              {quantity}
            </TextDefault>
            <TouchableOpacity activeOpacity={0.7} style={S.stepperBtn} onPress={() => setQuantity((q) => q + 1)} accessibilityRole='button' accessibilityLabel={t('increase')}>
              <Ionicons name='add' size={scale(18)} color={P.accent} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.85} style={[S.cta, !canAdd && S.ctaDisabled]} onPress={onPressAddToCart} accessibilityRole='button'>
            <TextDefault textColor={P.onAccent} style={{ fontSize: scale(15) }} bolder>
              {t('addToCart')}  ·  {fmt(totalPrice)}
            </TextDefault>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

export default ItemDetail
