import { scale } from '../../utils/scaling'
import { alignment } from '../../utils/alignment'
const { StyleSheet } = require('react-native')

const styles = (props = null) =>
  StyleSheet.create({
    flex: {
      flex: 1
    },
    mapView: {
      height: '70%',
      marginBottom: scale(-20)
    },
    container: {
      flex: 1,
      height: '90%',
      overflow: 'visible',
      justifyContent: 'space-around',
      borderTopLeftRadius: scale(30),
      borderTopRightRadius: scale(30),
      backgroundColor: props !==null ? props?.cardBackground : '#f5f5f5',
      borderWidth: scale(1),
      borderColor: props !==null ? props?.customBorder : 'transparent',
      paddingTop: scale(20),
      paddingBottom: scale(20)
    },
    container2: {
      flex: 1,
      height: '90%',
      overflow: 'visible',
      justifyContent: 'space-around',
      borderTopLeftRadius: scale(30),
      borderTopRightRadius: scale(30),
      backgroundColor:props !==null ? props?.cardBackground : '#f5f5f5',
      borderWidth: scale(1),
      borderColor: props !==null ? props?.customBorder : 'transparent',
      padding: scale(25)
    },
    heading: {
      ...alignment.MBlarge,
      ...props?.isRTL ? {paddingRight: scale(20)} : {paddingLeft: scale(20)}
    },
    addressHeading: {
      marginBottom: scale(30)
    },
    button: {
      width: '100%',
      height: '20%',
      alignItems: 'center',
      display: 'flex',
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      paddingHorizontal: scale(20),
      marginTop: scale(10),
      marginBottom: scale(10),
      gap: scale(15)
    },
    dropdownContainer: {
      borderWidth: 1,
      borderColor: '#DAD6D6',
      borderRadius: 8,
      height: '18%',
      overflow: 'hidden',
      justifyContent: 'center'
    },
    button1: {
      flexDirection: props?.isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10
    },
    cityField: {
      color:props != null ? props?.newFontcolor : '#E5E7EB',
    },
    icon1: {
      marginLeft: 10
    },
    textInput: {
      width: '100%',
      height: '22%',
      justifyContent: 'center',
      paddingHorizontal: scale(10),
      marginTop: scale(15),
      borderWidth: 1,
      borderColor: props != null ? props?.borderBottomColor : '#E5E7EB',
      borderRadius: scale(8)
    },
    overlay: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)'
    },
    icon: {
      backgroundColor: props != null ? props?.iconBackground : '#E5E7EB',
      height: scale(36),
      width: scale(36),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scale(18),
      // marginRight: scale(16)
    },
    line: {
      borderBottomWidth: scale(1),
      borderBottomColor: props != null ? props?.borderBottomColor : '#DAD6D6',
      width: '100%'
    },
    emptyButton: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      height: '20%',
      backgroundColor: props !== null ? props?.main : 'transparent',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: scale(28),
      marginTop: scale(50)
    },
    mainContainer: {
      width: scale(50),
      height: scale(50),
      position: 'absolute',
      top: '46%',
      left: '50%',
      zIndex: 1,
      translateX: scale(-25),
      translateY: scale(-25),
      justifyContent: 'center',
      alignItems: 'center',
      transform: [{ translateX: scale(-25) }, { translateY: scale(-25) }]
    },
    // --- Map rework ---
    // Map region takes the upper portion. Using flex (not a % height) gives
    // the native MapView concrete bounds, which the New Architecture needs to
    // route touch/gesture events correctly.
    mapContainer: {
      flex: 1.15,
      overflow: 'hidden',
      backgroundColor: props != null ? props?.cardBackground : '#e5e5e5'
    },
    // Centre pin overlay. We anchor a small fixed-size box at the map's exact
    // centre (top/left 50% minus half the box) instead of an absolute-fill View
    // with justifyContent:'center'. Under the New Architecture (Fabric), the
    // fill-and-centre approach failed to resolve against the native MapView
    // sibling and collapsed the pin to the top of the map. Never steals touches
    // (pointerEvents='none' is set in JSX).
    markerFixed: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 40,
      height: 40,
      marginLeft: -20,
      marginTop: -20,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1
    },
    markerPin: {
      // Fixed size: scale() multiplies by (window width / 350), which on wide
      // or web windows blows the pin up several times and — combined with the
      // upward shift — pushes its top out of the (overflow:hidden) map box.
      width: 40,
      height: 40,
      resizeMode: 'contain',
      // Lift the pin by half its height so its tip rests on the exact centre
      // of the map. Must match height/2 so the anchor stays on the centre.
      transform: [{ translateY: -20 }]
    },
    // Floating map controls (zoom in / out / locate).
    controlsContainer: {
      position: 'absolute',
      right: scale(12),
      bottom: scale(28),
      gap: scale(10),
      zIndex: 2
    },
    controlButton: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: props != null ? props?.cardBackground : '#ffffff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: props != null ? props?.customBorder : '#DAD6D6',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3
    },
    // Small "finding address…" pill shown while reverse geocoding.
    loadingPill: {
      position: 'absolute',
      top: scale(12),
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
      paddingHorizontal: scale(14),
      paddingVertical: scale(8),
      borderRadius: scale(20),
      zIndex: 2,
      backgroundColor: props != null ? props?.cardBackground : '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3
    }
  })
export default styles
