import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { TransactionForm } from '@/components/transaction-form';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useTransaction } from '@/hooks/use-transactions';
import { t } from '@/lib/i18n';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transaction = useTransaction(id);
  const accounts = useAccounts();
  // The form splits the category into parent/subcategory, so wait for the tree.
  const categories = useCategories();

  const pending = transaction.isPending || accounts.isPending || categories.isPending;
  const error = transaction.error ?? accounts.error;
  if (pending || error || !transaction.data || !accounts.data) {
    return (
      <Screen edges={['bottom']}>
        <QueryState isPending={pending} error={error} onRetry={transaction.refetch} />
        {!pending && !error ? <ThemedText themeColor="textSecondary">{t('Transaction not found.')}</ThemedText> : null}
      </Screen>
    );
  }
  // Keyed so the form re-initializes if another transaction is opened.
  return <TransactionForm key={transaction.data.id} accounts={accounts.data} existing={transaction.data} />;
}
