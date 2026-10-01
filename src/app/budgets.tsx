import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BudgetProgress, budgetTitle } from '@/components/budget-progress';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useBudgets, useDeleteBudget } from '@/hooks/use-budgets';
import { useTheme } from '@/hooks/use-theme';
import type { Budget } from '@/lib/api/types';
import { formatDay } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';

// English keys, translated at render time.
const PERIOD_LABELS: Record<Budget['period'], string> = {
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
};

export default function BudgetsScreen() {
  const theme = useTheme();
  const budgets = useBudgets();
  const deleteBudget = useDeleteBudget();

  const confirmDelete = (budget: Budget) => {
    haptics.warning();
    Alert.alert(t('Delete the {name} budget?', { name: budgetTitle(budget) }), t('Your transactions are not affected.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: () => deleteBudget.mutate(budget.id, { onSuccess: () => toast.success(t('Budget deleted')) }),
      },
    ]);
  };

  return (
    <Screen
      edges={['bottom']}
      refreshing={budgets.isRefetching}
      onRefresh={budgets.refetch}
      footer={<Button title={t('New budget')} onPress={() => router.push('/add-budget')} />}>
      <QueryState isPending={budgets.isPending} error={budgets.error} onRetry={budgets.refetch} />

      {budgets.data?.length === 0 ? (
        <Card style={styles.empty}>
          <IconBadge icon="pie-chart" size={56} />
          <ThemedText type="sectionTitle">{t('No budgets yet')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('Set a limit for all spending or for one category, like Food. We warn you as you get close.')}
          </ThemedText>
        </Card>
      ) : null}

      {budgets.data?.map((budget) => (
        <Card key={budget.id}>
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t(PERIOD_LABELS[budget.period])} · {formatDay(budget.period_start)} – {formatDay(budget.period_end)}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Delete the {name} budget', { name: budgetTitle(budget) })}
              hitSlop={12}
              onPress={() => confirmDelete(budget)}>
              <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
          <BudgetProgress budget={budget} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('Alert at {pct}%', { pct: budget.alert_threshold_pct })}
          </ThemedText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
