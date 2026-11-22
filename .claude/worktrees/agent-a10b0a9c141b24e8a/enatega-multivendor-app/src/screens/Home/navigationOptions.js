/* eslint-disable react/display-name */
import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import SelectedLocation from '../../components/Main/Location/Location'
import { alignment } from '../../utils/alignment'
import { scale } from '../../utils/scaling'

const navigationOptions = (props) => ({
  headerStyle: {
    shadowColor: 'transparent',
    shadowRadius: 0,
    backgroundColor: props?.headerMenuBackground
  },
  headerTitleStyle: {
    color: props?.fontMainColor,
    ...alignment.PTlarge
  },
  headerTitleContainerStyle: {
    alignItems: 'flex-start',
    ...alignment.MLxSmall
  },
  headerTitleAlign: 'left',
  headerTitle: (headerProp) => <SelectedLocation {...headerProp} modalOn={() => props?.open()} linkColor={props?.fontMainColor} navigation={props?.navigation} />,
  headerRight: () => (
    <TouchableOpacity
      onPress={() => props?.navigation?.navigate('Notifications')}
      style={styles.bellButton}
      accessibilityLabel="Notifications"
      accessibilityRole="button"
    >
      <Ionicons name="notifications-outline" size={24} color={props?.iconColorPink ?? '#333'} />
      {props?.unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {props.unreadCount > 9 ? '9+' : String(props.unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  bellButton: {
    marginRight: scale(14),
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: scale(4),
    right: scale(6),
    minWidth: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(2),
  },
  badgeText: {
    color: '#fff',
    fontSize: scale(9),
    fontWeight: '700',
  },
})

export default navigationOptions
