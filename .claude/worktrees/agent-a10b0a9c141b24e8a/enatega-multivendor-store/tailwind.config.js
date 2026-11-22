/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('tailwindcss').Config} */

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // The app toggles dark mode itself (ThemeContext + Appearance.setColorScheme)
  // rather than only following the OS media query. NativeWind's web runtime
  // throws when something imperatively sets the color scheme while darkMode
  // is 'media' — 'class' is required for manual control.
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
