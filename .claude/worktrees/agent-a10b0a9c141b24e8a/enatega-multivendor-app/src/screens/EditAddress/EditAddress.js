import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
  useLayoutEffect
} from 'react'
import {
  View,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styles from './styles'
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Device from 'expo-device'
import { scale } from '../../utils/scaling'
import gql from 'graphql-tag'
import { editAddress } from '../../apollo/mutations'
import { useMutation } from '@apollo/client'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { customMapStyle } from '../../utils/customMapStyles'
import darkMapStyle from '../../utils/DarkMapStyles'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { LocationContext } from '../../context/Location'
import SearchModal from '../../components/Address/SearchModal'
import CustomMarker from '../../assets/SVG/imageComponents/CustomMarker'
import Analytics from '../../utils/analytics'
import { MaterialIcons, Entypo, Foundation, Ionicons } from '@expo/vector-icons'
import { HeaderBackButton } from '@react-navigation/elements'
import navigationService from '../../routes/navigationService'
import { safeAnimateToRegion } from '../../utils/safeFitToCoordinates'
import { useTranslation } from 'react-i18next'
import { useLocation } from '../../ui/hooks'
import useGeocoding from '../../ui/hooks/useGeocoding'

import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'

const EDIT_ADDRESS = gql`
  ${editAddress}
`

const LATITUDE = 33.7001019
const LONGITUDE = 72.9735978
const LATITUDE_DELTA = 0.0022
const LONGITUDE_DELTA = 0.0021

// Google Maps renders blank on the iOS simulator, so fall back to Apple Maps
// (PROVIDER_DEFAULT) there. On physical iOS devices and all Android, use Google
// Maps so the valid API key + customMapStyle take effect.
const MAP_PROVIDER =
  Platform.OS === 'ios' && !Device.isDevice ? PROVIDER_DEFAULT : PROVIDER_GOOGLE

// react-native-maps crashes if region contains NaN. Coerce + fall back to a default.
function safeCoord(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function EditAddress(props) {
  const analytics = Analytics()

  const { t } = useTranslation()
  const addressRef = useRef(null)
  const mapRef = useRef(null)
  const hasNavigatedAfterSaveRef = useRef(false)
  // Monotonic id so only the most recent reverse-geocode result is applied.
  // Prevents stale responses from overwriting newer ones while panning fast.
  const geocodeRequestId = useRef(0)
  const pendingProgrammaticRegionRef = useRef(null)
  const geocodeLoadingTimerRef = useRef(null)
  const lastReverseGeocodeRegionRef = useRef(null)
  const [isFetchingAddress, setIsFetchingAddress] = useState(false)
  // Forces a one-pixel relayout of the map after it's ready. On the New
  // Architecture (Fabric) the Android Google MapView mounts but its GL surface
  // never repaints until it receives a size change, leaving the map white.
  const [mapNudge, setMapNudge] = useState(0)
  const { getAddress } = useGeocoding()
  const { getCurrentLocation } = useLocation()
  const { location, setLocation } = useContext(LocationContext)
  const [_id] = useState(props?.route.params._id ?? null)
  const [selectedLabel, setSelectedLabel] = useState(
    props?.route.params.label ?? 'Home'
  )
  const [region, setRegion] = useState(() => {
    const loc = props?.route.params?.location
    const regionChangeParam = props?.route.params?.regionChange
    return {
      latitude: loc
        ? safeCoord(loc.coordinates?.[1], LATITUDE)
        : safeCoord(regionChangeParam?.latitude, LATITUDE),
      latitudeDelta: LATITUDE_DELTA,
      longitude: loc
        ? safeCoord(loc.coordinates?.[0], LONGITUDE)
        : safeCoord(regionChangeParam?.longitude, LONGITUDE),
      longitudeDelta: LONGITUDE_DELTA
    }
  })
  const [deliveryAddress, setDeliveryAddress] = useState(
    props?.route.params.deliveryAddress ?? ''
  )
  const [deliveryDetails, setDeliveryDetails] = useState(
    props?.route.params.details ?? ''
  )
  const [deliveryAddressError, setDeliveryAddressError] = useState('')
  const [deliveryDetailsError, setDeliveryDetailsError] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const regionObj = props?.route.params.regionChange ?? null

  const [mutate, { loading }] = useMutation(EDIT_ADDRESS, {
    onCompleted,
    onError
  })
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  const labelValues = [
    {
      title: 'Home',
      value: 'Home',
      icon: <Entypo name='home' size={scale(24)} />
    },
    {
      title: 'Work',
      value: 'Work',
      icon: <MaterialIcons name='work' size={scale(24)} />
    },
    {
      title: 'Apartment',
      value: 'Apartment',
      icon: <MaterialIcons name='apartment' size={scale(24)} />
    },
    {
      title: 'Other',
      value: 'Other',
      icon: <Foundation name='heart' size={scale(24)} />
    }
  ]

  const inset = useSafeAreaInsets()

  useLayoutEffect(() => {
    props?.navigation.setOptions({
      headerRight: null,
      title: t('editAddress'),
      headerTitleStyle: {
        color: currentTheme.newFontcolor,
        fontWeight: 'bold'
      },
      headerTitleContainerStyle: {
        marginTop: '2%',
        paddingLeft: scale(25),
        paddingRight: scale(25),
        height: '75%',
        marginLeft: 0
      },
      headerStyle: {
        backgroundColor: currentTheme.themeBackground,
        elevation: 1
      },
      headerTitleAlign: 'center',
      headerLeft: () => (
        <HeaderBackButton
          truncatedLabel=''
          backImage={() => (
            <View>
              <MaterialIcons
                name='arrow-back'
                size={30}
                color={currentTheme.newFontcolor}
              />
            </View>
          )}
          onPress={() => {
            navigationService.goBack()
          }}
        />
      )
    })
  }, [props?.navigation, currentTheme])
  useEffect(() => {
    if (regionObj !== null) regionChange(regionObj)
  }, [regionObj])
  useEffect(() => {
    async function Track() {
      await analytics.track(analytics.events.NAVIGATE_TO_EDITADDRESS)
    }
    Track()
  }, [])
  useEffect(() => {
    return () => {
      if (geocodeLoadingTimerRef.current) {
        clearTimeout(geocodeLoadingTimerRef.current)
      }
    }
  }, [])
  // Reverse-geocode a coordinate and apply it to the form. Race-protected:
  // a newer call invalidates older in-flight responses.
  const reverseGeocode = useCallback(
    async(latitude, longitude) => {
      const nextCoordinate = { latitude, longitude }
      const requestId = ++geocodeRequestId.current
      lastReverseGeocodeRegionRef.current = nextCoordinate

      if (geocodeLoadingTimerRef.current) {
        clearTimeout(geocodeLoadingTimerRef.current)
      }
      geocodeLoadingTimerRef.current = setTimeout(() => {
        if (requestId === geocodeRequestId.current) setIsFetchingAddress(true)
      }, 450)

      try {
        const response = await getAddress(latitude, longitude)
        if (requestId !== geocodeRequestId.current) return
        if (response.formattedAddress) {
          setDeliveryAddress(response.formattedAddress)
          setDeliveryAddressError(null)
        }
      } catch (error) {
        console.log('Error fetching address:', error.message)
      } finally {
        if (requestId === geocodeRequestId.current) {
          if (geocodeLoadingTimerRef.current) {
            clearTimeout(geocodeLoadingTimerRef.current)
            geocodeLoadingTimerRef.current = null
          }
          setIsFetchingAddress(false)
        }
      }
    },
    [getAddress]
  )

  const withRegionDefaults = useCallback(
    (nextRegion) => ({
      latitude: safeCoord(nextRegion?.latitude, region.latitude),
      longitude: safeCoord(nextRegion?.longitude, region.longitude),
      latitudeDelta: safeCoord(
        nextRegion?.latitudeDelta,
        region.latitudeDelta ?? LATITUDE_DELTA
      ),
      longitudeDelta: safeCoord(
        nextRegion?.longitudeDelta,
        region.longitudeDelta ?? LONGITUDE_DELTA
      )
    }),
    [region]
  )

  const moveMapToRegion = useCallback((nextRegion, duration = 500) => {
    safeAnimateToRegion(mapRef, nextRegion, duration)
  }, [])

  const isSameCoordinate = (left, right, tolerance = 0.000001) => {
    if (!left || !right) return false
    return (
      Math.abs(left.latitude - right.latitude) < tolerance &&
      Math.abs(left.longitude - right.longitude) < tolerance
    )
  }

  // Called when the map settles after a user gesture (pan/zoom). Programmatic
  // moves are already synced by the caller, so skip their duplicate callback.
  const onRegionChangeComplete = useCallback(
    (newRegion) => {
      if (!newRegion) return
      const nextRegion = withRegionDefaults(newRegion)
      setRegion(nextRegion)

      if (isSameCoordinate(pendingProgrammaticRegionRef.current, nextRegion)) {
        pendingProgrammaticRegionRef.current = null
        return
      }

      if (isSameCoordinate(lastReverseGeocodeRegionRef.current, nextRegion, 0.00005)) {
        return
      }

      reverseGeocode(nextRegion.latitude, nextRegion.longitude)
    },
    [reverseGeocode, withRegionDefaults]
  )

  // Recenter the map on a coordinate and resolve its address (used by the
  // FullMap return path and search modal).
  function regionChange(nextRegion) {
    const targetRegion = withRegionDefaults(nextRegion)
    pendingProgrammaticRegionRef.current = targetRegion
    setRegion(targetRegion)
    moveMapToRegion(targetRegion)
    reverseGeocode(targetRegion.latitude, targetRegion.longitude)
  }

  // Nudge the map layout once it's ready so the GL surface repaints (fixes the
  // white/blank map on the New Architecture on Android).
  const onMapReady = useCallback(() => {
    requestAnimationFrame(() => setMapNudge(1))
  }, [])

  // Zoom by stepping the camera's zoom level. Works on both Google and Apple
  // providers and keeps the centre coordinate fixed.
  const zoomBy = useCallback(async(delta) => {
    if (!mapRef.current) return
    try {
      const camera = await mapRef.current.getCamera()
      const nextZoom = Math.max(1, Math.min(20, (camera.zoom ?? 15) + delta))
      mapRef.current.animateCamera(
        { ...camera, zoom: nextZoom },
        { duration: 250 }
      )
    } catch (error) {
      console.log('Error zooming map:', error.message)
    }
  }, [])

  const setCurrentLocation = useCallback(async() => {
    try {
      const { coords, error } = await getCurrentLocation()
      if (!error && coords) {
        const targetRegion = withRegionDefaults({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA
        })
        pendingProgrammaticRegionRef.current = targetRegion
        setRegion(targetRegion)
        moveMapToRegion(targetRegion, 1000)
        reverseGeocode(targetRegion.latitude, targetRegion.longitude)
      }
    } catch (error) {
      console.log('Error setting current location:', error.message)
    }
  }, [getCurrentLocation, moveMapToRegion, reverseGeocode, withRegionDefaults])

  // Open the full-screen map; FullMap returns the chosen region via
  // route params, handled by the regionObj effect above.
  const openFullMap = () => {
    props?.navigation.navigate('FullMap', {
      latitude: region.latitude,
      longitude: region.longitude,
      currentScreen: 'EditAddress'
    })
  }

  function onCompleted({ editAddress }) {
    if (hasNavigatedAfterSaveRef.current) return

    const updatedAddress = editAddress?.addresses?.find(
      (address) => address._id === _id
    )

    if (updatedAddress && location?._id === updatedAddress._id) {
      setLocation({
        ...updatedAddress,
        latitude: Number(
          updatedAddress.location?.coordinates?.[1] ?? region.latitude
        ),
        longitude: Number(
          updatedAddress.location?.coordinates?.[0] ?? region.longitude
        )
      })
    }
    FlashMessage({
      message: t('addressUpdated')
    })
    props?.navigation.goBack()
  }

  function onError(error) {
    hasNavigatedAfterSaveRef.current = false
    FlashMessage({
      message: `${t('errorOccured')} ${error.message}`
    })
  }

  const onOpen = () => {
    setModalVisible(true)
  }
  const onClose = () => {
    setModalVisible(false)
  }

  const onSubmit = (deliveryAddressGeo, coordinates) => {
    const targetRegion = withRegionDefaults({
      latitude: coordinates?.lat,
      longitude: coordinates?.lng,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA
    })

    geocodeRequestId.current += 1
    pendingProgrammaticRegionRef.current = targetRegion
    lastReverseGeocodeRegionRef.current = targetRegion
    if (geocodeLoadingTimerRef.current) {
      clearTimeout(geocodeLoadingTimerRef.current)
      geocodeLoadingTimerRef.current = null
    }
    setIsFetchingAddress(false)
    setDeliveryAddress(deliveryAddressGeo)
    setDeliveryAddressError(null)
    setRegion(targetRegion)
    moveMapToRegion(targetRegion)
    setModalVisible(false)
  }

  const navigateAfterSave = (addressInput) => {
    if (location?._id === _id) {
      setLocation({
        ...location,
        _id,
        label: addressInput.label,
        deliveryAddress: addressInput.deliveryAddress,
        details: addressInput.details,
        location: addressInput.location,
        latitude: addressInput.location.coordinates[1],
        longitude: addressInput.location.coordinates[0]
      })
    }

    hasNavigatedAfterSaveRef.current = true
    FlashMessage({
      message: t('addressUpdated')
    })
    props?.navigation.goBack()
  }

  const onSave = () => {
    const addressError = !deliveryAddress.trim().length
      ? t('DeliveryAddressIsRequired')
      : null
    const detailsError = !deliveryDetails.trim().length
      ? t('DeliveryAddressIsRequired')
      : null

    setDeliveryAddressError(addressError)
    setDeliveryDetailsError(detailsError)

    if (addressError === null && detailsError === null) {
      const addressInput = {
        _id,
        location: {
          coordinates: [Number(region.longitude), Number(region.latitude)]
        },
        deliveryAddress: deliveryAddress.trim(),
        details: deliveryDetails.trim(),
        label: selectedLabel
      }

      mutate({
        variables: {
          addressInput
        }
      })
      navigateAfterSave(addressInput)
    }
  }

  const { isConnected: connect } = useNetworkStatus()
  if (!connect) return <ErrorView refetchFunctions={[]} />

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}
        style={styles(currentTheme).flex}
        enabled={!modalVisible}
      >
        {/* ---------- Movable map header ---------- */}
        <View style={styles(currentTheme).mapContainer}>
          <MapView
            ref={mapRef}
            // absoluteFill gives the native view concrete bounds — required for
            // gesture/touch routing under the New Architecture (Fabric).
            style={StyleSheet.absoluteFill}
            provider={MAP_PROVIDER}
            initialRegion={region}
            region={region}
            customMapStyle={
              themeContext.ThemeValue === 'Dark' ? darkMapStyle : customMapStyle
            }
            onRegionChangeComplete={onRegionChangeComplete}
            onMapReady={onMapReady}
            loadingEnabled={true}
            loadingBackgroundColor={currentTheme.cardBackground}
            loadingIndicatorColor={currentTheme.main}
            mapPadding={{ top: 0, right: 0, bottom: mapNudge, left: 0 }}
            showsCompass={false}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={true}
            pitchEnabled={false}
            zoomControlEnabled={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            mapType='standard'
          />

          {/* Fixed centre pin — never steals touches. */}
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

          {/* Expand to full-screen map */}
          <TouchableOpacity
            style={styles(currentTheme).expandButton}
            accessibilityRole='button'
            accessibilityLabel={t('addAddress')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={openFullMap}
          >
            <MaterialIcons
              name='fullscreen'
              size={scale(22)}
              color={currentTheme.newIconColor}
            />
          </TouchableOpacity>

          {/* Custom map controls: zoom in / out / locate me */}
          <View style={styles().controlsContainer}>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Zoom in'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => zoomBy(1)}
            >
              <Ionicons
                name='add'
                size={22}
                color={currentTheme.newIconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Zoom out'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => zoomBy(-1)}
            >
              <Ionicons
                name='remove'
                size={22}
                color={currentTheme.newIconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles(currentTheme).controlButton}
              accessibilityRole='button'
              accessibilityLabel='Use my current location'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={setCurrentLocation}
            >
              <Ionicons
                name='locate'
                size={20}
                color={currentTheme.newIconColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------- Body ---------- */}
        <View style={styles(currentTheme).bodyContainer}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            <View style={styles().sectionTitle}>
              <TextDefault H4 bolder textColor={currentTheme.fontMainColor}>
                {t('address')}
              </TextDefault>
            </View>

            {/* Full delivery address */}
            <View
              style={[
                styles(currentTheme).inputWrapper,
                deliveryAddressError
                  ? styles(currentTheme).inputWrapperError
                  : {}
              ]}
            >
              <View style={styles().inputInner}>
                <TextDefault small textColor={currentTheme.secondaryText}>
                  {t('fullDeliveryAddress')}
                </TextDefault>
                <TextInput
                  ref={addressRef}
                  value={deliveryAddress}
                  placeholder={t('deliveryAddress')}
                  placeholderTextColor={currentTheme.secondaryText}
                  maxLength={100}
                  style={styles(currentTheme).input}
                  onChangeText={(text) => {
                    setDeliveryAddress(text)
                    if (text.trim().length) setDeliveryAddressError(null)
                  }}
                  onBlur={() =>
                    setDeliveryAddressError(
                      !deliveryAddress.trim().length
                        ? t('DeliveryAddressIsRequired')
                        : null
                    )
                  }
                />
              </View>
              <TouchableOpacity
                style={styles(currentTheme).editIconBtn}
                onPress={onOpen}
              >
                <MaterialIcons
                  name='edit'
                  size={scale(18)}
                  color={currentTheme.fontMainColor}
                />
              </TouchableOpacity>
            </View>
            {!!deliveryAddressError && (
              <TextDefault
                small
                textColor={currentTheme.textErrorColor}
                style={styles().errorText}
              >
                {deliveryAddressError}
              </TextDefault>
            )}

            {/* Apt / Floor */}
            <View
              style={[
                styles(currentTheme).inputWrapper,
                deliveryDetailsError
                  ? styles(currentTheme).inputWrapperError
                  : {}
              ]}
            >
              <View style={styles().inputInner}>
                <TextDefault small textColor={currentTheme.secondaryText}>
                  {t('deliveryDetails')}
                </TextDefault>
                <TextInput
                  value={deliveryDetails}
                  placeholder={t('aptFloor')}
                  placeholderTextColor={currentTheme.secondaryText}
                  maxLength={30}
                  style={styles(currentTheme).input}
                  onChangeText={(text) => {
                    setDeliveryDetails(text)
                    if (text.trim().length) setDeliveryDetailsError(null)
                  }}
                  onBlur={() =>
                    setDeliveryDetailsError(
                      !deliveryDetails.trim().length
                        ? t('DeliveryAddressIsRequired')
                        : null
                    )
                  }
                />
              </View>
            </View>
            {!!deliveryDetailsError && (
              <TextDefault
                small
                textColor={currentTheme.textErrorColor}
                style={styles().errorText}
              >
                {deliveryDetailsError}
              </TextDefault>
            )}

            {/* ---------- Add Label ---------- */}
            <View style={styles(currentTheme).divider} />
            <TextDefault H5 bolder textColor={currentTheme.fontMainColor}>
              {t('addLabel')}
            </TextDefault>
            <View style={styles().labelRow}>
              {labelValues.map((label) => {
                const active = selectedLabel === label.value
                return (
                  <View style={styles().labelItem} key={label.value}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      accessibilityRole='button'
                      accessibilityLabel={t(label.title)}
                      onPress={() => setSelectedLabel(label.value)}
                      style={[
                        styles(currentTheme).labelButton,
                        active ? styles(currentTheme).labelButtonActive : {}
                      ]}
                    >
                      {React.cloneElement(label.icon, {
                        color: active
                          ? currentTheme.black
                          : currentTheme.fontMainColor
                      })}
                    </TouchableOpacity>
                    <TextDefault
                      bold
                      center
                      textColor={currentTheme.fontMainColor}
                      style={styles().labelText}
                    >
                      {t(label.title)}
                    </TextDefault>
                  </View>
                )
              })}
            </View>

            {/* ---------- Save ---------- */}
            <TouchableOpacity
              disabled={loading}
              onPress={onSave}
              activeOpacity={0.7}
              style={styles(currentTheme).saveBtnContainer}
            >
              <TextDefault textColor={currentTheme.black} H5 bold>
                {t('saveContBtn')}
              </TextDefault>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {modalVisible
        ? (
        <SearchModal
          visible={modalVisible}
          onClose={onClose}
          onSubmit={onSubmit}
        />
          )
        : null}
      <View
        style={{
          paddingBottom: inset.bottom,
          backgroundColor: currentTheme.themeBackground
        }}
      />
    </>
  )
}

export default EditAddress
