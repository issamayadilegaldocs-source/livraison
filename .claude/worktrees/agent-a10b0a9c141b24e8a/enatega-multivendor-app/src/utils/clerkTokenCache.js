import * as SecureStore from 'expo-secure-store'

export const tokenCache = {
  async getToken(key) {
    try {
      return SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value)
    } catch {}
  },
  async clearToken(key) {
    try {
      return SecureStore.deleteItemAsync(key)
    } catch {}
  },
}
