// Auth tokens are managed by Clerk (see lib/utils/clerkTokenCache.ts).
// Keys stored in expo-secure-store:
//   "store-id"  — the active restaurant's MongoDB _id (session-critical)
// Keys stored in AsyncStorage (non-sensitive):
//   "lang"      — selected UI language
//   "app_theme" — light/dark theme preference
//   "printer"   — Bluetooth printer configuration (JSON)
