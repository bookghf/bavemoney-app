import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { IconBadge } from '@/components/ui/icon-badge';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { api, getErrorMessage } from '@/lib/api/client';
import type { Category, TransactionListResponse } from '@/lib/api/types';
import { detectColumns, importTag, occurredAt, parseCSV, resolveCategories, toDraftRows, type DraftRow, type ParseResult } from '@/lib/csv';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { sumAmounts } from '@/lib/money';

/** The API takes at most this many rows per import, all or nothing. */
const MAX_ROWS = 2000;

type Loaded = { fileName: string; parsed: ParseResult; previousImports: number };

export default function ImportScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const active = (accounts.data ?? []).filter((a) => !a.is_archived);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<unknown>(null);

  const account = active.find((a) => a.id === accountId) ?? active[0];
  const rows = loaded?.parsed.rows ?? [];
  const resolutions = resolveCategories(rows, categories.data ?? []);
  const missing = resolutions.filter((r) => !r.topId || (r.sub && !r.subId));
  const expense = sumAmounts(rows.filter((r) => r.type === 'expense').map((r) => r.amount));
  const income = sumAmounts(rows.filter((r) => r.type === 'income').map((r) => r.amount));
  const dates = rows.map((r) => `${r.date.y}-${String(r.date.m).padStart(2, '0')}-${String(r.date.d).padStart(2, '0')}`).sort();

  const pick = async () => {
    setReadError(null);
    setImportError(null);
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
      const parsed = toDraftRows(records, columns);
      // The same file imported before would duplicate every row.
      const { data } = await api.get<TransactionListResponse>('/transactions', {
        params: { tags: importTag(asset.name), limit: 1 },
      });
      setLoaded({ fileName: asset.name, parsed, previousImports: data.pagination.total_items });
      haptics.selection();
    } catch (error) {
      setReadError(getErrorMessage(error));
    }
  };

  const runImport = async () => {
    if (!loaded || !account || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      // Create the categories the file mentions but the user does not have.
      const created = new Map<string, string>(); // "type|top" or "type|top|sub" -> id
      if (createMissing) {
        for (const r of missing) {
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
        const r = resolutions.find((x) => x.key === `${row.type}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`);
        if (!r) return undefined;
        return r.subId ?? created.get(r.key) ?? r.topId ?? created.get(`${r.type}|${r.top.toLowerCase()}`);
      };
      const accountFor = (row: DraftRow) =>
        (row.account && active.find((a) => a.name.toLowerCase() === row.account.toLowerCase())?.id) || account.id;

      const perDay = new Map<string, number>();
      const payload = rows.map((row) => {
        const day = `${row.date.y}-${row.date.m}-${row.date.d}`;
        const index = perDay.get(day) ?? 0;
        perDay.set(day, index + 1);
        return {
          account_id: accountFor(row),
          category_id: categoryFor(row),
          type: row.type,
          amount: row.amount,
          note: row.note,
          occurred_at: occurredAt(row, index),
        };
      });
      const { data } = await api.post<{ imported: number }>('/transactions/import', {
        account_id: account.id,
        tag: importTag(loaded.fileName),
        rows: payload,
      });
      await queryClient.invalidateQueries();
      haptics.success();
      toast.success(t('Imported {count} transactions', { count: data.imported }));
      router.back();
    } catch (error) {
      haptics.warning();
      setImportError(error);
    } finally {
      setImporting(false);
    }
  };

  const tooMany = rows.length > MAX_ROWS;

  return (
    <Screen
      edges={['bottom']}
      footer={
        loaded ? (
          <>
            <ErrorText error={importError} />
            <Button
              title={tn(rows.length, 'Import {count} transaction', 'Import {count} transactions')}
              onPress={runImport}
              loading={importing}
              disabled={rows.length === 0 || tooMany || !account}
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
            {t('Export your Google Sheet or Excel file as CSV. It needs a date and an amount column; item, category, type, and account are used when present. Thai headers and dates like 30/07/2569 work.')}
          </ThemedText>
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
            <ThemedText type="sectionTitle">{tn(rows.length, '{count} transaction', '{count} transactions')}</ThemedText>
            {dates.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {dates[0]} – {dates[dates.length - 1]}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="danger">
              {t('Spending')} {formatMoney(expense, account?.currency)}
            </ThemedText>
            {income !== '0.00' ? (
              <ThemedText type="small" themeColor="success">
                {t('Income')} {formatMoney(income, account?.currency)}
              </ThemedText>
            ) : null}
          </Card>

          {loaded.previousImports > 0 ? (
            <Card style={[styles.notice, { backgroundColor: theme.warningSoft }]}>
              <Ionicons name="warning" size={20} color={theme.warning} />
              <ThemedText type="small" style={styles.flex}>
                {t('A file with this name was imported before. Importing again will duplicate those transactions.')}
              </ThemedText>
            </Card>
          ) : null}
          {tooMany ? (
            <ThemedText type="small" themeColor="danger">
              {t('Split the file: at most 2000 rows can be imported at a time.')}
            </ThemedText>
          ) : null}
          {loaded.parsed.problems.length > 0 || loaded.parsed.skippedTransfers > 0 ? (
            <Card>
              <ThemedText type="smallBold">{t('Left out')}</ThemedText>
              {loaded.parsed.skippedTransfers > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {tn(loaded.parsed.skippedTransfers, '{count} transfer (add transfers in the app)', '{count} transfers (add transfers in the app)')}
                </ThemedText>
              ) : null}
              {loaded.parsed.problems.slice(0, 5).map((problem) => (
                <ThemedText key={problem.line} type="small" themeColor="textSecondary">
                  {t('Line {line}: {message}', { line: problem.line, message: problem.message })}
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
          <ThemedText type="small" themeColor="textSecondary">
            {t('Rows that name one of your accounts go to that account instead.')}
          </ThemedText>

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

const styles = StyleSheet.create({
  intro: { gap: Spacing.two, alignItems: 'flex-start' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  categories: { gap: Spacing.two },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
});
