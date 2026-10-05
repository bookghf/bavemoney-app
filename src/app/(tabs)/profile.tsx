import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconBadge, type IoniconName } from '@/components/ui/icon-badge';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { BrandGradient, Spacing } from '@/constants/theme';
import { toast } from '@/components/ui/toast';
import { useLogout } from '@/hooks/use-auth';
import { useExportCSV } from '@/hooks/use-export';
import { getErrorMessage } from '@/lib/api/client';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/feedback';
import { formatDate } from '@/lib/format';
import { openLegalPage, PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { usePreferences, type CalendarSystem, type Language } from '@/store/preferences-store';

export default function ProfileScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const exportCSV = useExportCSV();
  const language = usePreferences((state) => state.language);
  const calendar = usePreferences((state) => state.calendar);
  const update = usePreferences((state) => state.update);
  const name = user?.display_name || user?.email || '';

  const confirmLogout = () => {
    haptics.warning();
    Alert.alert(t('Log out?'), t('You will need your email and password to sign back in.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Log out'), style: 'destructive', onPress: () => logout.mutate({}) },
    ]);
  };

  return (
    <Screen inTabs>
      <ScreenHeader title={t('Profile')} />

      {user ? (
        <Card style={styles.identity}>
          <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText} maxFontSizeMultiplier={1}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {user.display_name || user.email}
          </ThemedText>
          {user.display_name ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {user.email}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {t('Member since {date}', { date: formatDate(user.created_at) })} · {user.default_currency}
          </ThemedText>
        </Card>
      ) : null}

      <Card style={styles.list}>
        <LinkRow icon="person-outline" label={t('Edit profile')} onPress={() => router.push('/edit-profile')} />
        <LinkRow
          icon="lock-closed-outline"
          label={t('Change password')}
          onPress={() => router.push('/change-password')}
          separator
        />
        <LinkRow icon="pie-chart-outline" label={t('Budgets')} onPress={() => router.push('/budgets')} separator />
        <LinkRow icon="repeat-outline" label={t('Recurring')} onPress={() => router.push('/recurring')} separator />
        <LinkRow icon="pricetags-outline" label={t('Categories')} onPress={() => router.push('/categories')} separator />
      </Card>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {t('Your data')}
      </ThemedText>
      <Card style={styles.list}>
        <LinkRow icon="cloud-upload-outline" label={t('Import CSV')} onPress={() => router.push('/import')} />
        <LinkRow
          icon="share-outline"
          label={exportCSV.isPending ? t('Preparing file…') : t('Export CSV')}
          onPress={() =>
            exportCSV.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })
          }
          separator
        />
        <LinkRow icon="receipt-outline" label={t('All transactions')} onPress={() => router.push('/transactions')} separator />
        <LinkRow icon="wallet-outline" label={t('Accounts')} onPress={() => router.navigate('/account')} separator />
      </Card>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {t('Display')}
      </ThemedText>
      <Card style={styles.settings}>
        <View style={styles.setting}>
          <ThemedText type="small">{t('Language')}</ThemedText>
          <SegmentedControl<Language | 'auto'>
            options={[
              { value: 'auto', label: t('Device') },
              { value: 'en', label: 'English' },
              { value: 'th', label: 'ไทย' },
            ]}
            value={language ?? 'auto'}
            onChange={(next) => update({ language: next === 'auto' ? null : next })}
          />
        </View>
        <View style={styles.setting}>
          <ThemedText type="small">{t('Year format')}</ThemedText>
          <SegmentedControl<CalendarSystem>
            options={[
              { value: 'gregory', label: t('2026 (CE)') },
              { value: 'buddhist', label: t('2569 (BE)') },
            ]}
            value={calendar}
            onChange={(next) => update({ calendar: next })}
          />
        </View>
      </Card>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {t('About')}
      </ThemedText>
      <Card style={styles.list}>
        <LinkRow icon="shield-checkmark-outline" label={t('Privacy policy')} onPress={() => openLegalPage(PRIVACY_URL)} />
        <LinkRow icon="document-text-outline" label={t('Terms of use')} onPress={() => openLegalPage(TERMS_URL)} separator />
      </Card>

      <Card style={styles.list}>
        <Pressable
          accessibilityRole="button"
          disabled={logout.isPending}
          onPress={confirmLogout}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
          <IconBadge icon="log-out-outline" tone="danger" size={36} />
          <ThemedText type="smallBold" themeColor="danger" style={styles.label}>
            {t('Log out')}
          </ThemedText>
          {logout.isPending ? <ActivityIndicator /> : null}
        </Pressable>
      </Card>

      {/* Kept apart from Log out so the two red rows can not be mistaken for each other. */}
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dangerLabel}>
        {t('Danger zone')}
      </ThemedText>
      <Card style={styles.list}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('Erases all your data after you confirm with your password')}
          onPress={() => router.push('/reset-account')}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
          <IconBadge icon="refresh-circle-outline" tone="danger" size={36} />
          <ThemedText type="smallBold" themeColor="danger" style={styles.label}>
            {t('Reset account')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('Deletes your login and all your data after you confirm with your password')}
          onPress={() => router.push('/delete-account')}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <IconBadge icon="trash-outline" tone="danger" size={36} />
          <ThemedText type="smallBold" themeColor="danger" style={styles.label}>
            {t('Delete account')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      </Card>
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  separator,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  separator?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      {separator ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
      <IconBadge icon={icon} size={36} />
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarText: { color: '#ffffff', fontSize: 32, fontWeight: 700 },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
  },
  separator: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: Spacing.three + 36 + Spacing.three,
    height: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  sectionLabel: { marginLeft: Spacing.three, marginTop: Spacing.two },
  dangerLabel: { marginLeft: Spacing.three, marginTop: Spacing.five },
  settings: { gap: Spacing.three },
  setting: { gap: Spacing.two },
});
