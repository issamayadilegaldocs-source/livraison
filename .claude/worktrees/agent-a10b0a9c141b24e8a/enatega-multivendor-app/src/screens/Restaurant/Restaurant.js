import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import React, { useState, useContext, useEffect, useRef, useCallback } from 'react'
import { View, TouchableOpacity, StatusBar, SectionList, ScrollView, FlatList } from 'react-native'
import { Image } from 'expo-image'
import Animated, { Extrapolation, interpolate, useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Placeholder, PlaceholderMedia, PlaceholderLine, Fade } from 'rn-placeholder'
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons'
import { gql, useApolloClient, useQuery, useSubscription } from '@apollo/client'
import { useTranslation } from 'react-i18next'

import TextDefault from '../../components/Text/TextDefault/TextDefault'
import TextError from '../../components/Text/TextError/TextError'
import Search from '../../components/Main/Search/Search'
import Spinner from '../../components/Spinner/Spinner'
import ConfigurationContext from '../../context/Configuration'
import UserContext from '../../context/User'
import { useRestaurant } from '../../ui/hooks'
import { useFavorite } from '../../components/FavButton/useFavorite'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { scale } from '../../utils/scaling'
import { theme } from '../../utils/themeColors'
import { IMAGE_LINK } from '../../utils/constants'
import { escapeRegExp } from '../../utils/regex'
import { isOpen, formatTimeSlot } from '../../utils/customFunctions'
import { confirmAction, showAlert } from '../../utils/crossPlatformAlert'
import analytics from '../../utils/analytics'
import { popularItems as popularItemsQuery, food, restaurantHeader, FOOD_STOCK_CHANGED } from '../../apollo/queries'
import styles from './styles'

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList)
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 20 }

const POPULAR_ITEMS = gql`
  ${popularItemsQuery}
`
const FOOD = gql`
  ${food}
`
const RESTAURANT_HEADER = gql`
  ${restaurantHeader}
`

function Restaurant(props) {
  const { _id: restaurantId } = props.route.params
  const Analytics = analytics()
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const propsData = route.params

  const insets = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const isDarkTheme = themeContext.ThemeValue === 'Dark'
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }
  const S = styles(currentTheme)
  const P = S._palette

  const configuration = useContext(ConfigurationContext)
  const { restaurant: restaurantCart, cartCount, clearCart, checkItemCart, cart, isPickup, setIsPickup } = useContext(UserContext)

  // ── layout constants ──
  const APP_BAR_H = scale(52)
  const TAB_STRIP_H = scale(46)
  const HERO_H = scale(210)
  const TOP_OFFSET = insets.top + APP_BAR_H
  // Flip into sticky mode exactly when the hero image clears the bar, so the
  // solid background appears before scrolled content can bleed through it.
  const TAB_THRESHOLD = HERO_H - TOP_OFFSET
  // precomputed for worklets (scale() can't run on the UI thread)
  const TAB_FADE = scale(24)
  const TAB_SLIDE = scale(8)

  // ── data ──
  const { data, refetch, networkStatus, loading, error } = useRestaurant(propsData._id, 'cache-and-network')
  const client = useApolloClient()
  const { data: popularData } = useQuery(POPULAR_ITEMS, { variables: { restaurantId } })

  // Real-time stock update: when the vendor toggles a food item out-of-stock,
  // update the Apollo cache so the menu greyed out immediately — no refresh needed.
  useSubscription(FOOD_STOCK_CHANGED, {
    variables: { restaurantId },
    onData: ({ client: c, data: { data: subData } }) => {
      const payload = subData?.foodStockChanged
      if (!payload) return
      c.cache.modify({
        id: `Food:${payload.foodId}`,
        fields: {
          isOutOfStock: () => payload.isOutOfStock,
        },
      })
    },
  })

  const fetchFoodDetails = (itemId) => client.readFragment({ id: `Food:${itemId}`, fragment: FOOD })
  const dataList = popularData?.popularItems?.map((item) => fetchFoodDetails(item?.id)).filter(Boolean)

  const restaurant = data?.restaurant
  // Deep-link / cold-cache fallback: when the screen is opened without the preview
  // route params (e.g. from a notification), fetch the slim header-only query so
  // the header still paints fast while the full menu query loads. Skipped in the
  // normal tap-from-feed flow where params already carry every header field.
  const { data: headerData } = useQuery(RESTAURANT_HEADER, {
    variables: { id: propsData?._id },
    skip: !!propsData?.name || !propsData?._id,
    fetchPolicy: 'cache-first'
  })
  // Merged header view: full query wins; else the route-params preview
  // (RestaurantPreviewFields carries every header field); else the slim header
  // query. The header paints instantly while the full menu query is in flight.
  // The menu/addons/options below always read from `restaurant` — they only exist
  // on the full query.
  const r = restaurant ?? (propsData?.name ? propsData : headerData?.restaurantHeader) ?? propsData
  const { isFavorite, loading: favLoading, toggleFavorite } = useFavorite(r?._id)

  // ── ui state ──
  const [selectedLabel, setSelectedLabel] = useState(0)
  const [tabsVisible, setTabsVisible] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterData, setFilterData] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  const scrollRef = useRef(null)
  const tabListRef = useRef(null)
  const buttonClicked = useRef(false)
  const tabsVisibleRef = useRef(false)

  const translationY = useSharedValue(0)

  // ── sections ──
  const allDeals = (restaurant?.categories || []).filter((cat) => cat?.foods?.length)
  const deals = allDeals.map((c, index) => ({
    ...c,
    data: c.foods,
    index: dataList?.length > 0 ? index + 1 : index
  }))
  const updatedDeals =
    dataList?.length > 0
      ? [{ title: 'Popular', id: 'popular', data: dataList.slice(0, 6), index: 0 }, ...deals]
      : deals

  // ── search filtering ──
  useEffect(() => {
    if (!deals) return
    if (search === '') {
      const flat = []
      updatedDeals.forEach((category) => category?.data?.forEach((d) => flat.push(d)))
      setFilterData(flat)
      setShowSearchResults(false)
      return
    }
    const regex = new RegExp(escapeRegExp(search), 'i')
    const flat = []
    updatedDeals.forEach((category) =>
      category?.data?.forEach((d) => {
        if (d?.title?.search(regex) >= 0 || d?.description?.search(regex) > 0) flat.push(d)
      })
    )
    setFilterData(flat)
    setShowSearchResults(true)
  }, [search, searchOpen, data])

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
    Analytics.track(Analytics.events.NAVIGATE_TO_RESTAURANTS)
  }, [])

  const closedPromptShown = useRef(false)
  useEffect(() => {
    // Wait for the network fetch to settle before judging open/closed — a stale
    // cached emission (e.g. cached before the restaurant set its schedule) would
    // otherwise flash a false "closed" alert on a genuinely-open restaurant.
    if (loading) return
    if (restaurant && (!restaurant?.isAvailable || !isOpen(restaurant))) {
      // Prompt once per visit — repeated cache/network emissions would otherwise
      // re-open the (blocking on web) confirm dialog on every data change.
      if (closedPromptShown.current) return
      closedPromptShown.current = true
      confirmAction({
        message: t('restaurantClosedAtTheMoment'),
        cancelText: t('goBackToRestaurants'),
        confirmText: t('seeMenu'),
        onConfirm: () => {},
        onCancel: () => navigation.goBack()
      })
    }
  }, [data, loading])

  // ── helpers ──
  const fmt = (n) => `${configuration?.currencySymbol ?? ''} ${parseFloat(n || 0).toFixed(2)}`

  const closedAlert = () =>
    confirmAction({
      message: t('restaurantClosed'),
      cancelText: t('backToRestaurants'),
      confirmText: t('seeMenu'),
      onConfirm: () => {},
      onCancel: () => navigation.goBack()
    })

  const onPressItem = async(item) => {
    if (!restaurant?.isAvailable || !isOpen(restaurant)) return closedAlert()
    if (item?.isOutOfStock) return showAlert('Currently Unavailable', 'Item Out of Stock')
    const food = { ...item, restaurant: restaurant?._id, restaurantName: restaurant?.name }
    if (!restaurantCart || food.restaurant === restaurantCart) {
      await goToItem(food, food.restaurant !== restaurantCart)
    } else {
      confirmAction({
        message: t('clearCartText'),
        cancelText: t('Cancel'),
        confirmText: t('okText'),
        onConfirm: () => goToItem(food, true),
        destructive: true
      })
    }
  }

  const goToItem = async(food, clearFlag) => {
    if (clearFlag) await clearCart()
    navigation.navigate('ItemDetail', {
      food,
      addons: restaurant?.addons || [],
      options: restaurant?.options || [],
      restaurant: restaurant?._id
    })
  }

  const itemQty = (id) => {
    const res = checkItemCart?.(id)
    return res?.exist ? res.quantity : 0
  }

  // best-effort subtotal for the floating cart pill (single-restaurant cart)
  const cartSubtotal = () => {
    if (!restaurant || !cart?.length) return 0
    const foods = (restaurant.categories || []).flatMap((c) => c.foods || [])
    const addons = restaurant.addons || []
    const options = restaurant.options || []
    let total = 0
    cart.forEach((cartItem) => {
      const f = foods.find((x) => x._id === cartItem._id)
      if (!f) return
      const variation = f.variations?.find((v) => v._id === cartItem?.variation?._id) || f.variations?.[0]
      if (!variation) return
      let price = variation.price
      cartItem.addons?.forEach((addon) => {
        if (!addons.find((a) => a._id === addon._id)) return
        addon.options?.forEach((opt) => {
          const o = options.find((x) => x._id === opt._id)
          if (o) price += o.price
        })
      })
      total += price * cartItem.quantity
    })
    return total
  }

  // ── scroll / sticky tabs ──
  const syncTabs = (visible) => {
    if (tabsVisibleRef.current !== visible) {
      tabsVisibleRef.current = visible
      setTabsVisible(visible)
    }
  }

  // Tracks the last value we pushed to JS so we only cross the UI→JS bridge
  // when the tab-strip visibility boolean actually flips — not on every one of
  // the ~60 scroll frames per second (which was a real scroll-jank source).
  const tabsVisibleSV = useSharedValue(false)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    const y = Math.max(0, event.contentOffset.y)
    translationY.value = y
    const visible = y > TAB_THRESHOLD
    if (visible !== tabsVisibleSV.value) {
      tabsVisibleSV.value = visible
      runOnJS(syncTabs)(visible)
    }
  })

  const tabStripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationY.value, [TAB_THRESHOLD - TAB_FADE, TAB_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(translationY.value, [TAB_THRESHOLD - TAB_FADE, TAB_THRESHOLD], [-TAB_SLIDE, 0], Extrapolation.CLAMP) }]
  }))

  const scrollToSection = (index) => {
    scrollRef.current?.scrollToLocation({
      animated: true,
      sectionIndex: index,
      itemIndex: 0,
      viewOffset: TOP_OFFSET + TAB_STRIP_H,
      viewPosition: 0
    })
  }
  const scrollTabBar = (index) => {
    tabListRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 })
  }
  const changeIndex = (index) => {
    if (selectedLabel === index) return
    setSelectedLabel(index)
    buttonClicked.current = true
    scrollToSection(index)
    scrollTabBar(index)
  }
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (buttonClicked.current || !viewableItems.length) return
    const idx = viewableItems[0]?.section?.index
    if (idx != null) {
      setSelectedLabel(idx)
      scrollTabBar(idx)
    }
  }).current

  // ── loading / error ──
  // Only show the full-screen placeholder when we have nothing to paint at all —
  // i.e. no full data AND no preview/param header to fall back on (e.g. a cold
  // deep-link). In the normal tap-from-feed flow `r.name` comes from the route
  // params, so we skip straight to rendering the header and skeleton the menu.
  if (loading && !restaurant && !r?.name) {
    return (
      <View style={[S.screen, { paddingTop: insets.top + scale(60) }]}>
        {Array.from(Array(8), (_, i) => (
          <Placeholder
            key={i}
            Animation={(p) => <Fade {...p} style={{ backgroundColor: currentTheme.gray }} duration={600} />}
            Left={PlaceholderMedia}
            style={{ padding: scale(12) }}
          >
            <PlaceholderLine width={70} />
            <PlaceholderLine width={50} />
          </Placeholder>
        ))}
      </View>
    )
  }
  if (error) return <TextError text={JSON.stringify(error)} />

  // ── derived header values ── (read from `r` so they resolve from params first)
  const open = isOpen(r)
  const cuisines = r?.cuisines?.join(' · ')
  const ratings = r?.reviewData?.ratings ?? r?.reviewAverage ?? 0
  const reviewCount = r?.reviewData?.total ?? r?.reviewCount ?? 0
  const heroImg = (propsData?.image || r?.image || '').trim()

  const currentDayShort = new Date().toLocaleString('en-US', { weekday: 'short' }).toUpperCase()
  const today = r?.openingTimes?.find((o) => o.day === currentDayShort)
  const hoursStr =
    today && today.times?.length
      ? today.times.map((tm) => `${formatTimeSlot(tm.startTime)} – ${formatTimeSlot(tm.endTime)}`).join(', ')
      : t('ClosedAllDay')

  const aboutObject = {
    latitude: r?.location?.coordinates?.[1] ?? '',
    longitude: r?.location?.coordinates?.[0] ?? '',
    address: r?.address ?? '',
    restaurantName: r?.name,
    restaurantImage: r?.image,
    restaurantLogo: r?.logo,
    restaurantCuisines: r?.cuisines,
    restaurantTax: propsData?.tax,
    restaurantMinOrder: r?.minimumOrder,
    deliveryTime: r?.deliveryTime,
    minimumOrder: r?.minimumOrder,
    average: ratings,
    total: reviewCount,
    openingTimes: r?.openingTimes,
    phone: r?.phone,
    _id: r?._id
  }

  // ── small renderers ──
  const CircleBtn = ({ icon, onPress, label, solid }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[S.circleBtn, solid ? S.circleBtnSolid : S.circleBtnScrim]}
    >
      {icon}
    </TouchableOpacity>
  )

  const renderHero = () => (
    <View style={S.hero}>
      {!!heroImg && <Image source={{ uri: heroImg }} style={S.heroImage} contentFit='cover' transition={150} cachePolicy='memory-disk' />}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']} locations={[0.25, 0.55, 1]} style={S.heroScrim} pointerEvents='none' />
      <View style={S.heroBottomRow}>
        <View style={S.heroChipsRow}>
          <View style={S.heroChip}>
            <TextDefault textColor='#fff' style={{ fontSize: scale(11) }} bold>
              {fmt(configuration?.deliveryRate)} {t('delivery')}
            </TextDefault>
          </View>
          <View style={S.heroChip}>
            <TextDefault textColor='#fff' style={{ fontSize: scale(11) }} bold>
              {t('minimumOrder')} {fmt(r?.minimumOrder)}
            </TextDefault>
          </View>
        </View>
        <View style={[S.openBadge, { backgroundColor: open ? P.positive : '#6B7280' }]}>
          <TextDefault textColor='#fff' style={{ fontSize: scale(11) }} bolder>
            {open ? t('Open') : t('Closed')}
          </TextDefault>
        </View>
      </View>
    </View>
  )

  const renderInfoCard = () => (
    <View>
      <View style={S.infoCard}>
        <View style={S.infoTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextDefault textColor={P.accent === '#000' ? '#000' : currentTheme.fontMainColor} style={{ fontSize: scale(22), letterSpacing: -0.5 }} bolder isRTL numberOfLines={2}>
              {r?.name}
            </TextDefault>
            {!!cuisines && (
              <TextDefault textColor={currentTheme.fontNewColor} style={{ fontSize: scale(13), marginTop: scale(4) }} bold isRTL numberOfLines={1}>
                {cuisines}
              </TextDefault>
            )}
          </View>
          <TouchableOpacity activeOpacity={0.8} disabled={favLoading} onPress={toggleFavorite} accessibilityRole='button' accessibilityLabel={t('Favourite')} style={S.favBtn}>
            {favLoading
              ? (
              <Spinner size='small' backColor='transparent' spinnerColor={currentTheme.iconColorDark} />
                )
              : (
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={scale(20)} color={isFavorite ? '#DE1135' : currentTheme.newIconColor} />
                )}
          </TouchableOpacity>
        </View>

        <View style={S.metaRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={S.metaStar}
            onPress={() => navigation.navigate('Reviews', { restaurantObject: { ...aboutObject, isOpen: null }, tab: false })}
          >
            <FontAwesome name='star' size={scale(12)} color={P.star} />
            <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(13) }} bolder>
              {Number(ratings).toFixed(1)}
            </TextDefault>
            <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(13) }}>
              ({reviewCount} {t('reviews')})
            </TextDefault>
          </TouchableOpacity>
          <View style={S.dot} />
          <TextDefault textColor={currentTheme.fontNewColor} style={{ fontSize: scale(13) }}>
            {currentDayShort} {hoursStr}
          </TextDefault>
          <View style={S.dot} />
          <TextDefault textColor={open ? P.positive : '#DE1135'} style={{ fontSize: scale(13) }} bold>
            {open ? t('Open') : t('Closed')}
          </TextDefault>
        </View>

        <View style={S.chipsRow}>
          <View style={S.infoChip}>
            <Ionicons name='time-outline' size={scale(12)} color={currentTheme.fontNewColor} />
            <TextDefault textColor={currentTheme.fontThirdColor} style={{ fontSize: scale(12) }} bold>
              {r?.deliveryTime} {t('Min')}
            </TextDefault>
          </View>
          <View style={S.infoChip}>
            <MaterialCommunityIcons name='bike' size={scale(13)} color={currentTheme.fontNewColor} />
            <TextDefault textColor={currentTheme.fontThirdColor} style={{ fontSize: scale(12) }} bold>
              {fmt(configuration?.deliveryRate)}
            </TextDefault>
          </View>
          <View style={S.infoChip}>
            <Ionicons name='bag-handle-outline' size={scale(12)} color={currentTheme.fontNewColor} />
            <TextDefault textColor={currentTheme.fontThirdColor} style={{ fontSize: scale(12) }} bold>
              {t('minimumOrder')} {fmt(r?.minimumOrder)}
            </TextDefault>
          </View>
        </View>
      </View>

      {/* Delivery / Collection toggle */}
      <View style={S.toggleWrap}>
        <View style={S.segment}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setIsPickup(false)} style={[S.segmentBtn, !isPickup && S.segmentBtnActive]} accessibilityRole='button'>
            <MaterialCommunityIcons name='truck-delivery-outline' size={scale(13)} color={!isPickup ? P.onAccent : currentTheme.fontNewColor} />
            <TextDefault textColor={!isPickup ? P.onAccent : currentTheme.fontNewColor} style={{ fontSize: scale(13) }} bolder={!isPickup}>
              {t('delivery')} · {r?.deliveryTime} {t('Min')}
            </TextDefault>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setIsPickup(true)} style={[S.segmentBtn, isPickup && S.segmentBtnActive]} accessibilityRole='button'>
            <Ionicons name='home-outline' size={scale(13)} color={isPickup ? P.onAccent : currentTheme.fontNewColor} />
            <TextDefault textColor={isPickup ? P.onAccent : currentTheme.fontNewColor} style={{ fontSize: scale(13) }} bolder={isPickup}>
              {t('Collection')}
            </TextDefault>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  const renderPopularCard = (item) => {
    const v = item?.variations?.[0]
    const onSale = (v?.discounted ?? 0) > 0
    const qty = itemQty(item?._id)
    const img = item?.image && item.image.trim() !== '' ? item.image : IMAGE_LINK
    return (
      <TouchableOpacity key={item?._id} activeOpacity={0.85} style={S.popularCard} onPress={() => onPressItem(item)}>
        <View>
          <View style={S.popularImgWrap}>
            <Image source={{ uri: img }} style={S.popularImg} contentFit='cover' transition={150} cachePolicy='memory-disk' />
            {onSale && (
              <View style={S.saleTagSm}>
                <TextDefault textColor='#fff' style={{ fontSize: scale(9), letterSpacing: 0.5 }} bolder>
                  SALE
                </TextDefault>
              </View>
            )}
            {qty > 0 && (
              <View style={S.qtyBadge}>
                <TextDefault textColor={P.onAccent} style={{ fontSize: scale(10) }} bolder>
                  {qty}
                </TextDefault>
              </View>
            )}
          </View>
          <TouchableOpacity activeOpacity={0.85} style={S.popularAddBtn} onPress={() => onPressItem(item)} accessibilityRole='button' accessibilityLabel={t('addToCart')}>
            <Ionicons name='add' size={scale(16)} color={P.onAccent} />
          </TouchableOpacity>
        </View>
        <View style={S.popularBody}>
          <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(12), marginBottom: scale(4) }} bolder numberOfLines={2}>
            {item?.title}
          </TextDefault>
          <View style={{ flexDirection: currentTheme.isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: scale(4) }}>
            <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(13) }} bolder>
              {fmt(v?.price)}
            </TextDefault>
            {onSale && (
              <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(10) }} lineOver>
                {fmt((v?.price ?? 0) + (v?.discounted ?? 0))}
              </TextDefault>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderMenuRow = (item) => {
    const v = item?.variations?.[0]
    const onSale = (v?.discounted ?? 0) > 0
    const qty = itemQty(item?._id)
    const img = item?.image && item.image.trim() !== '' ? item.image : IMAGE_LINK
    return (
      <TouchableOpacity activeOpacity={0.7} style={[S.menuRow, { opacity: item?.isOutOfStock ? 0.5 : 1 }]} onPress={() => onPressItem(item)}>
        <View style={S.menuTextCol}>
          {onSale && (
            <View style={S.saleTag}>
              <TextDefault textColor={P.saleFg} style={{ fontSize: scale(9), letterSpacing: 0.4 }} bolder>
                {t('Sale') !== 'Sale' ? t('Sale') : 'SALE'}
              </TextDefault>
            </View>
          )}
          <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(14), marginBottom: scale(3) }} bolder isRTL numberOfLines={2}>
            {item?.title}
          </TextDefault>
          {!!item?.description && (
            <TextDefault textColor={currentTheme.fontNewColor} style={{ fontSize: scale(12), lineHeight: scale(17) }} isRTL numberOfLines={2}>
              {item?.description}
            </TextDefault>
          )}
          <View style={S.priceRow}>
            <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(14) }} bolder>
              {fmt(v?.price)}
            </TextDefault>
            {onSale && (
              <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12) }} lineOver>
                {fmt((v?.price ?? 0) + (v?.discounted ?? 0))}
              </TextDefault>
            )}
          </View>
        </View>
        <View style={S.menuImgCol}>
          <View style={{ position: 'relative', width: scale(80), height: scale(80) }}>
            <View style={S.menuImgWrap}>
              <Image source={{ uri: img }} style={S.menuImg} contentFit='cover' transition={150} cachePolicy='memory-disk' />
            </View>
            <TouchableOpacity activeOpacity={0.85} style={S.menuAddBtn} onPress={() => onPressItem(item)} accessibilityRole='button' accessibilityLabel={t('addToCart')}>
              <Ionicons name='add' size={scale(15)} color={P.onAccent} />
            </TouchableOpacity>
            {qty > 0 && (
              <View style={[S.qtyBadge, { top: scale(-6), left: scale(-6), right: undefined }]}>
                <TextDefault textColor={P.onAccent} style={{ fontSize: scale(10) }} bolder>
                  {qty}
                </TextDefault>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const searchHandler = () => {
    setSearchOpen((v) => !v)
    setSearch('')
  }

  return (
    <View style={S.screen}>
      {/* ── Fixed app bar ── */}
      <View style={[S.appBar, { paddingTop: insets.top, height: TOP_OFFSET }, (tabsVisible || searchOpen) && S.appBarSolid]}>
        {searchOpen
          ? (
          <View style={{ flex: 1, flexDirection: currentTheme.isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: scale(8) }}>
            <CircleBtn solid label={t('close')} onPress={searchHandler} icon={<Ionicons name='close' size={scale(20)} color={currentTheme.newIconColor} />} />
            <View style={{ flex: 1 }}>
              <Search setSearch={setSearch} search={search} newheaderColor={currentTheme.backgroundColor} cartContainer={currentTheme.gray500} placeHolder={t('searchItems')} />
            </View>
          </View>
            )
          : (
          <>
            <CircleBtn label={t('back')} onPress={() => navigation.goBack()} solid={tabsVisible} icon={<Ionicons name='arrow-back' size={scale(18)} color={tabsVisible ? currentTheme.newIconColor : '#fff'} />} />
            <View style={S.appBarTitle} pointerEvents='none'>
              {tabsVisible && (
                <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(15), textAlign: 'center' }} bolder numberOfLines={1}>
                  {r?.name}
                </TextDefault>
              )}
            </View>
            <View style={S.appBarBtnRow}>
              <CircleBtn
                label={t('searchItems')}
                solid={tabsVisible}
                onPress={searchHandler}
                icon={<Ionicons name='search' size={scale(16)} color={tabsVisible ? currentTheme.newIconColor : '#fff'} />}
              />
              <CircleBtn
                label={t('info')}
                solid={tabsVisible}
                onPress={() => navigation.navigate('About', { restaurantObject: { ...aboutObject }, tab: false })}
                icon={<Ionicons name='information-circle-outline' size={scale(18)} color={tabsVisible ? currentTheme.newIconColor : '#fff'} />}
              />
            </View>
          </>
            )}
      </View>

      {/* ── Sticky category tabs ── */}
      {!searchOpen && updatedDeals.length > 0 && (
        <Animated.View style={[S.tabStrip, { top: TOP_OFFSET, height: TAB_STRIP_H }, tabStripStyle]} pointerEvents={tabsVisible ? 'auto' : 'none'}>
          <FlatList
            ref={tabListRef}
            data={updatedDeals}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.tabStripContent}
            keyExtractor={(item, i) => `tab-${i}`}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item, index }) => {
              const active = selectedLabel === index
              return (
                <TouchableOpacity activeOpacity={0.7} style={S.tabBtn} onPress={() => changeIndex(index)} accessibilityRole='tab'>
                  <TextDefault textColor={active ? currentTheme.fontMainColor : currentTheme.fontSecondColor} style={{ fontSize: scale(14) }} bolder={active}>
                    {t(item.title)}
                  </TextDefault>
                  {active && <View style={S.tabUnderline} />}
                </TouchableOpacity>
              )
            }}
          />
        </Animated.View>
      )}

      {/* ── Body ── */}
      {showSearchResults || searchOpen
        ? (
        <ScrollView style={{ flex: 1, marginTop: TOP_OFFSET, backgroundColor: P.surface }} keyboardShouldPersistTaps='handled'>
          {filterData.map((item, index) => {
            const v = item?.variations?.[0]
            const img = item?.image && item.image.trim() !== '' ? item.image : IMAGE_LINK
            return (
              <TouchableOpacity key={`${item?._id}-${index}`} activeOpacity={0.7} style={[S.searchRow, { opacity: item?.isOutOfStock ? 0.5 : 1 }]} onPress={() => onPressItem(item)}>
                <View style={{ flexDirection: currentTheme.isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: scale(12), flex: 1 }}>
                  <Image source={{ uri: img }} style={{ width: scale(56), height: scale(56), borderRadius: scale(10) }} contentFit='cover' transition={150} cachePolicy='memory-disk' />
                  <View style={{ flex: 1 }}>
                    <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(14) }} bolder isRTL numberOfLines={1}>
                      {item?.title}
                    </TextDefault>
                    {!!item?.description && (
                      <TextDefault textColor={currentTheme.fontNewColor} style={{ fontSize: scale(12), marginTop: scale(2) }} isRTL numberOfLines={1}>
                        {item?.description}
                      </TextDefault>
                    )}
                    <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(13), marginTop: scale(4) }} bolder>
                      {fmt(v?.price)}
                    </TextDefault>
                  </View>
                </View>
                <View style={[S.popularAddBtn, { position: 'relative', bottom: 0, right: 0 }]}>
                  <Ionicons name='add' size={scale(16)} color={P.onAccent} />
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
          )
        : (
        <AnimatedSectionList
          ref={scrollRef}
          sections={updatedDeals}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          refreshing={networkStatus === 4}
          onRefresh={() => networkStatus === 7 && refetch()}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={() => {
            buttonClicked.current = false
          }}
          viewabilityConfig={VIEWABILITY_CONFIG}
          keyExtractor={(item, index) => `${item?._id ?? 'i'}-${index}`}
          contentContainerStyle={{ paddingBottom: scale(110) }}
          ListHeaderComponent={
            <>
              {renderHero()}
              {renderInfoCard()}
            </>
          }
          ListFooterComponent={
            // Menu hasn't arrived yet (header is already painted from params):
            // skeleton the list area instead of blocking the whole screen.
            !restaurant?.categories
              ? (
              <View style={{ paddingTop: scale(8) }}>
                {Array.from(Array(6), (_, i) => (
                  <Placeholder
                    key={`menu-skel-${i}`}
                    Animation={(p) => <Fade {...p} style={{ backgroundColor: currentTheme.gray }} duration={600} />}
                    Right={PlaceholderMedia}
                    style={{ padding: scale(12) }}
                  >
                    <PlaceholderLine width={60} />
                    <PlaceholderLine width={40} />
                  </Placeholder>
                ))}
              </View>
                )
              : null
          }
          renderSectionHeader={({ section }) => {
            if (section.title === 'Popular') {
              if (!dataList || dataList.length === 0) return null
              return (
                <View style={S.popularSection}>
                  <View style={S.popularHeading}>
                    <MaterialCommunityIcons name='fire' size={scale(16)} color='#FF6B35' />
                    <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(16), letterSpacing: -0.3 }} bolder>
                      {t('Popular')}
                    </TextDefault>
                    <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: scale(12) }}>
                      {t('mostOrderedNow')}
                    </TextDefault>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.popularRail}>
                    {section.data.map((item) => renderPopularCard(item))}
                  </ScrollView>
                </View>
              )
            }
            return (
              <View>
                <View style={S.bandSpacer} />
                <View style={S.catHeader}>
                  <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(17), letterSpacing: -0.3 }} bolder isRTL>
                    {section.title}
                  </TextDefault>
                </View>
              </View>
            )
          }}
          renderItem={({ item, section }) => {
            if (section.title === 'Popular') return null
            return renderMenuRow(item)
          }}
        />
          )}

      {/* ── Floating cart pill ── */}
      {cartCount > 0 && !searchOpen && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[S.cartBar, { bottom: insets.bottom + scale(10), pointerEvents: 'auto' }]}
          onPress={() => navigation.navigate('Cart')}
          accessibilityRole='button'
          accessibilityLabel={t('viewCart')}
        >
          <View style={S.cartLeft}>
            <View style={S.cartCountCircle}>
              <TextDefault textColor={P.accent} style={{ fontSize: scale(11) }} bolder>
                {cartCount}
              </TextDefault>
            </View>
            <TextDefault textColor={P.onAccent} style={{ fontSize: scale(14) }} bolder>
              {t('viewCart')}
            </TextDefault>
          </View>
          <View style={S.cartTotalPill}>
            <TextDefault textColor='#fff' style={{ fontSize: scale(13) }} bolder>
              {fmt(cartSubtotal())}
            </TextDefault>
            <Ionicons name={currentTheme.isRTL ? 'chevron-back' : 'chevron-forward'} size={scale(14)} color='#fff' />
          </View>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default Restaurant
