/**
 * Web persistence for the auth session. expo-secure-store has no web
 * implementation, so fall back to localStorage (not encrypted — acceptable for
 * a dev/learning app, but consider httpOnly cookies for production web).
 *
 * `window` is undefined during static rendering (web.output = "static"), so
 * every access is guarded.
 */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  return storage()?.getItem(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  storage()?.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  storage()?.removeItem(key);
}
