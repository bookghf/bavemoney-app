import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/hooks/use-accounts';
import { budgetKeys } from '@/hooks/use-budgets';
import { reportKeys } from '@/hooks/use-reports';
import { transactionKeys } from '@/hooks/use-transactions';
import { api } from '@/lib/api/client';
import type { CreateRecurringRuleRequest, RecurringRule, UpdateRecurringRuleRequest } from '@/lib/api/types';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: () => [...recurringKeys.all, 'list'] as const,
  detail: (id: string) => [...recurringKeys.all, 'detail', id] as const,
};

export function useRecurringRules() {
  return useQuery({
    queryKey: recurringKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<{ rules: RecurringRule[] }>('/recurring');
      return data.rules ?? [];
    },
  });
}

export function useRecurringRule(id: string | undefined) {
  return useQuery({
    queryKey: recurringKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ rule: RecurringRule }>(`/recurring/${id}`);
      return data.rule;
    },
    enabled: !!id,
  });
}

/**
 * Saving a rule makes the API create whatever it already has due, so the
 * ledger (lists, reports, balances, budgets) is refreshed along with the rules.
 */
function invalidateRules(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: recurringKeys.all }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: reportKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  ]);
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecurringRuleRequest) => {
      const { data } = await api.post<{ rule: RecurringRule }>('/recurring', input);
      return data.rule;
    },
    onSuccess: () => invalidateRules(queryClient),
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRecurringRuleRequest & { id: string }) => {
      const { data } = await api.patch<{ rule: RecurringRule }>(`/recurring/${id}`, input);
      return data.rule;
    },
    onSuccess: () => invalidateRules(queryClient),
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/recurring/${id}`);
    },
    onSuccess: () => invalidateRules(queryClient),
  });
}
