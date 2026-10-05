import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import type { Category, CategoryType } from '@/lib/api/types';
import { useCategoryLook } from '@/lib/category-look';
import { categoryName, t } from '@/lib/i18n';

/** Every category of one type: built-ins are read-only, the user's own are editable. */
export default function CategoriesScreen() {
  const categories = useCategories();
  const [type, setType] = useState<CategoryType>('expense');
  const list = (categories.data ?? []).filter((category) => category.type === type);

  return (
    <Screen
      edges={['bottom']}
      refreshing={categories.isRefetching}
      onRefresh={categories.refetch}
      footer={
        <Button
          title={t('New category')}
          onPress={() => router.push({ pathname: '/category-form', params: { type } })}
        />
      }>
      <SegmentedControl
        options={[
          { value: 'expense', label: t('Expense') },
          { value: 'income', label: t('Income') },
        ]}
        value={type}
        onChange={setType}
      />
      <QueryState isPending={categories.isPending} error={categories.error} onRetry={categories.refetch} />
      {list.length > 0 ? (
        <Card style={styles.list}>
          {list.map((category, index) => (
            <View key={category.id}>
              <CategoryRow category={category} separator={index > 0} />
              {(category.children ?? []).map((child) => (
                <CategoryRow key={child.id} category={child} parent={category} separator />
              ))}
            </View>
          ))}
        </Card>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('Built-in categories can not be changed, but you can add your own subcategories under them.')}
      </ThemedText>
    </Screen>
  );
}

function CategoryRow({ category, parent, separator }: { category: Category; parent?: Category; separator?: boolean }) {
  const theme = useTheme();
  const lookOf = useCategoryLook();
  // Subcategories wear their parent's look.
  const look = lookOf(parent ?? category);
  const editable = !category.is_system;
  const open = () =>
    editable
      ? router.push({ pathname: '/category-form', params: { id: category.id } })
      : router.push({ pathname: '/category-form', params: { type: category.type, parent_id: category.id } });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={categoryName(category.name)}
      accessibilityHint={editable ? t('Edit this category') : t('Add a subcategory')}
      onPress={open}
      style={({ pressed }) => [styles.row, parent && styles.child, pressed && { backgroundColor: theme.backgroundElement }]}>
      {separator ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
      {parent ? (
        <View style={[styles.dot, { backgroundColor: look.chart }]} />
      ) : (
        <IconBadge icon={look.icon} colors={look} size={36} />
      )}
      <ThemedText type={parent ? 'small' : 'default'} style={styles.name}>
        {categoryName(category.name)}
      </ThemedText>
      {editable ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      ) : parent ? null : (
        <View style={styles.builtIn}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Built-in')}
          </ThemedText>
          <Ionicons name="add-circle-outline" size={20} color={theme.tint} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, minHeight: 56 },
  child: { paddingLeft: Spacing.three + 36 + Spacing.three, minHeight: 48 },
  separator: { position: 'absolute', top: 0, right: 0, left: Spacing.three + 36 + Spacing.three, height: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
  builtIn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
