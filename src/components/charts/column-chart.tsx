import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useChartPalette } from '@/hooks/use-chart-palette';

export type ColumnDatum = {
  key: string;
  /** Full label for the readout, e.g. "Wed, Sep 30". */
  label: string;
  /** Short axis label, e.g. "30". */
  axisLabel: string;
  value: number;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  formatValue: (value: number) => string;
  color?: string;
  height?: number;
};

/**
 * A single-series column chart. Tap a column to read its value; with nothing
 * selected the readout names the peak. Columns are capped at 24px wide and
 * grow from one baseline.
 */
export function ColumnChart({ data, formatValue, color, height = 160 }: ColumnChartProps) {
  const palette = useChartPalette();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fill = color ?? palette.series[0];

  const max = Math.max(0, ...data.map((d) => d.value));
  const peak = data.find((d) => d.value === max && max > 0);
  const selected = data.find((d) => d.key === selectedKey) ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.readout}>
        {selected ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {selected.label}
            </ThemedText>
            <ThemedText type="smallBold">{formatValue(selected.value)}</ThemedText>
          </>
        ) : peak ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Peak · {peak.label}
            </ThemedText>
            <ThemedText type="smallBold">{formatValue(peak.value)}</ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing recorded in this period.
          </ThemedText>
        )}
      </View>

      <View style={[styles.plot, { height, borderBottomColor: palette.track }]}>
        {data.map((d) => {
          const isSelected = d.key === selectedKey;
          const dimmed = selectedKey !== null && !isSelected;
          const barHeight = max > 0 ? (d.value / max) * height : 0;
          return (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              accessibilityState={{ selected: isSelected }}
              // The whole column slot is the hit target, not just the bar.
              onPress={() => setSelectedKey(isSelected ? null : d.key)}
              style={styles.slot}>
              {barHeight > 0 ? (
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, 2),
                      backgroundColor: fill,
                      opacity: dimmed ? 0.35 : 1,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Axis labels at the ends and middle only, never on every column. */}
      <View style={styles.axis}>
        {axisLabels(data).map((d, i, shown) => (
          <ThemedText
            key={d.key}
            type="small"
            themeColor={d.key === selectedKey ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={[styles.axisLabel, { textAlign: i === 0 ? 'left' : i === shown.length - 1 ? 'right' : 'center' }]}>
            {d.axisLabel}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

/** First, middle, and last datum (fewer when there are fewer columns). */
function axisLabels(data: ColumnDatum[]): ColumnDatum[] {
  if (data.length <= 2) return data;
  return [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]];
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  readout: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    // 2px surface gap between neighbouring columns.
    gap: 2,
  },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 11, lineHeight: 14, flex: 1 },
});
