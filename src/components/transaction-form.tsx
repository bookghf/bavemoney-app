import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryGrid } from '@/components/category-grid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { DateField } from '@/components/ui/date-field';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useQuickPicks, type QuickPick } from '@/hooks/use-quick-picks';
import { useTheme } from '@/hooks/use-theme';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/hooks/use-transactions';
import type { Account, CreateTransactionRequest, Transaction } from '@/lib/api/types';
import { addDays, occurredAtFor, toISODate, today } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { parsePositiveAmount } from '@/lib/money';
import { usePreferences } from '@/store/preferences-store';

export type EntryType = CreateTransactionRequest['type'];

const MAX_NOTE_LENGTH = 500;

type TransactionFormProps = {
  accounts: Account[];
  /** Present when editing; the form then saves with PATCH and offers Delete. */
  existing?: Transaction;
  initialType?: EntryType;
};

/**
 * Add/edit form for income, expense, and transfers. The amount comes first
 * and is focused on open; the last account and category are remembered; and
 * frequent entries are one tap away as quick picks.
 */
export function TransactionForm({ accounts, existing, initialType = 'expense' }: TransactionFormProps) {
  const theme = useTheme();
  const isEdit = !!existing;
  const categories = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const prefs = usePreferences();
  const amountRef = useRef<TextInput>(null);
  // Guards against a double tap firing two requests before the re-render.
  const submitting = useRef(false);

  const [type, setType] = useState<EntryType>(existing ? (existing.type as EntryType) : initialType);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    existing?.account_id ?? prefs.lastAccountId,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.to_account_id ?? null);
  const [amount, setAmount] = useState(existing?.amount ?? '');
  const initialCategory = splitCategory(existing, categories.data);
  const [categoryId, setCategoryId] = useState<string | null>(
    existing ? initialCategory.top : (prefs.lastCategoryByType[initialType] ?? null),
  );
  const [subcategoryId, setSubcategoryId] = useState<string | null>(initialCategory.sub);
  const [day, setDay] = useState(existing ? toISODate(new Date(existing.occurred_at)) : today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const quickPicks = useQuickPicks(type);
  const todayISO = today();
  const activeAccounts = accounts.filter((a) => !a.is_archived || a.id === existing?.account_id);
  const account = activeAccounts.find((a) => a.id === selectedAccountId) ?? activeAccounts[0];
  const isTransfer = type === 'transfer';
  // The API only transfers between open accounts that share a currency.
  const transferTargets = activeAccounts.filter(
    (a) => a.id !== account?.id && a.currency === account?.currency && !a.is_archived,
  );
  const toAccount = isEdit
    ? accounts.find((a) => a.id === toAccountId) ?? null
    : (transferTargets.find((a) => a.id === toAccountId) ?? null);

  const topCategories = (categories.data ?? []).filter((category) => category.type === type);
  // A remembered category may belong to the other type; ignore it then.
  const category = topCategories.find((c) => c.id === categoryId) ?? null;
  const subcategories = category?.children ?? [];

  const parsedAmount = parsePositiveAmount(amount);
  const amountError = !parsedAmount
    ? amount.trim() === ''
      ? t('Enter an amount')
      : t('Use a positive number with at most 2 decimals, e.g. 120.50')
    : null;
  const transferError = isTransfer && !toAccount ? t('Pick the account that receives the money') : null;
  const noteError = note.length > MAX_NOTE_LENGTH ? t('Keep the note under 500 characters') : null;
  const mutation = isEdit ? updateTransaction : createTransaction;

  const changeType = (next: EntryType) => {
    setType(next);
    setCategoryId(isEdit ? null : (prefs.lastCategoryByType[next] ?? null));
    setSubcategoryId(null);
  };

  const pickCategory = (next: string | null) => {
    setCategoryId(next);
    setSubcategoryId(null); // subcategories belong to one parent
  };

  const applyPick = (pick: QuickPick) => {
    const resolved = resolveCategory(pick.categoryId, categories.data);
    const alreadyApplied =
      parsedAmount === parsePositiveAmount(pick.amount) &&
      note.trim() === pick.note &&
      (subcategoryId ?? categoryId) === pick.categoryId;
    setAmount(pick.amount);
    setNote(pick.note);
    setCategoryId(resolved.top);
    setSubcategoryId(resolved.sub);
    // Tapping a pick that is already filled in saves it.
    if (alreadyApplied) submit({ amount: pick.amount, note: pick.note, categoryId: pick.categoryId });
  };

  const submit = (override?: { amount: string; note: string; categoryId: string | null }) => {
    const finalAmount = override ? parsePositiveAmount(override.amount) : parsedAmount;
    const finalNote = (override?.note ?? note).trim();
    const finalCategory = override ? override.categoryId : (subcategoryId ?? category?.id ?? null);
    if (!account || !finalAmount || transferError || noteError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    const done = () => {
      submitting.current = false;
    };
    const label = isTransfer ? t('Transfer') : type === 'income' ? t('Income') : t('Expense');
    const money = formatMoney(finalAmount, account.currency);

    if (existing) {
      updateTransaction.mutate(
        {
          id: existing.id,
          amount: finalAmount,
          note: finalNote,
          occurred_at: sameDay(existing.occurred_at, day) ? undefined : occurredAtFor(day),
          ...(isTransfer
            ? {}
            : { type: type as 'income' | 'expense', category_id: finalCategory ?? '' }),
        },
        {
          onSuccess: () => {
            haptics.success();
            toast.success(t('{label} {amount} updated', { label, amount: money }));
            router.back();
          },
          onSettled: done,
        },
      );
      return;
    }

    const request: CreateTransactionRequest = {
      account_id: account.id,
      to_account_id: isTransfer ? toAccount?.id : undefined,
      category_id: isTransfer ? undefined : (finalCategory ?? undefined),
      type,
      amount: finalAmount,
      note: finalNote || undefined,
      tags: [],
      occurred_at: occurredAtFor(day),
    };
    createTransaction.mutate(request, {
      onSuccess: (created) => {
        haptics.success();
        prefs.update({
          lastAccountId: account.id,
          lastCategoryByType: { ...prefs.lastCategoryByType, [type]: category?.id ?? null },
        });
        toast.success(t('{label} {amount} saved', { label, amount: money }), {
          label: t('Undo'),
          onPress: () => deleteTransaction.mutate(created.id),
        });
        router.back();
      },
      onSettled: done,
    });
  };

  const confirmDelete = () => {
    if (!existing) return;
    haptics.warning();
    Alert.alert(t('Delete this transaction?'), t('Your balances and reports will update.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: () =>
          deleteTransaction.mutate(existing.id, {
            onSuccess: () => {
              toast.success(t('Transaction deleted'), {
                label: t('Undo'),
                // Deleting is a soft delete server-side, but there is no
                // restore endpoint, so undo re-creates the same entry.
                onPress: () => createTransaction.mutate(recreateRequest(existing)),
              });
              router.back();
            },
          }),
      },
    ]);
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={mutation.error ?? deleteTransaction.error} />
          <Button
            title={isEdit ? t('Save changes') : isTransfer ? t('Save transfer') : t('Save')}
            onPress={() => submit()}
            loading={mutation.isPending}
          />
          {isEdit ? (
            <Button
              title={t('Delete transaction')}
              variant="quiet"
              onPress={confirmDelete}
              loading={deleteTransaction.isPending}
            />
          ) : null}
        </>
      }>
      {isEdit && isTransfer ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Transfers stay transfers; you can change the amount, date, and note.')}
        </ThemedText>
      ) : (
        <SegmentedControl
          options={
            isEdit
              ? [
                  { value: 'expense', label: t('Expense') },
                  { value: 'income', label: t('Income') },
                ]
              : [
                  { value: 'expense', label: t('Expense') },
                  { value: 'income', label: t('Income') },
                  { value: 'transfer', label: t('Transfer') },
                ]
          }
          value={type}
          onChange={changeType}
          selectedColor={type === 'income' ? theme.success : undefined}
        />
      )}

      <Card style={styles.amountCard}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Amount')} {account ? `(${account.currency})` : ''}
        </ThemedText>
        <TextInput
          ref={amountRef}
          value={amount}
          onChangeText={setAmount}
          autoFocus={!isEdit}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('Amount')}
          accessibilityHint={showErrors ? (amountError ?? undefined) : undefined}
          selectTextOnFocus
          style={[styles.amountInput, { color: type === 'income' ? theme.success : theme.text }]}
        />
        {showErrors && amountError ? (
          <ThemedText type="small" themeColor="danger">
            {amountError}
          </ThemedText>
        ) : null}
      </Card>

      {!isEdit && !isTransfer && (quickPicks.data?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('Quick picks')}
          </ThemedText>
          <ChipSelect
            scroll
            options={(quickPicks.data ?? []).map((pick) => ({
              value: pick.key,
              label: `${pick.note || categoryName(pick.categoryName ?? '') || t('No note')} · ${formatMoney(pick.amount, account?.currency)}`,
            }))}
            value={null}
            onChange={(key) => {
              const pick = quickPicks.data?.find((p) => p.key === key);
              if (pick) applyPick(pick);
            }}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('Tap to fill in, tap again to save.')}
          </ThemedText>
        </View>
      ) : null}

      {isEdit ? (
        <ThemedText type="small" themeColor="textSecondary">
          {isTransfer
            ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}`
            : t('Account: {name}', { name: account?.name ?? '' })}
        </ThemedText>
      ) : (
        <ChipSelect
          scroll
          label={isTransfer ? t('From account') : t('Account')}
          options={activeAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${formatMoney(a.current_balance, a.currency)}` }))}
          value={account?.id ?? null}
          onChange={(next) => {
            setSelectedAccountId(next);
            setToAccountId(null); // the target list depends on the source
          }}
        />
      )}

      {isTransfer && !isEdit ? (
        transferTargets.length > 0 ? (
          <View style={styles.section}>
            <ChipSelect
              scroll
              label={t('To account')}
              options={transferTargets.map((a) => ({ value: a.id, label: a.name }))}
              value={toAccount?.id ?? null}
              onChange={setToAccountId}
            />
            {showErrors && transferError ? (
              <ThemedText type="small" themeColor="danger">
                {transferError}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              {t('You need another {currency} account to transfer to.', { currency: account?.currency ?? '' })}
            </ThemedText>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace('/add-account')}>
              <ThemedText type="smallBold" themeColor="tint">
                {t('Create an account')}
              </ThemedText>
            </Pressable>
          </Card>
        )
      ) : null}

      {!isTransfer && topCategories.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('Category')}
          </ThemedText>
          <CategoryGrid categories={topCategories} value={category?.id ?? null} onChange={pickCategory} />
          {subcategories.length > 0 ? (
            <ChipSelect
              scroll
              options={subcategories.map((sub) => ({ value: sub.id, label: categoryName(sub.name) }))}
              value={subcategoryId}
              onChange={setSubcategoryId}
              allowDeselect
              onClear={() => setSubcategoryId(null)}
            />
          ) : null}
        </View>
      ) : null}

      <DateField
        label={t('Date')}
        value={day}
        onChange={setDay}
        maxDate={todayISO}
        shortcuts={[
          { label: t('Today'), value: todayISO },
          { label: t('Yesterday'), value: addDays(todayISO, -1) },
        ]}
      />

      <TextField
        label={t('Note (optional)')}
        value={note}
        onChangeText={setNote}
        placeholder={t('e.g. Lunch')}
        maxLength={MAX_NOTE_LENGTH}
        returnKeyType="done"
        error={showErrors ? noteError : null}
      />
    </Screen>
  );
}

/** Top-level category and subcategory ids of a stored transaction. */
function splitCategory(tx: Transaction | undefined, tree: { id: string; children?: { id: string }[] }[] | undefined) {
  if (!tx?.category) return { top: null, sub: null };
  if (tx.category.parent) return { top: tx.category.parent.id, sub: tx.category.id };
  return resolveCategory(tx.category.id, tree);
}

/** Split a category id into its top-level parent and (optional) subcategory. */
function resolveCategory(id: string | null, tree: { id: string; children?: { id: string }[] }[] | undefined) {
  if (!id) return { top: null, sub: null };
  const parent = tree?.find((c) => c.children?.some((child) => child.id === id));
  return parent ? { top: parent.id, sub: id } : { top: id, sub: null };
}

function sameDay(iso: string, day: string) {
  return toISODate(new Date(iso)) === day;
}

function recreateRequest(tx: Transaction): CreateTransactionRequest {
  return {
    account_id: tx.account_id,
    to_account_id: tx.to_account_id,
    category_id: tx.category?.id,
    type: tx.type as EntryType,
    amount: tx.amount,
    note: tx.note,
    tags: tx.tags ?? [],
    occurred_at: tx.occurred_at,
  };
}

const styles = StyleSheet.create({
  amountCard: { gap: Spacing.one, paddingVertical: Spacing.three },
  amountInput: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 800,
    letterSpacing: -1,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: Spacing.two },
});
