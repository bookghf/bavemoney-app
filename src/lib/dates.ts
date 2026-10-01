/**
 * Calendar-date helpers. Dates travel as local "YYYY-MM-DD" strings so a day
 * never shifts across time zones; convert to Date only to do arithmetic.
 */

import { dateLocale } from '@/lib/i18n';

export type ISODate = string;

/** Local YYYY-MM-DD for a date (the API expects a plain calendar date). */
export function toISODate(date: Date): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD string. */
export function parseISODate(value: ISODate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Same day-of-month `months` later, clamped to the target month's length. */
export function addMonths(value: ISODate, months: number): ISODate {
  const date = parseISODate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Whole days from `from` to `to` (0 when equal). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

/** The user's IANA time zone, so the API buckets transactions by local day. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * RFC 3339 timestamp for `day` at the current local time of day, so a
 * back-dated entry still sorts naturally within its day.
 */
export function occurredAtFor(day: ISODate): string {
  const now = new Date();
  const date = parseISODate(day);
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date.toISOString();
}

export function formatDay(value: ISODate, options: Intl.DateTimeFormatOptions = {}): string {
  return parseISODate(value).toLocaleDateString(dateLocale(), {
    month: 'short',
    day: 'numeric',
    ...options,
  });
}
