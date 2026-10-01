import { forwardRef, useId } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown under the field in red; also marks the field invalid. */
  error?: string | null;
  hint?: string;
};

// Number pads on iOS have no return key, so they get a "Done" bar.
const NEEDS_DONE_BAR = new Set(['decimal-pad', 'number-pad', 'numeric', 'phone-pad']);

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, style, keyboardType, ...rest },
  ref,
) {
  const theme = useTheme();
  const accessoryId = `done-${useId()}`;
  const doneBar = Platform.OS === 'ios' && keyboardType && NEEDS_DONE_BAR.has(keyboardType);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={theme.textSecondary}
        maxFontSizeMultiplier={FontScaleCap.body}
        keyboardType={keyboardType}
        inputAccessoryViewID={doneBar ? accessoryId : undefined}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {doneBar ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={[styles.doneBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={Keyboard.dismiss}>
              <ThemedText type="smallBold" themeColor="tint" style={styles.done}>
                {t('Done')}
              </ThemedText>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    // Explicit padding keeps taller Thai glyphs (and placeholders) centered.
    paddingVertical: 12,
    textAlignVertical: 'center',
    fontSize: 16,
  },
  doneBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: { fontSize: 16 },
});
