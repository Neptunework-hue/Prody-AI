import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '../utils/feedback';
import { FONT_SERIF, type ThemeColors } from '../constants/lifeTrackerDesign';
import { useAppTheme } from '../contexts/AppThemeContext';

/** Bottom nav height — matches docs/design.md shell (~60px bar) */
export const BOTTOM_NAV_HEIGHT = 60;
export const BOTTOM_NAV_PADDING = 8;
export const BOTTOM_NAV_TOTAL_HEIGHT = BOTTOM_NAV_HEIGHT + BOTTOM_NAV_PADDING;

const NAV_ITEMS = [
  { icon: 'home-outline', label: 'Home', route: 'dashboard' },
  { icon: 'calendar-month', label: 'Calendar', route: 'calendar' },
  { icon: 'format-list-checks', label: 'Tasks', route: 'tasks' },
  { icon: 'repeat', label: 'Habits', route: 'habits' },
  { icon: 'timer-outline', label: 'Focus', route: 'focus' },
];

function createNavStyles(c: ThemeColors) {
  return StyleSheet.create({
    outerContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      elevation: 9999,
      alignItems: 'center',
      paddingBottom: BOTTOM_NAV_PADDING,
      backgroundColor: 'transparent',
    },
    container: {
      width: '94%',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'stretch',
      minHeight: BOTTOM_NAV_HEIGHT,
      marginHorizontal: 12,
      backgroundColor: c.bg2,
      borderWidth: 1,
      borderColor: c.borderDefault,
      borderRadius: 12,
      paddingHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 6,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 2,
      borderRadius: 8,
    },
    navItemActive: {
      backgroundColor: c.amberBg,
    },
    activeTopBar: {
      position: 'absolute',
      top: 0,
      left: '12%',
      right: '12%',
      height: 2,
      backgroundColor: c.amber,
      borderRadius: 1,
    },
    iconBtn: {
      margin: 0,
      marginTop: 2,
    },
    label: {
      fontSize: 10,
      fontFamily: FONT_SERIF,
      marginTop: -4,
      fontWeight: '600',
    },
  });
}

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createNavStyles(c), [c]);
  const activeIndex = NAV_ITEMS.findIndex((item) => pathname.includes(item.route));
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outerContainer}>

      <View pointerEvents="auto" style={styles.container}>
        {NAV_ITEMS.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, isActive && styles.navItemActive]}
              activeOpacity={0.85}
              onPress={() => {
                tap();
                router.replace(`/(app)/${item.route}`);
              }}
            >
              {isActive ? <View style={styles.activeTopBar} /> : null}

              <IconButton
                icon={item.icon}
                size={22}
                iconColor={isActive ? c.amber : c.navInactive}
                style={styles.iconBtn}
              />

              <Text
                style={[styles.label, { color: isActive ? c.amber : c.navInactive }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
