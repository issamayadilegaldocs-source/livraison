import { verticalScale, scale } from '../../../utils/scaling'
import { Dimensions, StyleSheet } from 'react-native'
import { alignment } from '../../../utils/alignment'

const windowWidth = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('screen').height
const MODAL_HEIGHT = Math.floor(SCREEN_HEIGHT / 4)
const ACTION_WIDTH = scale(70)

const styles = (props = null, hasActiveOrders = false) =>
  StyleSheet.create({
    flex: {
      flex: 1
    },
    addressSkeletonWrap: {
      paddingTop: scale(4)
    },
    addressSkeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      opacity: 0.6
    },
    addressSkeletonIcon: {
      width: scale(20),
      height: scale(20),
      borderRadius: scale(10),
      marginRight: scale(12)
    },
    addressSkeletonText: {
      flex: 1
    },
    addressSkeletonLineShort: {
      width: '35%',
      height: scale(11),
      borderRadius: scale(4),
      marginBottom: scale(7)
    },
    addressSkeletonLineLong: {
      width: '75%',
      height: scale(10),
      borderRadius: scale(4)
    },
    mainItemsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: scale(20),
      marginTop: scale(16),
      marginBottom: scale(30)
    },
    mainItem: {
      padding: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      width: windowWidth / 2 - 30,
      borderRadius: 8,
      justifyContent: 'space-between'
    },
    popularMenuImg: {
      width: '100%',
      // aspectRatio: 15 / 8
      height: scale(90)
    },

    screenBackground: {
      backgroundColor: props != null ? props?.themeBackground : '#FFF',
      ...alignment.PBlarge
    },
    mainContentContainer: {
      width: '100%',
      height: '100%',
      alignSelf: 'center'
    },
    searchbar: {
      backgroundColor: props != null ? props?.main : 'black',
      ...alignment.PBmedium
    },

    swipeRowWrap: {
      marginHorizontal: scale(20),
      marginBottom: scale(8),
      borderRadius: scale(12),
      overflow: 'hidden'
    },
    swipeContainer: {
      borderRadius: scale(12)
    },
    addressbtn: {
      backgroundColor: '#F6F6F6',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      minHeight: scale(72),
      paddingVertical: scale(14),
      paddingHorizontal: scale(14),
      borderRadius: scale(12)
    },
    addressbtnSelecting: {
      opacity: 0.7
    },
    swipeActionsWrap: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'stretch'
    },
    swipeAction: {
      width: ACTION_WIDTH,
      alignItems: 'center',
      justifyContent: 'center'
    },
    swipeActionTouch: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scale(4)
    },
    swipeActionLabel: {
      marginTop: scale(2),
      fontSize: scale(10),
      lineHeight: scale(13)
    },
    swipeHint: {
      opacity: 0.5
    },
    addNewAddressbtn: {
      padding: scale(5),
      ...alignment.PLmedium,
      ...alignment.PRmedium
    },
    addressContainer: {
      flex: 1,
      ...alignment.PTsmall,
      ...alignment.PBsmall
    },
    headerBar: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(20),
      paddingTop: scale(26),
      paddingBottom: scale(16)
    },
    headerTitle: {
      textAlign: props?.isRTL ? 'right' : 'left',
      fontSize: scale(18),
      lineHeight: scale(24)
    },
    headerClose: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(16),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F3F3F3'
    },
    addressRowContent: {
      width: '100%',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(12)
    },
    addressInfo: {
      flex: 1,
      gap: scale(2)
    },
    addButton: {
      backgroundColor: props !== null ? props?.newheaderColor : 'transparent',
      width: '100%',
      height: scale(40),
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center'
    },
    addressSubContainer: {
      width: '90%',
      alignSelf: 'center',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6
    },
    content: {
      ...alignment.PTlarge
    },
    modal: {
      backgroundColor: '#FFFFFF',
      borderTopEndRadius: scale(20),
      borderTopStartRadius: scale(20),
      position: 'relative',
      zIndex: 999,
      shadowOpacity: 0
    },
    addressTick: {
      width: '10%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginRight: scale(5)
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    handle: {
      width: scale(36),
      height: scale(4),
      borderRadius: scale(2),
      backgroundColor: '#E0E0E0',
      marginTop: scale(12)
    },
    relative: {
      position: 'relative'
    },
    placeHolderContainer: {
      backgroundColor: props != null ? props?.cartContainer : '#B8B8B8',
      borderRadius: scale(3),
      elevation: scale(3),
      marginBottom: scale(12),
      padding: scale(12)
    },
    brandsPlaceHolderContainer: {
      backgroundColor: props != null ? props?.cartContainer : '#B8B8B8',
      borderRadius: scale(3),
      paddingHorizontal: scale(20)
    },
    height200: {
      height: scale(200)
    },
    height80: {
      height: scale(80)
    },
    placeHolderFadeColor: {
      backgroundColor: props != null ? props?.fontSecondColor : '#B8B8B8'
    },
    emptyViewContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
    },
    emptyViewBox: {
      backgroundColor: props != null ? props?.newBackground : '#f0f0f0',
      borderRadius: scale(10),
      width: '85%',
      height: verticalScale(130),
      justifyContent: 'center',
      alignItems: 'center',
      padding: scale(15),
      marginTop: scale(30),
      borderColor: props !== null ? props?.gray200 : '#E5E7EB',
      borderWidth: scale(1)
    },
    searchList: {
      marginBottom: 70
    },
    mL5p: {
      ...alignment.MLsmall
    },
    homeIcon: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(10),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E8E8E8',
      backgroundColor: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    },
    titleAddress: {
      justifyContent: 'center',
      marginTop: 0
    },
    labelStyle: {
      textAlignVertical: 'bottom',
      fontSize: scale(14),
      lineHeight: scale(19),
      fontWeight: '700',
      textAlign: 'left'
    },
    addressTextContainer: {
      display: 'flex',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      paddingHorizontal: scale(50),
      width: 'auto'
    },
    topBrandsMargin: {
      marginBottom: hasActiveOrders ? MODAL_HEIGHT : 0
    },
    listContent: {
      paddingBottom: scale(8)
    },
    savedDividerRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(10),
      paddingHorizontal: scale(20),
      paddingTop: scale(2),
      paddingBottom: scale(14)
    },
    savedDividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: '#F0F0F0'
    },
    savedDividerText: {
      fontSize: scale(11),
      lineHeight: scale(15),
      letterSpacing: 0.6,
      textTransform: 'uppercase'
    }
  })
export default styles
