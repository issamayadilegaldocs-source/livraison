import React, {
  useState,
  useContext,
  useLayoutEffect,
  useEffect,
  useMemo,
  useCallback
} from 'react'
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  InteractionManager,
  Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import gql from 'graphql-tag'
import { FavouriteRestaurant, profile as profileQuery, MY_LOYALTY_ACCOUNT } from '../../apollo/queries'
import { addFavouriteRestaurant } from '../../apollo/mutations'
import ChangePassword from './ChangePassword'
import { theme } from '../../utils/themeColors'
import UserContext from '../../context/User'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import styles from './styles'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import analytics from '../../utils/analytics'

import { useTranslation } from 'react-i18next'
import Spinner from '../../components/Spinner/Spinner'
import { useMutation, useQuery } from '@apollo/client'
import { LocationContext } from '../../context/Location'
import OrdersContext from '../../context/Orders'
import useHomeRestaurants from '../../ui/hooks/useRestaurantOrderInfo'
import { isOpen, sortRestaurantsByOpenStatus } from '../../utils/customFunctions'

import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'
import { useBottomTabBarScroll, useShowBottomTabBarOnFocus } from '../../context/BottomTabBarVisibility'
import { useTabBarSpace } from '../../utils/useTabBarSpace'
import { ACTIVE_ORDER_STATUSES } from '../../utils/enums'
import ConfigurationContext from '../../context/Configuration'
import {
  AntDesign,
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons
} from '@expo/vector-icons'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'

const RESTAURANTS = gql`
  ${FavouriteRestaurant}
`
const ADD_FAVOURITE = gql`
  ${addFavouriteRestaurant}
`
const PROFILE_QUERY = gql`
  ${profileQuery}
`

const initialsFromName = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'U'

const tagsForRestaurant = (restaurant = {}) => {
  const categories = restaurant.categories?.map((category) => category?.title).filter(Boolean) ?? []
  const cuisines = restaurant.cuisines?.filter(Boolean) ?? []
  const tags = restaurant.tags?.filter(Boolean) ?? []
  return (categories.length ? categories : cuisines.length ? cuisines : tags).slice(0, 3).join(' · ')
}

function Profile(props) {
  const Analytics = analytics()
  const navigation = useNavigation()
  const { t, i18n } = useTranslation()
  const [toggleView, setToggleView] = useState(true)
  const [modelVisible, setModalVisible] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { location } = useContext(LocationContext)

  const { profile } = useContext(UserContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    profilePageBackground: themeContext.ThemeValue === 'Dark' ? '#0F0F10' : '#F6F6F6',
    profileSurface: themeContext.ThemeValue === 'Dark' ? '#1C1C1E' : '#FFFFFF',
    profileCard: themeContext.ThemeValue === 'Dark' ? '#2A2A2C' : '#F6F6F6',
    profileText: themeContext.ThemeValue === 'Dark' ? '#FFFFFF' : '#000000',
    profileMuted: themeContext.ThemeValue === 'Dark' ? '#8E8E93' : '#AFAFAF',
    profileSecondaryText: themeContext.ThemeValue === 'Dark' ? '#C7C7CC' : '#757575',
    profileChip: themeContext.ThemeValue === 'Dark' ? '#2A2A2C' : '#F3F3F3',
    profileChipText: themeContext.ThemeValue === 'Dark' ? '#D1D1D6' : '#555555',
    profileDivider: themeContext.ThemeValue === 'Dark' ? '#2F2F31' : '#F3F3F3',
    profileChevron: themeContext.ThemeValue === 'Dark' ? '#636366' : '#CFCFCF',
    profileVersion: themeContext.ThemeValue === 'Dark' ? '#5F5F63' : '#C8C8C8',
    profileBlue: '#276EF1',
    profileStar: '#FFB800',
    ...theme[themeContext.ThemeValue]
  }
  const configuration = useContext(ConfigurationContext)
  const handleBottomTabBarScroll = useBottomTabBarScroll()
  const tabBarSpace = useTabBarSpace()
  useShowBottomTabBarOnFocus()
  const { orders } = useContext(OrdersContext)
  const [mutateFavourite, { loading: favouriteMutationLoading }] = useMutation(ADD_FAVOURITE, {
    onCompleted: () => FlashMessage({ message: t('favouritelistUpdated') }),
    refetchQueries: [PROFILE_QUERY, RESTAURANTS]
  })

  const activeOrders = useMemo(() => {
    return orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.orderStatus))
  }, [orders])

  const { data: loyaltyData } = useQuery(MY_LOYALTY_ACCOUNT, {
    skip: !configuration?.loyaltyEnabled,
    fetchPolicy: 'network-only'
  })
  const loyaltyPoints = loyaltyData?.myLoyaltyAccount?.points ?? 0
  const loyaltyLifetime = loyaltyData?.myLoyaltyAccount?.lifetimePoints ?? 0
  const loyaltyRedemptionRate = configuration?.loyaltyPointsRedemptionRate ?? 0
  const loyaltyCashValue = loyaltyRedemptionRate > 0 ? (loyaltyPoints / loyaltyRedemptionRate).toFixed(2) : '0.00'

  const { data, loading, refetch } = useQuery(RESTAURANTS, {
    variables: {
      longitude: location?.longitude || null,
      latitude: location?.latitude || null
    },
    fetchPolicy: 'network-only',
    errorPolicy: 'all'
  })
  const { orderLoading, orderData } = useHomeRestaurants()

  const recentOrderRestaurantsData = orderData?.recentOrderRestaurants ?? []
  const favouriteRestaurants = useMemo(
    () => sortRestaurantsByOpenStatus(data?.userFavourite || []).filter(Boolean),
    [data?.userFavourite]
  )
  const displayName = profile?.name || t('titleProfile')
  const activeOrdersLabel = `${activeOrders?.length || 0} ${t('ActiveOrder')}`
  const savedAddresses = Array.isArray(profile?.addresses) ? profile.addresses.length : 0

  useFocusEffect(
    useCallback(() => {
      let isActive = true
      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) {
          refetch()
        }
      })

      return () => {
        isActive = false
        task?.cancel?.()
      }
    }, [refetch])
  )

  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.menuBar)
    }
    StatusBar.setBarStyle(
      themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
    )
  })

  useEffect(() => {
    async function Track() {
      await Analytics.track(Analytics.events.NAVIGATE_TO_PROFILE)
    }
    Track()
  }, [])

  useLayoutEffect(() => {
    props?.navigation.setOptions({
      headerRight: null,
      headerLeft: null,
      headerTitleAlign: 'center',
      headerShown: false,
      headerTitleStyle: {
        color: currentTheme.newFontcolor
      },
      headerStyle: {
        backgroundColor: currentTheme.newHeaderbg,
        elevation: 0,
        shadowOpacity: 0
      },
      passChecker: showPass,
      closeIcon: toggleView,
      closeModal: setToggleView,
      modalSetter: setModalVisible,
      passwordButton: setShowPass
    })
  }, [props?.navigation, showPass, toggleView, themeContext.ThemeValue])

  const { isConnected: connect } = useNetworkStatus()
  if (!connect) return <ErrorView refetchFunctions={[refetch]} />

  const openRestaurant = (restaurant) => {
    if (!restaurant) return
    const restaurantOpen = isOpen(restaurant)
    if (restaurant.shopType === 'grocery') {
      navigation.navigate('NewRestaurantDetailDesign', {
        ...restaurant,
        isOpen: restaurantOpen,
        isAvailable: restaurant.isAvailable || true
      })
      return
    }
    navigation.navigate('Restaurant', {
      ...restaurant,
      isOpen: restaurantOpen,
      isAvailable: restaurant.isAvailable || true
    })
  }

  const toggleFavourite = (id) => {
    if (!id || favouriteMutationLoading) return
    mutateFavourite({ variables: { id } })
  }

  const renderQuickAccessItem = ({ icon, title, subtitle, onPress }) => (
    <TouchableOpacity
      key={title}
      activeOpacity={0.82}
      style={styles(currentTheme).quickAccessCard}
      onPress={onPress}
    >
      <View style={styles(currentTheme).quickAccessIcon}>
        {icon}
      </View>
      <TextDefault numberOfLines={1} bolder textColor={currentTheme.profileText} style={styles().quickAccessTitle}>
        {title}
      </TextDefault>
      <TextDefault numberOfLines={1} textColor={currentTheme.profileMuted} style={styles().quickAccessSubtitle}>
        {subtitle}
      </TextDefault>
    </TouchableOpacity>
  )

  const renderFavouriteCard = (restaurant) => (
    <TouchableOpacity
      key={restaurant._id}
      activeOpacity={0.84}
      style={styles(currentTheme).favouriteCard}
      onPress={() => openRestaurant(restaurant)}
    >
      <View style={styles().favouriteImageWrap}>
        {restaurant.image
          ? (
          <Image source={{ uri: restaurant.image }} resizeMode='cover' style={styles().favouriteImage} />
            )
          : (
          <View style={styles(currentTheme).imageFallback}>
            <TextDefault bolder textColor={currentTheme.white} style={styles().imageFallbackText}>
              {initialsFromName(restaurant.name)}
            </TextDefault>
          </View>
            )}
        <View style={styles().imageShade} />
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={favouriteMutationLoading}
          style={styles(currentTheme).heartButton}
          onPress={() => toggleFavourite(restaurant._id)}
        >
          <AntDesign name='heart' size={14} color={currentTheme.profileText} />
        </TouchableOpacity>
      </View>
      <View style={styles().favouriteInfo}>
        <TextDefault numberOfLines={1} bolder textColor={currentTheme.profileText} style={styles().restaurantName}>
          {restaurant.name}
        </TextDefault>
        <TextDefault numberOfLines={1} textColor={currentTheme.profileMuted} style={styles().restaurantMeta}>
          {tagsForRestaurant(restaurant) || restaurant.address}
        </TextDefault>
        <View style={styles().restaurantStats}>
          <View style={styles().statInline}>
            <AntDesign name='clockcircle' size={10} color={currentTheme.profileBlue} />
            <TextDefault bold textColor={currentTheme.profileBlue} style={styles().statText}>
              {restaurant.deliveryTime} {t('min')}
            </TextDefault>
          </View>
          <View style={styles().statInline}>
            <Feather name='shopping-cart' size={11} color={currentTheme.profileSecondaryText} />
            <TextDefault bold textColor={currentTheme.profileSecondaryText} style={styles().statText}>
              {configuration?.currencySymbol}{restaurant.minimumOrder || configuration?.deliveryRate || 0}
            </TextDefault>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderOrderAgainCard = (restaurant) => (
    <TouchableOpacity
      key={restaurant._id}
      activeOpacity={0.84}
      style={styles(currentTheme).orderAgainCard}
      onPress={() => openRestaurant(restaurant)}
    >
      <View style={styles().orderThumb}>
        {restaurant.image
          ? <Image source={{ uri: restaurant.image }} resizeMode='cover' style={styles().orderThumbImage} />
          : (
          <TextDefault bolder textColor={currentTheme.white} style={styles().orderThumbText}>
            {initialsFromName(restaurant.name)}
          </TextDefault>
            )}
      </View>
      <View style={styles().orderAgainInfo}>
        <TextDefault numberOfLines={1} bolder textColor={currentTheme.profileText} style={styles().orderAgainTitle}>
          {restaurant.name}
        </TextDefault>
        <View style={styles().orderAgainMetaRow}>
          <TextDefault textColor={currentTheme.profileSecondaryText} style={styles().orderAgainMeta}>
            {restaurant.deliveryTime} {t('min')}
          </TextDefault>
          <View style={styles(currentTheme).dot} />
          <TextDefault bold textColor={currentTheme.profileText} style={styles().orderAgainMeta}>
            {configuration?.currencySymbol}{restaurant.minimumOrder || configuration?.deliveryRate || 0}
          </TextDefault>
          {!!restaurant.reviewAverage && (
            <View style={styles().statInline}>
              <FontAwesome5 name='star' size={10} color={currentTheme.profileStar} />
              <TextDefault bold textColor={currentTheme.profileSecondaryText} style={styles().orderAgainMeta}>
                {restaurant.reviewAverage}
              </TextDefault>
            </View>
          )}
        </View>
      </View>
      <View style={styles(currentTheme).reorderButton}>
        <Feather name='refresh-cw' size={15} color={currentTheme.profileSurface} />
      </View>
    </TouchableOpacity>
  )

  const renderSettingsRow = ({ icon, title, subtitle, onPress }) => (
    <TouchableOpacity
      key={title}
      activeOpacity={0.76}
      style={styles(currentTheme).settingsRow}
      onPress={onPress}
    >
      <View style={styles(currentTheme).settingsIcon}>
        {icon}
      </View>
      <View style={styles().settingsText}>
        <TextDefault numberOfLines={1} bold textColor={currentTheme.profileText} style={styles().settingsTitle}>
          {title}
        </TextDefault>
        {!!subtitle && (
          <TextDefault numberOfLines={1} textColor={currentTheme.profileMuted} style={styles().settingsSubtitle}>
            {subtitle}
          </TextDefault>
        )}
      </View>
      <Feather name={currentTheme.isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={currentTheme.profileChevron} />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: currentTheme.profilePageBackground }}
    >
      <ChangePassword
        modalVisible={modelVisible}
        hideModal={() => {
          setModalVisible(false)
        }}
      />
      <View style={styles(currentTheme).formContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles(currentTheme).flex}
        >
          <ScrollView
            style={styles().flex}
            contentContainerStyle={[styles().scrollContent, { paddingBottom: tabBarSpace }]}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
            onScroll={handleBottomTabBarScroll}
            scrollEventThrottle={16}
          >
            <View style={styles(currentTheme).profileHeader}>
              <View style={styles(currentTheme).profileHeaderTop}>
                <View style={styles().profileNameBlock}>
                  <TextDefault numberOfLines={1} bolder textColor={currentTheme.profileText} style={styles().profileName}>
                    {displayName}
                  </TextDefault>
                  <View style={styles().verifiedRow}>
                    <FontAwesome5 name='star' size={13} color={currentTheme.profileStar} />
                    <TextDefault bold textColor={currentTheme.profileText} style={styles().verifiedText}>
                      {Number(profile?.rating || 5).toFixed(1)}
                    </TextDefault>
                    <View style={styles(currentTheme).dot} />
                    <TextDefault textColor={currentTheme.profileSecondaryText} style={styles().verifiedText}>
                      {t('Verified account')}
                    </TextDefault>
                  </View>
                </View>
                <TouchableOpacity activeOpacity={0.8} style={styles(currentTheme).avatar} onPress={() => navigation.navigate('Account')}>
                  <TextDefault bolder textColor={currentTheme.profileSurface} style={styles().avatarText}>
                    {initialsFromName(profile?.name)}
                  </TextDefault>
                </TouchableOpacity>
              </View>
              <TouchableOpacity activeOpacity={0.76} style={styles(currentTheme).activeOrdersChip} onPress={() => navigation.navigate('MyOrders')}>
                <View style={styles(currentTheme).activeOrdersDot} />
                <TextDefault bold textColor={currentTheme.profileChipText} style={styles().activeOrdersText}>
                  {activeOrdersLabel}
                </TextDefault>
              </TouchableOpacity>
            </View>

            <View style={styles(currentTheme).section}>
              <TextDefault bolder textColor={currentTheme.profileText} style={styles().compactSectionTitle}>
                {t('QuickLinks')}
              </TextDefault>
              <View style={styles().quickAccessGrid}>
                {renderQuickAccessItem({
                  icon: <Ionicons name='receipt-outline' size={19} color={currentTheme.profileText} />,
                  title: t('OrderHistory'),
                  subtitle: t('Past orders'),
                  onPress: () => navigation.navigate('MyOrders')
                })}
                {renderQuickAccessItem({
                  icon: <Ionicons name='chatbubble-outline' size={18} color={currentTheme.profileText} />,
                  title: t('CustomerSupport'),
                  subtitle: t('Help & contact'),
                  onPress: () => navigation.navigate('Help')
                })}
                {renderQuickAccessItem({
                  icon: <Ionicons name='location-outline' size={19} color={currentTheme.profileText} />,
                  title: t('myAddresses'),
                  subtitle: `${savedAddresses} ${t('saved')}`,
                  onPress: () => navigation.navigate('Addresses')
                })}
                {renderQuickAccessItem({
                  icon: <Ionicons name='wallet-outline' size={19} color={currentTheme.profileText} />,
                  title: t('titlePayment'),
                  subtitle: t('Payment methods'),
                  onPress: () => navigation.navigate('Payment')
                })}
              </View>
            </View>

            {configuration?.loyaltyEnabled && (
              <View style={[styles(currentTheme).section, { padding: 16 }]}>
                <View style={{ backgroundColor: currentTheme.main, borderRadius: 16, padding: 16 }}>
                  <TextDefault bolder textColor={'#fff'} style={{ fontSize: 13, opacity: 0.85, marginBottom: 2 }}>
                    {t('loyaltyPoints') || 'Loyalty Points'}
                  </TextDefault>
                  <TextDefault bolder textColor={'#fff'} style={{ fontSize: 36, lineHeight: 44 }}>
                    {loyaltyPoints.toLocaleString()}
                  </TextDefault>
                  <TextDefault textColor={'#fff'} style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                    {t('loyaltyCashValue') || 'Value'}: {configuration?.currencySymbol}{loyaltyCashValue}
                  </TextDefault>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <TextDefault textColor={currentTheme.fontSecondColor} style={{ fontSize: 12 }}>
                    {t('loyaltyLifetime') || 'Total earned'}
                  </TextDefault>
                  <TextDefault bolder textColor={currentTheme.profileText} style={{ fontSize: 12 }}>
                    {loyaltyLifetime.toLocaleString()} pts
                  </TextDefault>
                </View>
              </View>
            )}

            {loading
              ? (
              <Spinner
                size={'small'}
                backColor={currentTheme.profileSurface}
                spinnerColor={currentTheme.main}
              />
                )
              : favouriteRestaurants.length >= 1 && (
              <View style={styles(currentTheme).section}>
                <View style={styles().sectionHeader}>
                  <TextDefault bolder textColor={currentTheme.profileText} style={styles().sectionTitle}>
                    {t('YourFavourites')}
                  </TextDefault>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Favourite')}>
                    <TextDefault bold textColor={currentTheme.profileText} style={styles().seeAllText}>
                      {t('SeeAll')}
                    </TextDefault>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles().horizontalList}
                >
                  {favouriteRestaurants.slice(0, 8).map(renderFavouriteCard)}
                </ScrollView>
              </View>
              )}

            {orderLoading && (
                <Spinner
                  size={'small'}
                  backColor={currentTheme.profileSurface}
                  spinnerColor={currentTheme.main}
                />
            )}
            {!orderLoading && recentOrderRestaurantsData?.length >= 1 && (
              <View style={styles(currentTheme).section}>
                <View style={styles().sectionHeader}>
                  <TextDefault bolder textColor={currentTheme.profileText} style={styles().sectionTitle}>
                    {t('OrderAgain')}
                  </TextDefault>
                </View>
                <View style={styles().orderAgainList}>
                  {sortRestaurantsByOpenStatus(recentOrderRestaurantsData || []).slice(0, 3).map(renderOrderAgainCard)}
                </View>
              </View>
            )}

            <View style={styles(currentTheme).section}>
              <TextDefault bolder textColor={currentTheme.profileText} style={styles().sectionTitlePadded}>
                {t('titleSettings')}
              </TextDefault>
              {renderSettingsRow({
                icon: <MaterialCommunityIcons name='account-outline' size={18} color={currentTheme.profileText} />,
                title: t('Account'),
                subtitle: t('Manage your profile'),
                onPress: () => navigation.navigate('Account')
              })}
              {renderSettingsRow({
                icon: <Ionicons name='location-outline' size={18} color={currentTheme.profileText} />,
                title: t('myAddresses'),
                subtitle: `${savedAddresses} ${t('saved locations')}`,
                onPress: () => navigation.navigate('Addresses')
              })}
              {renderSettingsRow({
                icon: <Ionicons name='notifications-outline' size={18} color={currentTheme.profileText} />,
                title: t('Notifications'),
                subtitle: t('All enabled'),
                onPress: () => navigation.navigate('Account')
              })}
              {renderSettingsRow({
                icon: <Ionicons name='language-outline' size={18} color={currentTheme.profileText} />,
                title: t('Language'),
                subtitle: i18n.language?.toUpperCase(),
                onPress: () => navigation.navigate('Account')
              })}
            </View>

            <View style={styles(currentTheme).section}>
              {renderSettingsRow({
                icon: <Ionicons name='headset-outline' size={18} color={currentTheme.profileText} />,
                title: t('Help & support'),
                onPress: () => navigation.navigate('Help')
              })}
              {renderSettingsRow({
                icon: <Ionicons name='shield-checkmark-outline' size={18} color={currentTheme.profileText} />,
                title: t('Legal'),
                onPress: () => navigation.navigate('About')
              })}
            </View>

            <TextDefault center textColor={currentTheme.profileVersion} style={styles().versionText}>
              v5.0.0
            </TextDefault>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  )
}

export default Profile
