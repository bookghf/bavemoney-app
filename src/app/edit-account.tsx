import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AccountFormFields, validateAccount } from '@/components/account-form-fields';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText, QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useAccounts, useUpdateAccount } from '@/hooks/use-accounts';
import type { Account, AccountType } from '@/lib/api/types';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === id);

  if (!account) {
    return (
      <Screen edges={['bottom']}>
        <QueryState isPending={accounts.isPending} error={accounts.error} onRetry={accounts.refetch} />
        {accounts.data ? <ThemedText themeColor="textSecondary">{t('Account not found.')}</ThemedText> : null}
      </Screen>
    );
  }
  // Keyed so the form re-initializes if a different account is opened.
  return <EditAccountForm key={account.id} account={account} />;
}

function EditAccountForm({ account }: { account: Account }) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type as AccountType);
  const [balance, setBalance] = useState(account.initial_balance);
  const [showErrors, setShowErrors] = useState(false);
  const submitting = useRef(false);
  const updateAccount = useUpdateAccount();

  const save = () => {
    const { parsed, nameError, balanceError } = validateAccount(name, type, balance);
    if (nameError || balanceError || parsed === null) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    updateAccount.mutate(
      { id: account.id, name: name.trim(), type, initial_balance: parsed },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Account saved'));
          router.back();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };

  const setArchived = (archived: boolean) =>
    updateAccount.mutate(
      { id: account.id, is_archived: archived },
      {
        onSuccess: () => {
          toast.success(archived ? t('Account archived') : t('Account restored'), {
            label: t('Undo'),
            onPress: () => updateAccount.mutate({ id: account.id, is_archived: !archived }),
          });
          router.back();
        },
      },
    );

  const confirmArchive = () => {
    if (account.is_archived) {
      setArchived(false);
      return;
    }
    haptics.warning();
    Alert.alert(
      t('Archive "{name}"?', { name: account.name }),
      t('It disappears from your balance and you can no longer add transactions to it. Its history stays in your reports.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Archive'), style: 'destructive', onPress: () => setArchived(true) },
      ],
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={updateAccount.error} />
          <Button title={t('Save changes')} onPress={save} loading={updateAccount.isPending} />
        </>
      }>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Current balance')}
        </ThemedText>
        <ThemedText type="sectionTitle">{formatMoney(account.current_balance, account.currency)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Currency {code} can not change once the account has transactions.', { code: account.currency })}
        </ThemedText>
      </Card>

      <AccountFormFields
        name={name}
        onName={setName}
        type={type}
        onType={setType}
        balance={balance}
        onBalance={setBalance}
        showErrors={showErrors}
      />

      <View style={styles.danger}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {account.is_archived ? t('Archived account') : t('Danger zone')}
        </ThemedText>
        <Button
          title={account.is_archived ? t('Restore account') : t('Archive account')}
          variant={account.is_archived ? 'secondary' : 'danger'}
          onPress={confirmArchive}
          disabled={updateAccount.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { gap: Spacing.two, marginTop: Spacing.four },
});
