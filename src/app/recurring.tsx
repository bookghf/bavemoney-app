import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { ErrorText, QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useDeleteRecurringRule, useRecurringRules, useUpdateRecurringRule } from '@/hooks/use-recurring';
import { useTheme } from '@/hooks/use-theme';
import type { RecurringRule } from '@/lib/api/types';
import { useCategoryLook } from '@/lib/category-look';
import { formatDay } from '@/lib/dates';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { ruleTitle, scheduleLabel } from '@/lib/recurring';

/** Rent, salary, and monthly transfers the API adds by itself on their day. */
export default function RecurringScreen() {
  const rules = useRecurringRules();
  const updateRule = useUpdateRecurringRule();
  const deleteRule = useDeleteRecurringRule();

  const toggle = (rule: RecurringRule) => {
    haptics.selection();
    updateRule.mutate(
      { id: rule.id, is_active: !rule.is_active },
      { onSuccess: () => toast.success(rule.is_active ? t('Recurring item paused') : t('Recurring item resumed')) },
    );
  };

  const confirmDelete = (rule: RecurringRule) => {
    haptics.warning();
    Alert.alert(
      t('Delete the {name} recurring item?', { name: ruleTitle(rule) }),
      t('Transactions it already added stay.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => deleteRule.mutate(rule.id, { onSuccess: () => toast.success(t('Recurring item deleted')) }),
        },
      ],
    );
  };

  return (
    <Screen
      edges={['bottom']}
      refreshing={rules.isRefetching}
      onRefresh={rules.refetch}
      footer={
        <>
          <ErrorText error={updateRule.error ?? deleteRule.error} />
          <Button title={t('New recurring item')} onPress={() => router.push('/recurring-form')} />
        </>
      }>
      <QueryState isPending={rules.isPending} error={rules.error} onRetry={rules.refetch} />

      {rules.data?.length === 0 ? (
        <Card style={styles.empty}>
          <IconBadge icon="repeat" size={56} />
          <ThemedText type="sectionTitle">{t('No recurring items yet')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('Add rent, salary, or a monthly transfer once. It is recorded for you on its day every month or week.')}
          </ThemedText>
        </Card>
      ) : null}

      {rules.data?.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onToggle={() => toggle(rule)} onDelete={() => confirmDelete(rule)} />
      ))}
    </Screen>
  );
}

function RuleCard({ rule, onToggle, onDelete }: { rule: RecurringRule; onToggle: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const categoryLook = useCategoryLook();
  const isTransfer = rule.type === 'transfer';
  const isIncome = rule.type === 'income';
  const title = ruleTitle(rule);
  const look = categoryLook(rule.category?.parent ?? rule.category, rule.type);
  const sign = isTransfer ? '' : isIncome ? '+' : '−';
  const accounts = isTransfer ? `${rule.account_name} → ${rule.to_account_name ?? '?'}` : rule.account_name;
  const status = !rule.is_active
    ? rule.pause_reason === 'account_archived'
      ? t('Paused: its account is archived')
      : t('Paused')
    : rule.next_run_on
      ? t('Next: {date}', { date: formatDay(rule.next_run_on, { weekday: 'short', year: 'numeric' }) })
      : t('Ended');

  return (
    <Card style={[styles.card, !rule.is_active && styles.paused]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${sign}${formatMoney(rule.amount, rule.currency)}, ${scheduleLabel(rule)}, ${status}`}
        accessibilityHint={t('Opens the recurring item to edit it')}
        onPress={() => router.push({ pathname: '/recurring-form', params: { id: rule.id } })}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        {isTransfer ? (
          <IconBadge icon="swap-horizontal" tone="transfer" size={42} />
        ) : (
          <IconBadge icon={look.icon} colors={look} size={42} />
        )}
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {scheduleLabel(rule)} · {accounts}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor={isTransfer ? 'transfer' : isIncome ? 'success' : 'danger'}>
          {sign}
          {formatMoney(rule.amount, rule.currency)}
        </ThemedText>
      </Pressable>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <ThemedText
          type="small"
          themeColor={rule.pause_reason ? 'danger' : 'textSecondary'}
          style={styles.flex}
          numberOfLines={2}>
          {status}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rule.is_active ? t('Pause {name}', { name: title }) : t('Resume {name}', { name: title })}
          hitSlop={12}
          onPress={onToggle}>
          <Ionicons name={rule.is_active ? 'pause-circle-outline' : 'play-circle-outline'} size={24} color={theme.tint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Delete {name}', { name: title })}
          hitSlop={12}
          onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  center: { textAlign: 'center' },
  card: { gap: Spacing.two },
  paused: { opacity: 0.75 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
});
