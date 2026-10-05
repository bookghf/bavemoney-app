import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryGrid } from '@/components/category-grid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useCurrencies } from '@/hooks/use-accounts';
import { useCreateBudget } from '@/hooks/use-budgets';
import { useCategories, useJustCreatedCategory } from '@/hooks/use-categories';
import { useMonthStartDay } from '@/hooks/use-month-start-day';
import type { BudgetPeriod } from '@/lib/api/types';
import { orderCurrencies } from '@/lib/currency-order';
import { toISODate, today } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { parsePositiveAmount } from '@/lib/money';
import { monthRange, rangeLabel } from '@/lib/report-period';
import { useAuthStore } from '@/store/auth-store';

const THRESHOLDS = ['50', '80', '90', '100'] as const;

/**
 * First day of the period that contains today, so the budget starts now.
 * Months start on the user's month_start_day, as the API counts them.
 */
function periodStart(period: BudgetPeriod, monthStartDay: number): string {
  const now = new Date();
  if (period === 'weekly') return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()));
  if (period === 'yearly') return `${now.getFullYear()}-01-01`;
  return monthRange(toISODate(now), monthStartDay).from;
}

export default function AddBudgetScreen() {
  const defaultCurrency = useAuthStore((state) => state.user?.default_currency) || 'THB';
  const monthStartDay = useMonthStartDay();
  const categories = useCategories();
  const currencies = useCurrencies();
  const createBudget = useCreateBudget();
  const submitting = useRef(false);

  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [threshold, setThreshold] = useState<(typeof THRESHOLDS)[number]>('80');
  const [showErrors, setShowErrors] = useState(false);

  // Select a top-level category created from the "+ New" tile (once).
  const justCreated = useJustCreatedCategory((state) => state.category);
  const [handledId, setHandledId] = useState(() => justCreated?.id ?? null);
  if (justCreated && justCreated.id !== handledId && justCreated.type === 'expense' && !justCreated.parent_id) {
    setHandledId(justCreated.id);
    setCategoryId(justCreated.id);
  }

  const parsed = parsePositiveAmount(amount);
  const amountError = parsed ? null : t('Enter the most you want to spend, e.g. 8,000');
  const expenseCategories = (categories.data ?? []).filter((c) => c.type === 'expense');

  const submit = () => {
    if (!parsed) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    createBudget.mutate(
      {
        category_id: categoryId ?? undefined,
        amount: parsed,
        currency,
        period,
        start_date: periodStart(period, monthStartDay),
        alert_threshold_pct: Number(threshold),
      },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Budget created'));
          router.back();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={createBudget.error} />
          <Button title={t('Create budget')} onPress={submit} loading={createBudget.isPending} />
        </>
      }>
      <SegmentedControl
        options={[
          { value: 'weekly', label: t('Weekly') },
          { value: 'monthly', label: t('Monthly') },
          { value: 'yearly', label: t('Yearly') },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {period === 'monthly' && monthStartDay !== 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Follows your month, which starts on day {day}: {range}', {
            day: monthStartDay,
            range: rangeLabel('month', monthRange(today(), monthStartDay), today()),
          })}
        </ThemedText>
      ) : null}

      <TextField
        label={t('Limit')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus
        error={showErrors ? amountError : null}
      />

      {(currencies.data?.length ?? 0) > 1 ? (
        <ChipSelect
          label={t('Currency')}
          options={orderCurrencies((currencies.data ?? []).map((c) => c.code), defaultCurrency).map((code) => ({
            value: code,
            label: code,
          }))}
          value={currency}
          onChange={setCurrency}
        />
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('Category')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {categoryId ? t('Tracks this category and its subcategories.') : t('No category picked: tracks all spending.')}
        </ThemedText>
        <CategoryGrid
          categories={expenseCategories}
          value={categoryId}
          onChange={setCategoryId}
          onAdd={() => router.push({ pathname: '/category-form', params: { type: 'expense' } })}
        />
      </View>

      <ChipSelect
        label={t('Warn me at')}
        options={THRESHOLDS.map((value) => ({ value, label: `${value}%` }))}
        value={threshold}
        onChange={setThreshold}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {t('At this point the budget turns amber and Home shows a warning.')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
});
