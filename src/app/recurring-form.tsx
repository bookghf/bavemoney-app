import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { CategoryGrid } from '@/components/category-grid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { DateField } from '@/components/ui/date-field';
import { ErrorText, QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories, useJustCreatedCategory } from '@/hooks/use-categories';
import {
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useRecurringRule,
  useUpdateRecurringRule,
} from '@/hooks/use-recurring';
import { useTheme } from '@/hooks/use-theme';
import type {
  Account,
  Category,
  CreateRecurringRuleRequest,
  RecurringFrequency,
  RecurringRule,
  TransactionType,
} from '@/lib/api/types';
import { addMonths, deviceTimeZone, formatDay, parseISODate, today } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { parsePositiveAmount } from '@/lib/money';
import { firstRunOn, ruleTitle, scheduleLabel, weekdayName } from '@/lib/recurring';

const MAX_NOTE_LENGTH = 500;
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));
const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '0'] as const; // Monday first

/** New recurring item, or editing one when opened with ?id=. */
export default function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rule = useRecurringRule(id);
  const accounts = useAccounts();
  // The form splits the category into parent/subcategory, so wait for the tree.
  const categories = useCategories();

  const pending = (!!id && rule.isPending) || accounts.isPending || categories.isPending;
  const error = (id ? rule.error : null) ?? accounts.error ?? categories.error;
  if (pending || error || !accounts.data || (id && !rule.data)) {
    return (
      <Screen edges={['bottom']}>
        <QueryState isPending={pending} error={error} onRetry={id ? rule.refetch : accounts.refetch} />
        {!pending && !error ? <ThemedText themeColor="textSecondary">{t('Recurring item not found.')}</ThemedText> : null}
      </Screen>
    );
  }
  // Keyed so the form re-initializes if another rule is opened.
  return (
    <RecurringForm
      key={rule.data?.id ?? 'new'}
      accounts={accounts.data}
      categories={categories.data ?? []}
      existing={id ? rule.data : undefined}
    />
  );
}

function RecurringForm({
  accounts,
  categories,
  existing,
}: {
  accounts: Account[];
  categories: Category[];
  existing?: RecurringRule;
}) {
  const theme = useTheme();
  const createRule = useCreateRecurringRule();
  const updateRule = useUpdateRecurringRule();
  const deleteRule = useDeleteRecurringRule();
  // Guards against a double tap firing two requests before the re-render.
  const submitting = useRef(false);
  const todayISO = today();
  const initialCategory = splitCategory(existing, categories);

  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [accountId, setAccountId] = useState<string | null>(existing?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.to_account_id ?? null);
  const [amount, setAmount] = useState(existing?.amount ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory.top);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(initialCategory.sub);
  const [note, setNote] = useState(existing?.note ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(existing?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(existing?.day_of_month ?? parseISODate(todayISO).getDate()));
  const [weekday, setWeekday] = useState(String(existing?.weekday ?? parseISODate(todayISO).getDay()));
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayISO);
  const [showErrors, setShowErrors] = useState(false);

  // A category created from the grid's "+ New" tile is selected on return.
  const justCreated = useJustCreatedCategory((state) => state.category);
  const [handledId, setHandledId] = useState(() => justCreated?.id ?? null);
  if (justCreated && justCreated.id !== handledId && justCreated.type === type) {
    setHandledId(justCreated.id);
    setCategoryId(justCreated.parent_id ?? justCreated.id);
    setSubcategoryId(justCreated.parent_id ? justCreated.id : null);
  }

  // Open accounts, plus the rule's own account even if it was archived since.
  const usable = accounts.filter((a) => !a.is_archived || a.id === existing?.account_id);
  const account = usable.find((a) => a.id === accountId) ?? usable.find((a) => !a.is_archived) ?? null;
  const isTransfer = type === 'transfer';
  // Spending red, income green, transfers blue.
  const typeColor = isTransfer ? theme.transfer : type === 'income' ? theme.success : theme.danger;
  // The API only transfers between open accounts that share a currency.
  const transferTargets = accounts.filter(
    (a) => a.id !== account?.id && a.currency === account?.currency && !a.is_archived,
  );
  const toAccount = transferTargets.find((a) => a.id === toAccountId) ?? null;
  const topCategories = categories.filter((c) => c.type === type);
  const category = topCategories.find((c) => c.id === categoryId) ?? null;
  const subcategories = category?.children ?? [];

  const parsedAmount = parsePositiveAmount(amount);
  const amountError = !parsedAmount
    ? amount.trim() === ''
      ? t('Enter an amount')
      : t('Use a positive number with at most 2 decimals, e.g. 120.50')
    : null;
  const accountError = account ? null : t('Create an account first');
  const transferError = isTransfer && !toAccount ? t('Pick the account that receives the money') : null;
  const noteError = note.length > MAX_NOTE_LENGTH ? t('Keep the note under 500 characters') : null;
  const mutation = existing ? updateRule : createRule;

  const schedule = {
    frequency,
    day_of_month: frequency === 'monthly' ? Number(dayOfMonth) : null,
    weekday: frequency === 'weekly' ? Number(weekday) : null,
  };
  const firstRun = firstRunOn(startDate, schedule);

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null); // categories belong to one type
    setSubcategoryId(null);
  };

  const submit = () => {
    if (!account || !parsedAmount || transferError || noteError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;

    // Empty ids clear the field on an edit and are ignored on create.
    const request: CreateRecurringRuleRequest = {
      type,
      account_id: account.id,
      to_account_id: isTransfer ? toAccount?.id : '',
      category_id: isTransfer ? '' : (subcategoryId ?? category?.id ?? ''),
      amount: parsedAmount,
      note: note.trim(),
      frequency,
      day_of_month: schedule.day_of_month ?? undefined,
      weekday: schedule.weekday ?? undefined,
      start_date: startDate,
      time_zone: deviceTimeZone(),
    };
    const options = {
      onSuccess: () => {
        haptics.success();
        toast.success(existing ? t('Recurring item updated') : t('Recurring item saved'));
        router.back();
      },
      onSettled: () => {
        submitting.current = false;
      },
    };
    if (existing) updateRule.mutate({ id: existing.id, ...request }, options);
    else createRule.mutate(request, options);
  };

  const confirmDelete = () => {
    if (!existing) return;
    haptics.warning();
    Alert.alert(
      t('Delete the {name} recurring item?', { name: ruleTitle(existing) }),
      t('Transactions it already added stay.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () =>
            deleteRule.mutate(existing.id, {
              onSuccess: () => {
                toast.success(t('Recurring item deleted'));
                router.back();
              },
            }),
        },
      ],
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={mutation.error ?? deleteRule.error} />
          <Button title={existing ? t('Save changes') : t('Save')} onPress={submit} loading={mutation.isPending} />
          {existing ? (
            <Button
              title={t('Delete recurring item')}
              variant="quiet"
              onPress={confirmDelete}
              loading={deleteRule.isPending}
            />
          ) : null}
        </>
      }>
      {existing?.pause_reason === 'account_archived' ? (
        <Card>
          <ThemedText type="small" themeColor="danger">
            {t('Paused because its account was archived. Pick an open account, save, then resume it from the list.')}
          </ThemedText>
        </Card>
      ) : null}

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

      <TextField
        label={account ? `${t('Amount')} (${account.currency})` : t('Amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus={!existing}
        error={showErrors ? amountError : null}
      />

      <View style={styles.section}>
        <ChipSelect
          scroll
          label={isTransfer ? t('From account') : t('Account')}
          options={usable.map((a) => ({ value: a.id, label: `${a.name} · ${formatMoney(a.current_balance, a.currency)}` }))}
          value={account?.id ?? null}
          onChange={(next) => {
            setAccountId(next);
            setToAccountId(null); // the target list depends on the source
          }}
        />
        {showErrors && accountError ? (
          <ThemedText type="small" themeColor="danger">
            {accountError}
          </ThemedText>
        ) : null}
      </View>

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
          </Card>
        )
      ) : null}

      {!isTransfer && topCategories.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('Category')}
          </ThemedText>
          <CategoryGrid
            categories={topCategories}
            value={category?.id ?? null}
            onChange={(next) => {
              setCategoryId(next);
              setSubcategoryId(null); // subcategories belong to one parent
            }}
            onAdd={() =>
              router.push({
                pathname: '/category-form',
                params: { type, ...(category ? { parent_id: category.id } : {}) },
              })
            }
          />
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

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('Repeats')}
        </ThemedText>
        <SegmentedControl
          options={[
            { value: 'monthly', label: t('Monthly') },
            { value: 'weekly', label: t('Weekly') },
          ]}
          value={frequency}
          onChange={setFrequency}
        />
        {frequency === 'monthly' ? (
          <ChipSelect
            scroll
            label={t('Day of the month')}
            options={DAYS_OF_MONTH.map((value) => ({ value, label: value }))}
            value={dayOfMonth}
            onChange={setDayOfMonth}
          />
        ) : (
          <ChipSelect
            scroll
            label={t('Day of the week')}
            options={WEEKDAYS.map((value) => ({ value, label: weekdayName(Number(value)) }))}
            value={weekday}
            onChange={setWeekday}
          />
        )}
        {frequency === 'monthly' && Number(dayOfMonth) >= 29 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('In shorter months it is recorded on the last day.')}
          </ThemedText>
        ) : null}
      </View>

      <DateField
        label={t('Starts')}
        value={startDate}
        onChange={setStartDate}
        // The API back-fills at most a year of missed runs.
        minDate={existing && existing.start_date < addMonths(todayISO, -12) ? existing.start_date : addMonths(todayISO, -12)}
        shortcuts={[{ label: t('Today'), value: todayISO }]}
      />

      <TextField
        label={t('Note (optional)')}
        value={note}
        onChangeText={setNote}
        placeholder={isTransfer ? t('e.g. Savings') : t('e.g. Rent')}
        maxLength={MAX_NOTE_LENGTH}
        returnKeyType="done"
        error={showErrors ? noteError : null}
      />

      <ThemedText type="small" themeColor="textSecondary">
        {scheduleLabel(schedule)} ·{' '}
        {existing?.last_run_on
          ? t('Already recorded through {date}.', { date: formatDay(existing.last_run_on, { year: 'numeric' }) })
          : firstRun <= todayISO
            ? t('Runs from {date}; anything due up to today is recorded when you save.', {
                date: formatDay(firstRun, { year: 'numeric' }),
              })
            : t('First on {date}.', { date: formatDay(firstRun, { weekday: 'short', year: 'numeric' }) })}
      </ThemedText>
    </Screen>
  );
}

/** Top-level category and subcategory ids of a stored rule. */
function splitCategory(rule: RecurringRule | undefined, tree: Category[]) {
  if (!rule?.category) return { top: null, sub: null };
  if (rule.category.parent) return { top: rule.category.parent.id, sub: rule.category.id };
  const parent = tree.find((c) => c.children?.some((child) => child.id === rule.category?.id));
  return parent ? { top: parent.id, sub: rule.category.id } : { top: rule.category.id, sub: null };
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
});
