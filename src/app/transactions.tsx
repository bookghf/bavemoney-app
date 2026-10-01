import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useTransactions } from '@/hooks/use-transactions';
import type { Transaction, TransactionListParams, TransactionType } from '@/lib/api/types';
import { addDays, addMonths, toISODate, today } from '@/lib/dates';
import { formatDayHeading } from '@/lib/format';
import { categoryName, t, tn } from '@/lib/i18n';

type TypeFilter = 'all' | TransactionType;
type RangeFilter = 'any' | 'this-month' | 'last-month' | '30-days';

const ALL = 'all';

function rangeFor(range: RangeFilter): Pick<TransactionListParams, 'from' | 'to'> {
  const now = new Date();
  const firstOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  switch (range) {
    case 'this-month':
      return { from: firstOfMonth, to: today() };
    case 'last-month':
      return { from: addMonths(firstOfMonth, -1), to: addDays(firstOfMonth, -1) };
    case '30-days':
      return { from: addDays(today(), -29), to: today() };
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
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounced(search.trim());

  const filters: TransactionListParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(type !== 'all' ? { type } : {}),
    ...(accountId !== ALL ? { account: accountId } : {}),
    ...(categoryId !== ALL ? { category: categoryId } : {}),
    ...rangeFor(range),
  };
  const transactions = useTransactions(filters);
  const activeCount = [type !== 'all', accountId !== ALL, categoryId !== ALL, range !== 'any'].filter(Boolean).length;
  const filtering = activeCount > 0 || !!debouncedSearch;

  const categoryOptions = (categories.data ?? []).filter(
    (category) => type === 'all' || type === 'transfer' || category.type === type,
  );

  const clearFilters = () => {
    setType('all');
    setAccountId(ALL);
    setCategoryId(ALL);
    setRange('any');
    setSearch('');
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
    <Screen edges={['bottom']} refreshing={transactions.isRefetching} onRefresh={transactions.refetch}>
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('Search notes')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('Search notes')}
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
            { backgroundColor: activeCount > 0 ? theme.tint : theme.surface, borderColor: activeCount > 0 ? theme.tint : theme.border },
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
            ]}
            value={range}
            onChange={setRange}
          />
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {filtering ? t('Nothing matches these filters.') : t('No transactions yet. Tap + to add one.')}
          </ThemedText>
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

      {transactions.hasNextPage ? (
        <Button
          title={t('Load more')}
          variant="secondary"
          loading={transactions.isFetchingNextPage}
          onPress={() => transactions.fetchNextPage()}
        />
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
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  group: { gap: Spacing.two },
  day: { marginLeft: Spacing.three },
  card: { gap: 0, paddingVertical: Spacing.two },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 42 + Spacing.three },
});
