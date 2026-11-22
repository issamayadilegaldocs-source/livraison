import { View, Image, TouchableOpacity, StyleSheet } from 'react-native'
import React, { useContext } from 'react'
import { scale } from '../../utils/scaling'
import TextDefault from '../Text/TextDefault/TextDefault'
import { Ionicons } from '@expo/vector-icons'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { gql, useApolloClient } from '@apollo/client'
import { food as foodQuery } from '../../apollo/queries'
import ConfigurationContext from '../../context/Configuration'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { IMAGE_LINK } from '../../utils/constants'

const FOOD = gql`${foodQuery}`

export default function Row({ id, restaurant }) {
  const { t, i18n } = useTranslation()
  const configuration = useContext(ConfigurationContext)
  const navigation = useNavigation()
  const client = useApolloClient()
  const themeContext = useContext(ThemeContext)
  const isDark = themeContext.ThemeValue === 'Dark'
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const accent = isDark ? '#fff' : '#000'
  const onAccent = isDark ? '#000' : '#fff'

  const food = client.readFragment({ id: `Food:${id}`, fragment: FOOD })
  if (!food) return null

  const onPress = () => {
    navigation.push('ItemDetail', {
      food: { ...food, restaurantName: restaurant?.name },
      addons: restaurant?.addons,
      options: restaurant?.options,
      restaurant: restaurant?._id
    })
  }

  const img = food?.image && food.image.trim() !== '' ? food.image : IMAGE_LINK
  const price = food?.variations?.[0]?.price

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: currentTheme.isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: scale(12),
        paddingVertical: scale(14),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: currentTheme.horizontalLine || '#F0F0F0'
      }}
    >
      <Image style={{ width: scale(68), height: scale(68), borderRadius: scale(10) }} source={{ uri: img }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(14), marginBottom: scale(3) }} bolder isRTL numberOfLines={1}>
          {food?.title}
        </TextDefault>
        <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(14), marginBottom: scale(6) }} bolder>
          {`${configuration.currencySymbol} ${parseFloat(price || 0).toFixed(2)}`}
        </TextDefault>
        <View style={{ alignSelf: currentTheme.isRTL ? 'flex-end' : 'flex-start', backgroundColor: '#EAF7EE', borderRadius: scale(4), paddingHorizontal: scale(7), paddingVertical: scale(2) }}>
          <TextDefault textColor='#0E8345' style={{ fontSize: scale(11) }} bolder>
            {t('Popular')}
          </TextDefault>
        </View>
      </View>
      <View
        style={{
          width: scale(36),
          height: scale(36),
          borderRadius: scale(18),
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Ionicons name='add' size={scale(16)} color={onAccent} />
      </View>
    </TouchableOpacity>
  )
}
