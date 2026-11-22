import { scale } from '../../../utils/scaling'
import { Dimensions, StyleSheet, Platform } from 'react-native'
import { alignment } from '../../../utils/alignment'
const { height } = Dimensions.get('window')

const styles = (props = null) =>
  StyleSheet.create({
    offerContainer: {
      borderRadius: scale(16),
      width: scale(270),
      height: height * 0.315,
      ...alignment.MRsmall,
      backgroundColor: '#FFF',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2
    },
    overlayContainer: {
      position: 'absolute',
      top: 0,
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      width: scale(270),
      pointerEvents: 'box-none'
    },
    favouriteOverlay: {
      position: 'absolute',
      top: 10,
      ...props?.isRTL ? { left: 10 } : { right: 10 },
      width: scale(32),
      height: scale(32),
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
      borderRadius: scale(16),
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderWidth: 0
    },
    descriptionContainer: {
      paddingLeft: scale(14),
      paddingRight: scale(14),
      width: '100%',
      borderBottomLeftRadius: scale(16),
      borderBottomRightRadius: scale(16),
      height: '35%',
      justifyContent: 'center',
      gap: scale(5),
      backgroundColor: '#FFF'
    },
    aboutRestaurant: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: scale(2)
    },
    offerCategoty: {
      width: '100%',
      textAlign: props?.isRTL ? 'right' : 'left'
    },
    mainContainer: {
      paddingTop: scale(15),
      marginBottom: scale(15),
      borderTopLeftRadius: scale(20),
      borderTopRightRadius: scale(20),
      borderTopColor: '#ebebeb',
      borderTopWidth: scale(3)
    },
    restaurantImage: {
      width: Platform.OS === 'web' ? '100%' : scale(270),
      height: '100%',
      borderTopLeftRadius: scale(16),
      borderTopRightRadius: scale(16),
      aspectRatio: Platform.OS === 'web' ? 16 / 9 : 'auto'
    },
    imageContainer: {
      position: 'relative',
      alignItems: 'center',
      height: '65%'
    },
    restaurantTotalRating: {
      paddingLeft: scale(5)
    },
    restaurantPriceContainer: {
      marginTop: scale(3),
      fontSize: 15
    },
    deliveryInfo: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(8),
      flexWrap: 'wrap'
    },
    deliveryTime: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(4)
    },
    border: {
      width: '100%',
      height: 0
    },
    closedOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      justifyContent: 'center',
      alignItems: 'center'
    }
  })

export default styles
