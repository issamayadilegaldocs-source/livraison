import { scale } from '../../utils/scaling'
import { StyleSheet } from 'react-native'

/**
 * Restaurant details screen — design-system styles.
 * Mirrors raw/design-screens/app-home-page/Restaurant Page.dc.html:
 * scrolling hero, store-info card, segmented toggle, popular rail,
 * sticky category tabs, menu rows, floating cart pill.
 *
 * Theme-aware: `accent`/`onAccent` flip between black-on-white (light)
 * and white-on-dark (dark) using the existing theme tokens so the
 * black-first design language keeps contrast in both themes.
 */
const POSITIVE = '#0E8345'
const SALE_FG = '#C8200B'
const SALE_BG = '#FEF0EC'
const STAR = '#FFB800'

const styles = (props = null) => {
  const t = props || {}
  const surface = t.themeBackground || '#fff'
  const isDark = t.themeBackground === '#000'
  const pageBg = isDark ? '#000' : '#F6F6F6'
  const chipBg = isDark ? '#1c1c1e' : '#F6F6F6'
  const divider = t.horizontalLine || '#F0F0F0'
  // black-first design accent that flips for dark-theme contrast
  const accent = isDark ? '#fff' : '#000'
  const onAccent = isDark ? '#000' : '#fff'

  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: surface
    },
    screen: {
      flex: 1,
      backgroundColor: pageBg
    },

    /* ── Fixed top app bar ── */
    appBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(14)
    },
    appBarSolid: {
      backgroundColor: surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider
    },
    appBarBtnRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(8)
    },
    circleBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      alignItems: 'center',
      justifyContent: 'center'
    },
    circleBtnScrim: {
      backgroundColor: 'rgba(0,0,0,0.45)'
    },
    circleBtnSolid: {
      backgroundColor: isDark ? '#1c1c1e' : '#fff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: divider,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
      elevation: 2
    },
    appBarTitle: {
      flex: 1,
      marginHorizontal: scale(10)
    },

    /* ── Category tab strip (sticky) ── */
    tabStrip: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 45,
      backgroundColor: surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider
    },
    tabStripContent: {
      paddingHorizontal: scale(8),
      alignItems: 'center'
    },
    tabBtn: {
      height: scale(46),
      paddingHorizontal: scale(14),
      alignItems: 'center',
      justifyContent: 'center'
    },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: scale(8),
      right: scale(8),
      height: scale(2),
      borderRadius: scale(1),
      backgroundColor: accent
    },

    /* ── Hero ── */
    hero: {
      height: scale(210),
      backgroundColor: '#1A0F06',
      position: 'relative',
      overflow: 'hidden',
      justifyContent: 'flex-end'
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%'
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject
    },
    heroBottomRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16),
      paddingBottom: scale(14)
    },
    heroChipsRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      gap: scale(6),
      flexShrink: 1
    },
    heroChip: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: scale(7),
      paddingHorizontal: scale(9),
      paddingVertical: scale(4)
    },
    openBadge: {
      borderRadius: scale(7),
      paddingHorizontal: scale(10),
      paddingVertical: scale(4)
    },

    /* ── Store info card ── */
    infoCard: {
      backgroundColor: surface,
      paddingHorizontal: scale(16),
      paddingTop: scale(16),
      paddingBottom: scale(14)
    },
    infoTopRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: scale(6)
    },
    favBtn: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      backgroundColor: chipBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: scale(12)
    },
    metaRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: scale(8),
      marginTop: scale(8),
      marginBottom: scale(12)
    },
    metaStar: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(3)
    },
    dot: {
      width: scale(3),
      height: scale(3),
      borderRadius: scale(1.5),
      backgroundColor: '#D8D8D8'
    },
    chipsRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: scale(8)
    },
    infoChip: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(5),
      backgroundColor: chipBg,
      borderRadius: scale(8),
      paddingHorizontal: scale(10),
      paddingVertical: scale(7)
    },

    /* ── Delivery / Collection toggle ── */
    toggleWrap: {
      backgroundColor: surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: divider,
      paddingHorizontal: scale(16),
      paddingVertical: scale(10)
    },
    segment: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      backgroundColor: chipBg,
      borderRadius: scale(9999),
      padding: scale(3),
      gap: scale(3)
    },
    segmentBtn: {
      flex: 1,
      height: scale(38),
      borderRadius: scale(9999),
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scale(5)
    },
    segmentBtnActive: {
      backgroundColor: accent
    },

    /* ── Section band (between groups) ── */
    bandSpacer: {
      height: scale(8),
      backgroundColor: pageBg
    },

    /* ── Popular rail ── */
    popularSection: {
      backgroundColor: surface,
      paddingTop: scale(18)
    },
    popularHeading: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(7),
      paddingHorizontal: scale(16),
      paddingBottom: scale(12),
      flexWrap: 'wrap'
    },
    popularRail: {
      paddingHorizontal: scale(16),
      paddingBottom: scale(20),
      gap: scale(12)
    },
    popularCard: {
      width: scale(148),
      borderRadius: scale(12),
      backgroundColor: surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3
    },
    popularImgWrap: {
      height: scale(110),
      borderTopLeftRadius: scale(12),
      borderTopRightRadius: scale(12),
      overflow: 'hidden',
      backgroundColor: chipBg
    },
    popularImg: {
      width: '100%',
      height: '100%'
    },
    popularAddBtn: {
      position: 'absolute',
      bottom: scale(-13),
      right: scale(10),
      width: scale(28),
      height: scale(28),
      borderRadius: scale(14),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
      zIndex: 2
    },
    popularBody: {
      paddingTop: scale(18),
      paddingHorizontal: scale(10),
      paddingBottom: scale(12)
    },
    qtyBadge: {
      position: 'absolute',
      top: scale(8),
      right: scale(8),
      minWidth: scale(20),
      height: scale(20),
      borderRadius: scale(10),
      paddingHorizontal: scale(4),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2
    },
    saleTagSm: {
      position: 'absolute',
      top: scale(8),
      left: scale(8),
      backgroundColor: '#DE1135',
      borderRadius: scale(4),
      paddingHorizontal: scale(6),
      paddingVertical: scale(2),
      zIndex: 2
    },

    /* ── Category section header ── */
    catHeader: {
      backgroundColor: pageBg,
      paddingHorizontal: scale(16),
      paddingVertical: scale(10),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: divider
    },

    /* ── Menu row ── */
    menuRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      gap: scale(12),
      paddingHorizontal: scale(16),
      paddingVertical: scale(14),
      alignItems: 'flex-start',
      backgroundColor: surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider
    },
    menuTextCol: {
      flex: 1,
      minWidth: 0
    },
    saleTag: {
      alignSelf: t.isRTL ? 'flex-end' : 'flex-start',
      backgroundColor: SALE_BG,
      borderRadius: scale(4),
      paddingHorizontal: scale(6),
      paddingVertical: scale(2),
      marginBottom: scale(6)
    },
    priceRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(6),
      marginTop: scale(6)
    },
    menuImgCol: {
      width: scale(80)
    },
    menuImgWrap: {
      width: scale(80),
      height: scale(80),
      borderRadius: scale(10),
      overflow: 'hidden',
      backgroundColor: chipBg
    },
    menuImg: {
      width: '100%',
      height: '100%'
    },
    menuAddBtn: {
      position: 'absolute',
      bottom: scale(-10),
      right: scale(-6),
      width: scale(28),
      height: scale(28),
      borderRadius: scale(14),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4
    },
    stepper: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: chipBg,
      borderRadius: scale(9999),
      height: scale(28),
      marginTop: scale(10),
      overflow: 'hidden'
    },
    stepperBtn: {
      width: scale(28),
      height: scale(28),
      alignItems: 'center',
      justifyContent: 'center'
    },
    stepperPlus: {
      width: scale(28),
      height: scale(28),
      borderRadius: scale(14),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center'
    },

    /* ── Floating cart pill ── */
    cartBar: {
      position: 'absolute',
      left: scale(16),
      right: scale(16),
      height: scale(56),
      borderRadius: scale(9999),
      backgroundColor: accent,
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: scale(20),
      paddingRight: scale(8),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
      zIndex: 60
    },
    cartLeft: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(10)
    },
    cartCountCircle: {
      minWidth: scale(22),
      height: scale(22),
      borderRadius: scale(11),
      paddingHorizontal: scale(4),
      backgroundColor: onAccent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    cartTotalPill: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(6),
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: scale(9999),
      paddingHorizontal: scale(14),
      height: scale(40)
    },

    /* ── Search results row ── */
    searchRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16),
      paddingVertical: scale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
      backgroundColor: surface,
      gap: scale(12)
    },

    /* palette exports for inline use */
    _palette: {
      accent,
      onAccent,
      positive: POSITIVE,
      star: STAR,
      saleFg: SALE_FG,
      surface,
      chipBg,
      pageBg
    }
  })
}

export default styles
