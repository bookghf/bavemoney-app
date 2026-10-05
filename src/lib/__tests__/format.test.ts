import { formatDate, formatShortDate } from '@/lib/format';
import { usePreferences } from '@/store/preferences-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Local noon, so the day never shifts with the machine's time zone.
const NOW = new Date(2026, 9, 5, 12);
const THIS_YEAR = new Date(2026, 8, 25, 12).toISOString();
const LAST_YEAR = new Date(2025, 8, 25, 12).toISOString();

afterEach(() => usePreferences.setState({ language: null, calendar: 'gregory' }));

describe('formatShortDate', () => {
  it('drops the year for this year and keeps it for others (Thai, Buddhist era)', () => {
    usePreferences.setState({ language: 'th', calendar: 'buddhist' });
    expect(formatShortDate(THIS_YEAR, NOW)).toBe('25 ก.ย.');
    expect(formatShortDate(LAST_YEAR, NOW)).toBe('25 ก.ย. 2568');
  });

  it('drops the year for this year and keeps it for others (Thai, Gregorian)', () => {
    usePreferences.setState({ language: 'th', calendar: 'gregory' });
    expect(formatShortDate(THIS_YEAR, NOW)).toBe('25 ก.ย.');
    expect(formatShortDate(LAST_YEAR, NOW)).toBe('25 ก.ย. 2025');
  });

  it('drops the year for this year and keeps it for others (English)', () => {
    usePreferences.setState({ language: 'en', calendar: 'gregory' });
    // ICU versions disagree on "Sep" versus "Sept", so match loosely.
    expect(formatShortDate(THIS_YEAR, NOW)).toMatch(/^25 Sept?$/);
    expect(formatShortDate(LAST_YEAR, NOW)).toMatch(/^25 Sept? 2025$/);
    usePreferences.setState({ language: 'en', calendar: 'buddhist' });
    expect(formatShortDate(LAST_YEAR, NOW)).toContain('2568');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatShortDate('not a date', NOW)).toBe('not a date');
  });

  it('leaves formatDate with the full year', () => {
    usePreferences.setState({ language: 'th', calendar: 'buddhist' });
    expect(formatDate(THIS_YEAR)).toBe('25 ก.ย. 2569');
  });
});
