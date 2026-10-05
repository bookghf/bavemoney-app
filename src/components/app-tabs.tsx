import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/js-tabs';
import { useState } from 'react';
import { StyleSheet, Text, useColorScheme, useWindowDimensions, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CenterTabSpacer, NotchedTabBarBackground, TabActionMenu, useAddMenu } from '@/components/tab-action-menu';
import { Colors } from '@/constants/theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { t } from '@/lib/i18n';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Tab labels follow the device text size up to this much (11pt -> ~14pt). */
const TAB_LABEL_SCALE_CAP = FontScaleCap.display;
// Room for Thai vowels and tone marks above and below the line.
const TAB_LABEL_FONT_SIZE = 11;
const TAB_LABEL_LINE_HEIGHT = 16;
/** Tab item padding (5 + 5) plus the 28pt icon box above the label. */
const TAB_ITEM_CHROME = 38;

function TabLabel({
  color,
  position,
  children,
}: {
  color: ColorValue;
  position: 'beside-icon' | 'below-icon';
  children: string;
}) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={TAB_LABEL_SCALE_CAP}
      style={[styles.label, position === 'beside-icon' && styles.labelBeside, { color }]}>
      {children}
    </Text>
  );
}

// Outline glyph when unfocused, solid/filled glyph when focused.
function tabIcon(outline: IoniconName, filled: IoniconName) {
  return function TabBarIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  };
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const menuOpen = useAddMenu((state) => state.open);
  const setMenuOpen = useAddMenu((state) => state.setOpen);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // The bar grows with its labels so larger text is never clipped.
  const labelHeight = Math.ceil(TAB_LABEL_LINE_HEIGHT * Math.min(Math.max(fontScale, 1), TAB_LABEL_SCALE_CAP));
  const barHeight = TAB_ITEM_CHROME + labelHeight + insets.bottom;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => (
          // Measure the bar so the floating center button can sit in its notch.
          <View onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}>
            <BottomTabBar {...props} />
          </View>
        )}
        screenListeners={{
          // Switching tabs while the menu is open dismisses it.
          tabPress: () => setMenuOpen(false),
        }}
        screenOptions={{
          headerShown: false,
          // Labels follow the text size up to TAB_LABEL_SCALE_CAP; at 10pt and
          // fixed, Thai labels were too small to read.
          tabBarLabel: TabLabel,
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.textSecondary,
          // The notched shape is drawn by tabBarBackground.
          tabBarStyle: [styles.tabBar, { height: barHeight }],
          tabBarBackground: NotchedTabBarBackground,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('Home'),
            tabBarIcon: tabIcon('home-outline', 'home'),
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            title: t('Summary'),
            tabBarIcon: tabIcon('pie-chart-outline', 'pie-chart'),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: t('Add'),
            // Not a real screen: the slot is an empty spacer and the raised
            // TabActionMenu button floats above it.
            tabBarButton: CenterTabSpacer,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: t('Accounts'),
            tabBarIcon: tabIcon('wallet-outline', 'wallet'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('Profile'),
            tabBarIcon: tabIcon('person-outline', 'person'),
          }}
        />
      </Tabs>
      <TabActionMenu open={menuOpen} onOpenChange={setMenuOpen} tabBarHeight={tabBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  label: {
    fontSize: TAB_LABEL_FONT_SIZE,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontWeight: 500,
    textAlign: 'center',
  },
  labelBeside: { marginStart: 6 },
});
