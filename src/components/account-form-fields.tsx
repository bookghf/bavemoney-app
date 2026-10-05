import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChipSelect } from '@/components/ui/chip-select';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useCurrencies } from '@/hooks/use-accounts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ACCOUNT_COLORS, accountColorKey, accountLook } from '@/lib/account-look';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/api/types';
import type { CategoryColorKey } from '@/lib/category-look';
import { orderCurrencies } from '@/lib/currency-order';
import { haptics } from '@/lib/feedback';
import { humanize } from '@/lib/format';
import { t } from '@/lib/i18n';
import { parseAmountInput } from '@/lib/money';
import { useAuthStore } from '@/store/auth-store';

export const MAX_ACCOUNT_NAME = 100;

/** The opening balance and type as saved, for the edit form. */
type Stored = { balance: string; type: string };

/**
 * Validation shared by the new and edit account forms. An opening balance
 * left as saved is always accepted: setting the current balance can leave a
 * non-credit account below zero, and renaming it must still work.
 */
export function validateAccount(name: string, type: AccountType, balance: string, stored?: Stored) {
  const unchanged = !!stored && balance === stored.balance && type === stored.type;
  const parsed = unchanged ? stored.balance : parseAmountInput(balance || '0', { allowNegative: type === 'credit_card' });
  return {
    parsed,
    unchanged,
    nameError: name.trim() === '' ? t('Give the account a name') : null,
    balanceError:
      parsed === null
        ? type !== 'credit_card' && balance.trim().startsWith('-')
          ? t('Only credit cards can start below zero')
          : t('Use a number with at most 2 decimals, e.g. 1,500.00')
        : null,
  };
}

/** Spoken names for the color swatches. */
const COLOR_LABELS: Record<CategoryColorKey, () => string> = {
  orange: () => t('Orange'),
  amber: () => t('Amber'),
  lime: () => t('Lime'),
  cyan: () => t('Cyan'),
  indigo: () => t('Indigo'),
  violet: () => t('Violet'),
  fuchsia: () => t('Fuchsia'),
  pink: () => t('Pink'),
  brown: () => t('Brown'),
  slate: () => t('Slate'),
};

type Props = {
  name: string;
  onName: (value: string) => void;
  type: AccountType;
  onType: (value: AccountType) => void;
  /** Null shows the type's default color. */
  color: string | null;
  onColor: (value: CategoryColorKey) => void;
  balance: string;
  onBalance: (value: string) => void;
  /** Omit to hide the picker (currency is locked once used). */
  currency?: string;
  onCurrency?: (value: string) => void;
  /** The saved opening balance on the edit form; see validateAccount. */
  stored?: Stored;
  showErrors: boolean;
  autoFocusName?: boolean;
};

export function AccountFormFields(props: Props) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const mainCurrency = useAuthStore((state) => state.user?.default_currency);
  const currencies = useCurrencies();
  const { balanceError, nameError } = validateAccount(props.name, props.type, props.balance, props.stored);
  const codes = orderCurrencies(
    currencies.data?.map((c) => c.code) ?? (props.currency ? [props.currency] : []),
    mainCurrency,
  );
  const selectedColor = accountColorKey({ type: props.type, color: props.color });

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
      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('Color')}
        </ThemedText>
        <View accessibilityRole="radiogroup" style={styles.swatches}>
          {ACCOUNT_COLORS.map((key) => {
            const selected = key === selectedColor;
            const look = accountLook({ type: props.type, color: key }, scheme);
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={COLOR_LABELS[key]()}
                accessibilityState={{ checked: selected }}
                hitSlop={4}
                onPress={() => {
                  haptics.selection();
                  props.onColor(key);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: selected ? look.solid : look.bg, borderColor: selected ? theme.text : 'transparent' },
                ]}>
                <Ionicons name={look.icon} size={20} color={selected ? '#ffffff' : look.fg} />
              </Pressable>
            );
          })}
        </View>
      </View>
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

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
