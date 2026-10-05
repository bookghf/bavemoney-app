import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useChartPalette } from '@/hooks/use-chart-palette';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { t, tn } from '@/lib/i18n';

export type BreakdownItem = {
  key: string;
  name: string;
  total: number;
  /** Share of the report total, 0-100. */
  percentage: number;
  count: number;
  color: string;
  /** Shown indented under the item in the table view. */
  children?: BreakdownItem[];
  /** Tapping drills into this item (e.g. filter by it). */
  onPress?: () => void;
};

type BreakdownProps = {
  items: BreakdownItem[];
  formatValue: (value: number) => string;
};

/**
 * Composition at a glance (a 100% share bar) followed by one labelled bar per
 * item, scaled to the largest so rows compare directly. Every row carries its
 * name, amount, and share as text, so identity never rests on color alone.
 */
export function BreakdownChart({ items, formatValue }: BreakdownProps) {
  const theme = useTheme();
  const palette = useChartPalette();
  const max = Math.max(0, ...items.map((item) => item.total));
  const sum = items.reduce((acc, item) => acc + item.total, 0);

  return (
    <View style={styles.container}>
      {items.length > 1 && sum > 0 ? (
        <View style={styles.shareBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items
            .filter((item) => item.total > 0)
            .map((item) => (
              <View key={item.key} style={{ flex: item.total, backgroundColor: item.color }} />
            ))}
        </View>
      ) : null}

      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole={item.onPress ? 'button' : undefined}
          accessibilityLabel={`${item.name}: ${formatValue(item.total)}, ${item.percentage}%`}
          disabled={!item.onPress}
          onPress={item.onPress}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
          <View style={styles.rowHeader}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <ThemedText type="small" numberOfLines={1} style={styles.name}>
              {item.name}
            </ThemedText>
            <ThemedText type="smallBold">{formatValue(item.total)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.percent}>
              {formatPercent(item.percentage)}
            </ThemedText>
            {item.onPress ? <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} /> : null}
          </View>
          <View style={[styles.track, { backgroundColor: palette.track }]}>
            <View
              style={[
                styles.fill,
                { width: `${max > 0 ? (item.total / max) * 100 : 0}%`, backgroundColor: item.color },
              ]}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** The same breakdown as a table, with child rows indented under each item. */
export function BreakdownTable({ items, formatValue }: BreakdownProps) {
  const theme = useTheme();
  const { isLargeText } = useFontScale();
  const rows = items.flatMap((item) => [
    { item, child: false },
    ...(item.children ?? []).map((child) => ({ item: child, child: true })),
  ]);

  // With large text the four columns can not fit side by side, so each row
  // stacks: the name on its own line, then count · amount · share.
  if (isLargeText) {
    return (
      <View>
        {rows.map(({ item, child }) => (
          <Pressable
            key={`${child ? 'c' : 'p'}-${item.key}`}
            disabled={!item.onPress}
            onPress={item.onPress}
            style={[styles.stackedRow, child && styles.indent, { borderBottomColor: theme.backgroundSelected }]}>
            <View style={styles.nameCell}>
              <View style={[child ? styles.swatchSmall : styles.swatch, { backgroundColor: item.color }]} />
              <ThemedText type={child ? 'small' : 'smallBold'} style={styles.name}>
                {item.name}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {tn(item.count, '{count} transaction', '{count} transactions')} · {formatValue(item.total)} ·{' '}
              {formatPercent(item.percentage)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colName}>
          {t('Category')}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colCount}>
          {t('Txns')}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colAmount}>
          {t('Amount')}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colPercent}>
          %
        </ThemedText>
      </View>
      {rows.map(({ item, child }) => (
        <Pressable
          key={`${child ? 'c' : 'p'}-${item.key}`}
          disabled={!item.onPress}
          onPress={item.onPress}
          style={[styles.tableRow, { borderBottomColor: theme.backgroundSelected }]}>
          <View style={[styles.colName, styles.nameCell, child && styles.indent]}>
            <View style={[child ? styles.swatchSmall : styles.swatch, { backgroundColor: item.color }]} />
            <ThemedText type="small" themeColor={child ? 'textSecondary' : 'text'} numberOfLines={1} style={styles.name}>
              {item.name}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.colCount}>
            {item.count}
          </ThemedText>
          <ThemedText type={child ? 'small' : 'smallBold'} style={styles.colAmount}>
            {formatValue(item.total)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.colPercent}>
            {formatPercent(item.percentage)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export type TableRow = { key: string; label: string; value: number; muted?: boolean };

/** A two-column label/amount table, e.g. spending per day. */
export function ValueTable({
  title,
  rows,
  formatValue,
  total,
}: {
  title: string;
  rows: TableRow[];
  formatValue: (value: number) => string;
  total?: number;
}) {
  const theme = useTheme();
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colName}>
          {title}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colAmount}>
          {t('Amount')}
        </ThemedText>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.tableRow, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor={row.muted ? 'textSecondary' : 'text'} style={styles.colName}>
            {row.label}
          </ThemedText>
          <ThemedText
            type={row.muted ? 'small' : 'smallBold'}
            themeColor={row.muted ? 'textSecondary' : 'text'}
            style={styles.colAmount}>
            {formatValue(row.value)}
          </ThemedText>
        </View>
      ))}
      {total !== undefined ? (
        <View style={styles.tableRow}>
          <ThemedText type="smallBold" style={styles.colName}>
            {t('Total')}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.colAmount}>
            {formatValue(total)}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function formatPercent(value: number): string {
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  // 2px gaps between share segments; rounded ends on the whole bar.
  shareBar: { flexDirection: 'row', height: 12, gap: 2, borderRadius: 4, overflow: 'hidden' },
  row: { gap: Spacing.one },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchSmall: { width: 6, height: 6, borderRadius: 2 },
  name: { flex: 1 },
  percent: { minWidth: 40, textAlign: 'right' },
  track: { height: 8, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  tableHead: { paddingBottom: Spacing.one },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  indent: { paddingLeft: Spacing.three },
  colName: { flex: 1 },
  // Minimum, not fixed, widths: a column grows with the text instead of
  // splitting a number such as "100%" across lines.
  colCount: { minWidth: 40, textAlign: 'right' },
  colAmount: { minWidth: 96, textAlign: 'right' },
  colPercent: { minWidth: 44, textAlign: 'right' },
  stackedRow: { gap: 2, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
