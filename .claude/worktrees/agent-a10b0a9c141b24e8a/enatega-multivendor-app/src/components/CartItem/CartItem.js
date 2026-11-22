import React, { useContext, useEffect, useState } from 'react'
import { Alert, Image, TouchableOpacity, View } from 'react-native'
import { AntDesign, Feather, EvilIcons } from '@expo/vector-icons'
import { scale } from '../../utils/scaling'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import ConfigurationContext from '../../context/Configuration'
import { theme } from '../../utils/themeColors'
import styles from './styles'
import TextDefault from '../Text/TextDefault/TextDefault'
import { alignment } from '../../utils/alignment'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { IMAGE_LINK } from '../../utils/constants'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'

const CartItem = (props) => {
  const { t, i18n } = useTranslation()
  const configuration = useContext(ConfigurationContext)
  const themeContext = useContext(ThemeContext)
  const navigation = useNavigation()
  
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const imageUrl =
    props?.itemImage && props?.itemImage.trim() !== ''
      ? props?.itemImage
      : IMAGE_LINK
  const modifierLabel = props?.optionsTitle?.length
    ? props.optionsTitle.join(' · ')
    : t('additionalItems')

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const navigateToRestaurant = () => {
    const restaurant = props?.restaurantData
    if (!restaurant) {
      navigation.goBack()
      return
    }

    const navParams = {
      _id: restaurant._id,
      name: restaurant.name,
      image: restaurant.image,
      shopType: restaurant.shopType,
      isAvailable: restaurant.isAvailable,
      isOpen: restaurant.openingTimes,
      deliveryTime: restaurant.deliveryTime,
      minimumOrder: restaurant.minimumOrder,
      tax: restaurant.tax,
      reviewAverage: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      categories: restaurant.categories,
      address: restaurant.address,
      location: restaurant.location
    }

    if (restaurant.shopType === 'grocery') {
      navigation.navigate('NewRestaurantDetailDesign', navParams)
    } else {
      navigation.navigate('Restaurant', navParams)
    }
  }

  const animatedQuantity = useSharedValue(1)

  const animateQuantityChange = () => {
    animatedQuantity.value = withSpring(1.9, {
      damping: 2, // Adjust for desired bounciness
      stiffness: 20 // Adjust for desired spring effect
    })

    setTimeout(() => {
      animatedQuantity.value = withSpring(1) // Reset scale to 1
    }, 200) // Match this duration with the spring duration
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: animatedQuantity.value }]
    }
  })

  useEffect(() => {
    animateQuantityChange()
  }, [props?.quantity])

  return (
    <View style={styles(currentTheme).itemContainer}>
      <View
        style={{
          flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          flex: 1,
          gap: scale(12)
        }}
      >
        <View style={styles().suggestItemImgContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles().suggestItemImg}
            resizeMode='contain'
          />
        </View>
        <View style={styles().itemInfo}>
          <TextDefault
            numberOfLines={2}
            textColor={currentTheme.fontFourthColor}
            bolder
            H5
            isRTL
          >
            {props?.dealName}
          </TextDefault>

          {props?.itemAddons?.length > 0 && (
            <View style={styles().additionalItem}>
              <View>
                <TouchableOpacity
                  onPress={toggleDropdown}
                  activeOpacity={1}
                  style={{
                    flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center'
                  }}
                >
                  <TextDefault
                    style={{ marginRight: scale(5) }}
                    textColor={currentTheme.fontNewColor}
                    Normal
                    isRTL
                  >
                    {modifierLabel}
                  </TextDefault>
                  <Feather
                    name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={currentTheme.iconColorDark}
                  />
                </TouchableOpacity>
                {isDropdownOpen && (
                  <View style={styles(currentTheme).itemsDropdown}>
                    {props?.optionsTitle?.map((item, index) => (
                      <TextDefault
                        key={index}
                        textColor={currentTheme.fontNewColor}
                        Normal
                        isRTL
                      >
                        {item}
                      </TextDefault>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View
            style={{
              flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              marginTop: scale(4)
            }}
          >
            <TextDefault
              numberOfLines={1}
              textColor={currentTheme.fontFourthColor}
              bolder
              Normal
              isRTL
            >
              {configuration.currencySymbol}
              {parseFloat(props?.dealPrice).toFixed(2)}
            </TextDefault>
            <View style={styles().divider} />
            <TouchableOpacity onPress={navigateToRestaurant}>
              <TextDefault
                textColor={currentTheme.fontFourthColor}
                bolder
                Normal
                style={styles().editText}
                isRTL
              >
                {t('edit')}
              </TextDefault>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles(currentTheme).actionContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles(currentTheme).actionContainerBtns}
          onPress={props?.removeQuantity}
          accessibilityRole='button'
          accessibilityLabel={props?.quantity < 2 ? t('remove') : `${t('remove')} ${t('quantity')}`}
        >
          {props?.quantity < 2 ? (
            <EvilIcons
              name='trash'
              size={scale(25)}
              color={currentTheme.newFontcolor}
            />
          ) : (
            <AntDesign
              name='minus'
              size={scale(18)}
              color={currentTheme.newFontcolor}
            />
          )}
        </TouchableOpacity>

        <Animated.View
          style={[styles(currentTheme).actionContainerView, animatedStyle]}
        >
          <TextDefault H5 bold textColor={currentTheme.black} isRTL>
            {props?.quantity}
          </TextDefault>
        </Animated.View>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles(currentTheme).actionContainerBtns,
            styles(currentTheme).plusBtn
          ]}
          onPress={props?.addQuantity}
          accessibilityRole='button'
          accessibilityLabel={`${t('add')} ${t('quantity')}`}
        >
          <AntDesign name='plus' size={scale(18)} color={currentTheme.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default CartItem
