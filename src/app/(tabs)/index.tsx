import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BudgetProgress, budgetStatus, budgetTitle } from '@/components/budget-progress';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { BrandGradient, BrandShadow, Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useBudgets } from '@/hooks/use-budgets';
import { FontScaleCap, useFontScale } from '@/hooks/use-font-scale';
import { toISODate, useReportSummary } from '@/hooks/use-reports';
import { useTheme } from '@/hooks/use-theme';
import { useRecentTransactions } from '@/hooks/use-transactions';
import { getErrorMessage } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import { dateLocale, t, tn } from '@/lib/i18n';
import { totalsByCurrency } from '@/lib/money';
import { useAuthStore } from '@/store/auth-store';

export default function DashboardScreen() {
  const theme = useTheme();
  const { isLargeText } = useFontScale();
  const user = useAuthStore((state) => state.user);
  const currency = user?.default_currency || 'THB';
  const today = new Date();

  const accounts = useAccounts();
  const summary = useReportSummary({ period: 'month', date: toISODate(today), currency });
  const recent = useRecentTransactions(5);
  const budgets = useBudgets();

  const activeAccounts = (accounts.data ?? []).filter((account) => !account.is_archived);
  // Totals per currency; the API does not convert between currencies.
  const totals = totalsByCurrency(activeAccounts);
  // Fullest budgets first, so the ones that need attention lead.
  const sortedBudgets = [...(budgets.data ?? [])].sort((a, b) => b.percent_used - a.percent_used);
  const alert = sortedBudgets.find((budget) => budgetStatus(budget) !== 'ok');
  const alertIsOver = alert ? budgetStatus(alert) === 'over' : false;

  const income = Number.parseFloat(summary.data?.total_income ?? '0') || 0;
  const expense = Number.parseFloat(summary.data?.total_expense ?? '0') || 0;
  const monthLabel = today.toLocaleDateString(dateLocale(), { month: 'long' });
  const name = user?.display_name || user?.email || '';

  const refreshing = accounts.isRefetching || summary.isRefetching || recent.isRefetching || budgets.isRefetching;
  const refresh = () => {
    accounts.refetch();
    summary.refetch();
    recent.refetch();
    budgets.refetch();
  };

  return (
    <Screen inTabs refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText} maxFontSizeMultiplier={1}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {greeting(today)}
          </ThemedText>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {name}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('All transactions')}
          hitSlop={6}
          onPress={() => router.push('/transactions')}
          style={({ pressed }) => [styles.headerButton, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="search" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* The shadow lives on a wrapper: on iOS, overflow clipping on the same
          view would drop it and square off the corners. */}
      <View style={styles.heroShadow}>
        <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          {/* Decorative rings give the flat gradient some depth. */}
          <View style={[styles.ring, styles.ringLarge]} />
          <View style={[styles.ring, styles.ringSmall]} />

          <Text style={styles.heroLabel} maxFontSizeMultiplier={FontScaleCap.heading}>
            {t('Total balance')}
          </Text>
          {accounts.error ? (
            <Text style={styles.heroMuted} maxFontSizeMultiplier={FontScaleCap.heading}>
              {getErrorMessage(accounts.error)}
            </Text>
          ) : accounts.isPending ? (
            <ActivityIndicator color="#ffffff" style={styles.heroSpinner} />
          ) : Object.keys(totals).length === 0 ? (
            <Text style={styles.heroMuted} maxFontSizeMultiplier={FontScaleCap.heading}>
              {t('No accounts yet')}
            </Text>
          ) : (
            Object.entries(totals).map(([code, total]) => (
              <Text
                key={code}
                style={styles.heroAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={FontScaleCap.display}>
                {formatMoney(total, code)}
              </Text>
            ))
          )}
          <Text style={styles.heroMuted} maxFontSizeMultiplier={FontScaleCap.heading}>
            {tn(activeAccounts.length, '{count} account', '{count} accounts')}
          </Text>

          {/* Side by side normally; stacked when large text would squeeze it. */}
          <View style={[styles.flowRow, isLargeText && styles.flowRowStacked]}>
            <Flow icon="arrow-down" label={t('{month} income', { month: monthLabel })} value={formatMoney(income, currency)} />
            <View style={isLargeText ? styles.flowDividerStacked : styles.flowDivider} />
            <Flow icon="arrow-up" label={t('{month} spent', { month: monthLabel })} value={formatMoney(expense, currency)} />
          </View>
        </LinearGradient>
      </View>

      {alert ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/budgets')}
          style={[styles.alert, { backgroundColor: alertIsOver ? theme.dangerSoft : theme.warningSoft }]}>
          <Ionicons name="warning" size={20} color={alertIsOver ? theme.danger : theme.warning} />
          <ThemedText type="small" style={styles.flex}>
            {alertIsOver
              ? t('You are over your {name} budget', { name: budgetTitle(alert) })
              : t('{percent}% of your {name} budget is spent', {
                  percent: Math.round(alert.percent_used),
                  name: budgetTitle(alert),
                })}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title={t('Budgets')}
          actionLabel={sortedBudgets.length > 0 ? t('Manage') : undefined}
          href="/budgets"
        />
        <Card style={styles.budgetCard}>
          {budgets.isPending || budgets.error ? (
            <QueryState isPending={budgets.isPending} error={budgets.error} onRetry={budgets.refetch} />
          ) : sortedBudgets.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/add-budget')} style={styles.budgetEmpty}>
              <View style={[styles.badge, { backgroundColor: theme.tintSoft }]}>
                <Ionicons name="pie-chart" size={20} color={theme.tint} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{t('Set a monthly budget')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Get a heads-up before you overspend.')}
                </ThemedText>
              </View>
              <Ionicons name="add-circle" size={26} color={theme.tint} />
            </Pressable>
          ) : (
            sortedBudgets.slice(0, 3).map((budget) => <BudgetProgress key={budget.id} budget={budget} compact />)
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('Recent activity')} actionLabel={t('See all')} href="/transactions" />
        <Card style={styles.listCard}>
          <QueryState isPending={recent.isPending} error={recent.error} onRetry={recent.refetch} />
          {recent.data?.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={28} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('No transactions yet. Tap + to add one.')}
              </ThemedText>
            </View>
          ) : null}
          {recent.data?.map((transaction, index) => (
            <View key={transaction.id}>
              {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
              <TransactionRow transaction={transaction} />
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function Flow({ icon, label, value }: { icon: 'arrow-down' | 'arrow-up'; label: string; value: string }) {
  return (
    <View style={styles.flow}>
      <View style={styles.flowIcon}>
        <Ionicons name={icon} size={14} color="#ffffff" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.flowLabel} numberOfLines={2} maxFontSizeMultiplier={FontScaleCap.heading}>
          {label}
        </Text>
        <Text style={styles.flowValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={FontScaleCap.heading}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return t('Good morning');
  if (hour < 18) return t('Good afternoon');
  return t('Good evening');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.one },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: 700 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 8 },
  heroShadow: { borderRadius: 28, boxShadow: BrandShadow },
  hero: { borderRadius: 28, padding: Spacing.four, gap: Spacing.half, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 28, borderColor: 'rgba(255,255,255,0.07)' },
  ringLarge: { width: 260, height: 260, top: -120, right: -90 },
  ringSmall: { width: 140, height: 140, bottom: -60, left: -40 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600 },
  heroAmount: {
    color: '#ffffff',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 800,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroMuted: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 },
  heroSpinner: { alignSelf: 'flex-start', marginVertical: Spacing.two },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  flow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  flowLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 },
  flowValue: { color: '#ffffff', fontSize: 15, fontWeight: 700, fontVariant: ['tabular-nums'] },
  flowRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  flowDividerStacked: { height: 1, marginVertical: Spacing.two, backgroundColor: 'rgba(255,255,255,0.2)' },
  flowDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 16 },
  budgetCard: { gap: Spacing.three },
  budgetEmpty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  badge: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  listCard: { gap: 0, paddingVertical: Spacing.two },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 42 + Spacing.three },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
});
