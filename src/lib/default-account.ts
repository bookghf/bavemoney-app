import type { Account } from '@/lib/api/types';

/**
 * Names that mark an account people put money aside in rather than spend
 * from, in English and Thai ("ออม" = save, "ฝากประจำ" = fixed deposit).
 */
const SAVINGS_LIKE = /sav(e|ing)|ออม|ฝากประจำ|fixed|deposit|invest|ลงทุน|emergency|ฉุกเฉิน/i;

export function isSavingsLike(account: Pick<Account, 'name'>): boolean {
  return SAVINGS_LIKE.test(account.name);
}

/**
 * The account a new entry starts on, among the open accounts:
 * 1. the one used last on this device, so a run of entries stays put;
 * 2. else the one used most for this type in the recent history (the card
 *    people pay with, the account their salary lands in);
 * 3. else the first account that is not savings-like, since a first expense is
 *    rarely paid from a savings account;
 * 4. else the first open account.
 */
export function defaultAccount(
  accounts: Account[],
  { lastAccountId, usage }: { lastAccountId: string | null; usage?: Record<string, number> },
): Account | undefined {
  const open = accounts.filter((account) => !account.is_archived);
  const last = open.find((account) => account.id === lastAccountId);
  if (last) return last;

  let mostUsed: Account | undefined;
  for (const account of open) {
    const count = usage?.[account.id] ?? 0;
    // Strictly greater keeps the list order as the tie-breaker.
    if (count > 0 && count > (mostUsed ? (usage?.[mostUsed.id] ?? 0) : 0)) mostUsed = account;
  }
  if (mostUsed) return mostUsed;

  return open.find((account) => !isSavingsLike(account)) ?? open[0];
}
