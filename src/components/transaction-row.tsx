import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconBadge } from '@/components/ui/icon-badge';
import { Spacing } from '@/constants/theme';
import type { Transaction } from '@/lib/api/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { categoryIcon } from '@/lib/icons';

type TransactionRowProps = {
  transaction: Transaction;
  /** Leave the date out when rows are already grouped under a day heading. */
  hideDate?: boolean;
};

/** One ledger entry; tapping it opens the edit screen. */
export function TransactionRow({ transaction, hideDate }: TransactionRowProps) {
  const theme = useTheme();
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const title = isTransfer
    ? transaction.note || t('Transfer')
    : categoryLabel(transaction) || transaction.note || (isIncome ? t('Income') : t('Expense'));
  const accounts = isTransfer
    ? `${transaction.account_name} → ${transaction.to_account_name ?? '?'}`
    : transaction.account_name;
  // Show the note under the category when both exist.
  const detail = !isTransfer && categoryLabel(transaction) ? transaction.note : undefined;
  const subtitle = [detail, accounts, hideDate ? undefined : formatDate(transaction.occurred_at)]
    .filter(Boolean)
    .join(' · ');
  // Transfers move money between your own accounts, so they are neither gain nor loss.
  const sign = isTransfer ? '' : isIncome ? '+' : '−';
  const color = isTransfer ? undefined : isIncome ? 'success' : undefined;
  const icon = categoryIcon(transaction.category?.parent?.name ?? transaction.category?.name, transaction.type);
  const tone = isTransfer ? 'neutral' : isIncome ? 'success' : 'tint';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sign}${formatMoney(transaction.amount, transaction.currency)}, ${subtitle}`}
      accessibilityHint={t('Opens the transaction to edit or delete it')}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <IconBadge icon={icon} tone={tone} size={42} />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText
        type="smallBold"
        themeColor={isTransfer ? 'textSecondary' : color}
        style={styles.amount}>
        {sign}
        {formatMoney(transaction.amount, transaction.currency)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    marginHorizontal: -Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
  text: { flex: 1, gap: 1 },
  amount: { fontSize: 15, fontVariant: ['tabular-nums'] },
});

/** "Transport › Bus" for a subcategory, "Transport" for a top-level category. */
function categoryLabel({ category }: Transaction): string | undefined {
  if (!category) return undefined;
  return category.parent
    ? `${categoryName(category.parent.name)} › ${categoryName(category.name)}`
    : categoryName(category.name);
}
