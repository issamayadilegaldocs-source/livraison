import React, {
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import MapView, { Marker } from 'react-native-maps'
import styles from './styles'
import { Image, View, FlatList, TouchableOpacity } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import Bicycle from '../../assets/SVG/Bicycle'
import { AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import ConfigurationContext from '../../context/Configuration'
import { LocationContext } from '../../context/Location'
import { useRestaurantQueries } from '../../ui/hooks/useRestaurantQueries'
import { useShowBottomTabBarOnFocus } from '../../context/BottomTabBarVisibility'
import { useTabBarSpace } from '../../utils/useTabBarSpace'
import { useTranslation } from 'react-i18next'
import { safeFitToCoordinates, safeAnimateToRegion } from '../../utils/safeFitToCoordinates'

export default function MapSection() {
  const { i18n } = useTranslation()
  const mapRef = useRef()
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const tabBarSpace = useTabBarSpace()
  // Reveal the floating bottom tab bar whenever the Map tab gains focus.
  // Without this the nav stays hidden if it was scrolled away on another tab.
  useShowBottomTabBarOnFocus()
  // When opened from Home the location + restaurants arrive via params. When
  // opened from the bottom tab there are no params, so fall back to the
  // selected location from context and the nearby restaurants query.
  const { location: contextLocation } = useContext(LocationContext)
  const location = route?.params?.location || contextLocation
  const canGoBack = !!route?.params?.location
  const { allData: nearbyRestaurants } = useRestaurantQueries('restaurant', location, 'restaurant')
  // Only keep restaurants that have valid [lng, lat] coordinates — some
  // records come back with location: null or non-numeric coordinates and
  // would feed NaN into the map region, crashing react-native-maps.
  const restaurants = ((route?.params?.restaurants?.length ? route.params.restaurants : nearbyRestaurants) || []).filter(
    (rest) =>
      Array.isArray(rest?.location?.coordinates) &&
      rest.location.coordinates.length >= 2 &&
      Number.isFinite(parseFloat(rest.location.coordinates[0])) &&
      Number.isFinite(parseFloat(rest.location.coordinates[1]))
  )
  const [visibleMarkerIndex, setVisibleMarkerIndex] = useState(0)
  const [isMapReady, setIsMapReady] = useState(false)
  const configuration = useContext(ConfigurationContext)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false
    })
  }, [navigation, currentTheme])

  const handleMarkerAnimate = useCallback((coord) => {
    safeAnimateToRegion(mapRef, {
      ...coord,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421
    })
  }, [])

  // RN forbids changing onViewableItemsChanged/viewabilityConfig on the fly —
  // keep both referentially stable across re-renders via useRef.
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleMarkerIndex(viewableItems[0].index)
    }
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  useEffect(() => {
    if (!restaurants?.length || visibleMarkerIndex === null || visibleMarkerIndex === undefined) return
    const rest = restaurants[visibleMarkerIndex]
    if (!rest) return
    const coord = {
      latitude: parseFloat(rest.location.coordinates[1]),
      longitude: parseFloat(rest.location.coordinates[0])
    }
    handleMarkerAnimate(coord)
  }, [handleMarkerAnimate, restaurants, visibleMarkerIndex])

  const userLat = parseFloat(location?.latitude)
  const userLng = parseFloat(location?.longitude)
  const userCoordinate = useMemo(() => ({ latitude: userLat, longitude: userLng }), [userLat, userLng])
  const restaurantCoordinates = useMemo(
    () =>
      restaurants.map((rest) => ({
        latitude: parseFloat(rest.location.coordinates[1]),
        longitude: parseFloat(rest.location.coordinates[0])
      })),
    [restaurants]
  )

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !Number.isFinite(userCoordinate.latitude) || !Number.isFinite(userCoordinate.longitude)) return

    const coordinates = [userCoordinate, ...restaurantCoordinates]
    const fitMap = setTimeout(() => {
      if (coordinates.length === 1) {
        handleMarkerAnimate(userCoordinate)
        return
      }

      safeFitToCoordinates(mapRef, coordinates, {
        edgePadding: {
          top: 90,
          right: 45,
          bottom: 260,
          left: 45
        },
        animated: true
      })
    }, 250)

    return () => clearTimeout(fitMap)
  }, [handleMarkerAnimate, isMapReady, restaurantCoordinates, userCoordinate])

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return <View style={styles().screen} />
  }

  // Center on the first valid restaurant when available, otherwise the user.
  const regionCenter = restaurants?.length
    ? {
        latitude: parseFloat(restaurants[0].location.coordinates[1]),
        longitude: parseFloat(restaurants[0].location.coordinates[0])
      }
    : { latitude: userLat, longitude: userLng }

  return (
    <View style={styles().screen}>
      <MapView
        ref={mapRef}
        style={styles().map}
        showsUserLocation
        zoomEnabled={true}
        zoomControlEnabled={true}
        rotateEnabled={false}
        // provider={PROVIDER_DEFAULT}
        // customMapStyle={mapStyle}
        onMapReady={() => setIsMapReady(true)}
        initialRegion={{
          ...regionCenter,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421
        }}
      >
        <Marker coordinate={{ latitude: userLat, longitude: userLng }} title='Current Address'>
          <Image source={require('../../assets/images/user.png')} style={styles().userMarkerImage} />
        </Marker>
        {restaurants &&
          restaurants?.map((rest, index) => {
            const coord = {
              latitude: parseFloat(rest.location.coordinates[1]),
              longitude: parseFloat(rest.location.coordinates[0])
            }
            return (
              <Marker
                coordinate={coord}
                key={index}
                onPress={() => {
                  if (rest.shopType === 'grocery' || rest.shopType === 'store') {
                    navigation.navigate('NewRestaurantDetailDesign', { ...rest })
                  } else {
                    navigation.navigate('Restaurant', { ...rest })
                  }
                }}
                style={styles().markerContainer}
              >
                <View
                  style={styles(currentTheme).greenDot}
                />
                <Image
                  source={{ uri: rest?.image }}
                  width={20}
                  style={styles().markerImage}
                />
              </Marker>
            )
          })}
      </MapView>
      <View
        style={[
          styles().restContainer,
          // Keep the restaurant cards above the floating bottom tab bar.
          { bottom: tabBarSpace }
        ]}
        pointerEvents='box-none'
      >
        <FlatList
          data={restaurants}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={styles(currentTheme).restCard}
                onPress={() => {
                  if (item.shopType === 'grocery' || item.shopType === 'store') {
                    navigation.navigate('NewRestaurantDetailDesign', { ...item })
                  } else {
                    navigation.navigate('Restaurant', { ...item })
                  }
                }}
                activeOpacity={0.8}
              >
                <Image
                  resizeMode='cover'
                  source={{ uri: item?.image }}
                  style={styles().restImg}
                />
                <View style={{ gap: 3 }}>
                  <TextDefault
                    H5
                    bolder
                    textColor={currentTheme.buttonText}
                  >
                    {item.name}
                  </TextDefault>
                  <TextDefault
                    numberOfLines={1}
                    bold
                    Normal
                    textColor={currentTheme.subText}
                  >
                    {item?.tags?.slice(0, 2)?.join(', ')}
                  </TextDefault>
                  <View
                    style={styles().restInfo}
                  >
                    <View
                      style={styles().deliveryTime}
                    >
                      <Bicycle color={currentTheme.color2} />

                      <TextDefault
                        textColor={currentTheme.color2}
                        numberOfLines={1}
                        bold
                        Small
                      >
                        {configuration.currencySymbol}{' '}{configuration.deliveryRate}
                      </TextDefault>
                    </View>
                    <View
                      style={styles().deliveryTime}
                    >
                      <AntDesign
                        name='clock-circle'
                        size={14}
                        color={currentTheme.editProfileButton}
                      />

                      <TextDefault
                        textColor={currentTheme.editProfileButton}
                        numberOfLines={1}
                        bold
                        Small
                      >
                        {item.deliveryTime + ' '} min
                      </TextDefault>
                    </View>
                    <View
                      style={styles().deliveryTime}
                    >
                      <FontAwesome5
                        name='star'
                        size={14}
                        color={currentTheme.color2}
                      />

                      <TextDefault bold Small>
                        {item.reviewAverage}
                      </TextDefault>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
          keyExtractor={(item) => item?._id}
          contentContainerStyle={{ flexGrow: 1, gap: 16, marginHorizontal: 15, paddingRight: 50 }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          horizontal={true}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          inverted={currentTheme?.isRTL}
        />
      </View>
      {canGoBack && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 15,
            backgroundColor: currentTheme.white,
            borderRadius: 50,
            height: 40,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            elevation: 12
          }}
        >
          <Ionicons name='arrow-back' size={24} color='black' />
        </TouchableOpacity>
      )}
    </View>
  )
}
