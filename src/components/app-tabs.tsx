import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/js-tabs';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View, type ColorValue } from 'react-native';

import { CenterTabSpacer, NotchedTabBarBackground, TabActionMenu } from '@/components/tab-action-menu';
import { Colors } from '@/constants/theme';
import { t } from '@/lib/i18n';

type IoniconName = keyof typeof Ionicons.glyphMap;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);

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
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textSecondary,
          // The notched shape is drawn by tabBarBackground.
          tabBarStyle: styles.tabBar,
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
});
