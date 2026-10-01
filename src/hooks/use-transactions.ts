import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/hooks/use-accounts';
import { budgetKeys } from '@/hooks/use-budgets';
import { reportKeys } from '@/hooks/use-reports';
import { api } from '@/lib/api/client';
import type {
  CreateTransactionRequest,
  Transaction,
  TransactionListParams,
  TransactionListResponse,
  UpdateTransactionRequest,
} from '@/lib/api/types';
import { deviceTimeZone } from '@/lib/dates';

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (filters: TransactionListParams = {}) => [...transactionKeys.all, 'list', filters] as const,
  recent: (limit: number) => [...transactionKeys.all, 'recent', limit] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 20;

/**
 * Transactions matching `filters`, newest first, fetched page by page as the
 * list scrolls. Date filters are calendar days in the device's time zone.
 */
export function useTransactions(filters: TransactionListParams = {}) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<TransactionListResponse>('/transactions', {
        params: { ...filters, page: pageParam, limit: PAGE_SIZE, tz: deviceTimeZone() },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.total_pages ? pagination.page + 1 : undefined,
    select: (data) => {
      // Offset pages can overlap when a transaction is added mid-scroll; keep
      // the first copy of each id.
      const seen = new Set<string>();
      const items = data.pages
        .flatMap((page) => page.transactions ?? [])
        .filter((tx) => !seen.has(tx.id) && seen.add(tx.id));
      return { items, total: data.pages[0]?.pagination.total_items ?? 0 };
    },
  });
}

/** The most recent `limit` transactions. */
export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: transactionKeys.recent(limit),
    queryFn: async () => {
      const { data } = await api.get<TransactionListResponse>('/transactions', {
        params: { limit },
      });
      return data.transactions ?? [];
    },
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<Transaction>(`/transactions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/** Everything derived from transactions: lists, reports, balances, budgets. */
function invalidateLedger(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: reportKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  ]);
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionRequest) => {
      const { data } = await api.post<Transaction>('/transactions', input);
      return data;
    },
    onSuccess: () => invalidateLedger(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTransactionRequest & { id: string }) => {
      const { data } = await api.patch<Transaction>(`/transactions/${id}`, input);
      return data;
    },
    onSuccess: () => invalidateLedger(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: () => invalidateLedger(queryClient),
  });
}
