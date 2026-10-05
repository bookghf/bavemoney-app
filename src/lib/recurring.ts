/** Display helpers for recurring rules (see hooks/use-recurring.ts). */
import type { RecurringRule } from '@/lib/api/types';
import { parseISODate, toISODate, type ISODate } from '@/lib/dates';
import { categoryName, dateLocale, t } from '@/lib/i18n';

/** Weekday 0 (Sunday) - 6 (Saturday) in the app's language, e.g. "Monday". */
export function weekdayName(weekday: number, style: 'long' | 'short' = 'long'): string {
  // 2026-10-04 is a Sunday.
  return new Date(2026, 9, 4 + weekday).toLocaleDateString(dateLocale(), { weekday: style });
}

/** "Monthly on day 25", "Monthly on the last day", or "Every Monday". */
export function scheduleLabel(rule: Pick<RecurringRule, 'frequency' | 'day_of_month' | 'weekday'>): string {
  if (rule.frequency === 'weekly') return t('Every {weekday}', { weekday: weekdayName(rule.weekday ?? 0) });
  // The 31st always runs on the month's last day.
  if (rule.day_of_month === 31) return t('Monthly on the last day');
  return t('Monthly on day {day}', { day: rule.day_of_month ?? 1 });
}

/** The rule's name in lists and dialogs: its category, note, or type. */
export function ruleTitle(rule: RecurringRule): string {
  if (rule.type === 'transfer') return rule.note || t('Transfer');
  const category = rule.category ? categoryName(rule.category.name) : '';
  return category || rule.note || (rule.type === 'income' ? t('Income') : t('Expense'));
}

/**
 * The first due day on or after `start`, as the API schedules it: weekly on
 * the weekday, monthly on the day clamped to the month's last day.
 */
export function firstRunOn(
  start: ISODate,
  rule: Pick<RecurringRule, 'frequency' | 'day_of_month' | 'weekday'>,
): ISODate {
  const date = parseISODate(start);
  if (rule.frequency === 'weekly') {
    date.setDate(date.getDate() + (((rule.weekday ?? 0) - date.getDay() + 7) % 7));
    return toISODate(date);
  }
  const inMonth = (year: number, month: number) => {
    const last = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(rule.day_of_month ?? 1, last));
  };
  const due = inMonth(date.getFullYear(), date.getMonth());
  return toISODate(due >= date ? due : inMonth(date.getFullYear(), date.getMonth() + 1));
}
