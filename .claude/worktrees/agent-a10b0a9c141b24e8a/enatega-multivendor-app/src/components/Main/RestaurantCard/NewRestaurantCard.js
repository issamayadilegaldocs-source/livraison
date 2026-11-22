import { useNavigation } from '@react-navigation/native'
import React, { useContext } from 'react'
import { TouchableOpacity, View, Alert, Platform } from 'react-native'
import { Image } from 'expo-image'
import ConfigurationContext from '../../../context/Configuration'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { scale } from '../../../utils/scaling'
import { theme } from '../../../utils/themeColors'
import TextDefault from '../../Text/TextDefault/TextDefault'
import styles from './styles'
import { AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { addFavouriteRestaurant } from '../../../apollo/mutations'
import UserContext from '../../../context/User'
import { useApolloClient, useMutation } from '@apollo/client'
import gql from 'graphql-tag'
import { profile, FavouriteRestaurant } from '../../../apollo/queries'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import Spinner from '../../Spinner/Spinner'
import Bicycle from '../../../assets/SVG/Bicycle'
import { storeSearch } from '../../../utils/recentSearch'
import { prefetchRestaurant } from '../../../utils/prefetchRestaurant'
import Ripple from 'react-native-material-ripple'

const ADD_FAVOURITE = gql`
  ${addFavouriteRestaurant}
`
const PROFILE = gql`
  ${profile}
`
const FAVOURITERESTAURANTS = gql`
  ${FavouriteRestaurant}
`

function NewRestaurantCard(props) {
  const { t, i18n } = useTranslation()
  const configuration = useContext(ConfigurationContext)
  const navigation = useNavigation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }

  const { profile } = useContext(UserContext)
  const client = useApolloClient()
  const heart = profile ? profile.favourite.includes(props?._id) : false

  // Warm the restaurant detail cache + hero image while the finger is still down,
  // so the destination paints instantly on release. Restaurants only — the
  // grocery branch routes to a different screen with a different query.
  const handlePrefetch = () => {
    if (props?.shopType !== 'grocery') {
      prefetchRestaurant(client, props?._id, props?.image)
    }
  }
  const [mutate, { loading: loadingMutation }] = useMutation(ADD_FAVOURITE, {
    onCompleted,
    refetchQueries: [PROFILE, FAVOURITERESTAURANTS]
  })
  const isRestaurantOpen = props?.isOpen
  const isAvailable = props?.isAvailable
  const isRestaurantClosed = !isRestaurantOpen || !isAvailable
  const reviewAverage = Number(props?.reviewAverage)
  const reviewCount = Number(props?.reviewCount)
  const hasRating = reviewCount > 0 && reviewAverage > 0

  const categoryTitles = props?.categories?.map((category) => category?.title).filter(Boolean) ?? []
  const cuisineNames = props?.cuisines?.filter(Boolean) ?? []
  const tagNames = props?.tags?.filter(Boolean) ?? []
  const subtitleParts = categoryTitles.length ? categoryTitles : cuisineNames.length ? cuisineNames : tagNames
  const subtitle = subtitleParts.join(' · ')

  function onCompleted() {
    FlashMessage({ message: t('favouritelistUpdated') })
  }

  const handleAddToFavorites = () => {
    if (!loadingMutation && profile) {
      mutate({ variables: { id: props?._id } })
    } else if (!profile) {
      FlashMessage({ message: t('loginRequired') })
      navigation.navigate('Profile')
    }
  }

  const handleRestaurantClick = () => {
    if (isRestaurantClosed) {
      Alert.alert(
        '',
        t('restaurantClosed'),
        [
          {
            text: t('close'),
            onPress: () => {},
            style: 'cancel'
          },
          {
            text: t('seeMenu'),
            onPress: () => {
              if (props.shopType === 'grocery') {
                navigation.navigate('NewRestaurantDetailDesign', { ...props })
              } else {
                navigation.navigate('Restaurant', { ...props })
              }
            }
          }
        ],
        { cancelable: true }
      )
    } else {
      if (props?.shopType === 'grocery') {
        navigation.navigate('NewRestaurantDetailDesign', { ...props })
      } else {
        navigation.navigate('Restaurant', { ...props })
      }
    }
    if (props?.isSearch) {
      storeSearch(props?.isSearch)
    }
  }
  return (
    <View style={[
      styles(currentTheme).offerContainer,
      props?.fullWidth && { width: '100%', marginRight: 0 },
      { position: 'relative' }
    ]}>
      <Ripple
        rippleColor={'#F5F5F5'}
        style={[
          { width: '100%', height: '100%' },
          Platform.OS === 'android' && {
            overflow: 'hidden',
            borderRadius: 16
          }
        ]}
        activeOpacity={0.8}
        onPressIn={handlePrefetch}
        onPress={handleRestaurantClick}
        rippleContainerBorderRadius={16}
        rippleDuration={Platform.OS === 'android' ? 300 : 400}
        rippleSize={Platform.OS === 'android' ? 150 : 200}
        disabled={false}
      >
        <View
          style={[
            styles().container,
            themeContext.ThemeValue === 'Pink' && !props?.fullWidth && {
              backgroundColor: 'white',
              borderRadius: 16,

              // iOS shadow
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              // Android shadow
              elevation: 2,
              marginBottom: 5
            }
          ]}
        >
          <View style={styles().imageContainer}>
            <Image contentFit='cover' transition={150} cachePolicy='memory-disk' source={{ uri: props?.image }} style={[styles().restaurantImage, props?.fullWidth && { width: '100%' }]} />
            {isRestaurantClosed && (
              <View style={styles(currentTheme).closedOverlay}>
                <TextDefault H4 textColor={currentTheme.white} bold>
                  Closed
                </TextDefault>
              </View>
            )}
          </View>
          <View style={styles().descriptionContainer}>
            <View style={styles(currentTheme).aboutRestaurant}>
              <TextDefault H4 numberOfLines={1} textColor={currentTheme.fontThirdColor} bolder>
                {props?.name}
              </TextDefault>
            </View>
            {subtitle
              ? (
              <TextDefault textColor={currentTheme.gray600} numberOfLines={1} bold Normal style={styles(currentTheme).offerCategoty}>
                {subtitle}
              </TextDefault>
                )
              : null}
            <View style={styles().border} />
            <View style={styles(currentTheme).deliveryInfo}>
              <View style={styles(currentTheme).deliveryTime}>
                <AntDesign name='clock-circle' size={14} color={currentTheme.editProfileButton} />
                <TextDefault textColor={currentTheme.editProfileButton} numberOfLines={1} bold Normal>
                  {props?.deliveryTime + ' '}
                  {t('min')}
                </TextDefault>
              </View>
              <View style={styles(currentTheme).deliveryTime}>
                <Bicycle color={currentTheme.newFontcolor} />
                <TextDefault textColor={currentTheme.newFontcolor} numberOfLines={1} bold Normal>
                  {configuration.currencySymbol} {configuration.deliveryRate}
                </TextDefault>
              </View>
              {hasRating && (
                <View style={styles(currentTheme).aboutRestaurant}>
                  <FontAwesome5 name='star' size={14} color={currentTheme.newFontcolor} />
                  <TextDefault textColor={currentTheme.newFontcolor} bold Normal>
                    {props?.reviewAverage}
                  </TextDefault>
                  <TextDefault textColor={currentTheme.newFontcolor} bold Normal>
                    ({props?.reviewCount})
                  </TextDefault>
                </View>
              )}
            </View>
          </View>
        </View>
      </Ripple>

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={loadingMutation}
        onPress={handleAddToFavorites}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          position: 'absolute',
          top: 10,
          ...(currentTheme?.isRTL ? { left: 10 } : { right: 10 }),
          width: scale(32),
          height: scale(32),
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          elevation: 1000
        }}
      >
        <View style={styles(currentTheme).favouriteOverlay}>
          {loadingMutation
            ? <Spinner size={'small'} backColor={'transparent'} spinnerColor={currentTheme.iconColorDark} />
            : (
              <Ionicons
                name={
                  heart
                    ? 'heart'
                    : 'heart-outline'
                }
                size={scale(15)}
                color={currentTheme.iconColor}
              />
              )}
        </View>
      </TouchableOpacity>
    </View>
  )
}

export default React.memo(NewRestaurantCard)
