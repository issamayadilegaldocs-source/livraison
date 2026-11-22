/* eslint-disable react/display-name */
import React, { useRef, useContext, useLayoutEffect, useState, useEffect, useCallback, useMemo } from 'react'
import { View, TouchableOpacity, StatusBar, Platform, RefreshControl, FlatList, ActivityIndicator, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AntDesign, SimpleLineIcons, Ionicons, MaterialIcons } from '@expo/vector-icons'
import { useApolloClient, useMutation, useQuery, gql } from '@apollo/client'
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native'
import { Modalize } from 'react-native-modalize'
import { useTranslation } from 'react-i18next'

import { useLocation } from '../../ui/hooks'
import useGeocoding from '../../ui/hooks/useGeocoding'
import { useRestaurantQueries } from '../../ui/hooks/useRestaurantQueries'
import useHomeRestaurants from '../../ui/hooks/useRestaurantOrderInfo'
import useNetworkStatus from '../../utils/useNetworkStatus'
import { prefetchRestaurant } from '../../utils/prefetchRestaurant'

import UserContext from '../../context/User'
import { LocationContext } from '../../context/Location'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'

import { FetchAllShopTypes, getBanners, getCuisines, MY_NOTIFICATIONS } from '../../apollo/queries'
import { selectAddress, deleteAddress } from '../../apollo/mutations'

import { scale } from '../../utils/scaling'
import { FILTER_TYPE } from '../../utils/enums'
import { isOpen, sortRestaurantsByOpenStatus, getErrorMessage } from '../../utils/customFunctions'
import analytics from '../../utils/analytics'

import styles from './Styles'
import navigationOptions from './navigationOptions'
import { FILTER_VALUES } from '../Menu/Menu'

import TextDefault from '../../components/Text/TextDefault/TextDefault'
import NewRestaurantCard from '../../components/Main/RestaurantCard/NewRestaurantCard'
import MainModalize from '../../components/Main/Modalize/MainModalize'
import Filters from '../../components/Filter/FilterSlider'
import AppliedFilters from '../../components/Filter/AppliedFilters'
import ErrorView from '../../components/ErrorView/ErrorView'
import Spinner from '../../components/Spinner/Spinner'
import ActiveOrders from '../../components/Main/ActiveOrders/ActiveOrders'
import Banner from '../../components/Main/Banner/Banner'
import MainLoadingUI from '../../components/Main/LoadingUI/MainLoadingUI'
import ForceUpdate from '../../components/Update/ForceUpdate'
import ModalDropdown from '../../components/Picker/ModalDropdown'
import { useBottomTabBarBlock, useBottomTabBarScroll, useShowBottomTabBarOnFocus, useBottomTabBarSetBlocked } from '../../context/BottomTabBarVisibility'

import CustomHomeIcon from '../../assets/SVG/imageComponents/CustomHomeIcon'
import CustomOtherIcon from '../../assets/SVG/imageComponents/CustomOtherIcon'
import CustomWorkIcon from '../../assets/SVG/imageComponents/CustomWorkIcon'
import CustomApartmentIcon from '../../assets/SVG/imageComponents/CustomApartmentIcon'

const SELECT_ADDRESS = gql`
  ${selectAddress}
`
const DELETE_ADDRESS = gql`
  ${deleteAddress}
`
const GET_BANNERS = gql`
  ${getBanners}
`
const GET_CUISINES = gql`
  ${getCuisines}
`
const FETCH_ALL_SHOPTYPES = FetchAllShopTypes

function Home(props) {
  const Analytics = analytics()
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }
  const handleBottomTabBarScroll = useBottomTabBarScroll()
  useShowBottomTabBarOnFocus()

  const { isLoggedIn, profile, cartCount } = useContext(UserContext)
  const hasCartItems = cartCount > 0
  const { location, setLocation } = useContext(LocationContext)
  const { getCurrentLocation } = useLocation()
  const { getAddress } = useGeocoding()
  const { isConnected: connect } = useNetworkStatus()

  const [activeSegment, setActiveSegment] = useState('restaurant') // 'restaurant' | 'grocery'
  const [busy, setBusy] = useState(false)
  const [hasActiveOrders, setHasActiveOrders] = useState(false)
  const [citiesModalVisible, setCitiesModalVisible] = useState(false)
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [restaurantData, setRestaurantData] = useState([])
  const [activeCollection, setActiveCollection] = useState(null)
  const [filters, setFilters] = useState(FILTER_VALUES)
  const [appliedFilters, setAppliedFilters] = useState(FILTER_VALUES)
  const [filterSectionApplied, setFilterSectionApplied] = useState(false)
  const [filterApplied, setFilterApplied] = useState(false)

  const modalRef = useRef(null)
  const filtersModalRef = useRef(null)
  const chipsListRef = useRef(null)
  // Address sheet hides the tab bar imperatively (see openAddressSheet) so its
  // open path never re-renders Home. The other two sheets are rare and stay on
  // the effect-driven path.
  useBottomTabBarBlock(isFocused && (citiesModalVisible || filtersSheetVisible))
  const setTabBarBlocked = useBottomTabBarSetBlocked()

  // ---- data: full lists per segment ----
  const restaurantQ = useRestaurantQueries('restaurant', location, 'restaurant')
  const groceryQ = useRestaurantQueries('grocery', location, 'grocery')
  const activeQ = activeSegment === 'restaurant' ? restaurantQ : groceryQ
  const activeAllData = activeQ.allData
  const activeRawData = activeQ.data

  // ---- data: curated carousels ----
  const { orderLoading, orderError, orderData } = useHomeRestaurants()
  const { restaurantData: mostOrderedGroceryStores, loading: mostOrderedGroceryLoading, error: mostOrderedGroceryError } = useRestaurantQueries('topPicks', location, 'grocery')

  const { data: bannersData, refetch: refetchBanners } = useQuery(GET_BANNERS, {
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first'
  })
  const { data: notificationsData } = useQuery(MY_NOTIFICATIONS, {
    skip: !isLoggedIn,
    fetchPolicy: 'cache-and-network',
  })
  const unreadCount = (notificationsData?.myNotifications ?? []).filter((n) => !n.read).length
  const { data: allCuisines } = useQuery(GET_CUISINES)
  const { data: allShopTypes } = useQuery(FETCH_ALL_SHOPTYPES)

  const [mutate] = useMutation(SELECT_ADDRESS, { onError: (e) => console.log(e) })
  const [deleteAddressMutation, { loading: deletingAddress }] = useMutation(DELETE_ADDRESS, { onError: (e) => console.log(e) })

  const restaurantCuisines = useMemo(() => {
    if (!allCuisines?.cuisines) return []
    return allCuisines.cuisines.filter((c) => c?.shopType?.toLowerCase() === 'restaurant')
  }, [allCuisines])
  const groceryCuisines = useMemo(() => {
    if (!allCuisines?.cuisines) return []
    return allCuisines.cuisines.filter((c) => c?.shopType?.toLowerCase() === 'grocery')
  }, [allCuisines])
  const activeCuisines = activeSegment === 'restaurant' ? restaurantCuisines : groceryCuisines

  const sortedMostOrderedRestaurants = useMemo(() => sortRestaurantsByOpenStatus(orderData?.mostOrderedRestaurants || []), [orderData?.mostOrderedRestaurants])
  const sortedMostOrderedGrocery = useMemo(() => sortRestaurantsByOpenStatus(mostOrderedGroceryStores || []), [mostOrderedGroceryStores])

  // ---- reset displayed list to active segment's base when it loads / segment changes ----
  useEffect(() => {
    setActiveCollection(null)
    setFilters(FILTER_VALUES)
    setAppliedFilters(FILTER_VALUES)
    setFilterSectionApplied(false)
    setFilterApplied(false)
    setRestaurantData(sortRestaurantsByOpenStatus(activeAllData || []))
  }, [activeSegment, activeAllData])

  // ---- inject the active segment cuisines into the filter modal ----
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      Cuisines: {
        selected: [],
        type: FILTER_TYPE.CHECKBOX,
        values: activeCuisines?.map((c) => c.name) ?? []
      }
    }))
  }, [activeCuisines])

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(currentTheme.newheaderColor)
      }
      StatusBar.setBarStyle('dark-content')
    }, [currentTheme])
  )

  useEffect(() => {
    async function Track() {
      await Analytics.track(Analytics.events.NAVIGATE_TO_MAIN)
    }
    Track()
  }, [])

  const openAddressSheet = () => {
    // Hide the tab bar imperatively (re-renders the tab navigator, NOT Home)
    // and open. Crucially we do NOT setState on Home here: a Home re-render on
    // this tap is what made the sheet take ~half a second to react.
    setTabBarBlocked(true)
    modalRef.current?.open()
  }

  const openFiltersSheet = () => {
    setFiltersSheetVisible(true)
    filtersModalRef.current?.open()
  }

  useLayoutEffect(() => {
    navigation.setOptions(
      navigationOptions({
        headerMenuBackground: currentTheme.themeBackground,
        fontMainColor: currentTheme.darkBgFont,
        iconColorPink: currentTheme.iconColor,
        open: openAddressSheet,
        navigation,
        unreadCount
      })
    )
  }, [navigation, currentTheme, unreadCount])

  const addressIcons = {
    House: CustomHomeIcon,
    Office: CustomWorkIcon,
    Apartment: CustomApartmentIcon,
    Other: CustomOtherIcon
  }

  const setAddressLocation = (address) => {
    setLocation({
      _id: address._id,
      label: address.label,
      latitude: Number(address.location.coordinates[1]),
      longitude: Number(address.location.coordinates[0]),
      deliveryAddress: address.deliveryAddress,
      details: address.details
    })
    mutate({ variables: { id: address._id } }).catch((e) => console.log(e))
    modalRef.current.close()
  }

  const onEditAddress = (address) => {
    modalRef.current?.close()
    navigation.navigate('EditAddress', { ...address })
  }

  const onDeleteAddress = (address) => {
    Alert.alert(
      t('deleteAddressTitle') || 'Delete address',
      t('deleteAddressMessage') || 'Are you sure you want to delete this address?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteAddressMutation({ variables: { id: address._id } })
        }
      ]
    )
  }

  const setCurrentLocation = async() => {
    setBusy(true)
    const { error, coords } = await getCurrentLocation()
    if (!coords || !coords.latitude || !coords.longitude) {
      setBusy(false)
      return
    }
    try {
      const { formattedAddress } = await getAddress(coords.latitude, coords.longitude)
      let address = formattedAddress || 'Unknown Address'
      if (address.length > 21) address = address.substring(0, 21) + '...'
      if (error) {
        navigation.navigate('SelectLocation')
      } else {
        modalRef.current?.close()
        setLocation({
          label: 'currentLocation',
          latitude: coords.latitude,
          longitude: coords.longitude,
          deliveryAddress: address
        })
        setBusy(false)
      }
    } catch (fetchError) {
      console.error('Error fetching address:', fetchError.message)
      setBusy(false)
    }
  }

  const handleMarkerPress = async(coordinates) => {
    setCitiesModalVisible(false)
    const response = await getAddress(coordinates.latitude, coordinates.longitude)
    setLocation({
      label: 'Location',
      deliveryAddress: response.formattedAddress,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      city: response.city
    })
  }

  const handleRefresh = async() => {
    setIsRefreshing(true)
    await Promise.allSettled([refetchBanners(), restaurantQ.refetch(), groceryQ.refetch()])
    setIsRefreshing(false)
  }

  const modalHeader = () => (
    <View style={styles().sheetActionWrap}>
      <View style={styles(currentTheme).addressContainer}>
        <TouchableOpacity style={[styles(currentTheme).currentLocationButton]} activeOpacity={0.7} onPress={setCurrentLocation} disabled={busy}>
          <View style={styles(currentTheme).addressSubContainer}>
            {busy
              ? (
              <Spinner size='small' backColor='transparent' spinnerColor={currentTheme.white} />
                )
              : (
              <>
                <SimpleLineIcons name='target' size={scale(18)} color={currentTheme.white} />
                <View style={styles().mL5p} />
                <TextDefault bold textColor={currentTheme.white}>
                  {t('currentLocation')}
                </TextDefault>
              </>
                )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const modalFooter = () => (
    <View style={styles().sheetFooterWrap}>
      <View style={[styles(currentTheme).addressContainer]}>
        <TouchableOpacity
          activeOpacity={0.5}
          style={styles(currentTheme).addAddressButton}
          onPress={() => {
            if (isLoggedIn) {
              navigation.navigate('AddNewAddress', { prevScreen: 'Home', ...location })
            } else {
              modalRef.current?.close()
              navigation.navigate({ name: 'CreateAccount' })
            }
          }}
        >
          <View style={styles(currentTheme).addressSubContainer}>
            <AntDesign name='pluscircleo' size={scale(20)} color={currentTheme.black} />
            <View style={styles().mL5p} />
            <TextDefault bold textColor={currentTheme.black}>
              {t('addAddress')}
            </TextDefault>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  // ---- cuisine chip filtering (inline) ----
  const onPressCollection = (collection, index) => {
    chipsListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
    if (activeCollection === collection.name) {
      setActiveCollection(null)
      setRestaurantData(sortRestaurantsByOpenStatus(activeAllData || []))
      setFilterApplied(false)
    } else {
      setActiveCollection(collection.name)
      const filtered = (activeAllData || []).filter((item) => item?.cuisines?.includes(collection.name))
      setRestaurantData(sortRestaurantsByOpenStatus(filtered))
      setFilterApplied(true)
    }
  }

  // ---- sort/offers/rating filter modal ----
  const extractRating = (ratingString) => parseInt(ratingString)
  const applyFilters = () => {
    let filteredData = [...(activeRawData?.nearByRestaurantsPreview?.restaurants || [])]
    const { Rating: ratings, Sort: sort, Offers: offers, Cuisines: cuisines } = filters

    if (ratings?.selected?.length > 0) {
      const numericRatings = ratings.selected.map(extractRating)
      filteredData = filteredData.filter((item) => item?.reviewAverage >= Math.min(...numericRatings))
    }
    if (sort?.selected?.length > 0) {
      if (sort.selected[0] === 'fastDelivery') filteredData.sort((a, b) => a.deliveryTime - b.deliveryTime)
      else if (sort.selected[0] === 'Distance') filteredData.sort((a, b) => a.distanceWithCurrentLocation - b.distanceWithCurrentLocation)
    }
    if (offers?.selected?.length > 0) {
      if (offers.selected.includes('freeDelivery')) filteredData = filteredData.filter((item) => item?.freeDelivery)
      if (offers.selected.includes('acceptVouchers')) filteredData = filteredData.filter((item) => item?.acceptVouchers)
    }
    if (cuisines?.selected?.length > 0) {
      filteredData = filteredData.filter((item) => item.cuisines?.some((c) => cuisines.selected.includes(c)))
    }

    setRestaurantData(sortRestaurantsByOpenStatus(filteredData))
    filtersModalRef.current?.close()
    setAppliedFilters(filters)
    const anySelected = ratings?.selected?.length > 0 || sort?.selected?.length > 0 || offers?.selected?.length > 0 || cuisines?.selected?.length > 0
    setFilterApplied(anySelected)
    setFilterSectionApplied(anySelected)
    setActiveCollection(null)
  }
  const resetFilters = () => setFilters(appliedFilters)

  const displayAddress = location?.deliveryAddress || location?.label || t('currentLocation')
  const popularRestaurants = activeSegment === 'restaurant' ? sortedMostOrderedRestaurants : sortedMostOrderedGrocery
  const brandRestaurants = useMemo(() => {
    const source = activeSegment === 'restaurant' ? sortedMostOrderedRestaurants : sortedMostOrderedGrocery
    return source?.length ? source.slice(0, 8) : restaurantData?.slice(0, 8) || []
  }, [activeSegment, sortedMostOrderedRestaurants, sortedMostOrderedGrocery, restaurantData])

  const homeBanners = useMemo(() => {
    const apiBanners = (bannersData?.banners || [])
      .filter((banner) => banner?.isActive !== false)
      .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0))

    if (apiBanners.length) return apiBanners

    return [{
      _id: 'default-home-promo',
      title: t('freeDeliveryOnFirstOrder') || 'Free delivery\non your first order',
      description: t('useCode') || 'Use code',
      badgeText: t('limitedOffer') || 'Limited offer',
      buttonText: t('orderNow') || 'Order now',
      promoCode: 'FREESHIP',
      backgroundColor: '#111111',
      textColor: '#FFFFFF',
      accentColor: '#FF9050',
      buttonBackgroundColor: '#FFFFFF',
      buttonTextColor: '#000000',
      action: 'Navigate Specific Page',
      screen: activeSegment === 'grocery' ? 'Grocery List' : 'Near By Restaurants'
    }]
  }, [activeSegment, bannersData?.banners, t])

  const foodTypes = useMemo(() => {
    const baseItems = activeSegment === 'grocery' && allShopTypes?.fetchAllShopTypes?.data?.length
      ? allShopTypes.fetchAllShopTypes.data.map((item) => ({ ...item, name: item.name, collection: item.slug, isShopType: true }))
      : activeCuisines
    return [{ _id: 'all', name: t('All') || 'All' }, ...(baseItems || [])].slice(0, 12)
  }, [activeSegment, activeCuisines, allShopTypes, t])

  const renderSectionHeader = (title, onPress, accessory = null) => (
    <View style={styles(currentTheme).sectionHeader}>
      <View style={styles(currentTheme).sectionTitleRow}>
        <TextDefault bolder H4 textColor={currentTheme.black}>
          {title}
        </TextDefault>
        {accessory}
      </View>
      {onPress && (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
          <TextDefault bold textColor={currentTheme.black} style={styles().seeAllText}>
            {t('SeeAll')}
          </TextDefault>
        </TouchableOpacity>
      )}
    </View>
  )

  const renderSegmentBtn = (segment, label) => {
    const active = activeSegment === segment
    return (
      <TouchableOpacity activeOpacity={0.8} style={[styles(currentTheme).segmentBtn, active && styles(currentTheme).segmentBtnActive]} onPress={() => setActiveSegment(segment)} accessibilityRole='button' accessibilityLabel={label}>
        <TextDefault bolder textColor={active ? currentTheme.white : currentTheme.black}>
          {label}
        </TextDefault>
      </TouchableOpacity>
    )
  }

  const renderHomeHeader = () => (
    <View style={styles(currentTheme).stickyHeader}>
      <View style={styles(currentTheme).locationRow}>
        <TouchableOpacity style={styles(currentTheme).locationButton} activeOpacity={0.75} onPress={openAddressSheet}>
          <MaterialIcons name='location-on' size={18} color={currentTheme.black} />
          <View style={styles().locationTextWrap}>
            <TextDefault bold textColor={currentTheme.gray600} style={styles().eyebrowText}>
              {t('deliverTo') || 'Deliver to'}
            </TextDefault>
            <View style={styles(currentTheme).locationTitleRow}>
              <TextDefault bolder numberOfLines={1} textColor={currentTheme.black} style={styles().locationText}>
                {displayAddress}
              </TextDefault>
              <MaterialIcons name='keyboard-arrow-down' size={18} color={currentTheme.black} />
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles(currentTheme).cartButton,
            hasCartItems && styles(currentTheme).cartButtonActive
          ]}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Cart')}
          accessibilityRole='button'
        >
          <SimpleLineIcons name='bag' size={18} color={currentTheme.black} />
          {hasCartItems && (
            <View style={styles(currentTheme).cartBadge}>
              <TextDefault bolder textColor='#FFF' style={styles().cartBadgeText}>
                {cartCount}
              </TextDefault>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={styles(currentTheme).searchBar} onPress={() => navigation.navigate('SearchScreen')} accessibilityRole='search' accessibilityLabel={t('searchRestaurant')}>
        <Ionicons name='search' size={18} color={currentTheme.gray500} />
        <TextDefault textColor={currentTheme.gray500} style={styles().searchText}>
          {t('searchRestaurant')}
        </TextDefault>
      </TouchableOpacity>
      <View style={styles(currentTheme).segmentRow}>
        {renderSegmentBtn('restaurant', t('Restaurants'))}
        {renderSegmentBtn('grocery', t('grocery'))}
        <TouchableOpacity activeOpacity={0.8} style={styles(currentTheme).segmentBtn} onPress={openFiltersSheet}>
          <TextDefault bolder textColor={currentTheme.black}>
            {t('offers') || 'Offers'}
          </TextDefault>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderFoodTypes = () => (
    <View style={styles(currentTheme).foodRailSection}>
      <FlatList
        ref={chipsListRef}
        data={foodTypes}
        horizontal
        showsHorizontalScrollIndicator={false}
        inverted={currentTheme?.isRTL}
        keyExtractor={(item, index) => item?._id || `food-${index}`}
        contentContainerStyle={styles(currentTheme).foodRailContent}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => {
          const isAll = item?._id === 'all'
          const active = isAll ? !activeCollection : activeCollection === item.name
          return (
            <TouchableOpacity
              activeOpacity={0.78}
              style={styles(currentTheme).foodTypeItem}
              onPress={() => {
                if (isAll) {
                  setActiveCollection(null)
                  setRestaurantData(sortRestaurantsByOpenStatus(activeAllData || []))
                  setFilterApplied(false)
                } else if (item?.isShopType) {
                  navigation.navigate('Menu', { collection: item.collection, selectedType: item.collection, isShopType: true })
                } else {
                  onPressCollection(item, index)
                }
              }}
            >
              <View style={styles(currentTheme).foodIconWrap}>
                <View style={[styles(currentTheme).foodIconBox, active && styles(currentTheme).foodIconBoxActive]}>
                  {item?.image
                    ? (
                    <Image source={{ uri: item.image }} style={styles().foodImage} resizeMode='cover' />
                      )
                    : (
                    <MaterialIcons name={isAll ? 'apps' : activeSegment === 'grocery' ? 'local-grocery-store' : 'restaurant'} size={24} color={active ? currentTheme.white : currentTheme.black} />
                      )}
                </View>
                {active && (
                  <View style={styles(currentTheme).foodCheckBadge}>
                    <MaterialIcons name='check' size={12} color={currentTheme.white} />
                  </View>
                )}
              </View>
              <TextDefault bolder={active} bold={!active} numberOfLines={1} textColor={active ? currentTheme.black : currentTheme.gray500} style={styles().foodTypeText}>
                {item.name}
              </TextDefault>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )

  const renderPromoBanner = () => (
    <View style={styles(currentTheme).promoWrap}>
      <Banner banners={homeBanners} />
    </View>
  )

  const renderCompactRestaurant = ({ item }) => (
    <TouchableOpacity activeOpacity={0.8} style={styles(currentTheme).popularCard} onPress={() => navigation.navigate(item?.shopType === 'grocery' ? 'NewRestaurantDetailDesign' : 'Restaurant', { ...item })}>
      <View style={styles(currentTheme).popularImageWrap}>
        <Image source={{ uri: item?.image || item?.logo }} style={styles().popularImage} resizeMode='cover' />
        <View style={styles().popularImageShade} />
      </View>
      <View style={styles().popularInfo}>
        <TextDefault bolder numberOfLines={1} textColor={currentTheme.black}>
          {item?.name}
        </TextDefault>
        <View style={styles(currentTheme).metaRow}>
          <AntDesign name='star' size={11} color='#FFB800' />
          <TextDefault bold textColor={currentTheme.black} style={styles().metaText}>
            {item?.reviewAverage ?? '4.8'}
          </TextDefault>
          <TextDefault textColor={currentTheme.gray500} style={styles().metaText}>
            {' · '}
            {item?.deliveryTime}
            {' '}
            {t('min')}
          </TextDefault>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderPopularSection = () => {
    if (orderLoading || mostOrderedGroceryLoading || isRefreshing) return <MainLoadingUI />
    if (orderError || mostOrderedGroceryError || !popularRestaurants?.length) return null
    return (
      <View style={styles(currentTheme).contentSection}>
        {renderSectionHeader(t("popularRightNow"), () => navigation.navigate('Menu', { selectedType: activeSegment, queryType: 'topPicks', shopType: activeSegment }), <MaterialIcons name='local-fire-department' size={18} color='#FF6B35' />)}
        <FlatList
          data={popularRestaurants}
          horizontal
          showsHorizontalScrollIndicator={false}
          inverted={currentTheme?.isRTL}
          keyExtractor={(item, index) => item?._id || `popular-${index}`}
          renderItem={renderCompactRestaurant}
          contentContainerStyle={styles(currentTheme).horizontalCardsContent}
        />
      </View>
    )
  }

  const renderBrandsSection = () => {
    if (!brandRestaurants?.length) return null
    return (
      <View style={styles(currentTheme).contentSection}>
        {renderSectionHeader(t("ourBrands"), () => navigation.navigate('Menu', { selectedType: activeSegment, queryType: 'topBrands', shopType: activeSegment }))}
        <FlatList
          data={brandRestaurants}
          horizontal
          showsHorizontalScrollIndicator={false}
          inverted={currentTheme?.isRTL}
          keyExtractor={(item, index) => item?._id || `brand-${index}`}
          contentContainerStyle={styles(currentTheme).brandContent}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.78} style={styles(currentTheme).brandItem} onPress={() => navigation.navigate(item?.shopType === 'grocery' ? 'NewRestaurantDetailDesign' : 'Restaurant', { ...item })}>
              <View style={styles(currentTheme).brandCircle}>
                {item?.logo || item?.image ? <Image source={{ uri: item.logo || item.image }} style={styles().brandImage} resizeMode='cover' /> : <TextDefault bolder textColor={currentTheme.white}>{item?.name?.slice(0, 2)?.toUpperCase()}</TextDefault>}
              </View>
              <TextDefault bold numberOfLines={1} textColor={currentTheme.gray700} style={styles().brandText}>
                {item?.name}
              </TextDefault>
            </TouchableOpacity>
          )}
        />
      </View>
    )
  }

  const renderRestaurantFilters = () => (
    <View style={styles(currentTheme).restaurantFilterBlock}>
      <View style={styles(currentTheme).restaurantHeaderRow}>
        <TextDefault bolder H4 textColor={currentTheme.black}>
          {t(activeSegment === 'restaurant' ? 'Restaurants' : 'allStores')}
        </TextDefault>
        <View style={styles(currentTheme).restaurantActions}>
          <TouchableOpacity style={styles(currentTheme).filterLink} onPress={openFiltersSheet} accessibilityRole='button' accessibilityLabel={t('filters')}>
            <Ionicons name='options-outline' size={16} color={currentTheme.gray600} />
            <TextDefault bold textColor={currentTheme.gray600}>
              {t('filters')}
            </TextDefault>
          </TouchableOpacity>
          <TouchableOpacity style={styles(currentTheme).mapButton} onPress={() => location && navigation.navigate('MapSection', { location, restaurants: restaurantData })} accessibilityRole='button' accessibilityLabel={t('Map')}>
            <Ionicons name='map-outline' size={16} color={currentTheme.gray600} />
          </TouchableOpacity>
        </View>
      </View>
      {filterSectionApplied && <AppliedFilters filters={appliedFilters} />}
    </View>
  )

  // ---- list assembly ----
  const listData = useMemo(() => {
    return [{ key: '__header', type: 'header' }, { key: '__foodTypes', type: 'foodTypes' }, { key: '__promo', type: 'promo' }, { key: '__popular', type: 'popular' }, { key: '__brands', type: 'brands' }, { key: '__heading', type: 'heading' }, ...(restaurantData || [])]
  }, [restaurantData, foodTypes, popularRestaurants, brandRestaurants, homeBanners])

  const keyExtractor = useCallback((item, index) => item?.key || item?._id || index.toString(), [])

  // Prefetch the restaurant detail (+ hero image) for the cards near the top of
  // the feed so tapping one paints instantly. Bounded: only the first 3 visible
  // restaurant rows per change, and prefetchRestaurant() de-dupes + uses
  // cache-first, so this never re-fetches or floods the network on scroll.
  // Refs keep the handler/config stable (RN forbids changing them at runtime).
  const client = useApolloClient()
  const clientRef = useRef(client)
  clientRef.current = client
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems
      .map((v) => v.item)
      .filter((it) => it && it._id && it.image && !it.type && it.shopType !== 'grocery')
      .slice(0, 3)
      .forEach((it) => prefetchRestaurant(clientRef.current, it._id, it.image))
  }).current

  const renderItem = useCallback(
    ({ item }) => {
      switch (item?.type) {
        case 'header':
          return renderHomeHeader()
        case 'foodTypes':
          return renderFoodTypes()
        case 'promo':
          return renderPromoBanner()
        case 'popular':
          return renderPopularSection()
        case 'brands':
          return renderBrandsSection()
        case 'heading':
          return renderRestaurantFilters()
        default:
          if (item && item?.image && item?._id) {
            return (
              <View style={styles(currentTheme).cardWrapper}>
                <NewRestaurantCard {...item} fullWidth isOpen={isOpen(item)} />
              </View>
            )
          }
          return null
      }
    },
    [currentTheme, activeSegment, activeCollection, filterSectionApplied, appliedFilters, restaurantData, allShopTypes, sortedMostOrderedRestaurants, sortedMostOrderedGrocery, orderLoading, mostOrderedGroceryLoading, isRefreshing, location, displayAddress, homeBanners]
  )

  const userFriendlyErrorMessage = getErrorMessage(activeQ.error)
  if (activeQ.error) return <ErrorView refetchFunctions={[restaurantQ.refetch, groceryQ.refetch, refetchBanners]} errorMessage={userFriendlyErrorMessage} />
  if (!connect) return <ErrorView refetchFunctions={[restaurantQ.refetch, groceryQ.refetch, refetchBanners]} />

  const initialLoading = activeQ.loading && (activeAllData === null || activeAllData === undefined)

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles().flex, styles(currentTheme).screenBackground]}>
      <View style={[styles().flex, styles(currentTheme).container]}>
        {initialLoading
          ? (
          <View style={styles().centerFill}>
            <ActivityIndicator size='large' color={currentTheme.spinnerColor} />
          </View>
            )
          : !location
              ? (
          <View style={styles().centerFill}>
            <Spinner backColor='transparent' />
          </View>
                )
              : (
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={false}
            onScroll={handleBottomTabBarScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            contentContainerStyle={[styles(currentTheme).listContent, hasActiveOrders && { paddingBottom: scale(160) }]}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[currentTheme.iconColorPink]} />}
            ListEmptyComponent={null}
            ListFooterComponent={
              restaurantData?.length === 0
                ? (
                <View style={styles().emptyViewContainer}>
                  <View style={styles(currentTheme).emptyViewBox}>
                    <TextDefault bold H4 center textColor={currentTheme.fontMainColor}>
                      {!filterApplied ? t('notAvailableinYourArea') : t('noMatchingResults')}
                    </TextDefault>
                    <TextDefault textColor={currentTheme.fontMainColor} center>
                      {!filterApplied ? (activeSegment === 'restaurant' ? t('noRestaurant') : t('noGrocery')) : t('noMatchingResultsDesc')}
                    </TextDefault>
                  </View>
                </View>
                  )
                : null
            }
          />
                )}
        <ForceUpdate />
      </View>

      <ActiveOrders onActiveOrdersChange={setHasActiveOrders} />

      <MainModalize modalRef={modalRef} currentTheme={currentTheme} isLoggedIn={isLoggedIn} addressIcons={addressIcons} modalHeader={modalHeader} modalFooter={modalFooter} setAddressLocation={setAddressLocation} onEditAddress={onEditAddress} onDeleteAddress={onDeleteAddress} deletingAddress={deletingAddress} onClose={() => modalRef.current?.close()} onClosed={() => setTabBarBlocked(false)} profile={profile} location={location} />

      <ModalDropdown theme={currentTheme} visible={citiesModalVisible} onItemPress={handleMarkerPress} onClose={() => setCitiesModalVisible(false)} />

      <Modalize ref={filtersModalRef} modalStyle={styles(currentTheme).modal} adjustToContentHeight overlayStyle={styles(currentTheme).overlay} handleStyle={styles(currentTheme).handle} handlePosition='inside' onOpen={() => setFiltersSheetVisible(true)} onClosed={() => setFiltersSheetVisible(false)} openAnimationConfig={{ timing: { duration: 400 }, spring: { speed: 20, bounciness: 10 } }} closeAnimationConfig={{ timing: { duration: 400 }, spring: { speed: 20, bounciness: 10 } }}>
        <Filters
          filters={filters}
          setFilters={setFilters}
          applyFilters={applyFilters}
          onClose={() => {
            resetFilters()
            filtersModalRef.current?.close()
          }}
        />
      </Modalize>
    </SafeAreaView>
  )
}

export default Home
