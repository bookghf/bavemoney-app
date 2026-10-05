import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AccountFormFields, validateAccount } from '@/components/account-form-fields';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { ErrorText, QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useAccounts, useReconcileAccount, useUpdateAccount } from '@/hooks/use-accounts';
import { useAccountLook } from '@/lib/account-look';
import type { Account, AccountType } from '@/lib/api/types';
import { haptics } from '@/lib/feedback';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { isNegative, parseAmountInput, toCents } from '@/lib/money';

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
  const look = useAccountLook()(account);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type as AccountType);
  const [color, setColor] = useState<string | null>(account.color ?? null);
  const [balance, setBalance] = useState(account.initial_balance);
  // The opening balance as last saved here; setting the current balance
  // moves it before the account list has refetched.
  const [savedBalance, setSavedBalance] = useState(account.initial_balance);
  const [showErrors, setShowErrors] = useState(false);
  const submitting = useRef(false);
  const updateAccount = useUpdateAccount();
  const stored = { balance: savedBalance, type: account.type };

  const save = () => {
    const { parsed, unchanged, nameError, balanceError } = validateAccount(name, type, balance, stored);
    if (nameError || balanceError || parsed === null) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    updateAccount.mutate(
      {
        id: account.id,
        name: name.trim(),
        type,
        // Left out when untouched, so a below-zero opening balance from
        // setting the current balance does not block other edits.
        ...(unchanged ? {} : { initial_balance: parsed }),
        ...(color !== (account.color ?? null) ? { color: color ?? '' } : {}),
      },
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
        <View style={styles.balanceRow}>
          <IconBadge icon={look.icon} colors={look} size={44} />
          <View style={styles.balanceText}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Current balance')}
            </ThemedText>
            <ThemedText type="sectionTitle" themeColor={isNegative(account.current_balance) ? 'danger' : undefined}>
              {formatMoney(account.current_balance, account.currency)}
            </ThemedText>
          </View>
        </View>
        <SetCurrentBalance
          account={account}
          onReconciled={(updated) => {
            setBalance(updated.initial_balance);
            setSavedBalance(updated.initial_balance);
          }}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('Currency {code} can not change once the account has transactions.', { code: account.currency })}
        </ThemedText>
      </Card>

      <AccountFormFields
        name={name}
        onName={setName}
        type={type}
        onType={setType}
        color={color}
        onColor={setColor}
        balance={balance}
        onBalance={setBalance}
        stored={stored}
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

/**
 * "Set current balance": the user types what the bank shows today and the API
 * back-computes the opening balance, so no made-up income or expense lands in
 * the reports.
 */
function SetCurrentBalance({ account, onReconciled }: { account: Account; onReconciled: (updated: Account) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [showError, setShowError] = useState(false);
  const reconcile = useReconcileAccount();
  const allowNegative = account.type === 'credit_card';
  const parsed = parseAmountInput(value, { allowNegative });
  const error =
    parsed !== null
      ? null
      : !allowNegative && value.trim().startsWith('-')
        ? t('Only credit cards can be below zero')
        : t('Use a number with at most 2 decimals, e.g. 1,500.00');

  if (!open) {
    return (
      <Button
        title={t('Set current balance')}
        variant="secondary"
        onPress={() => {
          setValue(account.current_balance);
          setShowError(false);
          reconcile.reset();
          setOpen(true);
        }}
      />
    );
  }

  const submit = () => {
    if (parsed === null) {
      setShowError(true);
      haptics.warning();
      return;
    }
    if (reconcile.isPending) return;
    if (toCents(parsed) === toCents(account.current_balance)) {
      setOpen(false);
      return;
    }
    reconcile.mutate(
      { id: account.id, balance: parsed },
      {
        onSuccess: (updated) => {
          haptics.success();
          onReconciled(updated);
          toast.success(t('Balance set to {amount}', { amount: formatMoney(updated.current_balance, updated.currency) }));
          setOpen(false);
        },
      },
    );
  };

  return (
    <View style={styles.reconcile}>
      <TextField
        label={t('Balance today')}
        hint={t('Enter what your bank or wallet shows now. The opening balance is adjusted to match, so no income or expense is added to your reports.')}
        value={value}
        onChangeText={setValue}
        keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
        placeholder="0.00"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        error={showError ? error : null}
      />
      <ErrorText error={reconcile.error} />
      <View style={styles.reconcileButtons}>
        <Button title={t('Cancel')} variant="quiet" onPress={() => setOpen(false)} style={styles.flex} />
        <Button title={t('Set balance')} onPress={submit} loading={reconcile.isPending} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  danger: { gap: Spacing.two, marginTop: Spacing.four },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  balanceText: { flex: 1, gap: 1 },
  reconcile: { gap: Spacing.two },
  reconcileButtons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
