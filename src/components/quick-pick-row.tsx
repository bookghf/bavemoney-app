import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { QuickPick } from '@/hooks/use-quick-picks';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';

type QuickPickRowProps = {
  picks: QuickPick[];
  label: (pick: QuickPick) => string;
  /** The pick currently filled into the form; it gets a Save button beside it. */
  armedKey: string | null;
  /** e.g. "Save ฿20.00", for the armed pick. */
  saveLabel: (pick: QuickPick) => string;
  saving?: boolean;
  onPick: (pick: QuickPick) => void;
  onSave: (pick: QuickPick) => void;
};

/**
 * Frequent entries as one scrolling row of chips. A tap fills the form in;
 * saving takes a second, explicit tap on the "Save ฿20" button that appears
 * beside the filled-in chip, so a double tap can not save by accident.
 */
export function QuickPickRow({ picks, label, armedKey, saveLabel, saving, onPick, onSave }: QuickPickRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('Quick picks')}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollRow}
        style={styles.scroll}>
        {picks.map((pick) => {
          const armed = pick.key === armedKey;
          return (
            <View key={pick.key} style={styles.pair}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: armed }}
                accessibilityHint={t('Fills in the form')}
                onPress={() => {
                  haptics.selection();
                  onPick(pick);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  armed
                    ? { backgroundColor: theme.tintSoft, borderColor: theme.tint }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type={armed ? 'smallBold' : 'small'} numberOfLines={1}>
                  {label(pick)}
                </ThemedText>
              </Pressable>
              {armed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: !!saving }}
                  disabled={saving}
                  onPress={() => onSave(pick)}
                  style={({ pressed }) => [
                    styles.chip,
                    styles.save,
                    { backgroundColor: theme.tintFill, borderColor: theme.tintFill },
                    pressed && styles.pressed,
                  ]}>
                  {saving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                      <ThemedText type="smallBold" style={styles.saveText} numberOfLines={1}>
                        {saveLabel(pick)}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  // Bleed to the screen edges so chips scroll under the gutter, like ChipSelect.
  scroll: { marginHorizontal: -20 },
  scrollRow: { gap: Spacing.two, paddingHorizontal: 20 },
  pair: { flexDirection: 'row', gap: Spacing.one },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  save: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveText: { color: '#ffffff' },
  pressed: { opacity: 0.75 },
});
