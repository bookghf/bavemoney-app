import { ChipSelect } from '@/components/ui/chip-select';
import { TextField } from '@/components/ui/text-field';
import { useCurrencies } from '@/hooks/use-accounts';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/api/types';
import { humanize } from '@/lib/format';
import { t } from '@/lib/i18n';
import { parseAmountInput } from '@/lib/money';

export const MAX_ACCOUNT_NAME = 100;

/** Validation shared by the new and edit account forms. */
export function validateAccount(name: string, type: AccountType, balance: string) {
  const parsed = parseAmountInput(balance || '0', { allowNegative: type === 'credit_card' });
  return {
    parsed,
    nameError: name.trim() === '' ? t('Give the account a name') : null,
    balanceError:
      parsed === null
        ? type !== 'credit_card' && balance.trim().startsWith('-')
          ? t('Only credit cards can start below zero')
          : t('Use a number with at most 2 decimals, e.g. 1,500.00')
        : null,
  };
}

type Props = {
  name: string;
  onName: (value: string) => void;
  type: AccountType;
  onType: (value: AccountType) => void;
  balance: string;
  onBalance: (value: string) => void;
  /** Omit to hide the picker (currency is locked once used). */
  currency?: string;
  onCurrency?: (value: string) => void;
  showErrors: boolean;
  autoFocusName?: boolean;
};

export function AccountFormFields(props: Props) {
  const currencies = useCurrencies();
  const { nameError, balanceError } = validateAccount(props.name, props.type, props.balance);
  const codes = currencies.data?.map((c) => c.code) ?? (props.currency ? [props.currency] : []);

  return (
    <>
      <TextField
        label={t('Name')}
        value={props.name}
        onChangeText={props.onName}
        placeholder={t('e.g. Wallet, KBank, TrueMoney')}
        autoFocus={props.autoFocusName}
        maxLength={MAX_ACCOUNT_NAME}
        error={props.showErrors ? nameError : null}
      />
      <ChipSelect
        label={t('Type')}
        options={ACCOUNT_TYPES.map((value) => ({ value, label: humanize(value) }))}
        value={props.type}
        onChange={props.onType}
      />
      {props.currency && props.onCurrency ? (
        <ChipSelect
          label={t('Currency')}
          options={codes.map((code) => ({ value: code, label: code }))}
          value={props.currency}
          onChange={props.onCurrency}
        />
      ) : null}
      <TextField
        label={props.type === 'credit_card' ? t('Opening balance (negative = amount owed)') : t('Opening balance')}
        value={props.balance}
        onChangeText={props.onBalance}
        keyboardType={props.type === 'credit_card' ? 'numbers-and-punctuation' : 'decimal-pad'}
        placeholder="0.00"
        error={props.showErrors ? balanceError : null}
      />
    </>
  );
}
