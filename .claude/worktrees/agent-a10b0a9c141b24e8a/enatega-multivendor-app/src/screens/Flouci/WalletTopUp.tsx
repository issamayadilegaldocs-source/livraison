import React, { useLayoutEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { WebView, WebViewNavigation } from 'react-native-webview'
import { useTranslation } from 'react-i18next'

interface WalletTopUpProps {
  route: { params: { link: string } }
  navigation: {
    setOptions: (opts: object) => void
    goBack: () => void
    replace: (screen: string) => void
  }
}

function WalletTopUp({ route, navigation }: WalletTopUpProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const { link } = route.params

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: null,
      title: t('walletTopUp') || 'Recharger le portefeuille'
    })
  }, [navigation])

  function handleNavigationChange(navState: WebViewNavigation) {
    const url = navState.url ?? ''
    if (url.includes('payments/flouci/done') && url.includes('type=topup')) {
      const ok = url.includes('status=success')
      if (ok) {
        // Navigate to Account screen so the updated balance is visible
        navigation.replace('Account')
      } else {
        navigation.goBack()
      }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        javaScriptEnabled
        bounces={false}
        scalesPageToFit
        source={{ uri: link }}
        onLoad={() => setLoading(false)}
        onNavigationStateChange={handleNavigationChange}
      />
      {loading && (
        <ActivityIndicator style={{ position: 'absolute', bottom: '50%', left: '50%' }} />
      )}
    </View>
  )
}

export default WalletTopUp
