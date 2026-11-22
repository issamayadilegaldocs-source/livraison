import { scale } from '../../utils/scaling'
import { Dimensions, StyleSheet } from 'react-native'
import { alignment } from '../../utils/alignment'
const { height } = Dimensions.get('screen')

const styles = (props = null) =>
  StyleSheet.create({
    flex: {
      flex: 1
    },
    formContainer: {
      flex: 1,
      width: '100%',
      backgroundColor: props !== null ? props?.themeBackground : 'transparent'
    },
    containerInfo: {
      width: '100%',
      ...alignment.MTmedium
    },
    mainContainer: {
      flex: 1
    },
    formSubContainer: {
      borderRadius: scale(8),
      flexDirection: 'row',
      width: '92%',
      backgroundColor: props !== null ? props?.color5 : 'transparent',
      alignSelf: 'center',
      elevation: 1,
      borderWidth: props !== null && props?.gray200 !== '#E5E7EB' ? 0 : 1,
      borderColor: props !== null ? props?.gray200 : '#E5E7EB',
      ...alignment.MTsmall,
      ...alignment.Psmall
    },
    flexRow: {
      display: 'flex',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between'
    },
    containerHeading: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start'
    },
    headingTitle: {
      width: '50%'
    },

    headingLink: {
      flex: 1,
      ...alignment.MRxSmall,
      justifyContent: 'center',
      alignItems: 'flex-end'
    },
    headingButton: {
      marginLeft: scale(5),
      justifyContent: 'center',
      ...alignment.PLmedium
    },
    saveContainer: {
      backgroundColor: props !== null ? props?.main : '#90E36D',
      padding: scale(8),
      borderRadius: scale(16),
      justifyContent: 'center',
      alignItems: 'center',
      width: scale(120)
    },
    bacKButton: {
      backgroundColor: 'white',
      borderRadius: scale(50),
      width: scale(40),
      alignItems: 'flex-start',
      marginLeft: scale(5)
    },
    verifiedButton: {
      padding: scale(8),
      borderRadius: scale(16),
      marginTop: scale(10),
      justifyContent: 'center',
      alignItems: 'center',
      width: scale(120)
    },

    // Model for password changing
    modalContainer: {
      backgroundColor: props !== null ? props?.themeBackground : '#FFF',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: scale(20),
      shadowOpacity: 0,
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 16,
      paddingRight: 16
    },
    modalContent: {
      width: '90%'
    },
    modalHeader: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    btnContainer: {
      backgroundColor: props !== null ? props?.color3 : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      height: scale(40),
      borderRadius: 40,
      borderWidth: 1,
      borderColor: props !== null ? props?.borderColor : 'black'
    },
    titleContainer: {
      width: '100%',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      backgroundColor: props !== null ? props?.themeBackground : 'white',
      color: props !== null ? props?.darkBgFont : 'white',
      paddingTop: scale(8),
      fontSize: scale(20),
      fontWeight: '600'
    },
    phoneDetailsContainer: {
      display: 'flex',
      flexDirection: 'row'
    },
    // Modal
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
      filter: 'blur(10)'
    },
    modalView: {
      width: '90%',
      gap: 24,
      margin: 20,
      backgroundColor: props !== null ? props?.themeBackground : 'white',
      borderWidth: scale(1),
      borderColor: props !== null ? props?.color10 : 'white',
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    btn: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      height: scale(50),
      borderRadius: 40
    },
    btnCancel: {
      backgroundColor: props !== null ? props?.white : 'white',
      borderWidth: 1,
      borderColor: props !== null ? props?.black : 'black'
    },
    btnDelete: {
      backgroundColor: props !== null ? props?.red600 : '#DC2626'
    },
    modalInput: {
      height: scale(40),
      borderWidth: 1,
      borderColor: props != null ? props?.verticalLine : '#B8B8B8',
      padding: 5,
      borderRadius: 6,
      color: props !== null ? props?.newFontcolor : '#f9f9f9'
    },
    modal: {
      backgroundColor: props != null ? props?.themeBackground : '#FFF',
      borderTopEndRadius: scale(20),
      borderTopStartRadius: scale(20),
      shadowOpacity: 0,
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 16,
      paddingRight: 16
    },
    nameView: {
      ...alignment.MTlarge,
      ...alignment.MBlarge,
      alignItems: 'center'
    },
    line: {
      width: '100%',
      height: 0.5,
      ...alignment.MBsmall,
      backgroundColor: props !== null ? props?.borderBottomColor : '#DAD6D6',
      ...alignment.MTsmall
    },
    favView: {
      ...alignment.MTlarge
    },
    orderAgainView: {
      ...alignment.MTlarge
    },
    offerScroll: {
      height: height * 0.4,
      width: '100%'
    },
    linkContainer: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...alignment.MLxSmall
    },
    mainLeftContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center'
    },
    leftContainer: {
      height: scale(35),
      width: scale(35),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: props !== null ? props?.gray100 : 'transparent',
      borderRadius: 25
    },
    drawerContainer: {
      ...alignment.PLlarge
    },
    settingView: {
      ...alignment.MTlarge
    },
    quickLinkView: {
      ...alignment.MTlarge
    },
    seeAll: {
      backgroundColor: props !== null ? props?.newButtonBackground : '#F3FFEE',
      ...alignment.Psmall,
      borderRadius: scale(5)
    },
    padding: {
      ...alignment.PLmedium,
      ...alignment.PRmedium
    },
    scrollContent: {
      paddingBottom: scale(92)
    },
    profileHeader: {
      backgroundColor: props !== null ? props?.profileSurface : '#FFFFFF',
      paddingTop: scale(22),
      paddingHorizontal: scale(20),
      paddingBottom: scale(22)
    },
    profileHeaderTop: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: scale(16)
    },
    profileNameBlock: {
      flex: 1,
      minWidth: 0,
      paddingRight: scale(14)
    },
    profileName: {
      fontSize: scale(30),
      lineHeight: scale(34),
      letterSpacing: 0
    },
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(6),
      marginTop: scale(10)
    },
    verifiedText: {
      fontSize: scale(13),
      lineHeight: scale(17)
    },
    avatar: {
      width: scale(52),
      height: scale(52),
      borderRadius: scale(26),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileText : '#000000'
    },
    avatarText: {
      fontSize: scale(20),
      lineHeight: scale(24)
    },
    activeOrdersChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(7),
      borderRadius: scale(999),
      paddingVertical: scale(7),
      paddingHorizontal: scale(14),
      backgroundColor: props !== null ? props?.profileChip : '#F3F3F3'
    },
    activeOrdersDot: {
      width: scale(7),
      height: scale(7),
      borderRadius: scale(4),
      backgroundColor: props !== null ? props?.profileMuted : '#AFAFAF'
    },
    activeOrdersText: {
      fontSize: scale(12),
      lineHeight: scale(15)
    },
    section: {
      marginTop: scale(8),
      backgroundColor: props !== null ? props?.profileSurface : '#FFFFFF'
    },
    compactSectionTitle: {
      fontSize: scale(15),
      lineHeight: scale(20),
      paddingTop: scale(16),
      paddingHorizontal: scale(16),
      paddingBottom: scale(14)
    },
    sectionHeader: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: scale(16),
      paddingHorizontal: scale(16),
      paddingBottom: scale(12)
    },
    sectionTitle: {
      fontSize: scale(17),
      lineHeight: scale(22)
    },
    sectionTitlePadded: {
      fontSize: scale(17),
      lineHeight: scale(22),
      paddingTop: scale(16),
      paddingHorizontal: scale(16),
      paddingBottom: scale(6)
    },
    seeAllText: {
      fontSize: scale(13),
      lineHeight: scale(18),
      textDecorationLine: 'underline'
    },
    quickAccessGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(12),
      paddingHorizontal: scale(16),
      paddingBottom: scale(20)
    },
    quickAccessCard: {
      width: '48%',
      minHeight: scale(118),
      borderRadius: scale(14),
      padding: scale(16),
      backgroundColor: props !== null ? props?.profileCard : '#F6F6F6'
    },
    quickAccessIcon: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileSurface : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 1
    },
    quickAccessTitle: {
      marginTop: scale(12),
      fontSize: scale(13),
      lineHeight: scale(17)
    },
    quickAccessSubtitle: {
      marginTop: scale(3),
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    horizontalList: {
      gap: scale(12),
      paddingHorizontal: scale(16),
      paddingBottom: scale(20)
    },
    favouriteCard: {
      width: scale(172),
      borderRadius: scale(16),
      overflow: 'hidden',
      backgroundColor: props !== null ? props?.profileSurface : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
      elevation: 3
    },
    favouriteImageWrap: {
      height: scale(120),
      position: 'relative',
      overflow: 'hidden'
    },
    favouriteImage: {
      width: '100%',
      height: '100%'
    },
    imageFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileText : '#000000'
    },
    imageFallbackText: {
      fontSize: scale(14)
    },
    imageShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.12)'
    },
    heartButton: {
      position: 'absolute',
      top: scale(8),
      right: scale(8),
      width: scale(30),
      height: scale(30),
      borderRadius: scale(15),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileSurface : '#FFFFFF'
    },
    favouriteInfo: {
      paddingTop: scale(10),
      paddingHorizontal: scale(12),
      paddingBottom: scale(12)
    },
    restaurantName: {
      fontSize: scale(13),
      lineHeight: scale(17)
    },
    restaurantMeta: {
      marginTop: scale(3),
      marginBottom: scale(8),
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    restaurantStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(10)
    },
    statInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(4)
    },
    statText: {
      fontSize: scale(11),
      lineHeight: scale(15)
    },
    orderAgainList: {
      paddingHorizontal: scale(16),
      paddingBottom: scale(20),
      gap: scale(10)
    },
    orderAgainCard: {
      minHeight: scale(76),
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: scale(14),
      backgroundColor: props !== null ? props?.profileCard : '#F6F6F6'
    },
    orderThumb: {
      width: scale(76),
      height: scale(76),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileText : '#000000'
    },
    orderThumbImage: {
      width: '100%',
      height: '100%'
    },
    orderThumbText: {
      fontSize: scale(16)
    },
    orderAgainInfo: {
      flex: 1,
      minWidth: 0,
      paddingVertical: scale(14),
      paddingHorizontal: scale(12)
    },
    orderAgainTitle: {
      fontSize: scale(14),
      lineHeight: scale(18),
      marginBottom: scale(5)
    },
    orderAgainMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: scale(6)
    },
    orderAgainMeta: {
      fontSize: scale(12),
      lineHeight: scale(16)
    },
    reorderButton: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(17),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: scale(16),
      backgroundColor: props !== null ? props?.profileText : '#000000'
    },
    settingsRow: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(14),
      paddingVertical: scale(13),
      paddingHorizontal: scale(16),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: props !== null ? props?.profileDivider : '#F3F3F3'
    },
    settingsIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(11),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.profileChip : '#F3F3F3'
    },
    settingsText: {
      flex: 1,
      minWidth: 0
    },
    settingsTitle: {
      fontSize: scale(15),
      lineHeight: scale(19)
    },
    settingsSubtitle: {
      marginTop: scale(1),
      fontSize: scale(12),
      lineHeight: scale(16)
    },
    dot: {
      width: scale(3),
      height: scale(3),
      borderRadius: scale(2),
      backgroundColor: props !== null ? props?.profileMuted : '#D4D4D4'
    },
    versionText: {
      marginTop: scale(20),
      marginBottom: scale(8),
      fontSize: scale(11),
      lineHeight: scale(15),
      letterSpacing: 0
    }
  })
export default styles
