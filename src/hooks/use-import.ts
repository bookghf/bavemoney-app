import { useMutation, useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { transactionKeys } from '@/hooks/use-transactions';
import { api } from '@/lib/api/client';
import type { Transaction, TransactionListResponse } from '@/lib/api/types';
import { toCSV } from '@/lib/csv';
import { deviceTimeZone } from '@/lib/dates';
import { t } from '@/lib/i18n';

/** The API's largest page. */
const PAGE_SIZE = 100;

/**
 * Every transaction from `range.from` to `range.to` (YYYY-MM-DD, inclusive,
 * in the device's time zone), so an import can spot rows already in the
 * ledger. Disabled while `range` is null.
 */
export function useTransactionsBetween(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: [...transactionKeys.all, 'between', range?.from, range?.to] as const,
    queryFn: async () => {
      const page = async (n: number) => {
        const { data } = await api.get<TransactionListResponse>('/transactions', {
          params: { from: range!.from, to: range!.to, tz: deviceTimeZone(), page: n, limit: PAGE_SIZE },
        });
        return data;
      };
      const first = await page(1);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, first.pagination.total_pages - 1) }, (_, i) => page(i + 2)),
      );
      const seen = new Set<string>();
      return [first, ...rest]
        .flatMap((p) => p.transactions ?? [])
        .filter((tx): tx is Transaction => !seen.has(tx.id) && !!seen.add(tx.id));
    },
    enabled: !!range,
  });
}

/** The rows of the sample file; the import screen shows the same table. */
export function sampleRecords(): string[][] {
  return [
    [t('Date'), t('Item'), t('Amount')],
    ['30/07/2569', t('Chicken rice'), '50'],
    ['', t('Skytrain'), '42'],
    ['31/07/2569', t('Coffee'), '65'],
  ];
}

/** Write a small sample CSV and open the share sheet to save or send it. */
export function useSampleCSV() {
  return useMutation({
    mutationFn: async () => {
      const file = new File(Paths.cache, 'bavemoney-import-sample.csv');
      if (file.exists) file.delete();
      file.create();
      // A BOM so Excel opens the Thai text as UTF-8.
      file.write(`﻿${toCSV(sampleRecords())}`);
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this device'));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: t('Download sample file'),
      });
    },
  });
}
