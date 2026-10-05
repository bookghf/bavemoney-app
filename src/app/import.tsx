import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { IconBadge } from '@/components/ui/icon-badge';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { sampleRecords, useSampleCSV, useTransactionsBetween } from '@/hooks/use-import';
import { useTheme } from '@/hooks/use-theme';
import { api, getErrorMessage } from '@/lib/api/client';
import type { Category } from '@/lib/api/types';
import {
  dayRange,
  detectColumns,
  findDuplicates,
  importTag,
  occurredAt,
  parseCSV,
  resolveCategories,
  rowDay,
  toDraftRows,
  type ColumnMap,
  type DraftRow,
  type ParseResult,
  type RowProblem,
} from '@/lib/csv';
import { formatDay } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { sumAmounts } from '@/lib/money';

/**
 * The API takes at most this many rows per request, all or nothing. Larger
 * files are sent in parts of this size.
 */
const MAX_ROWS = 2000;

/** Preview rows rendered at first, and how many more each "show more" adds. */
const PREVIEW_STEP = 50;

type Loaded = { fileName: string; parsed: ParseResult; columns: ColumnMap };

type Filter = 'all' | 'duplicates' | 'excluded';

export default function ImportScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const sample = useSampleCSV();
  const active = (accounts.data ?? []).filter((a) => !a.is_archived);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<unknown>(null);
  /** Rows saved before a later part of a multi-part import failed. */
  const [partial, setPartial] = useState<{ done: number; total: number } | null>(null);
  // Rows the user ticked or unticked; the rest follow the defaults below.
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PREVIEW_STEP);

  const account = active.find((a) => a.id === accountId) ?? active[0];
  const rows = useMemo(() => loaded?.parsed.rows ?? [], [loaded]);
  const range = useMemo(() => dayRange(rows), [rows]);
  const existing = useTransactionsBetween(range);
  const resolutions = useMemo(() => resolveCategories(rows, categories.data ?? []), [rows, categories.data]);
  const missing = resolutions.filter((r) => !r.topId || (r.sub && !r.subId));
  const resolutionFor = (row: DraftRow) =>
    resolutions.find((x) => x.key === `${row.type}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`);

  const duplicates = useMemo(
    () =>
      findDuplicates(rows, existing.data ?? [], (row) => {
        const r = resolutions.find((x) => x.key === `${row.type}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`);
        return r?.subId ?? r?.topId;
      }),
    [rows, existing.data, resolutions],
  );
  const isIncluded = (row: DraftRow) => overrides.get(row.line) ?? (duplicates.has(row.line) ? includeDuplicates : true);
  const included = rows.filter(isIncluded);
  const expense = sumAmounts(included.filter((r) => r.type === 'expense').map((r) => r.amount));
  const income = sumAmounts(included.filter((r) => r.type === 'income').map((r) => r.amount));
  const parts = Math.ceil(included.length / MAX_ROWS);
  const checking = !!range && existing.isPending;

  const visible = rows.filter((row) =>
    filter === 'duplicates' ? duplicates.has(row.line) : filter === 'excluded' ? !isIncluded(row) : true,
  );

  const toggle = (row: DraftRow) => {
    haptics.selection();
    setOverrides((current) => new Map(current).set(row.line, !isIncluded(row)));
  };

  const setDuplicatesIncluded = (value: boolean) => {
    setIncludeDuplicates(value);
    // The switch decides for every duplicate, including ones ticked by hand.
    setOverrides((current) => new Map([...current].filter(([line]) => !duplicates.has(line))));
  };

  const pick = async () => {
    setReadError(null);
    setImportError(null);
    setPartial(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'public.comma-separated-values-text'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const records = parseCSV(await new File(asset.uri).text());
      const columns = records.length > 1 ? detectColumns(records[0]) : null;
      if (!columns) {
        setLoaded(null);
        setReadError(t('This file has no date and amount columns. Use a CSV with a header row.'));
        return;
      }
      setLoaded({ fileName: asset.name, parsed: toDraftRows(records, columns), columns });
      setOverrides(new Map());
      setIncludeDuplicates(false);
      setFilter('all');
      setShown(PREVIEW_STEP);
      haptics.selection();
    } catch (error) {
      setReadError(getErrorMessage(error));
    }
  };

  const runImport = async () => {
    if (!loaded || !account || importing || included.length === 0) return;
    setImporting(true);
    setImportError(null);
    setPartial(null);
    let done = 0;
    try {
      // Create the categories the file mentions but the user does not have.
      const created = new Map<string, string>(); // "type|top" or "type|top|sub" -> id
      if (createMissing) {
        for (const r of missing) {
          // Only for rows that are being imported.
          if (!included.some((row) => resolutionFor(row) === r)) continue;
          let topId = r.topId ?? created.get(`${r.type}|${r.top.toLowerCase()}`);
          if (!topId) {
            const { data } = await api.post<Category>('/categories', { name: r.top.trim(), type: r.type });
            topId = data.id;
            created.set(`${r.type}|${r.top.toLowerCase()}`, topId);
          }
          if (r.sub && !r.subId) {
            const { data } = await api.post<Category>('/categories', { name: r.sub.trim(), type: r.type, parent_id: topId });
            created.set(r.key, data.id);
          }
        }
      }
      const categoryFor = (row: DraftRow) => {
        if (!row.category) return undefined;
        const r = resolutionFor(row);
        if (!r) return undefined;
        return r.subId ?? created.get(r.key) ?? r.topId ?? created.get(`${r.type}|${r.top.toLowerCase()}`);
      };
      const accountFor = (row: DraftRow) =>
        (row.account && active.find((a) => a.name.toLowerCase() === row.account.toLowerCase())?.id) || account.id;

      // Times are spread over the whole file's rows, so a row keeps the same
      // time whether or not its neighbors are left out.
      const perDay = new Map<string, number>();
      const indexInDay = new Map<number, number>();
      for (const row of rows) {
        const index = perDay.get(rowDay(row)) ?? 0;
        perDay.set(rowDay(row), index + 1);
        indexInDay.set(row.line, index);
      }
      const payload = included.map((row) => ({
        account_id: accountFor(row),
        category_id: categoryFor(row),
        type: row.type,
        amount: row.amount,
        note: row.note,
        occurred_at: occurredAt(row, indexInDay.get(row.line) ?? 0),
      }));
      for (let start = 0; start < payload.length; start += MAX_ROWS) {
        const { data } = await api.post<{ imported: number }>('/transactions/import', {
          account_id: account.id,
          tag: importTag(loaded.fileName),
          rows: payload.slice(start, start + MAX_ROWS),
        });
        done += data.imported;
      }
      await queryClient.invalidateQueries();
      haptics.success();
      toast.success(t('Imported {count} transactions', { count: done }));
      router.back();
    } catch (error) {
      haptics.warning();
      setImportError(error);
      if (done > 0) {
        setPartial({ done, total: included.length });
        await queryClient.invalidateQueries();
      }
    } finally {
      setImporting(false);
    }
  };

  const currency = account?.currency;
  const sampleTable = sampleRecords().slice(0, 2);

  return (
    <Screen
      edges={['bottom']}
      footer={
        loaded ? (
          <>
            <ErrorText error={importError} />
            {partial ? (
              <ThemedText type="small" themeColor="danger">
                {t('{done} of {total} rows were imported before the error. Choose the file again: those rows will show as duplicates.', partial)}
              </ThemedText>
            ) : null}
            <Button
              title={tn(included.length, 'Import {count} transaction', 'Import {count} transactions')}
              onPress={runImport}
              loading={importing}
              disabled={included.length === 0 || !account || checking}
            />
            <Button title={t('Choose another file')} variant="secondary" onPress={pick} disabled={importing} />
          </>
        ) : (
          <Button title={t('Choose CSV file')} onPress={pick} />
        )
      }>
      {!loaded ? (
        <Card style={styles.intro}>
          <IconBadge icon="document-text" size={52} />
          <ThemedText type="sectionTitle">{t('Bring in your spending history')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Save your Google Sheet or Excel file as CSV, one row per transaction:')}
          </ThemedText>

          <View style={[styles.table, { borderColor: theme.border }]}>
            {sampleTable.map((record, r) => (
              <View
                key={r}
                style={[styles.tableRow, r === 0 && { backgroundColor: theme.backgroundElement }, r > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                {record.map((value, c) => (
                  <ThemedText
                    key={c}
                    type={r === 0 ? 'smallBold' : 'small'}
                    numberOfLines={1}
                    style={[styles.tableCell, c === record.length - 1 && styles.amountCell]}>
                    {value}
                  </ThemedText>
                ))}
              </View>
            ))}
          </View>

          <ColumnChips label={t('Required')} names={[t('Date'), t('Amount')]} required />
          <ColumnChips label={t('Optional')} names={[t('Item'), t('Category'), t('Type'), t('Account')]} />

          <ThemedText type="small" themeColor="textSecondary">
            {t('Thai headers and dates like 30/07/2569 work. A date on the first row of each day is enough.')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Up to 2,000 rows go in one import. Larger files are sent in parts of 2,000.')}
          </ThemedText>
          <Button title={t('Download sample file')} variant="secondary" onPress={() => sample.mutate()} loading={sample.isPending} style={styles.stretch} />
          <ErrorText error={sample.error} />
          {readError ? (
            <ThemedText type="small" themeColor="danger">
              {readError}
            </ThemedText>
          ) : null}
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.fileRow}>
              <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
              <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                {loaded.fileName}
              </ThemedText>
            </View>
            <ThemedText type="sectionTitle">
              {included.length === rows.length
                ? tn(rows.length, '{count} transaction', '{count} transactions')
                : t('{count} of {total} rows', { count: included.length, total: rows.length })}
            </ThemedText>
            {range ? (
              <ThemedText type="small" themeColor="textSecondary">
                {range.from === range.to
                  ? formatDay(range.from, { year: 'numeric' })
                  : `${formatDay(range.from, { year: 'numeric' })} – ${formatDay(range.to, { year: 'numeric' })}`}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="danger">
              {t('Spending')} {formatMoney(expense, currency)}
            </ThemedText>
            {income !== '0.00' ? (
              <ThemedText type="small" themeColor="success">
                {t('Income')} {formatMoney(income, currency)}
              </ThemedText>
            ) : null}
          </Card>

          {checking ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('Checking for transactions you already have…')}
            </ThemedText>
          ) : existing.isError ? (
            <Card style={[styles.notice, { backgroundColor: theme.warningSoft }]}>
              <Ionicons name="warning" size={20} color={theme.warning} />
              <ThemedText type="small" style={styles.flex}>
                {t('Could not check for duplicates. Review the rows before importing.')}
              </ThemedText>
              <Button title={t('Retry')} variant="secondary" onPress={() => existing.refetch()} />
            </Card>
          ) : duplicates.size > 0 ? (
            <Card style={{ backgroundColor: theme.warningSoft }}>
              <View style={styles.notice}>
                <Ionicons name="copy-outline" size={20} color={theme.warning} />
                <ThemedText type="small" style={styles.flex}>
                  {tn(
                    duplicates.size,
                    '{count} row looks like a transaction you already have (same day, amount, and item or category). It is left out.',
                    '{count} rows look like transactions you already have (same day, amount, and item or category). They are left out.',
                  )}
                </ThemedText>
              </View>
              <View style={styles.toggle}>
                <ThemedText type="small" style={styles.flex}>
                  {t('Import likely duplicates too')}
                </ThemedText>
                <Switch value={includeDuplicates} onValueChange={setDuplicatesIncluded} />
              </View>
            </Card>
          ) : null}

          {parts > 1 ? (
            <Card style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="layers-outline" size={20} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.flex}>
                {t('One import takes up to 2,000 rows, so these go in {parts} parts. Each part is saved whole or not at all; if one fails, the parts before it stay imported.', { parts })}
              </ThemedText>
            </Card>
          ) : null}

          {rows.length > 0 ? (
            <Card style={styles.preview}>
              <ThemedText type="smallBold">{t('Rows to import')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Tap a row to leave it out or bring it back.')}
              </ThemedText>
              {duplicates.size > 0 || included.length < rows.length ? (
                <ChipSelect
                  scroll
                  options={[
                    { value: 'all' as const, label: t('All ({count})', { count: rows.length }) },
                    ...(duplicates.size > 0
                      ? [{ value: 'duplicates' as const, label: t('Likely duplicates ({count})', { count: duplicates.size }) }]
                      : []),
                    { value: 'excluded' as const, label: t('Left out ({count})', { count: rows.length - included.length }) },
                  ]}
                  value={filter}
                  onChange={(value) => {
                    setFilter(value);
                    setShown(PREVIEW_STEP);
                  }}
                />
              ) : null}
              {visible.slice(0, shown).map((row) => (
                <PreviewRow
                  key={row.line}
                  row={row}
                  currency={currency}
                  included={isIncluded(row)}
                  duplicate={duplicates.has(row.line)}
                  showAccount={loaded.columns.account !== undefined}
                  onPress={() => toggle(row)}
                />
              ))}
              {visible.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('No rows here.')}
                </ThemedText>
              ) : null}
              {visible.length > shown ? (
                <Button
                  title={t('Show {count} more', { count: Math.min(PREVIEW_STEP * 4, visible.length - shown) })}
                  variant="secondary"
                  onPress={() => setShown((n) => n + PREVIEW_STEP * 4)}
                />
              ) : null}
            </Card>
          ) : null}

          {loaded.parsed.problems.length > 0 || loaded.parsed.skippedTransfers > 0 ? (
            <Card>
              <ThemedText type="smallBold">{t('Can not be imported')}</ThemedText>
              {loaded.parsed.skippedTransfers > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {tn(loaded.parsed.skippedTransfers, '{count} transfer (add transfers in the app)', '{count} transfers (add transfers in the app)')}
                </ThemedText>
              ) : null}
              {loaded.parsed.problems.slice(0, 5).map((problem) => (
                <ThemedText key={problem.line} type="small" themeColor="textSecondary">
                  {t('Line {line}: {message}', { line: problem.line, message: problemText(problem) })}
                </ThemedText>
              ))}
              {loaded.parsed.problems.length > 5 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('…and {count} more', { count: loaded.parsed.problems.length - 5 })}
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          <ChipSelect
            scroll
            label={t('Into account')}
            options={active.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
            value={account?.id ?? null}
            onChange={setAccountId}
          />
          <Detected rows={included} columns={loaded.columns} accounts={active.map((a) => a.name)} fallback={account?.name} />

          {resolutions.length > 0 ? (
            <Card style={styles.categories}>
              <ThemedText type="smallBold">{t('Categories')}</ThemedText>
              {resolutions.map((r) => {
                const isNew = !r.topId || (r.sub && !r.subId);
                return (
                  <View key={r.key} style={styles.categoryRow}>
                    <Ionicons
                      name={isNew ? (createMissing ? 'add-circle' : 'remove-circle-outline') : 'checkmark-circle'}
                      size={18}
                      color={isNew ? (createMissing ? theme.tint : theme.textSecondary) : theme.success}
                    />
                    <ThemedText type="small" style={styles.flex}>
                      {r.sub ? `${r.top} › ${r.sub}` : r.top}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {isNew ? (createMissing ? t('New') : t('Uncategorized')) : t('Matched')}
                    </ThemedText>
                  </View>
                );
              })}
              {missing.length > 0 ? (
                <View style={styles.toggle}>
                  <ThemedText type="small" style={styles.flex}>
                    {tn(missing.length, 'Create {count} new category', 'Create {count} new categories')}
                  </ThemedText>
                  <Switch value={createMissing} onValueChange={setCreateMissing} />
                </View>
              ) : null}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** Column names as chips, e.g. the required ones in the instructions. */
function ColumnChips({ label, names, required }: { label: string; names: string[]; required?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.chipRow}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.chipLabel}>
        {label}
      </ThemedText>
      {names.map((name) => (
        <View
          key={name}
          style={[
            styles.chip,
            required ? { backgroundColor: theme.tintSoft, borderColor: theme.tintSoft } : { borderColor: theme.border },
          ]}>
          <ThemedText type="small" themeColor={required ? 'tint' : 'text'}>
            {name}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

type PreviewRowProps = {
  row: DraftRow;
  currency?: string;
  included: boolean;
  duplicate: boolean;
  showAccount: boolean;
  onPress: () => void;
};

/** One file row in the preview; tapping it leaves it out or brings it back. */
function PreviewRow({ row, currency, included, duplicate, showAccount, onPress }: PreviewRowProps) {
  const theme = useTheme();
  const category = row.subcategory ? `${row.category} › ${row.subcategory}` : row.category;
  const details = [formatDay(rowDay(row)), row.note ? category : '', showAccount ? row.account : ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: included }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderTopColor: theme.border }, pressed && styles.pressed]}>
      <Ionicons name={included ? 'checkbox' : 'square-outline'} size={22} color={included ? theme.tint : theme.textSecondary} />
      <View style={[styles.flex, !included && styles.excluded]}>
        <ThemedText type="small" numberOfLines={1}>
          {row.note || category || t('Uncategorized')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {details}
        </ThemedText>
        {duplicate ? (
          <ThemedText type="small" themeColor="warning" numberOfLines={1}>
            {t('Likely duplicate')}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText
        type="smallBold"
        themeColor={row.type === 'income' ? 'success' : 'text'}
        style={[!included && styles.excluded, !included && styles.struck]}>
        {row.type === 'income' ? '+' : ''}
        {formatMoney(row.amount, currency)}
      </ThemedText>
    </Pressable>
  );
}

type DetectedProps = { rows: DraftRow[]; columns: ColumnMap; accounts: string[]; fallback?: string };

/** What the file's type and account columns say, or the defaults without them. */
function Detected({ rows, columns, accounts, fallback }: DetectedProps) {
  const theme = useTheme();
  const incomeRows = rows.filter((r) => r.type === 'income').length;
  const names = [...new Set(rows.map((r) => r.account).filter(Boolean))];
  const known = (name: string) => accounts.some((a) => a.toLowerCase() === name.toLowerCase());
  return (
    <View style={styles.detected}>
      <ThemedText type="small" themeColor="textSecondary">
        {columns.type === undefined
          ? t('No type column: every row is imported as spending.')
          : t('Type column found: {expense} spending, {income} income.', { expense: rows.length - incomeRows, income: incomeRows })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {columns.account === undefined
          ? t('No account column: every row goes to the account above.')
          : t('Account column found. Rows that name one of your accounts go to it; the rest go to {name}.', { name: fallback ?? '' })}
      </ThemedText>
      {names.map((name) => (
        <View key={name} style={styles.categoryRow}>
          <Ionicons name={known(name) ? 'checkmark-circle' : 'arrow-forward-circle-outline'} size={16} color={known(name) ? theme.success : theme.textSecondary} />
          <ThemedText type="small" style={styles.flex} numberOfLines={1}>
            {known(name) ? name : `${name} → ${fallback ?? ''}`}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: Spacing.two, alignItems: 'flex-start' },
  stretch: { alignSelf: 'stretch' },
  table: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, gap: Spacing.two },
  tableCell: { flex: 1 },
  amountCell: { textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.one },
  chipLabel: { marginRight: Spacing.one },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  preview: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
  excluded: { opacity: 0.45 },
  struck: { textDecorationLine: 'line-through' },
  detected: { gap: Spacing.one },
  categories: { gap: Spacing.two },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
});

function problemText(problem: RowProblem): string {
  const value = problem.value ?? '';
  switch (problem.kind) {
    case 'date':
      return t('Unreadable date "{value}"', { value });
    case 'missingDate':
      return t('No date above this row');
    case 'amount':
      return t('Unreadable amount "{value}"', { value });
    case 'type':
      return t('Unknown type "{value}"', { value });
  }
}
