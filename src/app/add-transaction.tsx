import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { TransactionForm, type EntryType } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { useAccounts } from '@/hooks/use-accounts';
import { t } from '@/lib/i18n';

const TYPES: readonly EntryType[] = ['expense', 'income', 'transfer'];

export default function AddTransactionScreen() {
  // Optional preset from the tab bar's add menu, e.g. /add-transaction?type=income.
  const { type } = useLocalSearchParams<{ type?: string }>();
  const accounts = useAccounts();
  const active = (accounts.data ?? []).filter((account) => !account.is_archived);

  if (accounts.isPending || accounts.error) {
    return (
      <Screen edges={['bottom']}>
        <QueryState isPending={accounts.isPending} error={accounts.error} onRetry={accounts.refetch} />
      </Screen>
    );
  }

  if (active.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">{t('You need an account before adding transactions.')}</ThemedText>
        <Button title={t('Create an account')} onPress={() => router.replace('/add-account')} />
      </Screen>
    );
  }

  const initialType = TYPES.find((value) => value === type) ?? 'expense';
  return <TransactionForm accounts={accounts.data ?? []} initialType={initialType} />;
}
