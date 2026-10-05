import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useMonthStartDay } from '@/hooks/use-month-start-day';
import { api } from '@/lib/api/client';
import type { ReportSummary, ReportSummaryParams } from '@/lib/api/types';
import { deviceTimeZone } from '@/lib/dates';

export { toISODate } from '@/lib/dates';

export const reportKeys = {
  all: ['reports'] as const,
  summary: (params: ReportSummaryParams, monthStartDay: number) =>
    [...reportKeys.all, 'summary', params, monthStartDay] as const,
};

export function useReportSummary(params: ReportSummaryParams) {
  // The API reads month_start_day from the profile; keying on it refetches a
  // month once the day changes, also when another device changed it.
  const monthStartDay = useMonthStartDay();
  return useQuery({
    queryKey: reportKeys.summary(params, monthStartDay),
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
