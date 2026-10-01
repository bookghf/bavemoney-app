import fs from 'fs';
import path from 'path';

import { formatMoney } from '@/lib/format';
import { TH } from '@/lib/i18n-th';
import { categoryName, t, tn } from '@/lib/i18n';
import { usePreferences } from '@/store/preferences-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const SRC = path.join(__dirname, '..', '..');

/** Every t('...') and tn(n, '...', '...') key in the app's source. */
function usedKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.startsWith('i18n')) {
        const source = fs.readFileSync(full, 'utf8');
        for (const match of source.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(match[1].replace(/\\n/g, '\n'));
        for (const match of source.matchAll(/\btn\([^,]+,\s*'([^']*)',\s*'([^']*)'/g)) {
          keys.add(match[1]);
          keys.add(match[2]);
        }
      }
    }
  };
  walk(SRC);
  return keys;
}

describe('Thai dictionary', () => {
  it('translates every string the UI passes to t()', () => {
    const missing = [...usedKeys()].filter((key) => !(key in TH));
    expect(missing).toEqual([]);
  });

  it('keeps every {placeholder} of the English key', () => {
    for (const [key, value] of Object.entries(TH)) {
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect([key, placeholders(value)]).toEqual([key, placeholders(key)]);
    }
  });
});

describe('t()', () => {
  afterEach(() => usePreferences.setState({ language: null }));

  it('fills placeholders and falls back to English', () => {
    usePreferences.setState({ language: 'en' });
    expect(t('{count} more', { count: 3 })).toBe('3 more');
    expect(t('Not in any dictionary')).toBe('Not in any dictionary');
    expect(tn(1, '{count} account', '{count} accounts')).toBe('1 account');
  });

  it('switches to Thai and translates system categories', () => {
    usePreferences.setState({ language: 'th' });
    expect(t('Save')).toBe('บันทึก');
    expect(t('{amount} over budget', { amount: '฿10' })).toBe('เกินงบ ฿10');
    expect(categoryName('Food')).toBe('อาหาร');
    expect(categoryName('My own category')).toBe('My own category');
  });
});

describe('formatMoney', () => {
  it('uses the baht symbol and keeps the sign in front', () => {
    usePreferences.setState({ language: 'en' });
    expect(formatMoney('109809.75', 'THB')).toBe('฿109,809.75');
    expect(formatMoney('-12190.25', 'THB')).toBe('-฿12,190.25');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('falls back to the currency code for others', () => {
    expect(formatMoney('5', 'CHF')).toMatch(/CHF/);
  });
});
