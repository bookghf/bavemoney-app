import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Budget } from '@/lib/api/types';
import { daysBetween, today } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { categoryIcon } from '@/lib/icons';

export type BudgetStatus = 'ok' | 'warning' | 'over';

/** ok below the alert threshold, warning from it, over past 100%. */
export function budgetStatus(budget: Budget): BudgetStatus {
  if (budget.is_over_budget || budget.percent_used >= 100) return 'over';
  if (budget.percent_used >= budget.alert_threshold_pct) return 'warning';
  return 'ok';
}

export function budgetTitle(budget: Budget) {
  return budget.category ? categoryName(budget.category.name) : t('All spending');
}

/**
 * One budget: spend against the limit, with a tick showing how far through
 * the period today is, so "60% spent, 80% of the month gone" reads as fine.
 */
export function BudgetProgress({ budget, compact }: { budget: Budget; compact?: boolean }) {
  const theme = useTheme();
  const status = budgetStatus(budget);
  const color = status === 'over' ? theme.danger : status === 'warning' ? theme.warning : theme.tint;
  const fill = Math.min(100, Math.max(0, budget.percent_used));
  const periodDays = daysBetween(budget.period_start, budget.period_end) + 1;
  const elapsed = Math.min(periodDays, Math.max(0, daysBetween(budget.period_start, today()) + 1));
  const timePct = (elapsed / periodDays) * 100;
  const daysLeft = periodDays - elapsed;
  const remaining = formatMoney(budget.remaining.replace(/^-/, ''), budget.currency);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={t('{name}: {spent} of {limit} spent, {percent}%', {
        name: budgetTitle(budget),
        spent: formatMoney(budget.current_spend, budget.currency),
        limit: formatMoney(budget.amount, budget.currency),
        percent: Math.round(budget.percent_used),
      })}>
      <View style={styles.header}>
        {!compact ? (
          <View style={[styles.icon, { backgroundColor: theme.tintSoft }]}>
            <Ionicons name={budget.category ? categoryIcon(budget.category.name, 'expense') : 'wallet'} size={18} color={theme.tint} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {budgetTitle(budget)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {formatMoney(budget.current_spend, budget.currency)} / {formatMoney(budget.amount, budget.currency)}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ color }}>
          {Math.round(budget.percent_used)}%
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.fill, { width: `${fill}%`, backgroundColor: color }]} />
        <View style={[styles.today, { left: `${timePct}%`, backgroundColor: theme.text }]} />
      </View>

      {!compact ? (
        <ThemedText type="small" themeColor={status === 'over' ? 'danger' : 'textSecondary'}>
          {status === 'over'
            ? t('{amount} over budget', { amount: remaining })
            : t('{amount} left · {days} days to go', { amount: remaining, days: daysLeft })}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  track: { height: 10, borderRadius: 5, overflow: 'visible' },
  fill: { height: 10, borderRadius: 5 },
  today: { position: 'absolute', top: -3, width: 2, height: 16, borderRadius: 1, opacity: 0.35 },
});
