import React, {
  useState,
  useContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useEffect
} from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  StyleSheet
} from 'react-native'
import * as Device from 'expo-device'
import { LocationContext } from '../../context/Location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { theme } from '../../utils/themeColors'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import styles from './styles'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { customMapStyle } from '../../utils/customMapStyles'
import darkMapStyle from '../../utils/DarkMapStyles'
import { useTranslation } from 'react-i18next'
import SearchModal from '../../components/Address/SearchModal'
import { Feather, Ionicons } from '@expo/vector-icons'
import ModalDropdown from '../../components/Picker/ModalDropdown'
import { useNavigation } from '@react-navigation/native'
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps'
import screenOptions from './screenOptions'
import { useLocation } from '../../ui/hooks'
import UserContext from '../../context/User'
import useGeocoding from '../../ui/hooks/useGeocoding'
import CustomMarker from '../../assets/SVG/imageComponents/CustomMarker'
import { safeAnimateToRegion } from '../../utils/safeFitToCoordinates'

// Default location if current location can't be retrieved
const DEFAULT_LATITUDE = 33.95
const DEFAULT_LONGITUDE = 73.56
const LATITUDE_DELTA = 0.035
const LONGITUDE_DELTA = 0.035

// Google Maps renders blank on the iOS simulator, so fall back to Apple Maps
// (PROVIDER_DEFAULT) there. On physical iOS devices and all Android, use Google
// Maps so the valid API key + customMapStyle take effect.
const MAP_PROVIDER =
  Platform.OS === 'ios' && !Device.isDevice ? PROVIDER_DEFAULT : PROVIDER_GOOGLE

export default function AddNewAddress(props) {
  const { isLoggedIn } = useContext(UserContext)
  const { getAddress } = useGeocoding()
  const [searchModalVisible, setSearchModalVisible] = useState(false)
  const [cityModalVisible, setCityModalVisible] = useState(false)
  const [isFetchingAddress, setIsFetchingAddress] = useState(false)
  // Forces a one-pixel relayout of the map after it's ready. On the New
  // Architecture (Fabric) the Android Google MapView mounts but its GL surface
  // never repaints until it receives a size change, leaving the map white.
  // Toggling mapPadding delivers that size change and makes tiles draw.
  const [mapNudge, setMapNudge] = useState(0)
  const [initialLocation, setInitialLocation] = useState({
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE
  })

  const { id, label, prevScreen } = props?.route.params || {}

  const [selectedValue, setSelectedValue] = useState({
    city: '',
    address: '',
    latitude: initialLocation.latitude,
    longitude: initialLocation.longitude
  })
  const { setLocation } = useContext(LocationContext)
  const mapRef = useRef()
  // Monotonic id so only the most recent reverse-geocode result is applied.
  // Prevents stale responses from overwriting newer ones while panning fast.
  const geocodeRequestId = useRef(0)
  const { t, i18n } = useTranslation()

  const themeContext = useContext(ThemeContext)
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }

  const inset = useSafeAreaInsets()
  const navigation = useNavigation()
  const { getCurrentLocation } = useLocation()

  // Reverse-geocode a coordinate and apply it to the form. Race-protected:
  // a newer call invalidates older in-flight responses. `fallback` values are
  // used when Google returns nothing (e.g. ZERO_RESULTS over water/desert).
  const reverseGeocode = useCallback(
    async(latitude, longitude, fallback = {}) => {
      const requestId = ++geocodeRequestId.current
      setIsFetchingAddress(true)
      try {
        const response = await getAddress(latitude, longitude)
        if (requestId !== geocodeRequestId.current) return
        setSelectedValue({
          city: response.city || fallback.city || '',
          address: response.formattedAddress || fallback.address || '',
          latitude,
          longitude
        })
      } catch (error) {
        console.log('Error fetching address:', error.message)
        if (requestId !== geocodeRequestId.current) return
        // Keep the coordinates even if address lookup fails so the pin stays
        // usable; fall back to whatever label we already have.
        setSelectedValue((prev) => ({
          city: fallback.city || prev.city || '',
          address: fallback.address || prev.address || '',
          latitude,
          longitude
        }))
      } finally {
        if (requestId === geocodeRequestId.current) setIsFetchingAddress(false)
      }
    },
    [getAddress]
  )

  const setCurrentLocation = async() => {
    try {
      const { coords, error } = await getCurrentLocation()
      if (!error && coords) {
        const newLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude
        }
        setInitialLocation(newLocation)

        // Animate map to current location; the resulting region settle triggers
        // onRegionChangeComplete, but we resolve the address here directly so it
        // appears even if the animation is interrupted.
        safeAnimateToRegion(
          mapRef,
          {
            ...newLocation,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA
          },
          1000
        )
        await reverseGeocode(coords.latitude, coords.longitude)
      } else {
        Alert.alert(t('locationError'), t('unableToGetLocation'), [
          { text: t('ok') }
        ])
      }
    } catch (error) {
      console.error('Error setting current location:', error)
      Alert.alert(t('locationError'), t('unableToGetLocation'), [
        { text: t('ok') }
      ])
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions(
      screenOptions({
        title: t('addAddress'),
        fontColor: currentTheme.newFontcolor,
        backColor: currentTheme.newheaderBG,
        iconColor: currentTheme.newIconColor,
        lineColor: currentTheme.newIconColor,
        setCurrentLocation,
        locationPrevScreen: prevScreen
      })
    )
  }, [prevScreen])

  // Fetch current location on component mount
  useEffect(() => {
    setCurrentLocation()
  }, [])

  const onSelectCity = useCallback(
    (item) => {
      const latitude = +item.latitude
      const longitude = +item.longitude

      setSelectedValue({
        city: item.name,
        address: item.name,
        latitude,
        longitude
      })
      setCoordinates({ latitude, longitude })
      setCityModalVisible(false)
      reverseGeocode(latitude, longitude, {
        city: item.name,
        address: item.name
      })
    },
    [reverseGeocode]
  )

  // Fired when the map settles after a user gesture (pan/zoom) or a
  // programmatic move. We re-resolve the centre coordinate to an address.
  const onRegionChangeComplete = useCallback(
    (region) => {
      if (!region) return
      reverseGeocode(region.latitude, region.longitude)
    },
    [reverseGeocode]
  )

  // Smoothly recentre the map on a coordinate (used by search / city select).
  const setCoordinates = useCallback((location) => {
    safeAnimateToRegion(
      mapRef,
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      },
      500
    )
  }, [])

  // When the native map signals it's ready, nudge its layout so the GL surface
  // repaints (fixes the white/blank map on the New Architecture on Android).
  const onMapReady = useCallback(() => {
    requestAnimationFrame(() => setMapNudge(1))
    // Re-assert the camera shortly after, which also forces a redraw.
    setTimeout(() => {
      safeAnimateToRegion(
        mapRef,
        {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA
        },
        150
      )
    }, 120)
  }, [initialLocation])

  // Zoom by stepping the camera's zoom level. Works on both Google and Apple
  // providers and keeps the centre coordinate fixed.
  const zoomBy = useCallback(async(delta) => {
    if (!mapRef.current) return
    try {
      const camera = await mapRef.current.getCamera()
      const nextZoom = Math.max(
        1,
        Math.min(20, (camera.zoom ?? 15) + delta)
      )
      mapRef.current.animateCamera({ ...camera, zoom: nextZoom }, { duration: 250 })
    } catch (error) {
      console.log('Error zooming map:', error.message)
    }
  }, [])

  const onSelectLocation = () => {
    setLocation({
      label: 'Location',
      deliveryAddress: selectedValue.address,
      latitude: selectedValue.latitude,
      longitude: selectedValue.longitude,
      city: selectedValue.city
    })
    if (isLoggedIn) {
      navigation.navigate('SaveAddress', {
        locationData: {
          id,
          label: label || 'House',
          deliveryAddress: selectedValue.address,
          latitude: selectedValue.latitude,
          longitude: selectedValue.longitude,
          city: selectedValue.city,
          prevScreen: props?.route.params.prevScreen
            ? props?.route.params.prevScreen
            : null
        }
      })
    } else {
      navigation.navigate('Main')
    }
  }

  return (
    <>
      <View style={styles().flex}>
        <View style={styles(currentTheme).mapContainer}>
          <MapView
            ref={mapRef}
            provider={MAP_PROVIDER}
            // absoluteFill gives the native view concrete bounds — required for
            // gesture/touch routing under the New Architecture (Fabric).
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: initialLocation.latitude,
              longitude: initialLocation.longitude,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA
            }}
            customMapStyle={
              themeContext.ThemeValue === 'Dark'
                ? darkMapStyle
                : customMapStyle
            }
            onRegionChangeComplete={onRegionChangeComplete}
            onMapReady={onMapReady}
            loadingEnabled={true}
            loadingBackgroundColor={currentTheme.cardBackground}
            loadingIndicatorColor={currentTheme.main}
            mapPadding={{ top: 0, right: 0, bottom: mapNudge, left: 0 }}
            showsCompass={true}
            pitchEnabled={true}
            rotateEnabled={true}
            scrollEnabled={true}
            zoomEnabled={true}
            // We render our own controls, so disable the native Android ones.
            zoomControlEnabled={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            mapType='standard'
          />

          {/* Fixed centre pin — fills the map, centred, never steals touches. */}
          <View style={styles().markerFixed} pointerEvents='none'>
            <CustomMarker width={40} height={40} style={styles().markerPin} />
          </View>

          {/* Reverse-geocoding indicator */}
          {isFetchingAddress && (
            <View style={styles(currentTheme).loadingPill} pointerEvents='none'>
              <ActivityIndicator size='small' color={currentTheme.main} />
              <TextDefault textColor={currentTheme.newFontcolor} small>
                {t('loading')}
              </TextDefault>
            </View>
          )}

          {/* Custom map controls: zoom in / out / locate me */}
          <View style={styles().controlsContainer}>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Zoom in'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => zoomBy(1)}
            >
              <Ionicons name='add' size={24} color={currentTheme.newIconColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Zoom out'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => zoomBy(-1)}
            >
              <Ionicons name='remove' size={24} color={currentTheme.newIconColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Use my current location'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={setCurrentLocation}
            >
              <Ionicons name='locate' size={22} color={currentTheme.newIconColor} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles(currentTheme).container2}>
          <TextDefault
            textColor={currentTheme.newFontcolor}
            H3
            bolder
            isRTL
            style={styles().addressHeading}
          >
            {t('addAddress')}
          </TextDefault>
          <CityModal
            theme={currentTheme}
            setCityModalVisible={setCityModalVisible}
            selectedValue={selectedValue.city}
            cityModalVisible={cityModalVisible}
            onSelect={onSelectCity}
            t={t}
          />

          <View style={[styles(currentTheme).textInput]}>
            <TouchableOpacity onPress={() => setSearchModalVisible(true)}>
              <TextDefault textColor={currentTheme.newFontcolor} isRTL>
                {selectedValue.address || t('address')}
              </TextDefault>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles(currentTheme).emptyButton}
            onPress={onSelectLocation}
            disabled={!selectedValue.address || !selectedValue.city}
          >
            <TextDefault textColor={currentTheme.buttonText} center H5>
              {t('saveBtn')}
            </TextDefault>
          </TouchableOpacity>
          <SearchModal
            visible={searchModalVisible}
            onClose={() => setSearchModalVisible(false)}
            onSubmit={(description, coords) => {
              const latitude = coords.lat
              const longitude = coords.lng
              setSearchModalVisible(false)
              setSelectedValue({
                city: description,
                address: description,
                latitude,
                longitude
              })
              setCoordinates({ latitude, longitude })
              reverseGeocode(latitude, longitude, {
                city: description,
                address: description
              })
            }}
          />
        </View>
        <View style={{ paddingBottom: inset.bottom }} />
      </View>
    </>
  )
}

const CityModal = React.memo(
  function CityModal({
    theme,
    setCityModalVisible,
    selectedValue,
    cityModalVisible,
    onSelect,
    t
  }) {
    return (
      <View style={styles().dropdownContainer}>
        <TouchableOpacity
          style={styles(theme).button1}
          onPress={() => {
            setCityModalVisible(true)
          }}
        >
          {selectedValue && (
            <Text style={styles(theme).cityField}>{selectedValue}</Text>
          )}
          {!selectedValue && (
            <Text style={styles(theme).cityField}>{t('selectCity')}</Text>
          )}
          <Feather
            name='chevron-down'
            size={18}
            color={theme.newIconColor}
            style={styles().icon1}
          />
        </TouchableOpacity>
        <ModalDropdown
          theme={theme}
          visible={cityModalVisible}
          onItemPress={onSelect}
          onClose={() => {
            setCityModalVisible(false)
          }}
        />
      </View>
    )
  },
  (prevprops, nextprops) => {
    return (
      prevprops?.cityModalVisible === nextprops?.cityModalVisible &&
      prevprops?.selectedValue === nextprops?.selectedValue
    )
  }
)
