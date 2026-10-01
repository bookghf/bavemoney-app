import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatPercent, type BreakdownItem } from '@/components/charts/breakdown';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

/** Slices beyond this many fold into one neutral "N more" slice. */
const MAX_SLICES = 6;

/**
 * Positive items, largest first, with the remainder past MAX_SLICES merged
 * into one "N more" slice in the neutral color.
 */
export function foldSlices(items: BreakdownItem[], neutral: string): BreakdownItem[] {
  const sorted = items.filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES) return sorted;
  const kept = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  return [
    ...kept,
    {
      key: '__folded',
      // Not "Other", which can be a real category name.
      name: t('{count} more', { count: rest.length }),
      total: rest.reduce((acc, item) => acc + item.total, 0),
      percentage: Math.round(rest.reduce((acc, item) => acc + item.percentage, 0) * 100) / 100,
      count: rest.reduce((acc, item) => acc + item.count, 0),
      color: neutral,
    },
  ];
}

type PieLegendProps = {
  slices: BreakdownItem[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  formatValue: (value: number) => string;
};

/**
 * One row per pie slice with its name, amount, and share, so identity never
 * rests on color alone. First tap highlights the slice; tapping it again
 * drills in when the slice supports it.
 */
export function PieLegend({ slices, selectedKey, onSelect, formatValue }: PieLegendProps) {
  const theme = useTheme();
  return (
    <View style={styles.legend}>
      {slices.map((slice) => {
        const isSelected = slice.key === selectedKey;
        return (
          <Pressable
            key={slice.key}
            accessibilityRole="button"
            accessibilityLabel={`${slice.name}: ${formatValue(slice.total)}, ${formatPercent(slice.percentage)}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => (isSelected && slice.onPress ? slice.onPress() : onSelect(isSelected ? null : slice.key))}
            style={[styles.row, isSelected && { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <ThemedText type="small" numberOfLines={1} style={styles.name}>
              {slice.name}
            </ThemedText>
            <ThemedText type="smallBold">{formatValue(slice.total)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.percent}>
              {formatPercent(slice.percentage)}
            </ThemedText>
            {isSelected && slice.onPress ? (
              <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { alignSelf: 'stretch', gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: 8,
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  name: { flex: 1 },
  percent: { minWidth: 40, textAlign: 'right' },
});
