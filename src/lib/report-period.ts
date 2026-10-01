import type { ReportDay, ReportPeriod } from '@/lib/api/types';
import { dateLocale, t } from '@/lib/i18n';
import {
  addDays,
  addMonths,
  daysBetween,
  formatDay,
  parseISODate,
  toISODate,
  type ISODate,
} from '@/lib/dates';

export type DateRange = { from: ISODate; to: ISODate };

/** The calendar range a period covers, matching the API (weeks start Sunday). */
export function periodRange(period: Exclude<ReportPeriod, 'custom'>, anchor: ISODate): DateRange {
  const date = parseISODate(anchor);
  switch (period) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = addDays(anchor, -date.getDay());
      return { from, to: addDays(from, 6) };
    }
    case 'month':
      return {
        from: toISODate(new Date(date.getFullYear(), date.getMonth(), 1)),
        to: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
      };
    case 'year':
      return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` };
  }
}

/** Move the anchor one period back (-1) or forward (+1). */
export function stepPeriod(period: Exclude<ReportPeriod, 'custom'>, anchor: ISODate, direction: 1 | -1): ISODate {
  switch (period) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
      return addDays(anchor, 7 * direction);
    case 'month':
      return addMonths(anchor, direction);
    case 'year':
      return addMonths(anchor, 12 * direction);
  }
}

export function rangeLabel(period: ReportPeriod, range: DateRange, todayISO: ISODate): string {
  const start = parseISODate(range.from);
  switch (period) {
    case 'day':
      if (range.from === todayISO) return t('Today');
      if (range.from === addDays(todayISO, -1)) return t('Yesterday');
      return formatDay(range.from, { weekday: 'short', year: 'numeric' });
    case 'month':
      return start.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
    case 'year':
      return start.toLocaleDateString(dateLocale(), { year: 'numeric' });
    default: {
      if (range.from === range.to) return formatDay(range.from, { year: 'numeric' });
      const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
      const from = formatDay(range.from, sameYear ? {} : { year: 'numeric' });
      return `${from} – ${formatDay(range.to, { year: 'numeric' })}`;
    }
  }
}

export type Bucket = {
  key: string;
  label: string;
  axisLabel: string;
  from: ISODate;
  expense: number;
  income: number;
};

/**
 * Groups the daily breakdown into chart-friendly buckets: days for up to a
 * month, weeks for up to ~4 months, months beyond that.
 */
export function bucketDays(days: ReportDay[]): { unit: 'day' | 'week' | 'month'; buckets: Bucket[] } {
  if (days.length === 0) return { unit: 'day', buckets: [] };
  const span = daysBetween(days[0].date, days[days.length - 1].date) + 1;
  const unit = span <= 31 ? 'day' : span <= 120 ? 'week' : 'month';

  const buckets: Bucket[] = [];
  days.forEach((day, i) => {
    const key =
      unit === 'day' ? day.date : unit === 'week' ? String(Math.floor(i / 7)) : day.date.slice(0, 7);
    let bucket = buckets[buckets.length - 1];
    if (bucket?.key !== key) {
      bucket = { key, label: '', axisLabel: '', from: day.date, expense: 0, income: 0 };
      buckets.push(bucket);
    }
    bucket.expense += Number.parseFloat(day.expense) || 0;
    bucket.income += Number.parseFloat(day.income) || 0;
  });

  for (const bucket of buckets) {
    const date = parseISODate(bucket.from);
    if (unit === 'day') {
      bucket.label = formatDay(bucket.from, { weekday: 'short' });
      bucket.axisLabel = span <= 7 ? date.toLocaleDateString(dateLocale(), { weekday: 'short' }) : String(date.getDate());
    } else if (unit === 'week') {
      bucket.label = `Week of ${formatDay(bucket.from)}`;
      bucket.axisLabel = formatDay(bucket.from);
    } else {
      bucket.label = date.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
      bucket.axisLabel = date.toLocaleDateString(dateLocale(), { month: 'short' });
    }
  }
  return { unit, buckets };
}
