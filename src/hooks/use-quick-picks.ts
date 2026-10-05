import { useQuery } from '@tanstack/react-query';

import { transactionKeys } from '@/hooks/use-transactions';
import { api } from '@/lib/api/client';
import type { TransactionListResponse } from '@/lib/api/types';

export type QuickPick = {
  key: string;
  type: 'income' | 'expense';
  amount: string;
  note: string;
  categoryId: string | null;
  categoryName: string | null;
  /** The account it is paid from: an MRT ride on the bank card stays on the card. */
  accountId: string;
  accountName: string;
  count: number;
};

/** How often each account and category came up, per transaction type. */
export type EntryUsage = {
  accounts: Record<string, Record<string, number>>;
  categories: Record<string, Record<string, number>>;
};

type RecentEntries = { picks: QuickPick[]; usage: EntryUsage };

const SAMPLE_SIZE = 100;
const MAX_PICKS = 8;

/** The latest transactions, shared by useQuickPicks and useEntryUsage. */
function useRecentEntries<T>(select: (entries: RecentEntries) => T, enabled = true) {
  return useQuery({
    queryKey: [...transactionKeys.all, 'quick-picks'],
    queryFn: async (): Promise<RecentEntries> => {
      const { data } = await api.get<TransactionListResponse>('/transactions', { params: { limit: SAMPLE_SIZE } });
      const groups = new Map<string, QuickPick>();
      const usage: EntryUsage = { accounts: {}, categories: {} };
      const bump = (counts: Record<string, Record<string, number>>, type: string, id: string) => {
        counts[type] ??= {};
        counts[type][id] = (counts[type][id] ?? 0) + 1;
      };
      for (const tx of data.transactions ?? []) {
        bump(usage.accounts, tx.type, tx.account_id);
        // Count a subcategory towards its parent: the grid shows parents.
        const topCategory = tx.category?.parent?.id ?? tx.category?.id;
        if (topCategory) bump(usage.categories, tx.type, topCategory);

        if (tx.type !== 'income' && tx.type !== 'expense') continue;
        const note = (tx.note ?? '').trim();
        const key = [tx.type, tx.amount, note.toLowerCase(), tx.category?.id ?? '', tx.account_id].join('|');
        const existing = groups.get(key);
        if (existing) existing.count += 1;
        else {
          groups.set(key, {
            key,
            type: tx.type as QuickPick['type'],
            amount: tx.amount,
            note,
            categoryId: tx.category?.id ?? null,
            categoryName: tx.category?.name ?? null,
            accountId: tx.account_id,
            accountName: tx.account_name,
            count: 1,
          });
        }
      }
      // Map keeps insertion order (newest first), so a stable sort by count
      // leaves recency as the tie-breaker.
      const picks = [...groups.values()].filter((pick) => pick.count >= 2).sort((a, b) => b.count - a.count);
      return { picks, usage };
    },
    select,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Entries the user logs again and again ("MRT ฿17", "Coffee ฿60"), taken from
 * the latest transactions: same type, amount, note, category, and account at
 * least twice. Most frequent first, ties broken by recency.
 */
export function useQuickPicks(type: 'income' | 'expense' | 'transfer') {
  return useRecentEntries(
    ({ picks }) => picks.filter((pick) => pick.type === type).slice(0, MAX_PICKS),
    type !== 'transfer',
  );
}

/** Account and category counts over the latest transactions, for defaults and ordering. */
export function useEntryUsage() {
  return useRecentEntries(({ usage }) => usage);
}
