import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconBadge } from '@/components/ui/icon-badge';
import { Radius, Spacing } from '@/constants/theme';
import type { Transaction } from '@/lib/api/types';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatShortDate } from '@/lib/format';
import { categoryName, t } from '@/lib/i18n';
import { useCategoryLook } from '@/lib/category-look';

type TransactionRowProps = {
  transaction: Transaction;
  /** Leave the date out when rows are already grouped under a day heading. */
  hideDate?: boolean;
};

/** One ledger entry; tapping it opens the edit screen. */
export function TransactionRow({ transaction, hideDate }: TransactionRowProps) {
  const theme = useTheme();
  const categoryLook = useCategoryLook();
  const { isLargeText } = useFontScale();
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
  const subtitle = [detail, accounts, hideDate ? undefined : formatShortDate(transaction.occurred_at)]
    .filter(Boolean)
    .join(' · ');
  // Transfers move money between your own accounts, so they are neither gain nor loss.
  const sign = isTransfer ? '' : isIncome ? '+' : '−';
  // Spending red, income green, transfers blue.
  const color = isTransfer ? 'transfer' : isIncome ? 'success' : 'danger';
  // The tile shows the category's own color (its parent's for a
  // subcategory); the amount's color and sign show money in or out.
  const look = categoryLook(transaction.category?.parent ?? transaction.category, transaction.type);

  const amount = (
    <ThemedText type="smallBold" themeColor={color} style={styles.amount}>
      {sign}
      {formatMoney(transaction.amount, transaction.currency)}
    </ThemedText>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sign}${formatMoney(transaction.amount, transaction.currency)}, ${subtitle}`}
      accessibilityHint={t('Opens the transaction to edit or delete it')}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      {isTransfer ? (
        <IconBadge icon="swap-horizontal" tone="transfer" size={42} />
      ) : (
        <IconBadge icon={look.icon} colors={look} size={42} />
      )}
      {/* With large text the amount moves under the title instead of
          squeezing it, and lines wrap instead of truncating. */}
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={isLargeText ? 2 : 1}>
          {title}
        </ThemedText>
        {isLargeText ? amount : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={isLargeText ? 3 : 1}>
          {subtitle}
        </ThemedText>
      </View>
      {isLargeText ? null : amount}
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
    borderRadius: Radius.md,
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
