/**
 * Minimal i18n: UI strings are written in English and looked up in the Thai
 * dictionary (lib/i18n-th.ts) when Thai is active; a missing entry falls back
 * to English. `{name}` placeholders are filled from `vars`.
 *
 * The root layout remounts the screens when the language or calendar changes,
 * so plain t() calls during render always see the current setting.
 */
import { TH } from '@/lib/i18n-th';
import { usePreferences, type Language } from '@/store/preferences-store';

export function deviceLanguage(): Language {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('th') ? 'th' : 'en';
  } catch {
    return 'en';
  }
}

export function currentLanguage(): Language {
  return usePreferences.getState().language ?? deviceLanguage();
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const template = currentLanguage() === 'th' ? (TH[key] ?? key) : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * Whether t(key) would show the key's own text in the current language: always
 * in English, and in Thai only when the dictionary has it. Lets callers swap
 * an untranslated server message for a translated fallback.
 */
export function hasTranslation(key: string): boolean {
  return currentLanguage() !== 'th' || key in TH;
}

/** Plural-aware count label: tn(2, 'account', 'accounts') -> "2 accounts". */
export function tn(count: number, one: string, other: string): string {
  return t(count === 1 ? one : other, { count });
}

/**
 * Display name of a category. System categories come from the API in English
 * and are translated here; user-created names are shown as typed.
 */
export function categoryName(name: string): string {
  return currentLanguage() === 'th' ? (TH[`category:${name}`] ?? name) : name;
}

/** BCP 47 locale for dates and numbers: app language + calendar, Latin digits. */
export function dateLocale(): string {
  const calendar = usePreferences.getState().calendar;
  return `${currentLanguage() === 'th' ? 'th-TH' : 'en-GB'}-u-ca-${calendar}-nu-latn`;
}
