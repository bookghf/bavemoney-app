import type { Account } from '@/lib/api/types';
import { defaultAccount, isSavingsLike } from '@/lib/default-account';

function account(id: string, name: string, is_archived = false): Account {
  return {
    id,
    name,
    type: 'bank',
    currency: 'THB',
    initial_balance: '0',
    current_balance: '0',
    is_archived,
    created_at: '2026-01-01T00:00:00Z',
  };
}

const saving = account('saving', 'Saving');
const cash = account('cash', 'Cash');
const card = account('card', 'KBank card');
const old = account('old', 'Old wallet', true);

describe('defaultAccount', () => {
  it('prefers the account used last', () => {
    expect(defaultAccount([saving, cash, card], { lastAccountId: 'card', usage: { cash: 9 } })?.id).toBe('card');
  });

  it('ignores a last account that was archived since', () => {
    expect(defaultAccount([saving, old, cash], { lastAccountId: 'old' })?.id).toBe('cash');
  });

  it('falls back to the account used most for the type, ties in list order', () => {
    expect(defaultAccount([saving, cash, card], { lastAccountId: null, usage: { card: 3, saving: 1 } })?.id).toBe('card');
    expect(defaultAccount([saving, cash, card], { lastAccountId: null, usage: { cash: 2, card: 2 } })?.id).toBe('cash');
    expect(defaultAccount([saving, cash], { lastAccountId: null, usage: { old: 5 } })?.id).toBe('cash');
  });

  it('skips savings-like accounts on a first entry', () => {
    expect(defaultAccount([saving, cash], { lastAccountId: null })?.id).toBe('cash');
    expect(defaultAccount([account('t', 'บัญชีเงินออม'), card], { lastAccountId: null })?.id).toBe('card');
  });

  it('still picks a savings account when it is the only one open', () => {
    expect(defaultAccount([old, saving], { lastAccountId: null })?.id).toBe('saving');
    expect(defaultAccount([old], { lastAccountId: null })).toBeUndefined();
  });
});

describe('isSavingsLike', () => {
  it.each(['Saving', 'Savings account', 'เงินออม', 'ฝากประจำ 12 เดือน', 'Emergency fund'])('%p is savings-like', (name) => {
    expect(isSavingsLike({ name })).toBe(true);
  });

  it.each(['Cash', 'KBank', 'TrueMoney', 'Credit card'])('%p is not', (name) => {
    expect(isSavingsLike({ name })).toBe(false);
  });
});
