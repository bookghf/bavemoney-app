import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, type ISODate } from '@/lib/dates';
import { t } from '@/lib/i18n';

type DateFieldProps = {
  label: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
  maxDate?: ISODate;
  minDate?: ISODate;
  /** Quick picks shown as chips beside the field, e.g. Today / Yesterday. */
  shortcuts?: { label: string; value: ISODate }[];
  range?: { from: ISODate; to: ISODate };
};

/** A date button that expands an inline calendar; closes once a day is picked. */
export function DateField({ label, value, onChange, maxDate, minDate, shortcuts, range }: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>
        {shortcuts?.map((shortcut) => {
          const selected = shortcut.value === value;
          return (
            <Pressable
              key={shortcut.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(shortcut.value);
                setOpen(false);
              }}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: theme.tintFill, borderColor: theme.tintFill }
                  : { backgroundColor: theme.surface, borderColor: theme.controlBorder },
              ]}>
              <ThemedText type={selected ? 'smallBold' : 'small'} style={selected ? styles.selectedText : undefined}>
                {shortcut.label}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatDay(value, { year: 'numeric' })}. ${t('Change date')}`}
          onPress={() => setOpen((current) => !current)}
          accessibilityState={{ expanded: open }}
          style={[
            styles.chip,
            styles.dateChip,
            // Open thickens the edge in teal, like a focused text field.
            open && styles.chipOpen,
            {
              backgroundColor: theme.surface,
              borderColor: open ? theme.tint : theme.controlBorder,
            },
          ]}>
          <Ionicons name="calendar-outline" size={16} color={theme.text} />
          <ThemedText type="small">{formatDay(value, { weekday: 'short', year: 'numeric' })}</ThemedText>
        </Pressable>
      </View>
      {open ? (
        <Card>
          <Calendar
            value={value}
            maxDate={maxDate}
            minDate={minDate}
            range={range}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipOpen: { borderWidth: 2, paddingHorizontal: Spacing.three - 1 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  selectedText: { color: '#ffffff' },
});
