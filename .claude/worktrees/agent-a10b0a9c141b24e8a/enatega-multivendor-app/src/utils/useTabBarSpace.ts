import { useContext } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'

// Geometry of the floating pill tab bar (see src/routes/index.js). It is
// absolutely positioned at `floatingTabBarBottom(insets.bottom)` above the
// screen's bottom edge, with a height of 52, so its top edge sits at
// `floatingTabBarBottom(insets.bottom) + 52`. A floating (absolute) bar does
// not reserve layout space, so any screen with content near the bottom must
// reserve this space itself.
export const FLOATING_TAB_BAR_HEIGHT = 52
// Minimum clearance from the screen's bottom edge so the bar never touches it.
const MIN_BAR_BOTTOM = 6
// How far the bar is pulled down into the bottom safe-area inset. The bar can
// sit close to the home indicator without overlapping it, so we don't reserve
// the full inset — keeping the bar near the bottom edge instead of floating high.
const BAR_INSET_PULLDOWN = 20
const DEFAULT_GAP = 16

/**
 * Distance (px) from the screen's bottom edge to the bottom of the floating
 * pill bar. Single source of truth shared by the bar (src/routes/index.js) and
 * the content-padding hook below.
 */
export function floatingTabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom - BAR_INSET_PULLDOWN, MIN_BAR_BOTTOM)
}

/**
 * Bottom padding (px) a screen should reserve so its content is never hidden
 * underneath the floating pill tab bar.
 *
 * The same screen component can be rendered both as a bottom-tab scene (bar
 * present) and as a pushed stack screen (no bar) — e.g. Profile / CreateAccount.
 * `BottomTabBarHeightContext` is only defined for descendants of the tab
 * navigator, so it reliably tells the two apart without relying on route names
 * (which collide across the two registrations). When no bar is present we only
 * clear the home-indicator safe area.
 *
 * @param gap breathing room above the bar (defaults to 16, matching the map overlay).
 */
export function useTabBarSpace(gap: number = DEFAULT_GAP): number {
  const insets = useSafeAreaInsets()
  const insideTabNavigator = useContext(BottomTabBarHeightContext) != null

  if (!insideTabNavigator) return insets.bottom

  return floatingTabBarBottom(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + gap
}
