import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { View, ImageBackground, TouchableOpacity, Platform, FlatList, StyleSheet } from 'react-native'
import styles from './styles'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import VideoBanner from './VideoBanner'
import { BANNER_PARAMETERS } from '../../../utils/banner-routes'
import { getCachedMediaUri } from '../../../utils/mediaCache'

// Helper function to get media type from URL
const getMediaTypeFromUrl = (url) => {
  const extension = url?.split('.').pop()?.toLowerCase()
  return extension === 'mp4' ? 'video' : 'image'
}

const normalizeCopy = (value) => value?.replace(/\\n/g, '\n')
const alphaColor = (color, alpha) => (color?.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color)

const resolvePromo = (item) => ({
  backgroundColor: item?.backgroundColor || '#111111',
  textColor: item?.textColor || '#FFFFFF',
  accentColor: item?.accentColor || '#FF9050',
  buttonBackgroundColor: item?.buttonBackgroundColor || '#FFFFFF',
  buttonTextColor: item?.buttonTextColor || '#000000',
  badgeText: item?.badgeText || 'Limited offer',
  buttonText: item?.buttonText || 'Order now',
  title: normalizeCopy(item?.title) || 'Free delivery\non your first order',
  description: normalizeCopy(item?.description) || 'Use code',
  promoCode: item?.promoCode
})

const Banner = ({ banners }) => {
  const navigation = useNavigation()
  const [cardWidth, setCardWidth] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(true)
  const [cachedMediaMap, setCachedMediaMap] = useState({})

  const bannersData = useMemo(() => banners ?? [], [banners])

  const onPressBanner = (banner) => {
    const action = banner.action
    if (action === 'Navigate Specific Restaurant') {
      navigation.navigate('Restaurant', { _id: banner.screen })
    } else if (banner?.screen && BANNER_PARAMETERS[banner?.screen]) {
      const { name, selectedType, queryType } = BANNER_PARAMETERS[banner?.screen]
      navigation.navigate(name, {
        selectedType: selectedType ?? 'restaurant',
        queryType: queryType ?? 'restaurant'
      })
    }
  }

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true)
      return () => setIsFocused(false)
    }, [])
  )

  useEffect(() => {
    let isMounted = true
    ;(async() => {
      const entries = await Promise.all(
        bannersData.map(async(banner) => {
          const mediaUrl = banner?.file
          const imageUrl = banner?.image || banner?.thumbnail || banner?.previewImage
          const mediaType = getMediaTypeFromUrl(mediaUrl)
          const cacheValue = {}

          if (mediaUrl && mediaType === 'video') {
            cacheValue.video = await getCachedMediaUri(mediaUrl, 'video')
          }
          if (imageUrl) {
            cacheValue.image = await getCachedMediaUri(imageUrl, 'image')
          } else if (mediaUrl && mediaType !== 'video') {
            cacheValue.image = await getCachedMediaUri(mediaUrl, 'image')
          }

          return [banner?._id || mediaUrl, cacheValue]
        })
      )
      if (isMounted) {
        setCachedMediaMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      }
    })()

    return () => {
      isMounted = false
    }
  }, [bannersData])

  // Position dots — only when there is more than one banner.
  const renderPagination = () => {
    if (bannersData.length <= 1) return null
    return (
      <View style={styles().promoPagination}>
        {bannersData.map((item, index) => (
          <View key={item?._id || `banner-dot-${index}`} style={[styles().promoDot, index === activeIndex && styles().promoDotActive]} />
        ))}
      </View>
    )
  }

  // Configured promo copy + styling: badge, title, description (+ code), button, dots.
  const renderPromoContent = (item) => {
    const { textColor, accentColor, buttonBackgroundColor, buttonTextColor, badgeText, buttonText, title, description, promoCode } = resolvePromo(item)
    return (
      <View style={styles().promoContent}>
        {!!badgeText && (
          <TextDefault bolder textColor={accentColor} style={[styles().promoEyebrow, { backgroundColor: alphaColor(accentColor, '2E') }]} numberOfLines={1}>
            {badgeText}
          </TextDefault>
        )}
        <TextDefault bolder textColor={textColor} style={styles().promoTitle} numberOfLines={2}>
          {title}
        </TextDefault>
        <TextDefault textColor={alphaColor(textColor, 'A6') || 'rgba(255,255,255,0.62)'} style={styles().promoSubtitle} numberOfLines={1}>
          {description}
          {!!promoCode && (
            <TextDefault bold textColor={textColor}>
              {' '}
              {promoCode}
            </TextDefault>
          )}
        </TextDefault>
        <View style={styles().promoFooter}>
          <View style={[styles().promoButton, { backgroundColor: buttonBackgroundColor }]}>
            <TextDefault bolder textColor={buttonTextColor} numberOfLines={1}>
              {buttonText}
            </TextDefault>
          </View>
          {renderPagination()}
        </View>
      </View>
    )
  }

  // Image / video that fills the card behind the promo content.
  const renderMediaBackground = (item, index) => {
    const mediaType = getMediaTypeFromUrl(item?.file)
    const cacheKey = item?._id || item?.file
    const cached = cachedMediaMap[cacheKey] || {}
    const isActiveSlide = index === activeIndex && isFocused
    const shouldRenderVideo = mediaType === 'video' && (Platform.OS !== 'android' || isActiveSlide)
    const fallbackImage = cached.image || item?.image || item?.thumbnail || item?.previewImage
    const videoUri = cached.video || item?.file

    return (
      <View style={StyleSheet.absoluteFill}>
        {shouldRenderVideo
          ? (
          <VideoBanner style={StyleSheet.absoluteFill} source={videoUri} />
            )
          : fallbackImage
            ? (
          <ImageBackground source={{ uri: fallbackImage }} style={StyleSheet.absoluteFill} resizeMode='cover' />
              )
            : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1f2937' }]} />
              )}
        <View style={styles().promoMediaScrim} />
      </View>
    )
  }

  const renderCard = (item, index) => {
    const { backgroundColor, accentColor } = resolvePromo(item)
    const hasMedia = !!item?.file

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles().card, !hasMedia && { backgroundColor }]}
        onPress={() => onPressBanner(item)}
      >
        {hasMedia
          ? (
              renderMediaBackground(item, index)
            )
          : (
          <>
            <View style={styles().promoCircleLarge} />
            <View style={[styles().promoCircleSmall, { backgroundColor: alphaColor(accentColor, '1A') }]} />
          </>
            )}
        {renderPromoContent(item)}
      </TouchableOpacity>
    )
  }

  const onMomentumScrollEnd = (event) => {
    if (!cardWidth) return
    const index = Math.round(event.nativeEvent.contentOffset.x / cardWidth)
    if (index !== activeIndex) setActiveIndex(index)
  }

  if (!bannersData.length) return null

  return (
    <View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
      {cardWidth > 0 &&
        (bannersData.length === 1
          ? (
              renderCard(bannersData[0], 0)
            )
          : (
          <FlatList
            data={bannersData}
            horizontal
            pagingEnabled
            decelerationRate='fast'
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => item?._id || `banner-${index}`}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item, index }) => <View style={{ width: cardWidth }}>{renderCard(item, index)}</View>}
          />
            ))}
    </View>
  )
}

export default Banner
