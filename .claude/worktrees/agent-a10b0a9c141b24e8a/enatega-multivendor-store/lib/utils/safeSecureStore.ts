import * as SecureStore from "expo-secure-store";

// expo-secure-store ships no web implementation (its SecureStore.web.js
// exports an empty object), so every call throws "... is not a function"
// there. None of this app's SecureStore keys hold the Clerk session
// credential itself (that's handled by clerkTokenCache.ts, which already
// guards its own calls) — they're store/device-scoped values, so falling
// back to localStorage on web is safe.
function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    if (hasLocalStorage()) {
      return localStorage.getItem(key);
    }
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    if (hasLocalStorage()) {
      localStorage.setItem(key, value);
    }
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    if (hasLocalStorage()) {
      localStorage.removeItem(key);
    }
  }
}
