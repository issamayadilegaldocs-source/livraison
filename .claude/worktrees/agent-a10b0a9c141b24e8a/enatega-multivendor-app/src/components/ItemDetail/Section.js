import { View } from 'react-native'
import React, { useContext } from 'react'
import TextDefault from '../Text/TextDefault/TextDefault'
import Row from './Row'
import { scale } from '../../utils/scaling'
import {
  relatedItems as relatedItemsQuery,
  restaurant as restaurantQuery
} from '../../apollo/queries'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import { useTranslation } from 'react-i18next'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'

const RELATED_ITEMS = gql`
  ${relatedItemsQuery}
`
const RESTAURANT = gql`
  ${restaurantQuery}
`

const Section = ({ itemId, restaurantId }) => {
  const { t, i18n } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const isDark = themeContext.ThemeValue === 'Dark'
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const client = useApolloClient()
  const { loading, error, data } = useQuery(RELATED_ITEMS, {
    variables: { itemId, restaurantId }
  })
  if (loading || error) return null
  const { relatedItems } = data
  if (relatedItems.length < 1) return null
  const result = client.readQuery({
    query: RESTAURANT,
    variables: { id: restaurantId }
  })

  const slicedItems = relatedItems.length > 3 ? relatedItems.slice(0, 3) : relatedItems
  return (
    <View
      style={{
        backgroundColor: currentTheme.themeBackground,
        borderTopWidth: scale(8),
        borderTopColor: isDark ? '#000' : '#F6F6F6',
        paddingHorizontal: scale(16),
        paddingTop: scale(16),
        paddingBottom: scale(6)
      }}
    >
      <TextDefault textColor={currentTheme.fontMainColor} style={{ fontSize: scale(16), marginBottom: scale(2) }} bolder isRTL>
        {t('frequentlyBoughtTogether')}
      </TextDefault>
      {slicedItems.map((id) => (
        <Row key={id} id={id} restaurant={result?.restaurant} />
      ))}
    </View>
  )
}
export default Section
