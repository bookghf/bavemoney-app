import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { create } from 'zustand';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Diameter of the raised center button. */
const BUTTON_SIZE = 60;
/** How far the button's center sits below the top edge of the tab bar. */
const BUTTON_CENTER_BELOW_BAR_TOP = 12;
/** Radius of the cradle cut into the tab bar around the button. */
const NOTCH_RADIUS = BUTTON_SIZE / 2 + 6;
/** Horizontal run of the smooth shoulder easing the bar edge into the cradle. */
const NOTCH_SHOULDER = 16;
const BAR_CORNER_RADIUS = Radius.lg;

const ITEM_SIZE = 50;
const ITEM_WIDTH = 88;

type MenuItem = {
  key: string;
  label: string;
  icon: IoniconName;
  /** Theme color of the item's circle: spending red, income green, transfer blue. */
  color: 'danger' | 'success' | 'transfer' | 'tintFill';
  href: Href;
  /** Resting offset of the item's circle from the button center (pt). */
  offset: { x: number; y: number };
};

// Four actions fanned out on an arc above the button, matching the reference
// layout: outer pair lower and wider, inner pair higher and closer.
const MENU_ITEMS: readonly MenuItem[] = [
  {
    key: 'expense',
    color: 'danger',
    label: 'Add\nexpense',
    icon: 'trending-down',
    href: { pathname: '/add-transaction', params: { type: 'expense' } },
    offset: { x: -105, y: -80 },
  },
  {
    key: 'income',
    color: 'success',
    label: 'Add\nincome',
    icon: 'trending-up',
    href: { pathname: '/add-transaction', params: { type: 'income' } },
    offset: { x: -35, y: -119 },
  },
  {
    key: 'transfer',
    color: 'transfer',
    label: 'Transfer\nmoney',
    icon: 'swap-horizontal',
    href: { pathname: '/add-transaction', params: { type: 'transfer' } },
    offset: { x: 35, y: -119 },
  },
  {
    key: 'account',
    color: 'tintFill',
    label: 'New\naccount',
    icon: 'wallet-outline',
    href: '/add-account',
    offset: { x: 105, y: -80 },
  },
];

// Timings read off the reference video (~52 fps): the menu flies out in ~0.3 s
// with a hard ease-out and collapses back in ~0.22 s; the backdrop snaps in/out.
const OPEN_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: 220, easing: Easing.inOut(Easing.cubic) };
const SPIN_OPEN_TIMING = { duration: 360, easing: Easing.out(Easing.cubic) };
const SPIN_CLOSE_TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };
const BACKDROP_TIMING = { duration: 100, easing: Easing.linear };
/** "+" spins through "×" and "+" and settles on "×" (45° + 90°). */
const OPEN_ROTATION_DEG = 135;

/**
 * Whether the add menu is open. A store rather than local state so the /add
 * route (reached by a deep link or a restored session) can open it.
 */
export const useAddMenu = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * Spacer rendered in the tab bar's center slot; the real button floats above
 * it. Hidden from screen readers, which reach the floating button instead.
 */
export function CenterTabSpacer() {
  return (
    <View
      style={styles.spacer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/**
 * Tab bar background with a circular cradle cut out around the raised center
 * button. Pass as `tabBarBackground`.
 */
export function NotchedTabBarBackground() {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const { width, height } = size;
  const cx = width / 2;
  const r = NOTCH_RADIUS;
  const cy = BUTTON_CENTER_BELOW_BAR_TOP;
  const c = BAR_CORNER_RADIUS;
  // Top edge: rounded outer corners, then a shoulder curve that meets the
  // cradle circle at its equator (vertical tangent) so the joint is smooth.
  const topEdge =
    `M0,${c} Q0,0 ${c},0 ` +
    `L${cx - r - NOTCH_SHOULDER},0 Q${cx - r},0 ${cx - r},${cy} ` +
    `A${r},${r} 0 0 0 ${cx + r},${cy} ` +
    `Q${cx + r},0 ${cx + r + NOTCH_SHOULDER},0 ` +
    `L${width - c},0 Q${width},0 ${width},${c}`;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={`${topEdge} L${width},${height} L0,${height} Z`} fill={theme.surface} />
          <Path d={topEdge} fill="none" stroke={theme.border} strokeWidth={1} />
        </Svg>
      ) : null}
    </View>
  );
}

type TabActionMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Measured height of the tab bar (including the bottom safe-area inset). */
  tabBarHeight: number;
};

/**
 * Full-screen overlay holding the raised center button and its fan-out menu.
 * Render as a sibling on top of the navigator; it only captures touches on the
 * button, the menu items and (while open) the backdrop.
 */
export function TabActionMenu({ open, onOpenChange, tabBarHeight }: TabActionMenuProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, open ? OPEN_TIMING : CLOSE_TIMING);
    rotation.value = withTiming(open ? OPEN_ROTATION_DEG : 0, open ? SPIN_OPEN_TIMING : SPIN_CLOSE_TIMING);
    backdrop.value = withTiming(open ? 1 : 0, BACKDROP_TIMING);
  }, [open, progress, rotation, backdrop]);

  // Android hardware back closes the menu instead of leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onOpenChange(false);
      return true;
    });
    return () => sub.remove();
  }, [open, onOpenChange]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (tabBarHeight <= 0) return null;

  const select = (item: MenuItem) => {
    onOpenChange(false);
    router.push(item.href);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { bottom: tabBarHeight }, backdropStyle]}
        pointerEvents={open ? 'auto' : 'none'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onOpenChange(false)}
          accessibilityLabel={t('Close menu')}
          accessibilityRole="button">
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="tabMenuWash" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.background} stopOpacity={0.94} />
                <Stop offset="0.45" stopColor={theme.background} stopOpacity={0.94} />
                <Stop offset="1" stopColor={theme.tint} stopOpacity={0.28} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={theme.background} opacity={0.75} />
            <Rect width="100%" height="100%" fill="url(#tabMenuWash)" />
          </Svg>
        </Pressable>
      </Animated.View>

      <View
        style={[
          styles.anchor,
          { bottom: tabBarHeight - BUTTON_CENTER_BELOW_BAR_TOP - BUTTON_SIZE / 2 },
        ]}
        pointerEvents="box-none">
        {MENU_ITEMS.map((item) => (
          <ActionItem
            key={item.key}
            item={item}
            progress={progress}
            open={open}
            tint={theme[item.color]}
            textColor={theme.text}
            onPress={() => select(item)}
          />
        ))}

        <Pressable
          onPress={() => {
            haptics.tap();
            onOpenChange(!open);
          }}
          accessibilityRole="button"
          // Named like the other tabs; the hint says what a tap does.
          accessibilityLabel={t('Add')}
          accessibilityHint={open ? t('Close add menu') : t('Open add menu')}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.tintFill,
              boxShadow: `0 4px 14px ${theme.tintFill}59`,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}>
          <Animated.View style={iconStyle}>
            <Ionicons name="add" size={34} color="#ffffff" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

type ActionItemProps = {
  item: MenuItem;
  progress: SharedValue<number>;
  open: boolean;
  tint: string;
  textColor: string;
  onPress: () => void;
};

function ActionItem({ item, progress, open, tint, textColor, onPress }: ActionItemProps) {
  // Items start tucked behind the button, small and translucent, and travel
  // straight out to their arc position while growing to full size.
  const itemStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.35, 1], [0, 0.75, 1]),
      transform: [
        { translateX: item.offset.x * p },
        { translateY: item.offset.y * p },
        { scale: interpolate(p, [0, 1], [0.35, 1]) },
      ],
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp'),
  }));

  return (
    <Animated.View style={[styles.item, itemStyle]} pointerEvents={open ? 'box-none' : 'none'}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t(item.label).replace('\n', ' ')}
        style={({ pressed }) => [styles.itemCircle, { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name={item.icon} size={24} color="#ffffff" />
      </Pressable>
      <Animated.View style={[styles.itemLabelWrap, labelStyle]} pointerEvents="none">
        <Text style={[styles.itemLabel, { color: textColor }]} maxFontSizeMultiplier={FontScaleCap.display}>
          {t(item.label)}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // Bottom-center anchor whose bottom edge lines up with the button's bottom.
  // It is tall enough to contain the open menu so touches register on Android.
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The circle is centered on the button center; the label hangs below it.
  item: {
    position: 'absolute',
    left: '50%',
    bottom: (BUTTON_SIZE - ITEM_SIZE) / 2,
    width: ITEM_WIDTH,
    marginLeft: -ITEM_WIDTH / 2,
    height: ITEM_SIZE,
    alignItems: 'center',
  },
  itemCircle: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabelWrap: {
    position: 'absolute',
    top: ITEM_SIZE + 4,
    width: ITEM_WIDTH,
  },
  itemLabel: {
    fontSize: 13,
    // About 1.4x, so Thai tone marks on the second line clear the first.
    lineHeight: 18,
    fontWeight: 600,
    textAlign: 'center',
  },
});
