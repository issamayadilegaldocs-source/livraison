import React, { useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  Modal,
  View,
  TouchableOpacity,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native'
import axios from 'axios'
import useEnvVars from '../../../environment'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { scale } from '../../utils/scaling'
import { theme } from '../../utils/themeColors'
import TextDefault from '../Text/TextDefault/TextDefault'
import styles from './styles'

import { useTranslation } from 'react-i18next'
import { AntDesign, Ionicons } from '@expo/vector-icons'

const { height } = Dimensions.get('screen')

export default function SearchModal({
  visible = false,
  onClose = () => {},
  onSubmit = () => {}
}) {
  const { t } = useTranslation()
  const { GOOGLE_MAPS_KEY } = useEnvVars()

  const [searchText, setSearchText] = useState('')
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const debounceTimerRef = useRef(null)
  const requestCancelTokenRef = useRef(null)

  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  // Reset state whenever the modal opens
  useEffect(() => {
    if (visible) {
      setSearchText('')
      setPredictions([])
      setLoading(false)
      setError(null)
    }
  }, [visible])

  // Cleanup timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (requestCancelTokenRef.current) {
        requestCancelTokenRef.current.cancel('Component unmounted')
      }
    }
  }, [])

  const close = () => {
    setSearchText('')
    setPredictions([])
    setLoading(false)
    setError(null)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (requestCancelTokenRef.current) {
      requestCancelTokenRef.current.cancel('Modal closed')
    }

    onClose()
  }

  // Search for places using Google Places API
  const searchPlaces = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setPredictions([])
      setLoading(false)
      setError(null)
      return
    }

    if (!GOOGLE_MAPS_KEY) {
      setError('Google Maps API key is not configured')
      setLoading(false)
      return
    }

    // Cancel previous request if exists
    if (requestCancelTokenRef.current) {
      requestCancelTokenRef.current.cancel('New search initiated')
    }

    // Create new cancel token
    const cancelToken = axios.CancelToken.source()
    requestCancelTokenRef.current = cancelToken

    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        {
          params: {
            input: query,
            key: GOOGLE_MAPS_KEY,
            language: 'en',
            // components: 'country:pk', // use to Restrict to Pakistan
            types: 'geocode'
          },
          timeout: 10000,
          cancelToken: cancelToken.token
        }
      )

      if (response.data.status === 'OK') {
        const formattedPredictions = response.data.predictions.map((prediction) => ({
          id: prediction.place_id,
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || ''
        }))

        setPredictions(formattedPredictions)
        setError(null)
      } else if (response.data.status === 'ZERO_RESULTS') {
        setPredictions([])
        setError(null)
      } else {
        setPredictions([])
        setError(response.data.error_message || 'Search failed')

        if (response.data.status === 'REQUEST_DENIED') {
          Alert.alert(
            'API Error',
            'Google Places API access denied. Please check your API key configuration.'
          )
        }
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        return // Don't update state for cancelled requests
      }

      setPredictions([])

      if (error.code === 'ECONNABORTED') {
        setError('Request timed out')
      } else if (error.response) {
        setError('Search service unavailable')
      } else if (error.request) {
        setError('Network error - check your connection')
      } else {
        setError('Search failed')
      }
    } finally {
      setLoading(false)
      // Clear the cancel token reference if this was the current request
      if (requestCancelTokenRef.current === cancelToken) {
        requestCancelTokenRef.current = null
      }
    }
  }, [GOOGLE_MAPS_KEY])

  // Get place details
  const getPlaceDetails = useCallback(async (placeId) => {
    if (!GOOGLE_MAPS_KEY) {
      return null
    }

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: placeId,
            key: GOOGLE_MAPS_KEY,
            fields: 'geometry,formatted_address,name'
          },
          timeout: 10000
        }
      )

      if (response.data.status === 'OK' && response.data.result) {
        const result = response.data.result

        return {
          geometry: {
            location: {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng
            }
          },
          formatted_address: result.formatted_address,
          name: result.name
        }
      } else {
        return null
      }
    } catch (error) {
      return null
    }
  }, [GOOGLE_MAPS_KEY])

  // Handle text input change with debouncing
  const handleTextChange = useCallback((text) => {
    setSearchText(text)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      searchPlaces(text)
    }, 300)
  }, [searchPlaces])

  // Handle place selection
  const handlePlaceSelect = useCallback(async (place) => {
    setLoading(true)

    try {
      const details = await getPlaceDetails(place.placeId)

      if (details && details.geometry && details.geometry.location) {
        onSubmit(place.description, details.geometry.location)
        close()
      } else {
        Alert.alert('Error', 'Unable to get coordinates for this location')
        setLoading(false)
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to select this location')
      setLoading(false)
    }
  }, [getPlaceDetails, onSubmit])

  const renderPrediction = ({ item }) => (
    <TouchableOpacity
      style={{
        backgroundColor: currentTheme.cardBackground,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8
      }}
      onPress={() => handlePlaceSelect(item)}
      disabled={loading}
    >
      <View style={styles(currentTheme).locationIcon}>
        <Ionicons name="location-outline" size={16} color={currentTheme.newIconColor} />
      </View>
      <TextDefault numberOfLines={1} textColor={currentTheme.newFontcolor} style={{ flex: 1 }}>
        {item.description}
      </TextDefault>
    </TouchableOpacity>
  )

  // Don't render if no API key
  if (!GOOGLE_MAPS_KEY) {
    return (
      <Modal visible={visible} transparent animationType={'slide'} onRequestClose={onClose}>
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <View style={{
            backgroundColor: currentTheme.cardBackground,
            padding: 20,
            borderRadius: 10,
            margin: 20,
            borderWidth: 1,
            borderColor: currentTheme.customBorder
          }}>
            <TextDefault textColor={currentTheme.newFontcolor}>
              Google Maps API key is not configured
            </TextDefault>
            <TouchableOpacity
              onPress={close}
              style={{
                marginTop: 15,
                padding: 12,
                backgroundColor: currentTheme.buttonBackground,
                borderRadius: 6
              }}
            >
              <TextDefault textColor={currentTheme.buttonText} center>Close</TextDefault>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={'slide'}
      statusBarTranslucent
      onRequestClose={close}
    >
      {/* Dimmed backdrop — tap outside the sheet to dismiss */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={close} />

        {/* Bottom sheet — fixed height, anchored to the bottom, does not move with the keyboard */}
        <View
          style={{
            height: height * 0.85,
            backgroundColor: currentTheme.cardBackground,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: scale(16),
            paddingTop: scale(8)
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: currentTheme.customBorder,
              marginBottom: 12
            }}
          />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity style={{ padding: 4, marginRight: 8 }} onPress={close}>
              <AntDesign name='arrowleft' size={24} color={currentTheme.newIconColor} />
            </TouchableOpacity>
            <TextDefault H5 bolder textColor={currentTheme.newFontcolor}>
              {t('search')}
            </TextDefault>
          </View>

          {/* Search input */}
          <View style={{
            borderWidth: 1,
            borderColor: currentTheme.customBorder,
            borderRadius: scale(6),
            backgroundColor: currentTheme.themeBackground,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <TextInput
              style={{
                color: currentTheme.newFontcolor,
                backgroundColor: currentTheme.themeBackground,
                height: 44,
                flex: 1,
                paddingHorizontal: 12,
                fontSize: 16,
                borderRadius: scale(6)
              }}
              placeholder={t('search')}
              placeholderTextColor={currentTheme.fontMainColor}
              value={searchText}
              onChangeText={handleTextChange}
              autoFocus={true}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => {
                if (predictions.length > 0) {
                  handlePlaceSelect(predictions[0])
                }
              }}
            />
            {loading && (
              <ActivityIndicator
                size="small"
                color={currentTheme.newIconColor}
                style={{ marginRight: 12 }}
              />
            )}
          </View>

          {/* Results */}
          <View style={{ flex: 1, marginTop: 8 }}>
            {error ? (
              <View style={{
                paddingVertical: 16,
                paddingHorizontal: 16,
                alignItems: 'center'
              }}>
                <Ionicons name="alert-circle-outline" size={24} color="#FF6B6B" />
                <TextDefault
                  textColor="#FF6B6B"
                  style={{ fontSize: 14, marginTop: 8, textAlign: 'center' }}
                >
                  {error}
                </TextDefault>
              </View>
            ) : predictions.length > 0 ? (
              <FlatList
                data={predictions}
                renderItem={renderPrediction}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={true}
              />
            ) : searchText.length > 2 && !loading ? (
              <View style={{
                paddingVertical: 20,
                alignItems: 'center'
              }}>
                <Ionicons
                  name="search-outline"
                  size={32}
                  color={currentTheme.fontMainColor}
                />
                <TextDefault
                  textColor={currentTheme.fontMainColor}
                  style={{ marginTop: 8, fontSize: 16 }}
                >
                  No places found
                </TextDefault>
                <TextDefault
                  textColor={currentTheme.fontMainColor}
                  style={{ marginTop: 4, fontSize: 14 }}
                >
                  Try a different search term
                </TextDefault>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}
