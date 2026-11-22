/* eslint-disable react/display-name */
import React from 'react'
import {
  RightButton,
  BackButton
} from '../components/Header/HeaderIcons/HeaderIcons'
import { Platform, StyleSheet } from 'react-native'
import { textStyles } from '../utils/textStyles'
import { scale } from '../utils/scaling'
import { useTranslation } from 'react-i18next'

const screenOptions = props => {
  const { t } = useTranslation()
  return {
    headerTitleAlign: 'center',
    headerBackTitleVisible: false,
    // Sur web, la CardSheet du stack passe en mode « page » (minHeight: 100%)
    // et délègue le scroll au <body> — qu'Expo verrouille (overflow: hidden).
    // Contraindre la carte à la hauteur du viewport rend le scroll aux
    // ScrollView/FlatList internes des écrans, comme sur natif.
    ...Platform.select({ web: { cardStyle: { flex: 1 } } }),
    headerStyle: {
      backgroundColor: props.backColor,
      borderBottomColor: props.lineColor,
      borderBottomWidth: StyleSheet.hairlineWidth
    },
    headerTitleStyle: {
      color: props.textColor,
      ...textStyles.Bolder,
      ...textStyles.B700,
      backgroundColor: 'transparent'
    },
    headerTitleContainerStyle: {
      marginHorizontal: scale(35)
    },
    headerBackImage: () =>
      BackButton({ iconColor: props.textColor, icon: 'leftArrow' }),
    headerRight: () => (
      <RightButton icon="cart" iconColor={props.iconColor} menuHeader={false} t={t}/>
    )
  }
}
export default screenOptions
