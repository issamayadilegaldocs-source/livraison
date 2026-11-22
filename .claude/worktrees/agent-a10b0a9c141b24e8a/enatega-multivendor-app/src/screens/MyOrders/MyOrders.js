import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity, StatusBar, Platform } from 'react-native'
import navigationService from '../../routes/navigationService'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ActiveOrders from '../../components/MyOrders/ActiveOrders'
import PastOrders from '../../components/MyOrders/PastOrders'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import styles from './styles'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { MaterialIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { scale } from '../../utils/scaling'
import Analytics from '../../utils/analytics'
import OrdersContext from '../../context/Orders'
import { HeaderBackButton } from '@react-navigation/elements'
import { useTranslation } from 'react-i18next'
import ReviewModal from '../../components/Review'
import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'
import { useTabBarSpace } from '../../utils/useTabBarSpace'
import { ACTIVE_ORDER_STATUSES, PAST_ORDER_STATUSES } from '../../utils/enums'

function MyOrders(props) {
  const reviewModalRef = useRef()
  const [reviewInfo, setReviewInfo] = useState()
  const analytics = Analytics()
  const { t, i18n } = useTranslation()
  const { orders, loadingOrders, errorOrders, reFetchOrders } = useContext(OrdersContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const [selectedTab, setSelectedTab] = useState('current')
  const inset = useSafeAreaInsets()
  const tabBarSpace = useTabBarSpace()
  // When rendered as the bottom-tab "Orders" screen there is no native header,
  // so the content must reserve the status-bar space itself. As a pushed stack
  // screen ("MyOrders") the native header already handles it.
  const isTabInstance = props?.route?.name === 'Orders'
  const activeOrders = useMemo(() => {
    return orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.orderStatus))
  }, [orders])
  const pastOrders = useMemo(() => {
    return orders.filter((o) => PAST_ORDER_STATUSES.includes(o.orderStatus))
  }, [orders])
  const openReviewModal = () => {
    reviewModalRef.current.open()
  }
  const closeReviewModal = () => {
    reviewModalRef.current.close()
  }

  useEffect(() => {
    async function Track() {
      await analytics.track(analytics.events.NAVIGATE_TO_MYORDERS)
    }
    Track()
  }, [])
  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#FFF')
    }
    StatusBar.setBarStyle('dark-content')
  })
  useEffect(() => {
    props?.navigation.setOptions({
      headerRight: null,
      headerLeft: () => (
        <HeaderBackButton
          truncatedLabel=''
          backImage={() => (
            <View style={styles().backButton}>
              <MaterialIcons name='arrow-back' size={25} color='#111' />
            </View>
          )}
          onPress={() => {
            navigationService.goBack()
          }}
        />
      ),
      headerTitle: t('titleOrders'),
      headerTitleAlign: 'center',
      headerTitleStyle: {
        color: '#111',
        fontWeight: 'bold'
      },
      headerTitleContainerStyle: {
        marginTop: '2%',
        paddingLeft: scale(25),
        paddingRight: scale(25),
        height: '75%',
        marginLeft: 0
      },
      headerStyle: {
        backgroundColor: '#FFF',
        elevation: 0
      }
    })
  }, [props?.navigation])

  const TabButton = ({ text, onPress, isSelected }) => {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={isSelected ? styles().activeTabStyles : styles().inactiveTabStyles}>
        <TextDefault H4 bold={isSelected} textColor={isSelected ? '#111' : '#AFAFAF'}>
          {text}
        </TextDefault>
      </TouchableOpacity>
    )
  }

  const onPressReview = (order, selectedRating) => {
    setReviewInfo({ order, selectedRating })
    openReviewModal()
  }

  const { isConnected: connect } = useNetworkStatus()
  if (!connect) return <ErrorView refetchFunctions={[reFetchOrders]} />
  return (
    <>
      <View style={[styles().container, isTabInstance && { paddingTop: inset.top }]}>
        <View style={styles().tabContainer}>
          <TabButton text={t('current')} onPress={() => setSelectedTab('current')} isSelected={selectedTab === 'current'} />

          <TabButton text={t('past')} onPress={() => setSelectedTab('past')} isSelected={selectedTab === 'past'} />
        </View>
        {selectedTab === 'current' && <ActiveOrders navigation={props?.navigation} activeOrders={activeOrders} loading={loadingOrders} error={errorOrders} />}
        {selectedTab === 'past' && <PastOrders navigation={props?.navigation} pastOrders={pastOrders} loading={loadingOrders} error={errorOrders} onPressReview={onPressReview} />}

        <View
          style={{
            paddingBottom: tabBarSpace,
            backgroundColor: '#F6F6F6'
          }}
        />
      </View>
      <ReviewModal ref={reviewModalRef} onOverlayPress={closeReviewModal} theme={currentTheme} orderId={reviewInfo?.order._id} rating={reviewInfo?.selectedRating} />
    </>
  )
}

export default MyOrders
