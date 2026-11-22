import { Platform, StyleSheet } from 'react-native'
import { alignment } from '../../../utils/alignment'
import { verticalScale, scale } from '../../../utils/scaling'

const styles = (backColor) =>
  StyleSheet.create({
    leftIconPadding: {
      ...alignment.MLsmall
      // ...alignment.PTxSmall,
      // ...alignment.PBxSmall
    },
    rightContainer: {
      position: 'relative',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      ...alignment.PRsmall
    },
    cartIconContainer: {
      width: verticalScale(36),
      height: verticalScale(36),
      borderRadius: verticalScale(18),
      justifyContent: 'center',
      alignItems: 'center'
    },
    cartIconContainerActive: {
      backgroundColor: backColor,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.9)',
      shadowColor: backColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: scale(8),
      elevation: 8
    },
    favContainer: {
      height: '100%',
      justifyContent: 'center',
      marginRight: Platform.OS === 'ios' && scale(15)
    },
    imgContainer: {
      width: verticalScale(20),
      height: verticalScale(20)
    },
    absoluteContainer: {
      width: verticalScale(15),
      height: verticalScale(15),
      backgroundColor: '#DC2626',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scale(15),
      position: 'absolute',
      right: scale(2),
      top: scale(1),
      borderWidth: 1,
      borderColor: '#FFF'
    },
    touchAreaPassword: {
      width: '40%',
      height: '70%',
      justifyContent: 'center',
      alignItems: 'flex-end'
    },
    titlePasswordText: {
      backgroundColor: backColor !== null ? backColor : 'white',
      height: '75%',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      borderRadius: scale(10),
      ...alignment.PLmedium
    },
    passwordContainer: {
      width: scale(150),
      ...alignment.PRxSmall
    },
    darkBackArrow: {
      ...alignment.PLxSmall,
      ...alignment.PRxSmall,
      ...alignment.PTxSmall,
      ...alignment.PBxSmall
    },
    rightButtonContainer: {
      padding: scale(5),
      width: scale(60)
    }
  })

export default styles
