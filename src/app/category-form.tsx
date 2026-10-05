import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { IconBadge } from '@/components/ui/icon-badge';
import { ErrorText, QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import {
  flattenCategories,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/use-categories';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { Category, CategoryType } from '@/lib/api/types';
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_CHOICES,
  categoryLook,
  swatchColor,
  type CategoryColorKey,
} from '@/lib/category-look';
import { haptics } from '@/lib/feedback';
import { categoryName, t } from '@/lib/i18n';
import { charCount } from '@/lib/validation';

const MAX_NAME = 50;
const NO_PARENT = 'none';

/**
 * Create a category (optionally under a parent), or edit one of the user's
 * own. Params: id (edit), type and parent_id (create presets).
 */
export default function CategoryFormScreen() {
  const { id, type, parent_id } = useLocalSearchParams<{ id?: string; type?: string; parent_id?: string }>();
  const categories = useCategories();
  const existing = id ? flattenCategories(categories.data ?? []).find((c) => c.id === id) : undefined;

  if (id && !existing) {
    return (
      <Screen edges={['bottom']}>
        <QueryState isPending={categories.isPending} error={categories.error} onRetry={categories.refetch} />
        {categories.data ? <ThemedText themeColor="textSecondary">{t('Category not found.')}</ThemedText> : null}
      </Screen>
    );
  }
  return (
    <CategoryForm
      key={existing?.id ?? 'new'}
      existing={existing}
      tree={categories.data ?? []}
      initialType={type === 'income' ? 'income' : 'expense'}
      initialParent={parent_id}
    />
  );
}

function CategoryForm({
  existing,
  tree,
  initialType,
  initialParent,
}: {
  existing?: Category;
  tree: Category[];
  initialType: CategoryType;
  initialParent?: string;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const saving = useRef(false);

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<CategoryType>((existing?.type as CategoryType) ?? initialType);
  const [parentId, setParentId] = useState<string>(existing?.parent_id ?? initialParent ?? NO_PARENT);
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [color, setColor] = useState<CategoryColorKey | ''>((existing?.color as CategoryColorKey) ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const isEdit = !!existing;
  // A category with subcategories stays top-level; others may move under a parent.
  const canHaveParent = !(existing?.children?.length ?? 0);
  const parents = tree.filter((c) => c.type === type && c.id !== existing?.id);
  const parent = parentId === NO_PARENT ? undefined : parents.find((c) => c.id === parentId);
  const isSub = !!parent;

  const nameError =
    name.trim() === ''
      ? t('Give the category a name')
      : charCount(name.trim()) > MAX_NAME
        ? t('Keep the name under 50 characters')
        : null;
  // Subcategories wear their parent's look; top-level ones their own.
  const previewLook = isSub
    ? categoryLook(parent, scheme)
    : categoryLook({ name: name || '?', icon: icon || undefined, color: color || undefined, type }, scheme);
  const mutation = isEdit ? updateCategory : createCategory;

  const save = () => {
    if (nameError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (saving.current) return;
    saving.current = true;
    const look = isSub ? {} : { icon: icon || undefined, color: color || undefined };
    const done = {
      onSuccess: () => {
        haptics.success();
        toast.success(isEdit ? t('Category saved') : t('Category "{name}" created', { name: name.trim() }));
        router.back();
      },
      onSettled: () => {
        saving.current = false;
      },
    };
    if (existing) {
      updateCategory.mutate({ id: existing.id, name: name.trim(), ...look }, done);
    } else {
      createCategory.mutate({ name: name.trim(), type, parent_id: parent?.id, ...look }, done);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    haptics.warning();
    Alert.alert(
      t('Delete "{name}"?', { name: existing.name }),
      t('Its transactions stay and become uncategorized. Budgets for it are removed.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () =>
            deleteCategory.mutate(existing.id, {
              onSuccess: () => {
                toast.success(t('Category deleted'));
                router.back();
              },
            }),
        },
      ],
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={mutation.error ?? deleteCategory.error} />
          <Button title={isEdit ? t('Save changes') : t('Create category')} onPress={save} loading={mutation.isPending} />
          {isEdit ? (
            <Button title={t('Delete category')} variant="quiet" onPress={confirmDelete} loading={deleteCategory.isPending} />
          ) : null}
        </>
      }>
      <Card style={styles.preview}>
        <IconBadge icon={previewLook.icon} colors={previewLook} size={52} />
        <View style={styles.flex}>
          <ThemedText type="sectionTitle" numberOfLines={2}>
            {name.trim() || t('New category')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {parent ? `${categoryName(parent.name)} ›` : type === 'expense' ? t('Expense') : t('Income')}
          </ThemedText>
        </View>
      </Card>

      {!isEdit ? (
        <SegmentedControl
          options={[
            { value: 'expense', label: t('Expense') },
            { value: 'income', label: t('Income') },
          ]}
          value={type}
          onChange={(next) => {
            setType(next);
            setParentId(NO_PARENT); // parents are per type
          }}
        />
      ) : null}

      <TextField
        label={t('Name')}
        value={name}
        onChangeText={setName}
        placeholder={t('e.g. Pets, Coffee, Gym')}
        autoFocus={!isEdit}
        error={showErrors ? nameError : null}
      />

      {!isEdit && canHaveParent ? (
        <ChipSelect
          scroll
          label={t('Inside')}
          options={[
            { value: NO_PARENT, label: t('Top level') },
            ...parents.map((c) => ({ value: c.id, label: categoryName(c.name) })),
          ]}
          value={parentId}
          onChange={setParentId}
        />
      ) : null}

      {isSub ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Subcategories use the icon and color of the category they are in.')}
        </ThemedText>
      ) : (
        <>
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('Color')}
            </ThemedText>
            <View accessibilityRole="radiogroup" style={styles.swatches}>
              {CATEGORY_COLORS.map((key) => {
                const selected = key === color;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityLabel={key}
                    accessibilityState={{ checked: selected }}
                    hitSlop={4}
                    onPress={() => {
                      haptics.selection();
                      setColor(key);
                    }}
                    style={[
                      styles.swatch,
                      { backgroundColor: swatchColor(key, scheme), borderColor: selected ? theme.text : 'transparent' },
                    ]}>
                    {selected ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('Icon')}
            </ThemedText>
            <View accessibilityRole="radiogroup" style={styles.icons}>
              {CATEGORY_ICON_CHOICES.map((choice) => {
                const selected = choice === previewLook.icon;
                return (
                  <Pressable
                    key={choice}
                    accessibilityRole="radio"
                    accessibilityLabel={choice}
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      haptics.selection();
                      setIcon(choice);
                    }}
                    style={[styles.iconChoice, { backgroundColor: selected ? previewLook.solid : previewLook.bg }]}>
                    <Ionicons name={choice} size={22} color={selected ? '#ffffff' : previewLook.fg} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  section: { gap: Spacing.two },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatch: { width: 40, height: 40, borderRadius: Radius.full, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  iconChoice: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
