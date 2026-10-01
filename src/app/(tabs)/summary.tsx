import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PieChart, type pieDataItem } from 'react-native-gifted-charts';

import { BreakdownChart, BreakdownTable, ValueTable, formatPercent, type BreakdownItem } from '@/components/charts/breakdown';
import { ColumnChart } from '@/components/charts/column-chart';
import { PieLegend, foldSlices } from '@/components/charts/pie-legend';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { DateField } from '@/components/ui/date-field';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { seriesColor } from '@/constants/chart-colors';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useChartPalette } from '@/hooks/use-chart-palette';
import { useReportSummary } from '@/hooks/use-reports';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryType, ReportPeriod, ReportSummaryParams } from '@/lib/api/types';
import { addDays, daysBetween, today, type ISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { bucketDays, periodRange, rangeLabel, stepPeriod, type DateRange } from '@/lib/report-period';
import { useAuthStore } from '@/store/auth-store';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
] as const satisfies readonly { value: ReportPeriod; label: string }[];

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Spending' },
  { value: 'income', label: 'Income' },
] as const satisfies readonly { value: CategoryType; label: string }[];

const VIEW_OPTIONS = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
] as const;

const SHAPE_OPTIONS = [
  { value: 'pie', label: 'Pie' },
  { value: 'bars', label: 'Bars' },
] as const;

const ALL = 'all';

/** Option labels are English keys; translate them at render time. */
function translate<T extends string>(options: readonly { value: T; label: string }[]) {
  return options.map((option) => ({ value: option.value, label: t(option.label) }));
}
const PIE_RADIUS = 110;

export default function SummaryScreen() {
  const theme = useTheme();
  const palette = useChartPalette();
  const currency = useAuthStore((state) => state.user?.default_currency) || 'THB';
  const todayISO = today();

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [anchor, setAnchor] = useState<ISODate>(todayISO);
  const [custom, setCustom] = useState<DateRange>({ from: addDays(todayISO, -6), to: todayISO });
  const [type, setType] = useState<CategoryType>('expense');
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [subcategoryId, setSubcategoryId] = useState<string>(ALL);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [shape, setShape] = useState<'pie' | 'bars'>('pie');
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);

  const range = period === 'custom' ? custom : periodRange(period, anchor);
  const canGoNext = period !== 'custom' && periodRange(period, stepPeriod(period, anchor, 1)).from <= todayISO;

  const categories = useCategories();
  const topCategories = (categories.data ?? []).filter((category) => category.type === type);
  const selectedCategory = topCategories.find((category) => category.id === categoryId);
  const subcategories = selectedCategory?.children ?? [];
  const selectedSubcategory = subcategories.find((category) => category.id === subcategoryId);

  const params: ReportSummaryParams = {
    period,
    ...(period === 'custom' ? { from: custom.from, to: custom.to } : { date: anchor }),
    type,
    currency,
    category_id: selectedSubcategory?.id ?? selectedCategory?.id,
  };
  const summary = useReportSummary(params);
  const data = summary.data;

  const money = (value: number) => formatMoney(value, currency);
  const total = Number.parseFloat((type === 'expense' ? data?.total_expense : data?.total_income) ?? '0') || 0;
  // Average over the days that have happened so far within the range.
  const elapsedDays = Math.max(1, daysBetween(range.from, range.to < todayISO ? range.to : todayISO) + 1);
  const { unit, buckets } = bucketDays(data?.daily_breakdown ?? []);
  const series = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    axisLabel: bucket.axisLabel,
    value: type === 'expense' ? bucket.expense : bucket.income,
  }));

  // Color follows the category (its position in the category list), never
  // its rank in this report, so filtering never repaints the survivors.
  const slotOf = (id: string) => topCategories.findIndex((category) => category.id === id);
  const pickCategory = (id: string) => {
    setCategoryId(id);
    setSubcategoryId(ALL);
  };

  const breakdown: BreakdownItem[] = (data?.by_category ?? []).flatMap((entry) => {
    const color = seriesColor(palette, entry.category.id ? slotOf(entry.category.id) : -1);
    const children: BreakdownItem[] = entry.subcategories.map((sub) => {
      const childSlot = sub.id ? (selectedCategory?.children ?? []).findIndex((c) => c.id === sub.id) : -1;
      return {
        key: sub.id || `${entry.category.id}-other`,
        name: sub.id ? categoryName(sub.name) : t('Other'),
        total: Number.parseFloat(sub.total) || 0,
        percentage: sub.percentage,
        count: sub.transaction_count,
        // Inside one category, subcategories get their own slots.
        color: selectedCategory ? seriesColor(palette, childSlot) : color,
        onPress: sub.id && !selectedSubcategory ? () => {
          setCategoryId(entry.category.id);
          setSubcategoryId(sub.id);
        } : undefined,
      };
    });
    // Filtered to one category: break it down by its subcategories instead.
    if (selectedCategory && !selectedSubcategory && children.length > 0) return children;
    return [
      {
        key: entry.category.id || 'uncategorized',
        name: !entry.category.id
          ? t('Uncategorized')
          : selectedSubcategory
            ? `${categoryName(entry.category.name)} › ${categoryName(selectedSubcategory.name)}`
            : categoryName(entry.category.name),
        total: Number.parseFloat(entry.total) || 0,
        percentage: entry.percentage,
        count: entry.transaction_count,
        color,
        children: selectedCategory ? [] : children,
        onPress: entry.category.id && !selectedCategory ? () => pickCategory(entry.category.id) : undefined,
      },
    ];
  });

  const typeNoun = type === 'expense' ? t('Spent') : t('Received');

  // Pie slices: largest first, tail folded into "N more". The selection is
  // keyed by slice, so it drops away by itself when the slice disappears.
  const slices = foldSlices(breakdown, palette.neutral);
  const sliceSum = slices.reduce((acc, slice) => acc + slice.total, 0);
  const focusedIndex = slices.findIndex((slice) => slice.key === selectedSlice);
  const focused = focusedIndex >= 0 ? slices[focusedIndex] : null;
  const toggleSlice = (key: string | null) => setSelectedSlice((current) => (current === key ? null : key));
  const pieData: pieDataItem[] = slices.map((slice) => ({ value: slice.total, color: slice.color }));
  const filterLabel = categoryName(selectedSubcategory?.name ?? selectedCategory?.name ?? '') || undefined;

  return (
    <Screen inTabs refreshing={summary.isRefetching && !summary.isPlaceholderData} onRefresh={summary.refetch}>
      <ScreenHeader title={t('Summary')} />

      <SegmentedControl
        options={translate(TYPE_OPTIONS)}
        value={type}
        onChange={(next) => {
          setType(next);
          pickCategory(ALL); // categories are per type
        }}
      />

      <Card>
        <SegmentedControl options={translate(PERIOD_OPTIONS)} value={period} onChange={setPeriod} />
        {period === 'custom' ? (
          <View style={styles.customRange}>
            <DateField
              label={t('From')}
              value={custom.from}
              maxDate={todayISO}
              range={custom}
              onChange={(from) => setCustom((current) => ({ from, to: current.to < from ? from : current.to }))}
            />
            <DateField
              label={t('To')}
              value={custom.to}
              maxDate={todayISO}
              minDate={custom.from}
              range={custom}
              onChange={(to) => setCustom((current) => ({ ...current, to }))}
            />
          </View>
        ) : (
          <View style={styles.stepper}>
            <StepButton icon="chevron-back" label={t('Previous period')} onPress={() => setAnchor(stepPeriod(period, anchor, -1))} />
            <ThemedText type="smallBold" style={styles.stepperLabel}>
              {rangeLabel(period, range, todayISO)}
            </ThemedText>
            <StepButton
              icon="chevron-forward"
              label={t('Next period')}
              disabled={!canGoNext}
              onPress={() => setAnchor(stepPeriod(period, anchor, 1))}
            />
          </View>
        )}
        {period === 'month' || period === 'year' ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {rangeLabel('custom', range, todayISO)}
          </ThemedText>
        ) : null}
      </Card>

      {topCategories.length > 0 ? (
        <View style={styles.filters}>
          <ChipSelect
            scroll
            label={t('Category')}
            options={[{ value: ALL, label: t('All') }, ...topCategories.map((c) => ({ value: c.id, label: categoryName(c.name) }))]}
            value={categoryId}
            onChange={pickCategory}
          />
          {subcategories.length > 0 ? (
            <ChipSelect
              scroll
              label={t('Subcategory')}
              options={[{ value: ALL, label: t('All') }, ...subcategories.map((c) => ({ value: c.id, label: categoryName(c.name) }))]}
              value={subcategoryId}
              onChange={setSubcategoryId}
            />
          ) : null}
        </View>
      ) : null}

      <QueryState isPending={summary.isPending} error={summary.error} onRetry={summary.refetch} />

      {data ? (
        <View style={[styles.results, summary.isPlaceholderData && styles.loading]}>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              {typeNoun}
              {filterLabel ? ` · ${filterLabel}` : ''} · {rangeLabel(period, range, todayISO)}
            </ThemedText>
            <ThemedText type="amount" themeColor={type === 'expense' ? 'danger' : 'success'} numberOfLines={1} adjustsFontSizeToFit>
              {money(total)}
            </ThemedText>
            <View style={styles.stats}>
              <Stat label={t('Transactions')} value={String(data.transaction_count)} />
              {range.from !== range.to ? <Stat label={t('Avg / day')} value={money(total / elapsedDays)} /> : null}
              {!filterLabel ? (
                <Stat
                  label={t('Net')}
                  value={money(Number.parseFloat(data.net) || 0)}
                  color={(Number.parseFloat(data.net) || 0) < 0 ? 'danger' : 'success'}
                />
              ) : null}
            </View>
          </Card>

          <SegmentedControl options={translate(VIEW_OPTIONS)} value={view} onChange={setView} />

          {range.from !== range.to ? (
            <Card>
              <ThemedText type="smallBold">
                {t(unit === 'day' ? '{noun} per day' : unit === 'week' ? '{noun} per week' : '{noun} per month', { noun: typeNoun })}
              </ThemedText>
              {view === 'chart' ? (
                <ColumnChart data={series} formatValue={money} color={type === 'expense' ? theme.danger : theme.success} />
              ) : (
                <ValueTable
                  title={unit === 'day' ? t('Date') : unit === 'week' ? t('Week') : t('Month')}
                  rows={series.map((s) => ({ key: s.key, label: s.label, value: s.value, muted: s.value === 0 }))}
                  formatValue={money}
                  total={total}
                />
              )}
            </Card>
          ) : null}

          <Card>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold" style={styles.flex}>
                {selectedCategory && !selectedSubcategory
                  ? t('{name} by subcategory', { name: categoryName(selectedCategory.name) })
                  : t('By category')}
              </ThemedText>
              {selectedCategory ? (
                <Pressable accessibilityRole="button" onPress={() => pickCategory(ALL)} hitSlop={8}>
                  <ThemedText type="small" style={{ color: theme.tint }}>
                    {t('Show all')}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {breakdown.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('Nothing recorded in this period.')}
              </ThemedText>
            ) : view === 'chart' ? (
              <>
                {breakdown.length > 1 ? (
                  <SegmentedControl options={translate(SHAPE_OPTIONS)} value={shape} onChange={setShape} />
                ) : null}
                {shape === 'pie' && breakdown.length > 1 ? (
                  <View style={styles.pie}>
                    <PieChart
                      data={pieData}
                      donut
                      radius={PIE_RADIUS}
                      innerRadius={PIE_RADIUS * 0.62}
                      innerCircleColor={theme.surface}
                      // 2px surface-colored seam separates neighbouring slices.
                      strokeWidth={2}
                      strokeColor={theme.surface}
                      focusOnPress
                      focusedPieIndex={focusedIndex}
                      onPress={(_item: pieDataItem, index: number) => toggleSlice(slices[index]?.key ?? null)}
                      centerLabelComponent={() => (
                        <View style={styles.pieCenter}>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
                            {focused ? focused.name : typeNoun}
                          </ThemedText>
                          <ThemedText type="smallBold" numberOfLines={1} style={[styles.center, styles.pieValue]}>
                            {money(focused ? focused.total : sliceSum)}
                          </ThemedText>
                          {focused ? (
                            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                              {formatPercent(focused.percentage)}
                            </ThemedText>
                          ) : null}
                        </View>
                      )}
                    />
                    <PieLegend
                      slices={slices}
                      selectedKey={focused?.key ?? null}
                      onSelect={toggleSlice}
                      formatValue={money}
                    />
                  </View>
                ) : (
                  <BreakdownChart items={breakdown} formatValue={money} />
                )}
                {breakdown.some((item) => item.onPress) ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {shape === 'pie' && breakdown.length > 1
                      ? t('Tap a slice or row to highlight it, tap the row again to drill in.')
                      : t('Tap a row to drill in.')}
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <BreakdownTable items={breakdown} formatValue={money} />
            )}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.stepButton, { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.35 : 1 }]}>
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'success' | 'danger' }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={color}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  customRange: { gap: Spacing.two },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperLabel: { flex: 1, textAlign: 'center' },
  stepButton: { padding: Spacing.two, borderRadius: 999 },
  center: { textAlign: 'center' },
  filters: { gap: Spacing.two },
  results: { gap: Spacing.three },
  loading: { opacity: 0.6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  stat: { gap: Spacing.half },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  pie: { gap: Spacing.three, alignItems: 'center' },
  pieCenter: { alignItems: 'center', maxWidth: PIE_RADIUS * 1.1 },
  pieValue: { fontSize: 16, lineHeight: 22 },
});
