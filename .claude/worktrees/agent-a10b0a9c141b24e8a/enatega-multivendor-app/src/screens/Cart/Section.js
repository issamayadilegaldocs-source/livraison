import { View, Image, TouchableOpacity } from 'react-native'
import React, { useContext } from 'react'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { scale } from '../../utils/scaling'
import { food, relatedItems as relatedItemsQuery, restaurant as restaurantQuery } from '../../apollo/queries'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import styles from './styles'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { MaterialIcons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import ConfigurationContext from '../../context/Configuration'
import { useTranslation } from 'react-i18next'
import { IMAGE_LINK } from '../../utils/constants'

const RELATED_ITEMS = gql`${relatedItemsQuery}`
const RESTAURANT = gql`${restaurantQuery}`
const FOOD = gql`${food}`

const Section = ({ itemId, restaurantId }) => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const client = useApolloClient()
  const themeContext = useContext(ThemeContext)
  const configuration = useContext(ConfigurationContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const { loading, error, data } = useQuery(RELATED_ITEMS, { variables: { itemId, restaurantId } })
  if (loading) return <View />
  if (error) return <View />
  const { relatedItems } = data
  if (relatedItems.length < 1) return <View />
  const result = client.readQuery({ query: RESTAURANT, variables: { id: restaurantId } })
  const slicedItems = relatedItems.length > 3 ? relatedItems.slice(0, 3) : relatedItems
  const restaurant = result?.restaurant
  const renderItem = ({ item }) => {
    const food = client.readFragment({ id: `Food:${item}`, fragment: FOOD })
    const imageUrl = food?.image && food?.image.trim() !== '' ? food?.image : IMAGE_LINK;

    const onAdd = () => {
      navigation.push('ItemDetail', {
        food: {
          ...food,
          restaurantName: restaurant.name
        },
        addons: restaurant.addons,
        options: restaurant.options,
        restaurant: restaurant._id
      })
    }
    return <View key={item} style={styles(currentTheme).upsellRow}>
        {imageUrl &&
          <View style={styles().suggestItemImgContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles().suggestItemImg}
              resizeMode="contain"
            />
          </View>
        }
        <View style={styles().upsellInfo}>
          <TextDefault
            numberOfLines={1}
            textColor={currentTheme.fontFourthColor}
            H5
            bolder>
            {food.title}
          </TextDefault>
          <TextDefault
            textColor={currentTheme.fontFourthColor}
            normal
            bolder>
            {`${configuration.currencySymbol}${food.variations[0].price}`}
          </TextDefault>
        </View>
        <TouchableOpacity onPress={onAdd} style={styles(currentTheme).addToCart}>
          <MaterialIcons name="add" size={scale(20)} color={currentTheme.themeBackground} />
        </TouchableOpacity>
    </View>
  }


  return (
    <View>
      <TextDefault
        style={styles().suggestItemDesciption}
        textColor={currentTheme.fontFourthColor}
        H5
        bolder>
        {t('addMore')}
      </TextDefault>
      {slicedItems.map((item, index) => renderItem({ item, index }))}
    </View>
  )
}
export default Section
