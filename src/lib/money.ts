/**
 * Exact money helpers. The API sends amounts as decimal strings ("1234.50");
 * sums are done in integer cents with BigInt so they never pick up float error.
 */

/** Largest integer part the API accepts (NUMERIC(18,2)). */
const MAX_INTEGER_DIGITS = 16;

/**
 * Parse what a user typed into a canonical decimal string ("1234.5"), or null
 * when it is not a valid amount. Accepts "1,234.56" (comma thousands), "12,50"
 * (comma decimal), spaces, and a leading currency symbol. Rejects junk such as
 * "12abc", "1e5", or more than 2 decimals rather than guessing.
 */
export function parseAmountInput(input: string, { allowNegative = false } = {}): string | null {
  let text = input.trim().replace(/[\s฿$€]/g, '');
  let sign = '';
  if (text.startsWith('-') || text.startsWith('−')) {
    if (!allowNegative) return null;
    sign = '-';
    text = text.slice(1);
  }
  if (text === '') return null;

  if (text.includes('.') && text.includes(',')) {
    // "1,234.56": commas group thousands.
    if (!/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(text)) return null;
    text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, ''); // "1,000"
    else if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.'); // "12,50"
    else return null;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const integer = match[1].replace(/^0+(?=\d)/, '');
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  const value = match[2] ? `${integer}.${match[2]}` : integer;
  return sign && /^[0.]+$/.test(value) ? value : sign + value;
}

/** A strictly positive amount, as the transaction and budget forms need. */
export function parsePositiveAmount(input: string): string | null {
  const value = parseAmountInput(input);
  return value !== null && !/^[0.]+$/.test(value) ? value : null;
}

/** "1234.5" -> 123450n. Accepts numbers too, for older API responses. */
export function toCents(amount: string | number): bigint {
  const text = typeof amount === 'number' ? amount.toFixed(2) : amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return 0n;
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0') || '0');
  return match[1] ? -cents : cents;
}

/** 123450n -> "1234.50" */
export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const fraction = String(abs % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${abs / 100n}.${fraction}`;
}

/** Exact sum of decimal amounts. */
export function sumAmounts(amounts: (string | number)[]): string {
  return fromCents(amounts.reduce<bigint>((total, amount) => total + toCents(amount), 0n));
}

/** True when the amount is below zero. */
export function isNegative(amount: string | number): boolean {
  return toCents(amount) < 0n;
}

/** Exact balance totals per currency: the API never converts between them. */
export function totalsByCurrency(accounts: { currency: string; current_balance: string }[]): Record<string, string> {
  const cents: Record<string, bigint> = {};
  for (const account of accounts) {
    cents[account.currency] = (cents[account.currency] ?? 0n) + toCents(account.current_balance);
  }
  return Object.fromEntries(Object.entries(cents).map(([code, value]) => [code, fromCents(value)]));
}
