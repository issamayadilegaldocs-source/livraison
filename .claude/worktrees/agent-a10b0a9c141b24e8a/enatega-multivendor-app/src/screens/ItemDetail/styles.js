import { StyleSheet } from 'react-native'
import { scale } from '../../utils/scaling'

/**
 * Item details screen — design-system styles.
 * Mirrors raw/design-screens/app-home-page/Item Details.dc.html:
 * immersive hero, item info, variation/addon selection rows,
 * special instructions, frequently-bought-together, fixed bottom bar
 * with quantity stepper + live-price CTA.
 *
 * Theme-aware: `accent`/`onAccent` flip between black-on-white (light)
 * and white-on-dark (dark) so the black-first design keeps contrast.
 */
const POSITIVE = '#0E8345'
const POSITIVE_BG = '#EAF7EE'
const STAR = '#FFB800'

const styles = (props = null) => {
  const t = props || {}
  const isDark = t.themeBackground === '#000'
  const surface = t.themeBackground || '#fff'
  const pageBg = isDark ? '#000' : '#F6F6F6'
  const chipBg = isDark ? '#1c1c1e' : '#F3F3F3'
  const divider = t.horizontalLine || '#F0F0F0'
  const border = t.verticalLine || '#E8E8E8'
  const accent = isDark ? '#fff' : '#000'
  const onAccent = isDark ? '#000' : '#fff'

  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: pageBg },
    scroll: { flex: 1, backgroundColor: pageBg },

    /* ── Fixed nav (back / share) ── */
    navOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 50,
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16)
    },
    navSolid: {
      backgroundColor: surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border
    },
    navTitle: {
      flex: 1,
      marginHorizontal: scale(10)
    },
    circleBtn: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(19),
      alignItems: 'center',
      justifyContent: 'center'
    },
    circleBtnScrim: { backgroundColor: 'rgba(0,0,0,0.42)' },
    circleBtnSolid: {
      backgroundColor: isDark ? '#1c1c1e' : '#fff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
      elevation: 2
    },

    /* ── Hero ── */
    hero: {
      height: scale(280),
      backgroundColor: '#1a0902',
      position: 'relative',
      overflow: 'hidden'
    },
    heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: scale(90) },

    /* ── Item info ── */
    infoCard: {
      backgroundColor: surface,
      paddingHorizontal: scale(16),
      paddingTop: scale(14),
      paddingBottom: scale(18)
    },
    infoTitleRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: scale(12),
      marginBottom: scale(7)
    },
    tagsRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      gap: scale(6),
      flexWrap: 'wrap',
      marginTop: scale(2)
    },
    tag: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(4),
      backgroundColor: chipBg,
      borderRadius: scale(9999),
      paddingHorizontal: scale(10),
      paddingVertical: scale(5)
    },

    /* ── Section block ── */
    section: {
      backgroundColor: surface,
      borderTopWidth: scale(8),
      borderTopColor: pageBg,
      paddingHorizontal: scale(16),
      paddingBottom: scale(6)
    },
    sectionHead: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: scale(16),
      paddingBottom: scale(10)
    },
    badge: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(4),
      borderRadius: scale(8),
      paddingHorizontal: scale(10),
      paddingVertical: scale(5)
    },
    badgeRequired: { backgroundColor: POSITIVE_BG },
    badgeOptional: { backgroundColor: chipBg },

    /* ── Option / variation row ── */
    optionRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: scale(14),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: divider
    },
    optionLeft: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(13),
      flex: 1,
      minWidth: 0
    },
    radioOuter: {
      width: scale(22),
      height: scale(22),
      borderRadius: scale(11),
      borderWidth: scale(2),
      borderColor: '#D8D8D8',
      alignItems: 'center',
      justifyContent: 'center'
    },
    radioOuterSelected: {
      borderWidth: 0,
      backgroundColor: accent
    },
    radioInner: {
      width: scale(8),
      height: scale(8),
      borderRadius: scale(4),
      backgroundColor: onAccent
    },
    checkOuter: {
      width: scale(22),
      height: scale(22),
      borderRadius: scale(6),
      borderWidth: scale(2),
      borderColor: '#D8D8D8',
      alignItems: 'center',
      justifyContent: 'center'
    },
    checkOuterSelected: {
      borderWidth: 0,
      backgroundColor: accent
    },
    errorText: { paddingVertical: scale(6) },

    /* ── Special instructions ── */
    input: {
      minHeight: scale(80),
      borderWidth: scale(1.5),
      borderColor: border,
      borderRadius: scale(8),
      paddingHorizontal: scale(12),
      paddingVertical: scale(10),
      fontSize: scale(13),
      lineHeight: scale(20),
      color: t.fontMainColor || '#000',
      backgroundColor: surface,
      textAlignVertical: 'top',
      textAlign: t.isRTL ? 'right' : 'left'
    },
    instrHint: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: scale(5),
      marginTop: scale(8)
    },

    /* ── Frequently bought together row ── */
    fbtRow: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(12),
      paddingVertical: scale(14),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: divider
    },
    fbtThumb: {
      width: scale(68),
      height: scale(68),
      borderRadius: scale(10),
      backgroundColor: chipBg,
      overflow: 'hidden'
    },
    fbtAddBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3
    },
    fbtPopular: {
      alignSelf: t.isRTL ? 'flex-end' : 'flex-start',
      backgroundColor: POSITIVE_BG,
      borderRadius: scale(4),
      paddingHorizontal: scale(7),
      paddingVertical: scale(2),
      marginTop: scale(2)
    },

    /* ── Fixed bottom bar ── */
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: border,
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: scale(10),
      paddingHorizontal: scale(16),
      paddingTop: scale(12)
    },
    stepper: {
      flexDirection: t.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: chipBg,
      borderRadius: scale(9999)
    },
    stepperBtn: {
      width: scale(44),
      height: scale(50),
      alignItems: 'center',
      justifyContent: 'center'
    },
    stepperQty: {
      minWidth: scale(22),
      textAlign: 'center'
    },
    cta: {
      flex: 1,
      height: scale(52),
      borderRadius: scale(9999),
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: scale(16)
    },
    ctaDisabled: { opacity: 0.4 },

    _palette: { accent, onAccent, positive: POSITIVE, positiveBg: POSITIVE_BG, star: STAR, surface, chipBg, pageBg }
  })
}

export default styles
