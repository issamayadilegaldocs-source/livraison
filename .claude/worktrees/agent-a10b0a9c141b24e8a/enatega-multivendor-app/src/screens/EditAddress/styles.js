import { verticalScale, scale } from '../../utils/scaling'
import { StyleSheet } from 'react-native'
import { alignment } from '../../utils/alignment'

const styles = (props = null) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: props !== null ? props?.themeBackground : '#FFF'
    },
    /* ---------- Map ---------- */
    mapContainer: {
      height: '38%',
      width: '100%',
      backgroundColor: props !== null ? props?.themeBackground : 'transparent'
    },
    markerContainer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center'
    },
    marker: {
      width: scale(40),
      height: scale(40),
      marginBottom: scale(40)
    },
    // Centre pin anchored to the map's exact centre; tip rests on the centre.
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
      width: 40,
      height: 40,
      resizeMode: 'contain',
      transform: [{ translateY: -20 }]
    },
    // Expand-to-fullscreen button (top-right of the map).
    expandButton: {
      position: 'absolute',
      top: scale(12),
      right: scale(12),
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: props !== null ? props?.cardBackground : '#ffffff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: props !== null ? props?.customBorder : '#DAD6D6',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
      zIndex: 2
    },
    // Floating map controls (zoom in / out / locate).
    controlsContainer: {
      position: 'absolute',
      right: scale(12),
      bottom: scale(16),
      gap: scale(10),
      zIndex: 2
    },
    controlButton: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: props !== null ? props?.cardBackground : '#ffffff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: props !== null ? props?.customBorder : '#DAD6D6',
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
      backgroundColor: props !== null ? props?.cardBackground : '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3
    },
    /* ---------- Body card overlapping the map ---------- */
    bodyContainer: {
      flex: 1,
      marginTop: -scale(22),
      borderTopLeftRadius: scale(24),
      borderTopRightRadius: scale(24),
      backgroundColor: props !== null ? props?.themeBackground : '#FFF',
      paddingTop: scale(28),
      paddingHorizontal: scale(20),
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: scale(8),
      shadowOffset: { width: 0, height: -scale(3) },
      elevation: 6
    },
    sectionTitle: {
      ...alignment.MBsmall
    },
    /* ---------- Inputs ---------- */
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: props !== null ? props?.verticalLine : '#D1D5DB',
      borderRadius: scale(12),
      paddingHorizontal: scale(14),
      paddingVertical: verticalScale(8),
      marginBottom: verticalScale(14),
      backgroundColor: props !== null ? props?.cardBackground : '#FFF'
    },
    inputWrapperError: {
      borderColor: props !== null ? props?.textErrorColor : 'red'
    },
    inputInner: {
      flex: 1
    },
    input: {
      color: props !== null ? props?.fontMainColor : '#212121',
      fontSize: scale(14),
      padding: 0,
      marginTop: verticalScale(2)
    },
    editIconBtn: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(17),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: props !== null ? props?.gray100 : '#F3F4F6',
      marginLeft: scale(8)
    },
    errorText: {
      ...alignment.MBsmall,
      marginTop: -verticalScale(8)
    },
    /* ---------- Add Label ---------- */
    divider: {
      height: 1,
      backgroundColor: props !== null ? props?.verticalLine : '#E5E7EB',
      ...alignment.MTsmall,
      ...alignment.MBmedium
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      ...alignment.MTmedium
    },
    labelItem: {
      flex: 1,
      alignItems: 'center'
    },
    labelButton: {
      width: scale(64),
      height: scale(64),
      borderRadius: scale(16),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: props !== null ? props?.verticalLine : '#E5E7EB',
      backgroundColor: props !== null ? props?.gray100 : '#F3F4F6'
    },
    labelButtonActive: {
      borderColor: props !== null ? props?.newheaderColor : '#90E36D',
      backgroundColor: props !== null ? props?.newheaderColor : '#90E36D'
    },
    labelText: {
      ...alignment.MTxSmall
    },
    /* ---------- Save button ---------- */
    saveBtnContainer: {
      width: '100%',
      height: verticalScale(48),
      borderRadius: scale(30),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: props !== null ? props?.newheaderColor : '#90E36D',
      alignSelf: 'center',
      ...alignment.MTlarge,
      ...alignment.MBmedium
    }
  })
export default styles
