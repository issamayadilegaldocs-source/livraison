import { theme } from '../utils/themeColors'

/**
 * Theme types derived directly from `src/utils/themeColors.js`, so they stay in
 * sync automatically as colors are added or renamed.
 *
 *   ThemeName   — 'Pink' | 'Dark' | … (the available theme variants)
 *   ThemeColors — the color map for a single theme (every color key)
 */
export type ThemeName = keyof typeof theme
export type ThemeColors = (typeof theme)[ThemeName]
