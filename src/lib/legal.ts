import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

/**
 * Public privacy policy and terms (docs/ in this repo, served by GitHub
 * Pages). App Store Connect needs the same privacy URL.
 */
const LEGAL_BASE = 'https://bookghf.github.io/bavemoney-app';

export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || `${LEGAL_BASE}/privacy.html`;
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || `${LEGAL_BASE}/terms.html`;

/** Open a legal page in the in-app browser. */
export function openLegalPage(url: string) {
  return openBrowserAsync(url, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
}
