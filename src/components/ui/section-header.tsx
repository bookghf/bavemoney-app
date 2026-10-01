import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** Section title with an optional trailing "See all"-style link. */
export function SectionHeader({ title, actionLabel, href }: { title: string; actionLabel?: string; href?: Href }) {
  return (
    <View style={styles.row}>
      <ThemedText type="sectionTitle" style={styles.flex}>
        {title}
      </ThemedText>
      {actionLabel && href ? (
        <Link href={href} asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <ThemedText type="smallBold" themeColor="tint">
              {actionLabel}
            </ThemedText>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
