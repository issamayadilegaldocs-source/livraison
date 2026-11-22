import { StyleSheet } from 'react-native'
import { alignment } from '../../utils/alignment'
import { scale } from '../../utils/scaling'

const styles = (props = null) =>
  StyleSheet.create({
    itemContainer: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      justifyContent:'space-between',
      alignItems: 'flex-start',
      gap: scale(10),
      paddingVertical: scale(14),
      paddingHorizontal: scale(16)
    },
    suggestItemImg:{
      width: scale(72),
      height: scale(72)
    },
    suggestItemImgContainer:{
      backgroundColor: '#F3F4F6',
      borderRadius: scale(10),
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center'
    },
    itemInfo: {
      flex: 1,
      minWidth: 0
    },
    divider:{
      width:scale(1),
      height:scale(12),
      backgroundColor: props !== null ? props?.verticalLine : '#D8D8D8',
      marginHorizontal: scale(10)
    },
    actionContainer: {
      height: scale(38),
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: props !== null ? props?.gray100 : '#F3F3F3',
      borderRadius: scale(19),
      overflow: 'hidden',
      marginTop: scale(4)
    },
    actionContainerBtns: {
      width: scale(38),
      height: scale(38),
      alignItems: 'center',
      justifyContent: 'center'
    },
    plusBtn:{
      backgroundColor: props !== null ? props.newFontcolor : '#000',
      borderRadius: scale(19)
    },
    actionContainerView: {    
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: scale(22),
      paddingHorizontal: scale(2)
    },
    additionalItem:{
      marginTop:scale(3),
      marginBottom:scale(6)
    },
    itemsDropdown:{
      backgroundColor: props !== null ? props.gray100 : '#F6F6F6',
      borderRadius: scale(8),
      paddingVertical: scale(8),
      paddingHorizontal: scale(10),
      marginTop: scale(6),
      marginBottom: scale(2)
    },
    editText: {
      textDecorationLine: 'underline'
    }
  })
export default styles
