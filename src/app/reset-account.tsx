import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useBudgets } from '@/hooks/use-budgets';
import { useCategories } from '@/hooks/use-categories';
import { useResetAccount } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useTransactions } from '@/hooks/use-transactions';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';

/**
 * Erase all ledger data and start fresh. Two confirmations guard it: the
 * password (re-checked by the API) and a final destructive alert.
 */
export default function ResetAccountScreen() {
  const theme = useTheme();
  const email = useAuthStore((state) => state.user?.email);
  const reset = useResetAccount();
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);

  // What will be erased, so the user sees the scale before confirming.
  const accounts = useAccounts();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const categories = useCategories();
  const customCategories = (categories.data ?? []).reduce(
    (count, category) =>
      count + (category.is_system ? 0 : 1) + (category.children ?? []).filter((child) => !child.is_system).length,
    0,
  );
  const rows = [
    { icon: 'receipt-outline' as const, label: t('Transactions'), count: transactions.data?.total },
    { icon: 'wallet-outline' as const, label: t('Accounts'), count: accounts.data?.length },
    { icon: 'pie-chart-outline' as const, label: t('Budgets'), count: budgets.data?.length },
    { icon: 'pricetags-outline' as const, label: t('Custom categories'), count: categories.data ? customCategories : undefined },
  ];

  const passwordError = password === '' ? t('Enter your password to confirm') : null;

  const confirm = () => {
    if (passwordError) {
      setShowError(true);
      haptics.warning();
      return;
    }
    haptics.warning();
    Alert.alert(
      t('Reset your account?'),
      t('All your transactions, accounts, budgets, and custom categories will be permanently deleted. This can not be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reset account'),
          style: 'destructive',
          onPress: () =>
            reset.mutate(password, {
              onSuccess: () => {
                haptics.success();
                toast.success(t('Your account was reset. Start fresh!'));
                router.dismissTo('/');
              },
              onError: () => setPassword(''),
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
          <ErrorText error={reset.error} />
          <Button title={t('Reset account')} variant="danger" onPress={confirm} loading={reset.isPending} />
        </>
      }>
      <Card style={[styles.warning, { backgroundColor: theme.dangerSoft }]}>
        <Ionicons name="warning" size={28} color={theme.danger} />
        <ThemedText type="sectionTitle">{t('Start over from zero')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('This permanently deletes your data. Your login ({email}) stays, so you can start again right away.', {
            email: email ?? '',
          })}
        </ThemedText>
      </Card>

      <Card style={styles.list}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Ionicons name={row.icon} size={20} color={theme.textSecondary} />
            <ThemedText style={styles.flex}>{row.label}</ThemedText>
            <ThemedText type="smallBold" themeColor="danger">
              {row.count ?? '…'}
            </ThemedText>
          </View>
        ))}
      </Card>

      <TextField
        label={t('Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        hint={t('Enter your password to confirm')}
        error={showError ? passwordError : null}
        onSubmitEditing={confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  warning: { gap: Spacing.two },
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, minHeight: 52 },
  flex: { flex: 1 },
});
