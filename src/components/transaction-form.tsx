import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryGrid } from '@/components/category-grid';
import { QuickPickRow } from '@/components/quick-pick-row';
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
import { useCategories, useJustCreatedCategory } from '@/hooks/use-categories';
import { useEntryUsage, useQuickPicks, type QuickPick } from '@/hooks/use-quick-picks';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/hooks/use-transactions';
import type { Account, CreateTransactionRequest, Transaction, UpdateTransactionRequest } from '@/lib/api/types';
import { addDays, occurredAtFor, toISODate, today } from '@/lib/dates';
import { defaultAccount } from '@/lib/default-account';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { parsePositiveAmount } from '@/lib/money';
import { usePreferences } from '@/store/preferences-store';

export type EntryType = CreateTransactionRequest['type'];

const MAX_NOTE_LENGTH = 500;
/** Category tiles shown before "See all": two rows of the 4-column grid. */
const COLLAPSED_CATEGORIES = 8;

type TransactionFormProps = {
  accounts: Account[];
  /** Present when editing; the form then saves with PATCH and offers Delete. */
  existing?: Transaction;
  initialType?: EntryType;
};

/**
 * Add/edit form for income, expense, and transfers. The amount comes first
 * and is focused on open, with the date right under it so it is never hidden
 * behind the Save button; then the account, a short category grid, and the
 * note. The last account and category are remembered, and frequent entries
 * are one tap away as quick picks. Editing can change everything, including
 * the account and the type (to or from a transfer).
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
  // null until the user picks one; the default below applies meanwhile.
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(existing?.account_id ?? null);
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
  // The quick pick last filled in; it offers an explicit Save button.
  const [armedPickKey, setArmedPickKey] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const quickPicks = useQuickPicks(type);
  const usage = useEntryUsage();
  const todayISO = today();
  // Open accounts, plus the archived ones this entry already uses: the API
  // lets an edit keep those but not move anything onto them.
  const known = (a: Account) => a.id === existing?.account_id || a.id === existing?.to_account_id;
  const activeAccounts = accounts.filter((a) => !a.is_archived || known(a));
  const account =
    activeAccounts.find((a) => a.id === selectedAccountId) ??
    defaultAccount(accounts, { lastAccountId: prefs.lastAccountId, usage: usage.data?.accounts[type] }) ??
    activeAccounts[0];
  const isTransfer = type === 'transfer';
  // Spending red, income green, transfers blue.
  const typeColor = isTransfer ? theme.transfer : type === 'income' ? theme.success : theme.danger;
  // The API only transfers between accounts that share a currency.
  const transferTargets = activeAccounts.filter((a) => a.id !== account?.id && a.currency === account?.currency);
  const toAccount = transferTargets.find((a) => a.id === toAccountId) ?? null;

  // Most-used categories first (stable, so the rest keep their order).
  const categoryUse = usage.data?.categories[type] ?? {};
  const topCategories = (categories.data ?? [])
    .filter((category) => category.type === type)
    .sort((a, b) => (categoryUse[b.id] ?? 0) - (categoryUse[a.id] ?? 0));
  // A remembered category may belong to the other type; ignore it then.
  const category = topCategories.find((c) => c.id === categoryId) ?? null;
  const subcategories = category?.children ?? [];
  const collapsible = topCategories.length > COLLAPSED_CATEGORIES;
  let shownCategories = topCategories;
  if (collapsible && !showAllCategories) {
    shownCategories = topCategories.slice(0, COLLAPSED_CATEGORIES);
    // Keep the picked category visible when it sits below the fold.
    if (category && !shownCategories.includes(category)) {
      shownCategories = [...shownCategories.slice(0, COLLAPSED_CATEGORIES - 1), category];
    }
  }

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
    setArmedPickKey(null);
    setCategoryId(isEdit ? null : (prefs.lastCategoryByType[next] ?? null));
    setSubcategoryId(null);
  };

  // A category created from the picker's "+ New" tile is selected on return.
  // Adjusting state during render (not in an effect) is React's pattern for
  // reacting to a changed value; handledId makes it happen once.
  const justCreated = useJustCreatedCategory((state) => state.category);
  const [handledId, setHandledId] = useState(() => justCreated?.id ?? null);
  if (justCreated && justCreated.id !== handledId && justCreated.type === type) {
    setHandledId(justCreated.id);
    setCategoryId(justCreated.parent_id ?? justCreated.id);
    setSubcategoryId(justCreated.parent_id ? justCreated.id : null);
  }

  const pickCategory = (next: string | null) => {
    setCategoryId(next);
    setSubcategoryId(null); // subcategories belong to one parent
  };

  const pickAccountOf = (pick: QuickPick) => activeAccounts.find((a) => a.id === pick.accountId && !a.is_archived);

  const applyPick = (pick: QuickPick) => {
    const resolved = resolveCategory(pick.categoryId, categories.data);
    const pickAccount = pickAccountOf(pick);
    setAmount(pick.amount);
    // Pay from the same account as before (unless it was archived since).
    if (pickAccount) setSelectedAccountId(pickAccount.id);
    setNote(pick.note);
    setCategoryId(resolved.top);
    setSubcategoryId(resolved.sub);
    setArmedPickKey(pick.key);
  };

  // The Save button stays next to a pick only while the form still holds it.
  const armedPick = (quickPicks.data ?? []).find((pick) => pick.key === armedPickKey);
  const pickStillApplied =
    !!armedPick &&
    parsedAmount === parsePositiveAmount(armedPick.amount) &&
    note.trim() === armedPick.note &&
    (subcategoryId ?? categoryId) === armedPick.categoryId &&
    (!pickAccountOf(armedPick) || account?.id === armedPick.accountId);

  // Name the account on a chip only when the same item comes from several.
  const pickLabel = (pick: QuickPick) => {
    const base = `${pick.note || categoryName(pick.categoryName ?? '') || t('No note')} · ${formatMoney(pick.amount, account?.currency)}`;
    const twins = (quickPicks.data ?? []).filter(
      (other) => other.note === pick.note && other.amount === pick.amount && other.categoryId === pick.categoryId,
    );
    return twins.length > 1 ? `${base} · ${pick.accountName}` : base;
  };

  const submit = () => {
    const finalAmount = parsedAmount;
    const finalNote = note.trim();
    const finalCategory = subcategoryId ?? category?.id ?? null;
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
      // Only what changed, so an unchanged archived account is not re-checked.
      // The API drops the category of a new transfer and the target of a
      // former one.
      const changes: UpdateTransactionRequest = {
        amount: finalAmount,
        note: finalNote,
        occurred_at: sameDay(existing.occurred_at, day) ? undefined : occurredAtFor(day),
        account_id: account.id !== existing.account_id ? account.id : undefined,
        type: type !== existing.type ? type : undefined,
        ...(isTransfer
          ? { to_account_id: toAccount?.id !== existing.to_account_id ? toAccount?.id : undefined }
          : { category_id: finalCategory ?? '' }),
      };
      updateTransaction.mutate(
        { id: existing.id, ...changes },
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
        setArmedPickKey(null);
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
      <SegmentedControl
        options={[
          { value: 'expense', label: t('Expense') },
          { value: 'income', label: t('Income') },
          { value: 'transfer', label: t('Transfer') },
        ]}
        value={type}
        onChange={changeType}
        selectedColor={typeColor}
      />

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
          // A faint "฿0" rather than "0.00", which read as an entered zero.
          placeholder={zeroPlaceholder(account?.currency)}
          placeholderTextColor={`${theme.textSecondary}66`}
          maxFontSizeMultiplier={FontScaleCap.display}
          accessibilityLabel={t('Amount')}
          accessibilityHint={showErrors ? (amountError ?? undefined) : undefined}
          selectTextOnFocus
          style={[styles.amountInput, { color: typeColor }]}
        />
        {showErrors && amountError ? (
          <ThemedText type="small" themeColor="danger">
            {amountError}
          </ThemedText>
        ) : null}
      </Card>

      {!isEdit && !isTransfer && (quickPicks.data?.length ?? 0) > 0 ? (
        <QuickPickRow
          picks={quickPicks.data ?? []}
          label={pickLabel}
          armedKey={pickStillApplied ? armedPickKey : null}
          saveLabel={(pick) => t('Save {amount}', { amount: formatMoney(pick.amount, account?.currency) })}
          saving={createTransaction.isPending}
          onPick={applyPick}
          onSave={() => submit()}
        />
      ) : null}

      {/* Right under the amount, above the keyboard and the Save button. */}
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

      <ChipSelect
        scroll
        label={isTransfer ? t('From account') : t('Account')}
        options={activeAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${formatMoney(a.current_balance, a.currency)}` }))}
        value={account?.id ?? null}
        onChange={setSelectedAccountId}
      />

      {isTransfer ? (
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
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/add-account')}>
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
          <CategoryGrid
            categories={shownCategories}
            value={category?.id ?? null}
            onChange={pickCategory}
            // "+ New" sits after the full list, so only once it is shown.
            onAdd={
              collapsible && !showAllCategories
                ? undefined
                : () =>
                    router.push({
                      pathname: '/category-form',
                      params: { type, ...(category ? { parent_id: category.id } : {}) },
                    })
            }
          />
          {collapsible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showAllCategories }}
              hitSlop={8}
              onPress={() => setShowAllCategories((current) => !current)}
              style={styles.seeAll}>
              <ThemedText type="smallBold" themeColor="tint">
                {showAllCategories
                  ? t('Show fewer')
                  : t('See all ({count})', { count: topCategories.length })}
              </ThemedText>
            </Pressable>
          ) : null}
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

/** "฿0" for the amount field: the money format without its ".00". */
function zeroPlaceholder(currency = 'THB') {
  return formatMoney(0, currency).replace(/[.,]00(?=\D*$)/, '');
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
  seeAll: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
});
