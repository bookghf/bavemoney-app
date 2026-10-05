import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { IconButton } from '@/components/ui/icon-button';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { useAccountLook } from '@/lib/account-look';
import { formatMoney, humanize } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { isNegative, totalsByCurrency } from '@/lib/money';

export default function AccountScreen() {
  const accounts = useAccounts();

  const active = (accounts.data ?? []).filter((account) => !account.is_archived);
  const archived = (accounts.data ?? []).filter((account) => account.is_archived);
  const totals = totalsByCurrency(active);

  return (
    <Screen inTabs refreshing={accounts.isRefetching} onRefresh={accounts.refetch}>
      <ScreenHeader
        title={t('Accounts')}
        right={
          <IconButton icon="add" primary accessibilityLabel={t('New account')} onPress={() => router.push('/add-account')} />
        }
      />

      <QueryState isPending={accounts.isPending} error={accounts.error} onRetry={accounts.refetch} />

      {accounts.data?.length === 0 ? (
        <Card style={styles.empty}>
          <IconBadge icon="wallet" size={56} />
          <ThemedText type="sectionTitle">{t('No accounts yet')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('Add a bank account, card, e-wallet or cash to start recording transactions.')}
          </ThemedText>
          <Button title={t('Create account')} onPress={() => router.push('/add-account')} style={styles.emptyButton} />
        </Card>
      ) : null}

      {Object.keys(totals).length > 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Net worth')} · {tn(active.length, '{count} account', '{count} accounts')}
          </ThemedText>
          {Object.entries(totals).map(([code, total]) => (
            <ThemedText key={code} type="amount" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(total, code)}
            </ThemedText>
          ))}
        </Card>
      ) : null}

      {active.length > 0 ? (
        <Card style={styles.list}>
          {active.map((account, index) => (
            <AccountRow key={account.id} account={account} separator={index > 0} />
          ))}
        </Card>
      ) : null}

      {archived.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            {t('Archived')}
          </ThemedText>
          <Card style={[styles.list, styles.archived]}>
            {archived.map((account, index) => (
              <AccountRow key={account.id} account={account} separator={index > 0} />
            ))}
          </Card>
        </View>
      ) : null}

      {accounts.data && accounts.data.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {t('Tap an account to edit it or set its current balance.')}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function AccountRow({
  account,
  separator,
}: {
  account: NonNullable<ReturnType<typeof useAccounts>['data']>[number];
  separator: boolean;
}) {
  const theme = useTheme();
  const look = useAccountLook()(account);
  const { isLargeText } = useFontScale();
  const negative = isNegative(account.current_balance);
  const balance = (
    <ThemedText type="smallBold" themeColor={negative ? 'danger' : undefined} style={styles.balance}>
      {formatMoney(account.current_balance, account.currency)}
    </ThemedText>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, ${formatMoney(account.current_balance, account.currency)}`}
      accessibilityHint={t('Edit this account')}
      onPress={() => router.push({ pathname: '/edit-account', params: { id: account.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      {separator ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
      <IconBadge icon={look.icon} colors={look} size={44} />
      {/* With large text the balance moves under the name instead of squeezing it. */}
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={isLargeText ? 2 : 1} style={styles.name}>
          {account.name}
        </ThemedText>
        {isLargeText ? balance : null}
        <ThemedText type="small" themeColor="textSecondary">
          {humanize(account.type)} · {account.currency}
        </ThemedText>
      </View>
      {isLargeText ? null : balance}
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyButton: { alignSelf: 'stretch', marginTop: Spacing.two },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  separator: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: Spacing.three + 44 + Spacing.three,
    height: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 1 },
  name: { fontSize: 16 },
  balance: { fontSize: 15, fontVariant: ['tabular-nums'] },
  section: { gap: Spacing.two },
  sectionLabel: { marginLeft: Spacing.three },
  archived: { opacity: 0.6 },
});
