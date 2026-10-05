import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { AccountFormFields, validateAccount } from '@/components/account-form-fields';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { useCreateAccount } from '@/hooks/use-accounts';
import type { AccountType } from '@/lib/api/types';
import type { CategoryColorKey } from '@/lib/category-look';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';

export default function AddAccountScreen() {
  const defaultCurrency = useAuthStore((state) => state.user?.default_currency) || 'THB';
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState(defaultCurrency);
  // Null until picked, so the color follows the type's default.
  const [color, setColor] = useState<CategoryColorKey | null>(null);
  const [balance, setBalance] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const submitting = useRef(false);
  const createAccount = useCreateAccount();

  const submit = () => {
    const { parsed, nameError, balanceError } = validateAccount(name, type, balance);
    if (nameError || balanceError || parsed === null) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    createAccount.mutate(
      { name: name.trim(), type, currency, initial_balance: parsed, color: color ?? undefined },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Account "{name}" created', { name: name.trim() }));
          router.back();
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={createAccount.error} />
          <Button title={t('Create account')} onPress={submit} loading={createAccount.isPending} />
        </>
      }>
      <AccountFormFields
        name={name}
        onName={setName}
        type={type}
        onType={setType}
        color={color}
        onColor={setColor}
        currency={currency}
        onCurrency={setCurrency}
        balance={balance}
        onBalance={setBalance}
        showErrors={showErrors}
        autoFocusName
      />
    </Screen>
  );
}
