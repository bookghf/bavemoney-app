import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api } from '@/lib/api/client';
import { deviceTimeZone, today } from '@/lib/dates';
import { t } from '@/lib/i18n';

/**
 * Export every transaction as CSV and open the share sheet (save to Files,
 * AirDrop, mail, Google Drive). The file opens in Excel and Google Sheets with
 * Thai intact and can be imported back.
 */
export function useExportCSV() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.get<string>('/transactions/export', {
        params: { tz: deviceTimeZone() },
        responseType: 'text',
        // Keep the CSV as text: axios would otherwise try to parse it as JSON.
        transformResponse: (body) => body,
      });
      const file = new File(Paths.cache, `bavemoney-${today()}.csv`);
      if (file.exists) file.delete();
      file.create();
      file.write(data);
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this device'));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: t('Export CSV'),
      });
    },
  });
}
