import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, parseISODate, toISODate, type ISODate } from '@/lib/dates';
import { dateLocale, t } from '@/lib/i18n';

type CalendarProps = {
  value: ISODate | null;
  onChange: (value: ISODate) => void;
  /** Days after this are disabled. */
  maxDate?: ISODate;
  /** Days before this are disabled. */
  minDate?: ISODate;
  /** Days inside this inclusive range get a soft highlight (range pickers). */
  range?: { from: ISODate; to: ISODate };
};

/** Narrow weekday names in the app language, Sunday first. */
function weekdays() {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(dateLocale(), { weekday: 'narrow' }),
  );
}

/** A month grid date picker built from plain views, so it works on iOS, Android, and web. */
export function Calendar({ value, onChange, maxDate, minDate, range }: CalendarProps) {
  const theme = useTheme();
  // First day of the visible month.
  const [month, setMonth] = useState(() => {
    const date = parseISODate(value ?? maxDate ?? toISODate(new Date()));
    return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
  });

  const first = parseISODate(month);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (ISODate | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(first.getFullYear(), first.getMonth(), i + 1)),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const nextMonth = addMonths(month, 1);
  const canGoNext = !maxDate || nextMonth <= maxDate;
  const canGoPrev = !minDate || addMonths(month, -1) >= toISODate(new Date(parseISODate(minDate).setDate(1)));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <NavButton icon="chevron-back" disabled={!canGoPrev} onPress={() => setMonth(addMonths(month, -1))} label={t('Previous month')} />
        <ThemedText type="smallBold">
          {first.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })}
        </ThemedText>
        <NavButton icon="chevron-forward" disabled={!canGoNext} onPress={() => setMonth(nextMonth)} label={t('Next month')} />
      </View>

      <View style={styles.week}>
        {weekdays().map((day, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.weekday}>
            {day}
          </ThemedText>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const disabled = (!!maxDate && day > maxDate) || (!!minDate && day < minDate);
            const selected = day === value;
            const inRange = !!range && day >= range.from && day <= range.to;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={parseISODate(day).toDateString()}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(day)}
                style={[
                  styles.cell,
                  inRange && { backgroundColor: theme.backgroundSelected },
                  selected && { backgroundColor: theme.tintFill },
                ]}>
                <ThemedText
                  type="small"
                  themeColor={disabled ? 'textSecondary' : 'text'}
                  style={[selected && styles.selectedText, disabled && styles.disabledText]}>
                  {parseISODate(day).getDate()}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function NavButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.nav, disabled && styles.disabledText]}>
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
  },
  nav: { padding: Spacing.one },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  selectedText: { color: '#ffffff' },
  disabledText: { opacity: 0.35 },
});
