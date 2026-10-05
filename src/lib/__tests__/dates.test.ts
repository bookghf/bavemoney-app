import { addDays, addMonths, daysBetween, occurredAtFor, toISODate } from '@/lib/dates';
import { bucketDays, monthName, monthRange, periodRange, rangeLabel, stepPeriod } from '@/lib/report-period';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('calendar dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('clamps month arithmetic to the month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(29);
  });

  it('keeps the picked local day in occurred_at', () => {
    expect(toISODate(new Date(occurredAtFor('2026-09-25')))).toBe('2026-09-25');
  });
});

describe('report periods', () => {
  it('covers whole months and years', () => {
    expect(periodRange('month', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('year', '2026-06-01')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('steps months without drifting', () => {
    expect(periodRange('month', stepPeriod('month', '2026-01-31', 1))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('month', stepPeriod('month', '2026-03-31', -1))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('starts months on payday', () => {
    expect(monthRange('2026-10-05', 25)).toEqual({ from: '2026-09-25', to: '2026-10-24' });
    expect(monthRange('2026-10-24', 25)).toEqual({ from: '2026-09-25', to: '2026-10-24' });
    expect(monthRange('2026-10-25', 25)).toEqual({ from: '2026-10-25', to: '2026-11-24' });
    expect(monthRange('2026-01-10', 25)).toEqual({ from: '2025-12-25', to: '2026-01-24' });
    expect(monthRange('2026-03-01', 28)).toEqual({ from: '2026-02-28', to: '2026-03-27' });
    expect(periodRange('month', '2026-10-05', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    // Out-of-range days fall back to calendar months, like the API.
    expect(monthRange('2026-10-05', 31)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('steps payday months one at a time', () => {
    const back = stepPeriod('month', '2026-10-05', -1, 25);
    expect(periodRange('month', back, 25)).toEqual({ from: '2026-08-25', to: '2026-09-24' });
    const next = stepPeriod('month', '2026-10-05', 1, 25);
    expect(periodRange('month', next, 25)).toEqual({ from: '2026-10-25', to: '2026-11-24' });
  });

  it('names payday months by their span', () => {
    const calendar = { from: '2026-10-01', to: '2026-10-31' };
    const payday = { from: '2026-09-25', to: '2026-10-24' };
    expect(monthName(calendar)).not.toContain('–');
    expect(monthName(payday)).toContain('–');
    expect(rangeLabel('month', calendar, '2026-10-05')).not.toContain('–');
    expect(rangeLabel('month', payday, '2026-10-05')).toContain('–');
  });

  it('buckets a month by day and a year by month', () => {
    const days = (from: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), income: '0', expense: '1.50' }));
    expect(bucketDays(days('2026-09-01', 30)).unit).toBe('day');
    const year = bucketDays(days('2026-01-01', 365));
    expect(year.unit).toBe('month');
    expect(year.buckets).toHaveLength(12);
  });
});
