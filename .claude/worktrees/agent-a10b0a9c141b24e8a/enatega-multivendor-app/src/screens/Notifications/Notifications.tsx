import React, { useContext, useLayoutEffect } from 'react'
import {
  View,
  FlatList,
  StatusBar,
  Platform,
  StyleSheet,
} from 'react-native'
import { useQuery, useMutation } from '@apollo/client'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import Spinner from '../../components/Spinner/Spinner'
import { MY_NOTIFICATIONS } from '../../apollo/queries'
import { MARK_NOTIFICATIONS_READ } from '../../apollo/mutations'
import screenOptions from '../../routes/screenOptions'
import { scale } from '../../utils/scaling'
import { alignment } from '../../utils/alignment'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH}h`
  return `Il y a ${Math.floor(diffH / 24)}j`
}

interface INotification {
  _id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export default function Notifications(props: any) {
  const { t } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const insets = useSafeAreaInsets()

  const { data, loading, refetch } = useQuery(MY_NOTIFICATIONS, {
    fetchPolicy: 'cache-and-network',
  })

  const [markRead] = useMutation(MARK_NOTIFICATIONS_READ, {
    onCompleted: () => refetch(),
  })

  useFocusEffect(
    React.useCallback(() => {
      markRead()
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(currentTheme.themeBackground)
      }
      StatusBar.setBarStyle(
        themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
      )
    }, [currentTheme.themeBackground, themeContext.ThemeValue])
  )

  useLayoutEffect(() => {
    props?.navigation.setOptions(
      screenOptions({
        backColor: currentTheme.themeBackground,
        lineColor: currentTheme.horizontalLine,
        textColor: currentTheme.newFontcolor,
        iconColor: currentTheme.iconColor,
      })
    )
  }, [props?.navigation, currentTheme])

  const notifications: INotification[] = data?.myNotifications ?? []

  const renderItem = ({ item }: { item: INotification }) => {
    const timeAgo = formatTimeAgo(new Date(Number(item.createdAt)))
    return (
      <View
        style={[
          styles.item,
          {
            backgroundColor: item.isRead
              ? currentTheme.themeBackground
              : currentTheme.cartContainer,
            borderBottomColor: currentTheme.horizontalLine,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={item.isRead ? 'notifications-outline' : 'notifications'}
            size={22}
            color={item.isRead ? currentTheme.fontSecondColor : currentTheme.main}
          />
        </View>
        <View style={styles.textContainer}>
          <TextDefault
            style={styles.title}
            textColor={currentTheme.fontMainColor}
            bolder={!item.isRead}
            numberOfLines={2}
          >
            {item.title}
          </TextDefault>
          <TextDefault small textColor={currentTheme.fontSecondColor} style={alignment.MTxSmall}>
            {item.body}
          </TextDefault>
          <TextDefault smaller textColor={currentTheme.fontSecondColor} style={alignment.MTxSmall}>
            {timeAgo}
          </TextDefault>
        </View>
        {!item.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: currentTheme.main }]} />
        )}
      </View>
    )
  }

  if (loading && !data) return <Spinner visible />

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.themeBackground, paddingBottom: insets.bottom },
      ]}
    >
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={currentTheme.fontSecondColor} />
          <TextDefault
            H5
            textColor={currentTheme.fontSecondColor}
            style={alignment.MTmedium}
            center
          >
            {t('noNotifications') || 'Aucune notification'}
          </TextDefault>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={loading}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
    marginTop: scale(2),
  },
  textContainer: { flex: 1 },
  title: { fontSize: scale(14) },
  unreadDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginTop: scale(6),
    marginLeft: scale(8),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
