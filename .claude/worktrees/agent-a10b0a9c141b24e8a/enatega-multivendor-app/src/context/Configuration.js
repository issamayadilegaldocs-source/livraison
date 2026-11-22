import React from 'react'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { useTranslation } from 'react-i18next'

import { getConfiguration } from '../apollo/queries'
import { localizedCurrencySymbol } from '../utils/currencySymbol'

const GETCONFIGURATION = gql`
  ${getConfiguration}
`

const ConfigurationContext = React.createContext({})

export const ConfigurationProvider = props => {
  const { loading, data, error } = useQuery(GETCONFIGURATION)
  const { i18n } = useTranslation()

  const configuration =
    loading || error || !data?.configuration
      ? {
          currency: '',
          currencySymbol: '',
          deliveryRate: 10,
          costType: 'perKM',
          baseDeliveryFee: 0,
          baseDeliveryDistance: 0,
          twilioEnabled: process.env.EXPO_PUBLIC_TWILIO_ENABLED === 'true'
        }
      : data?.configuration

  const localizedConfiguration = {
    ...configuration,
    twilioEnabled: process.env.EXPO_PUBLIC_TWILIO_ENABLED === 'true',
    currencySymbol: localizedCurrencySymbol(
      configuration.currency,
      configuration.currencySymbol,
      i18n.language
    )
  }

  return (
    <ConfigurationContext.Provider value={localizedConfiguration}>
      {props?.children}
    </ConfigurationContext.Provider>
  )
}
export const ConfigurationConsumer = ConfigurationContext.Consumer
export default ConfigurationContext
