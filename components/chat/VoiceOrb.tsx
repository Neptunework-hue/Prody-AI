import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

const SIZE = 168;

/**
 * Glossy “3D” orb — radial-style layers + pulse while voice UI is active.
 */
export default function VoiceOrb({ mode, active }: { mode: Mode; active: boolean }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!active || mode === 'idle') {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 280 });
      return;
    }
    const fast = mode === 'speaking';
    const min = fast ? 0.94 : 0.97;
    const max = fast ? 1.08 : 1.04;
    const dur = fast ? 420 : 900;
    cancelAnimation(pulse);
    pulse.value = withRepeat(
      withSequence(
        withTiming(max, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        withTiming(min, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [active, mode, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <View style={styles.sphere}>
        <View style={styles.highlight} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6b8cff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 18,
  },
  sphere: {
    width: SIZE - 4,
    height: SIZE - 4,
    borderRadius: (SIZE - 4) / 2,
    backgroundColor: '#3d4fb5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    /* simulated sphere depth */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  highlight: {
    position: 'absolute',
    top: SIZE * 0.14,
    left: SIZE * 0.2,
    width: SIZE * 0.42,
    height: SIZE * 0.38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    transform: [{ rotate: '-18deg' }],
  },
});
