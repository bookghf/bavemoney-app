import { currentLanguage, dateLocale, t } from '@/lib/i18n';

// Symbols for the currencies the app ships with. Hermes' Intl ignores
// currencyDisplay: 'narrowSymbol' and prints "THB 1,234.50", so the symbol
// is put in place of the code here instead.
const SYMBOLS: Record<string, string> = { THB: '฿', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

/** Format an amount (API decimal string or number) as currency: "฿1,234.50", "-฿90.00". */
export function formatMoney(amount: number | string, currency = 'THB'): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return String(amount);
  const locale = currentLanguage() === 'th' ? 'th-TH-u-nu-latn' : 'en-US';
  const symbol = SYMBOLS[currency];
  if (symbol) {
    const digits = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
    // U+2212 minus, the same sign transaction rows use.
    return `${value < 0 ? '\u2212' : ''}${symbol}${digits}`;
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    // Unknown currency code or missing Intl support.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Date in the app's language and calendar, e.g. "25 Sep 2026" or "25 ก.ย. 2569". */
export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = {}): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric', ...options });
}

/**
 * Compact date for list rows: "25 ก.ย." this year, "25 ก.ย. 2568" for other
 * years, so the year only takes room when it says something. Screens that
 * need the full date (pickers, ranges, "member since") use formatDate.
 */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // Both calendars change year on 1 January, so comparing Gregorian years is
  // enough for the Buddhist era too.
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Today", "Yesterday", or the formatted date: headers for day-grouped lists. */
export function formatDayHeading(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return t('Today');
  if (days === 1) return t('Yesterday');
  return formatDate(iso, { weekday: 'short' });
}

/** "credit_card" -> "Credit card", "e_wallet" -> "E-wallet" */
export function humanize(value: string): string {
  const text = value === 'e_wallet' ? 'E-wallet' : value.replace(/_/g, ' ');
  return t(text.charAt(0).toUpperCase() + text.slice(1));
}
