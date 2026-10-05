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

const SAMPLE_SIZE = 100;
const MAX_PICKS = 8;

/**
 * Entries the user logs again and again ("MRT ฿17", "Coffee ฿60"), taken from
 * the latest transactions: same type, amount, note, category, and account at
 * least twice. Most frequent first, ties broken by recency.
 */
export function useQuickPicks(type: 'income' | 'expense' | 'transfer') {
  return useQuery({
    queryKey: [...transactionKeys.all, 'quick-picks'],
    queryFn: async () => {
      const { data } = await api.get<TransactionListResponse>('/transactions', { params: { limit: SAMPLE_SIZE } });
      const groups = new Map<string, QuickPick>();
      for (const tx of data.transactions ?? []) {
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
      return [...groups.values()].filter((pick) => pick.count >= 2).sort((a, b) => b.count - a.count);
    },
    select: (picks) => picks.filter((pick) => pick.type === type).slice(0, MAX_PICKS),
    enabled: type !== 'transfer',
    staleTime: 60_000,
  });
}
