import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { DateField } from '@/components/ui/date-field';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { useTransactions } from '@/hooks/use-transactions';
import type { Transaction, TransactionListParams, TransactionType } from '@/lib/api/types';
import { addDays, addMonths, toISODate, today } from '@/lib/dates';
import { formatDayHeading } from '@/lib/format';
import { categoryName, t, tn } from '@/lib/i18n';
import { rangeLabel, type DateRange } from '@/lib/report-period';
import { translatedCategoryMatches } from '@/lib/transaction-search';

type TypeFilter = 'all' | TransactionType;
type RangeFilter = 'any' | 'this-month' | 'last-month' | '30-days' | 'custom';

const ALL = 'all';

function firstOfThisMonth() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** Where the custom range starts before the user picks: this month so far. */
function defaultCustomRange(): DateRange {
  return { from: firstOfThisMonth(), to: today() };
}

function rangeFor(range: RangeFilter, custom: DateRange): Pick<TransactionListParams, 'from' | 'to'> {
  const firstOfMonth = firstOfThisMonth();
  switch (range) {
    case 'this-month':
      return { from: firstOfMonth, to: today() };
    case 'last-month':
      return { from: addMonths(firstOfMonth, -1), to: addDays(firstOfMonth, -1) };
    case '30-days':
      return { from: addDays(today(), -29), to: today() };
    case 'custom':
      return custom;
    default:
      return {};
  }
}

/** Debounce a value so typing does not fire a request per keystroke. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const accounts = useAccounts();
  const categories = useCategories();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [accountId, setAccountId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [range, setRange] = useState<RangeFilter>('any');
  const [custom, setCustom] = useState<DateRange>(defaultCustomRange);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounced(search.trim());
  const todayISO = today();

  // The API matches stored names; Thai names of system categories only exist
  // here, so matching ones go along as IDs.
  const searchCategories = debouncedSearch ? translatedCategoryMatches(debouncedSearch, categories.data ?? []) : [];
  const filters: TransactionListParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(searchCategories.length > 0 ? { search_categories: searchCategories.join(',') } : {}),
    ...(type !== 'all' ? { type } : {}),
    ...(accountId !== ALL ? { account: accountId } : {}),
    ...(categoryId !== ALL ? { category: categoryId } : {}),
    ...rangeFor(range, custom),
  };
  const transactions = useTransactions(filters);
  const activeCount = [type !== 'all', accountId !== ALL, categoryId !== ALL, range !== 'any'].filter(Boolean).length;
  const filtering = activeCount > 0 || !!debouncedSearch;
  const clearLabel = !debouncedSearch
    ? t('Clear filters')
    : activeCount > 0
      ? t('Clear search and filters')
      : t('Clear search');

  const categoryOptions = (categories.data ?? []).filter(
    (category) => type === 'all' || type === 'transfer' || category.type === type,
  );

  const clearFilters = () => {
    setType('all');
    setAccountId(ALL);
    setCategoryId(ALL);
    setRange('any');
    setCustom(defaultCustomRange());
    setSearch('');
  };

  // Infinite scroll: fetch the next page as the bottom comes into view. The
  // guard matters because scroll events keep firing while a page loads.
  const loadMore = () => {
    if (transactions.hasNextPage && !transactions.isFetchingNextPage && !transactions.isFetching) {
      transactions.fetchNextPage();
    }
  };

  // The API returns newest first, so grouping in order keeps days sorted.
  const groups = (transactions.data?.items ?? []).reduce<{ day: string; items: Transaction[] }[]>(
    (acc, transaction) => {
      const day = toISODate(new Date(transaction.occurred_at));
      const last = acc[acc.length - 1];
      if (last?.day === day) last.items.push(transaction);
      else acc.push({ day, items: [transaction] });
      return acc;
    },
    [],
  );

  return (
    <Screen
      edges={['bottom']}
      refreshing={transactions.isRefetching && !transactions.isFetchingNextPage}
      onRefresh={transactions.refetch}
      onEndReached={loadMore}>
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('Search notes, categories, accounts, or amounts')}
            placeholderTextColor={theme.textSecondary}
            maxFontSizeMultiplier={FontScaleCap.body}
            accessibilityLabel={t('Search notes, categories, accounts, or amounts')}
            accessibilityHint={t('Search looks in notes, categories, accounts, tags, and amounts.')}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Filters')}
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters((open) => !open)}
          style={[
            styles.filterButton,
            { backgroundColor: activeCount > 0 ? theme.tintFill : theme.surface, borderColor: activeCount > 0 ? theme.tintFill : theme.border },
          ]}>
          <Ionicons name="options-outline" size={20} color={activeCount > 0 ? '#ffffff' : theme.text} />
          {activeCount > 0 ? <ThemedText style={styles.filterCount}>{activeCount}</ThemedText> : null}
        </Pressable>
      </View>

      {showFilters ? (
        <Card style={styles.filters}>
          <SegmentedControl
            options={[
              { value: 'all', label: t('All') },
              { value: 'expense', label: t('Expense') },
              { value: 'income', label: t('Income') },
              { value: 'transfer', label: t('Transfer') },
            ]}
            value={type}
            onChange={(next) => {
              setType(next);
              setCategoryId(ALL); // categories are per type
            }}
          />
          <ChipSelect
            scroll
            label={t('When')}
            options={[
              { value: 'any', label: t('Any time') },
              { value: 'this-month', label: t('This month') },
              { value: 'last-month', label: t('Last month') },
              { value: '30-days', label: t('Last 30 days') },
              { value: 'custom', label: t('Custom') },
            ]}
            value={range}
            onChange={setRange}
          />
          {range === 'custom' ? (
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
          ) : null}
          <ChipSelect
            scroll
            label={t('Account')}
            options={[{ value: ALL, label: t('All') }, ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
            value={accountId}
            onChange={setAccountId}
          />
          {type !== 'transfer' ? (
            <ChipSelect
              scroll
              label={t('Category')}
              options={[
                { value: ALL, label: t('All') },
                ...categoryOptions.map((c) => ({ value: c.id, label: categoryName(c.name) })),
              ]}
              value={categoryId}
              onChange={setCategoryId}
            />
          ) : null}
        </Card>
      ) : null}

      {filtering && transactions.data ? (
        <View style={styles.summaryRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {tn(transactions.data.total, '{count} match', '{count} matches')}
            {/* The panel may be closed, so say which days a custom range covers. */}
            {range === 'custom' ? ` · ${rangeLabel('custom', custom, todayISO)}` : ''}
          </ThemedText>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={clearFilters}>
            <ThemedText type="smallBold" themeColor="tint">
              {t('Clear')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <QueryState isPending={transactions.isPending} error={transactions.error} onRetry={transactions.refetch} />

      {transactions.data?.total === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name={filtering ? 'search' : 'receipt-outline'} size={28} color={theme.textSecondary} />
          {debouncedSearch ? (
            <>
              <ThemedText type="smallBold" style={styles.center}>
                {t('No results for “{query}”', { query: debouncedSearch })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {activeCount > 0
                  ? t('Search looks in notes, categories, accounts, tags, and amounts, within the filters you set.')
                  : t('Search looks in notes, categories, accounts, tags, and amounts.')}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {filtering ? t('Nothing matches these filters.') : t('No transactions yet. Tap + to add one.')}
            </ThemedText>
          )}
          {filtering ? (
            <Button title={clearLabel} variant="secondary" onPress={clearFilters} />
          ) : null}
        </Card>
      ) : null}

      {groups.map((group) => (
        <View key={group.day} style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.day}>
            {formatDayHeading(group.items[0].occurred_at)}
          </ThemedText>
          <Card style={styles.card}>
            {group.items.map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
                <TransactionRow transaction={transaction} hideDate />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {transactions.isFetchingNextPage ? (
        <ActivityIndicator accessibilityLabel={t('Loading more')} style={styles.more} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 46,
    minHeight: 46,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterCount: { color: '#ffffff', fontSize: 14, fontWeight: 700 },
  filters: { gap: Spacing.three },
  customRange: { gap: Spacing.two },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  group: { gap: Spacing.two },
  day: { marginLeft: Spacing.three },
  card: { gap: 0, paddingVertical: Spacing.two },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 42 + Spacing.three },
  more: { paddingVertical: Spacing.three },
});
