import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { ReportSummary, ReportSummaryParams } from '@/lib/api/types';
import { deviceTimeZone } from '@/lib/dates';

export { toISODate } from '@/lib/dates';

export const reportKeys = {
  all: ['reports'] as const,
  summary: (params: ReportSummaryParams) => [...reportKeys.all, 'summary', params] as const,
};

export function useReportSummary(params: ReportSummaryParams) {
  return useQuery({
    queryKey: reportKeys.summary(params),
    queryFn: async () => {
      const { data } = await api.get<ReportSummary>('/reports/summary', {
        // Bucket transactions by the user's local calendar day.
        params: { ...params, tz: deviceTimeZone() },
      });
      return data;
    },
    // Keep the last result on screen while the next period/filter loads.
    placeholderData: keepPreviousData,
  });
}
