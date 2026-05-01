import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const DOT = 8;
const N = 5;

function Dot({ index, active }: { index: number; active: boolean }) {
  const o = useSharedValue(0.35);

  useEffect(() => {
    if (!active) {
      cancelAnimation(o);
      o.value = withTiming(0.35, { duration: 200 });
      return;
    }
    cancelAnimation(o);
    o.value = withDelay(
      index * 100,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 320, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(o);
    };
  }, [active, index, o]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: 0.85 + o.value * 0.2 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export default function ListeningDots({ active }: { active: boolean }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: N }, (_, i) => (
        <Dot key={i} index={i} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    height: DOT + 8,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: '#9ca3af',
    marginHorizontal: 5,
  },
});
