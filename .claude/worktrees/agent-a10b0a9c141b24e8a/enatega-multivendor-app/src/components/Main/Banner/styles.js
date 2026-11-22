import { scale } from '../../../utils/scaling'
import { StyleSheet } from 'react-native'

const styles = () =>
  StyleSheet.create({
    // Single promo card. Fills its container width; height grows with content
    // (min 150) so the button is never pushed to a dead bottom edge.
    card: {
      width: '100%',
      minHeight: scale(150),
      borderRadius: scale(18),
      overflow: 'hidden'
    },
    promoContent: {
      paddingHorizontal: scale(20),
      paddingTop: scale(22),
      paddingBottom: scale(20)
    },
    promoCircleLarge: {
      position: 'absolute',
      width: scale(180),
      height: scale(180),
      borderRadius: scale(90),
      backgroundColor: 'rgba(255,255,255,0.035)',
      top: scale(-60),
      right: scale(-50)
    },
    promoCircleSmall: {
      position: 'absolute',
      width: scale(110),
      height: scale(110),
      borderRadius: scale(55),
      bottom: scale(-30),
      right: scale(60)
    },
    promoMediaScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.40)'
    },
    promoEyebrow: {
      alignSelf: 'flex-start',
      borderRadius: scale(5),
      paddingHorizontal: scale(9),
      paddingVertical: scale(3),
      fontSize: scale(10),
      lineHeight: scale(13),
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: scale(10),
      maxWidth: '78%'
    },
    promoTitle: {
      maxWidth: '84%',
      fontSize: scale(22),
      lineHeight: scale(27),
      letterSpacing: 0,
      marginBottom: scale(6)
    },
    promoSubtitle: {
      maxWidth: '82%',
      fontSize: scale(12),
      lineHeight: scale(17),
      marginBottom: scale(16)
    },
    promoFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    promoButton: {
      minHeight: scale(34),
      minWidth: scale(108),
      maxWidth: '62%',
      paddingHorizontal: scale(20),
      borderRadius: scale(18),
      alignItems: 'center',
      justifyContent: 'center'
    },
    promoPagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: scale(5),
      minWidth: scale(42),
      marginRight: scale(4)
    },
    promoDot: {
      width: scale(4),
      height: scale(4),
      borderRadius: scale(2),
      backgroundColor: 'rgba(255,255,255,0.35)'
    },
    promoDotActive: {
      width: scale(18),
      backgroundColor: '#FFFFFF'
    }
  })
export default styles
