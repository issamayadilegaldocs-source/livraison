import { fontStyles } from '../../../utils/fontStyles'
import { scale, verticalScale } from '../../../utils/scaling'
import { StyleSheet } from 'react-native'
import { alignment } from '../../../utils/alignment'
import { theme } from '../../../utils/themeColors'

const styles = (props = null, newheaderColor = theme.headerMenuBackground) =>
  StyleSheet.create({
    bodyStyleOne: {
      fontFamily: fontStyles.MuseoSans500,
      fontSize: scale(17),
      color: props != null ? props?.fontMainColor : 'black',
      minHeight: verticalScale(40)
    },
    mainContainerHolder: {
      zIndex: 333,
      width: '100%',
      alignItems: 'center',
      backgroundColor: newheaderColor,
      paddingTop: scale(6),
      paddingBottom: scale(4)
    },
    mainContainer: {
      width: '92%',
      height: scale(54),
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: scale(30),
      backgroundColor: props != null ? props?.newBackground : '#F3F4F6',

      shadowColor: props != null ? props?.shadowColor : 'black',
      shadowOffset: {
        width: 0,
        height: verticalScale(1)
      },
      shadowOpacity: 0.06,
      shadowRadius: verticalScale(4),
      elevation: 1
    },
    subContainer: {
      width: '90%',
      height: '72%',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row'
    },
    leftContainer: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      width: '84%',
      gap: scale(8),
      overflow: 'hidden'
    },
    searchContainer: {
      width: scale(26),
      alignSelf: 'center',
      alignItems: 'center'
    },
    inputContainer: {
      justifyContent: 'center',
      ...alignment.MLxSmall,
      ...alignment.MRxSmall,
      width: '90%'
    },
    filterContainer: {
      width: '10%',
      height: '90%',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row'
      // borderColor: 'white',
      // borderWidth: 2
    }
  })
export default styles
