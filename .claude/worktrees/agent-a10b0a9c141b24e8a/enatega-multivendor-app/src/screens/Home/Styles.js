import { verticalScale, scale } from '../../utils/scaling'
import { Dimensions, StyleSheet } from 'react-native'
import { alignment } from '../../utils/alignment'

const { height: HEIGHT } = Dimensions.get('window')

const styles = (props = null) =>
  StyleSheet.create({
    flex: {
      flex: 1
    },
    container: {
      flex: 1,
      backgroundColor: '#F6F6F6'
    },
    screenBackground: {
      backgroundColor: '#FFF'
    },
    centerFill: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20
    },
    // ---- design-system home header ----
    stickyHeader: {
      backgroundColor: '#FFF',
      paddingTop: scale(10),
      paddingBottom: scale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#F0F0F0'
    },
    locationRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16),
      paddingBottom: scale(10),
      gap: scale(12)
    },
    locationButton: {
      flex: 1,
      minWidth: 0,
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(8)
    },
    locationTextWrap: {
      flex: 1,
      minWidth: 0
    },
    eyebrowText: {
      fontSize: scale(10),
      lineHeight: scale(14),
      textTransform: 'uppercase',
      letterSpacing: 0.6
    },
    locationTitleRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      minWidth: 0
    },
    locationText: {
      flex: 1,
      fontSize: scale(14),
      lineHeight: scale(19)
    },
    cartButton: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      backgroundColor: '#F3F3F3',
      alignItems: 'center',
      justifyContent: 'center'
    },
    cartButtonActive: {
      shadowColor: props?.primary ?? '#90E36D',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: scale(8),
      elevation: 8
    },
    cartBadge: {
      position: 'absolute',
      top: -scale(4),
      right: -scale(4),
      minWidth: scale(18),
      height: scale(18),
      paddingHorizontal: scale(4),
      borderRadius: scale(9),
      backgroundColor: '#DC2626',
      borderWidth: scale(1),
      borderColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center'
    },
    cartBadgeText: {
      fontSize: scale(9),
      lineHeight: scale(11)
    },
    searchBar: {
      height: scale(46),
      marginHorizontal: scale(16),
      marginBottom: scale(10),
      borderRadius: scale(12),
      backgroundColor: '#F3F3F3',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(10),
      paddingHorizontal: scale(14)
    },
    searchText: {
      flex: 1,
      fontSize: scale(15)
    },
    segmentRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      paddingHorizontal: scale(16),
      gap: scale(8)
    },
    segmentBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: scale(34),
      paddingHorizontal: scale(16),
      borderRadius: 50,
      backgroundColor: '#F3F3F3'
    },
    segmentBtnActive: {
      backgroundColor: '#000'
    },
    foodRailSection: {
      backgroundColor: '#FFF',
      paddingVertical: scale(14),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#F0F0F0'
    },
    foodRailContent: {
      paddingHorizontal: scale(16),
      gap: scale(2)
    },
    foodTypeItem: {
      width: scale(64),
      alignItems: 'center',
      gap: scale(6)
    },
    foodIconWrap: {
      position: 'relative'
    },
    foodIconBox: {
      width: scale(52),
      height: scale(52),
      borderRadius: scale(14),
      backgroundColor: props?.gray100 ?? '#F3F3F3',
      borderWidth: scale(2),
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    foodIconBoxActive: {
      backgroundColor: '#000',
      borderColor: '#000'
    },
    foodCheckBadge: {
      position: 'absolute',
      top: -scale(3),
      right: -scale(3),
      width: scale(18),
      height: scale(18),
      borderRadius: scale(9),
      backgroundColor: '#000',
      borderWidth: scale(2),
      borderColor: props?.themeBackground ?? '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2
    },
    foodImage: {
      width: '100%',
      height: '100%'
    },
    foodTypeText: {
      width: '100%',
      textAlign: 'center',
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    promoWrap: {
      paddingHorizontal: scale(16),
      paddingTop: scale(16)
    },
    promoCard: {
      minHeight: scale(148),
      borderRadius: scale(18),
      backgroundColor: '#111',
      overflow: 'hidden',
      paddingHorizontal: scale(20),
      paddingTop: scale(22),
      paddingBottom: scale(18)
    },
    promoOrbLarge: {
      position: 'absolute',
      width: scale(180),
      height: scale(180),
      borderRadius: scale(90),
      backgroundColor: 'rgba(255,255,255,0.035)',
      top: scale(-60),
      right: scale(-50)
    },
    promoOrbSmall: {
      position: 'absolute',
      width: scale(110),
      height: scale(110),
      borderRadius: scale(55),
      backgroundColor: 'rgba(255,120,30,0.1)',
      bottom: scale(-30),
      right: scale(60)
    },
    promoEyebrow: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,120,30,0.18)',
      borderRadius: scale(5),
      paddingHorizontal: scale(9),
      paddingVertical: scale(3),
      fontSize: scale(10),
      lineHeight: scale(13),
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: scale(10)
    },
    promoTitle: {
      fontSize: scale(23),
      lineHeight: scale(28),
      letterSpacing: 0,
      marginBottom: scale(6)
    },
    promoSubtitle: {
      fontSize: scale(12),
      lineHeight: scale(18),
      marginBottom: scale(16)
    },
    promoButton: {
      alignSelf: 'flex-start',
      minHeight: scale(36),
      paddingHorizontal: scale(20),
      borderRadius: 50,
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center'
    },
    contentSection: {
      paddingTop: scale(22)
    },
    sectionTitleRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(7),
      minWidth: 0
    },
    seeAllText: {
      textDecorationLine: 'underline',
      fontSize: scale(13)
    },
    horizontalCardsContent: {
      paddingHorizontal: scale(16),
      gap: scale(12),
      paddingBottom: scale(4)
    },
    popularCard: {
      width: scale(152),
      borderRadius: scale(14),
      backgroundColor: '#FFF',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
      elevation: 2
    },
    popularImageWrap: {
      height: scale(120),
      backgroundColor: '#E8E8E8',
      overflow: 'hidden'
    },
    popularImage: {
      width: '100%',
      height: '100%'
    },
    popularImageShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.08)'
    },
    popularInfo: {
      paddingHorizontal: scale(10),
      paddingTop: scale(10),
      paddingBottom: scale(12),
      gap: scale(4)
    },
    metaRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(3)
    },
    metaText: {
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    brandContent: {
      paddingHorizontal: scale(16),
      gap: scale(18),
      paddingBottom: scale(4)
    },
    brandItem: {
      width: scale(68),
      alignItems: 'center',
      gap: scale(7)
    },
    brandCircle: {
      width: scale(60),
      height: scale(60),
      borderRadius: scale(30),
      backgroundColor: '#111',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    brandImage: {
      width: '100%',
      height: '100%'
    },
    brandText: {
      width: '100%',
      textAlign: 'center',
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    restaurantFilterBlock: {
      paddingHorizontal: scale(16),
      paddingTop: scale(22),
      paddingBottom: scale(4),
      gap: scale(10)
    },
    restaurantHeaderRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: scale(12)
    },
    restaurantActions: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(8)
    },
    filterLink: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(5)
    },
    mapButton: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(16),
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center'
    },
    // ---- headings ----
    sectionHeader: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16),
      paddingTop: scale(12),
      paddingBottom: scale(4)
    },
    carouselSection: {
      paddingHorizontal: scale(12),
      paddingTop: scale(8),
      gap: scale(8)
    },
    // ---- list ----
    listContent: {
      paddingBottom: HEIGHT * 0.34
    },
    cardWrapper: {
      paddingHorizontal: scale(16),
      paddingBottom: scale(16)
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
    // ---- address modal (reused MainModalize) ----
    addNewAddressbtn: {
      padding: scale(5),
      ...alignment.PLmedium,
      ...alignment.PRmedium
    },
    sheetActionWrap: {
      paddingHorizontal: scale(20),
      paddingBottom: scale(16)
    },
    sheetFooterWrap: {
      paddingHorizontal: scale(20),
      paddingTop: scale(16),
      paddingBottom: scale(32)
    },
    addressContainer: {
      width: '100%',
      ...alignment.PTsmall,
      ...alignment.PBsmall
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
    currentLocationButton: {
      backgroundColor: '#000000',
      width: '100%',
      height: scale(52),
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center'
    },
    addAddressButton: {
      backgroundColor: '#FFFFFF',
      width: '100%',
      height: scale(52),
      borderRadius: 50,
      borderWidth: scale(2),
      borderColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center'
    },
    addressSubContainer: {
      justifyContent: 'center',
      alignSelf: 'center',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center'
    },
    addressTick: {
      width: '10%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginRight: scale(5)
    },
    mL5p: {
      ...alignment.MLsmall
    },
    // ---- filters modal ----
    modal: {
      backgroundColor: props != null ? props?.themeBackground : '#FFF',
      paddingTop: scale(10),
      borderTopEndRadius: scale(20),
      borderTopStartRadius: scale(20),
      position: 'relative',
      zIndex: 999,
      shadowOpacity: 0,
      borderWidth: scale(1),
      borderColor: props != null ? props?.color10 : '#FFF'
    },
    overlay: {
      backgroundColor: props != null ? props?.backgroundColor2 : 'rgba(0, 0, 0, 0.5)'
    },
    handle: {
      width: scale(150),
      backgroundColor: props != null ? props?.backgroundColor : 'transparent'
    },
    button: {
      backgroundColor: props !== null ? props?.main : 'gray',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      height: scale(50),
      borderRadius: 40,
      marginTop: scale(10)
    },
    searchTouchable: {
      paddingTop: scale(8),
      paddingBottom: scale(4)
    }
  })
export default styles
