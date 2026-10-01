import * as SecureStore from 'expo-secure-store';

/**
 * Native (iOS/Android) persistence for the auth session, backed by the
 * Keychain / Keystore via expo-secure-store. The web implementation lives in
 * session-storage.web.ts (secure-store is not available on web).
 *
 * Values are stored under separate keys because some iOS versions reject
 * SecureStore values larger than ~2 KB. Keys may only contain [A-Za-z0-9._-].
 */
export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
