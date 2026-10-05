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
  const custom = list.filter((category) => !category.is_system);
  const builtIn = list.filter((category) => category.is_system);

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
      {/* The user's own categories first, then the built-ins under one
          header instead of a "Built-in" tag on every row. */}
      {custom.length > 0 ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            {t('Custom categories')}
          </ThemedText>
          <CategoryList categories={custom} />
        </>
      ) : null}
      {builtIn.length > 0 ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            {t('Built-in categories')}
          </ThemedText>
          <CategoryList categories={builtIn} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('Built-in categories can not be changed, but you can add your own subcategories under them.')}
          </ThemedText>
        </>
      ) : null}
    </Screen>
  );
}

function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <Card style={styles.list}>
      {categories.map((category, index) => (
        <View key={category.id}>
          <CategoryRow category={category} separator={index > 0} />
          {(category.children ?? []).map((child) => (
            <CategoryRow key={child.id} category={child} parent={category} separator />
          ))}
        </View>
      ))}
    </Card>
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
        // The whole row is pressable; the + gets a full 44pt box so it reads
        // as a target of its own.
        <View style={styles.add}>
          <Ionicons name="add-circle-outline" size={26} color={theme.tint} />
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
  add: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -Spacing.two },
  sectionLabel: { marginLeft: Spacing.three, marginTop: Spacing.two },
});
