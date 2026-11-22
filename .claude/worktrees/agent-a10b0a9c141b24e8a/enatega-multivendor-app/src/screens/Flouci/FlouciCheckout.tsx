import React, { useContext, useEffect, useLayoutEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { WebView, WebViewNavigation } from 'react-native-webview'
import { useApolloClient } from '@apollo/client'
import gql from 'graphql-tag'
import { myOrders } from '../../apollo/queries'
import useEnvVars from '../../../environment'
import UserContext from '../../context/User'
import { useTranslation } from 'react-i18next'

const MYORDERS = gql`
  ${myOrders}
`

interface FlouciCheckoutProps {
  route: { params: { _id: string } }
  navigation: {
    setOptions: (opts: object) => void
    goBack: () => void
    reset: (state: object) => void
  }
}

function FlouciCheckout({ route, navigation }: FlouciCheckoutProps) {
  const { SERVER_REST_URL } = useEnvVars()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const { clearCart } = useContext(UserContext) as { clearCart: () => Promise<void> }
  const client = useApolloClient()
  const { _id } = route.params

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: null,
      title: t('onlinePayment')
    })
  }, [navigation])

  useEffect(() => {
    // Cleanup: no subscriptions needed
    return () => {}
  }, [])

  async function handleNavigationChange(navState: WebViewNavigation) {
    const url = navState.url ?? ''

    if (url.includes('payments/flouci/success')) {
      const result = await client.query({ query: MYORDERS, fetchPolicy: 'network-only' })
      const order = (result.data?.orders ?? []).find((o: { _id: string }) => o._id === _id)
      await clearCart()
      navigation.reset({
        routes: [
          { name: 'Main' },
          {
            name: 'OrderDetail',
            params: { _id: order?._id ?? _id }
          }
        ]
      })
    } else if (url.includes('payments/flouci/fail') || url.includes('payments/flouci/done?status=fail')) {
      navigation.goBack()
    }
  }

  const checkoutUrl = `${SERVER_REST_URL}api/payments/flouci/checkout?orderId=${_id}`

  return (
    <View style={{ flex: 1 }}>
      <WebView
        javaScriptEnabled
        bounces={false}
        scalesPageToFit
        source={{ uri: checkoutUrl }}
        onLoad={() => setLoading(false)}
        onNavigationStateChange={handleNavigationChange}
      />
      {loading && (
        <ActivityIndicator style={{ position: 'absolute', bottom: '50%', left: '50%' }} />
      )}
    </View>
  )
}

export default FlouciCheckout
