import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAppTheme } from '../contexts/AppThemeContext';

const SIZE = 40;
const ICON = 22;

export default function ThemeModeToggle() {
  const { isLight, toggleLight, colors } = useAppTheme();
  const t = useSharedValue(isLight ? 1 : 0);

  React.useEffect(() => {
    t.value = withSpring(isLight ? 1 : 0, { damping: 16, stiffness: 120 });
  }, [isLight, t]);

  const moonStyle = useAnimatedStyle(() => {
    const scale = 0.85 + t.value * 0.15;
    return {
      opacity: t.value,
      transform: [{ rotate: `${t.value * 180}deg` }, { scale }] as const,
    };
  });

  const sunStyle = useAnimatedStyle(() => {
    const u = 1 - t.value;
    const scale = 0.9 + u * 0.1;
    return {
      opacity: u,
      transform: [{ rotate: `${u * -45}deg` }, { scale }] as const,
    };
  });

  return (
    <Pressable
      onPress={() => void toggleLight()}
      accessibilityRole="button"
      accessibilityLabel={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      style={({ pressed }) => [
        styles.wrap,
        { borderColor: colors.borderStrong },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icons}>
        <Animated.View style={[styles.layer, sunStyle]} pointerEvents="none">
          <MaterialCommunityIcons name="white-balance-sunny" size={ICON} color={colors.amber} />
        </Animated.View>
        <Animated.View style={[styles.layer, moonStyle]} pointerEvents="none">
          <MaterialCommunityIcons name="moon-waning-crescent" size={ICON} color={colors.blue} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  icons: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
