import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconButton } from 'react-native-paper';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LT } from '../constants/lifeTrackerDesign';

// Export the height constant for use in other components
export const BOTTOM_NAV_HEIGHT = 64;
export const BOTTOM_NAV_TOTAL_HEIGHT = BOTTOM_NAV_HEIGHT + 34; // 34 = safe max inset

/** Five tabs per design.md: Home, Daily, Focus, Habits, Shelf */
const NAV_ITEMS = [
  { icon: 'home-outline', label: 'Home', route: 'dashboard', color: LT.amber },
  { icon: 'format-list-checks', label: 'Daily', route: 'tasks', color: LT.blue },
  { icon: 'timer-outline', label: 'Focus', route: 'focus', color: LT.teal },
  { icon: 'repeat', label: 'Habits', route: 'habits', color: LT.pink },
  { icon: 'trophy-outline', label: 'Shelf', route: 'history', color: LT.amber },
];
const TAB_WIDTH = Dimensions.get('window').width / NAV_ITEMS.length;

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Use includes for robust matching
  const activeIndex = NAV_ITEMS.findIndex(item => pathname.includes(item.route));
  const activeColor = NAV_ITEMS[activeIndex]?.color || LT.amber;

  // Only keep glow animation
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.25);
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    if (hasMounted.current) {
      glowScale.value = withTiming(1.15, { duration: 120 }, () => {
        glowScale.value = withTiming(1, { duration: 120 });
      });
      glowOpacity.value = withTiming(0.35, { duration: 120 }, () => {
        glowOpacity.value = withTiming(0.25, { duration: 120 });
      });
    } else {
      hasMounted.current = true;
    }
  }, [pathname, activeIndex]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.container}>
        {NAV_ITEMS.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <TouchableOpacity
              key={item.route}
              style={styles.navItem}
              activeOpacity={0.8}
              onPress={() => router.push(`/(app)/${item.route}`)}
            >
              <View style={styles.iconWrapper}>
                {isActive && (
                  <Animated.View
                    style={[
                      styles.glow,
                      {
                        backgroundColor: activeColor,
                      },
                      animatedGlowStyle,
                    ]}
                  />
                )}
                <IconButton
                  icon={item.icon}
                  size={26}
                  iconColor={isActive ? activeColor : LT.parchmentMuted}
                  style={{ zIndex: 2, backgroundColor: isActive ? 'rgba(239,159,39,0.12)' : 'transparent', borderRadius: 16 }}
                />
              </View>
              {/* Optionally show label below icon */}
              {/* <Text style={[styles.navLabel, isActive && { color: item.color }]}>{item.label}</Text> */}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: BOTTOM_NAV_HEIGHT,
    borderRadius: 32,
    marginHorizontal: 16,
    backgroundColor: LT.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LT.outline,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BOTTOM_NAV_HEIGHT,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    zIndex: 1,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
    color: LT.parchment,
  },
}); 