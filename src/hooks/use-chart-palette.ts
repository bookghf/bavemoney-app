import { ChartColors } from '@/constants/chart-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useChartPalette() {
  const scheme = useColorScheme();
  return ChartColors[scheme === 'dark' ? 'dark' : 'light'];
}
