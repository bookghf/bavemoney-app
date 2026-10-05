import { firstRunOn, scheduleLabel } from '@/lib/recurring';
import { usePreferences } from '@/store/preferences-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const monthly = (day: number) => ({ frequency: 'monthly' as const, day_of_month: day, weekday: null });
const weekly = (weekday: number) => ({ frequency: 'weekly' as const, day_of_month: null, weekday });

describe('firstRunOn', () => {
  it('finds the day this month or next', () => {
    expect(firstRunOn('2026-10-05', monthly(25))).toBe('2026-10-25');
    expect(firstRunOn('2026-10-25', monthly(25))).toBe('2026-10-25');
    expect(firstRunOn('2026-12-26', monthly(25))).toBe('2027-01-25');
  });

  it('clamps the day to the end of shorter months', () => {
    expect(firstRunOn('2027-02-01', monthly(31))).toBe('2027-02-28');
    expect(firstRunOn('2028-02-01', monthly(30))).toBe('2028-02-29');
    expect(firstRunOn('2026-04-15', monthly(31))).toBe('2026-04-30');
  });

  it('finds the next weekday', () => {
    // 2026-10-05 is a Monday.
    expect(firstRunOn('2026-10-05', weekly(1))).toBe('2026-10-05');
    expect(firstRunOn('2026-10-05', weekly(0))).toBe('2026-10-11');
    expect(firstRunOn('2026-10-05', weekly(5))).toBe('2026-10-09');
  });
});

describe('scheduleLabel', () => {
  afterEach(() => usePreferences.setState({ language: null }));

  it('describes the schedule', () => {
    usePreferences.setState({ language: 'en' });
    expect(scheduleLabel(monthly(25))).toBe('Monthly on day 25');
    expect(scheduleLabel(monthly(31))).toBe('Monthly on the last day');
    expect(scheduleLabel(weekly(1))).toBe('Every Monday');
  });
});
