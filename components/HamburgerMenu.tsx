import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate 
} from 'react-native-reanimated';

interface HamburgerMenuProps {
  onPress: () => void;
  isOpen?: boolean;
}

export default function HamburgerMenu({ onPress, isOpen = false }: HamburgerMenuProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
  }, [isOpen]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 45]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={animatedStyle}>
        <IconButton
          icon="menu"
          size={28}
          iconColor={theme.colors.onSurface}
          style={styles.iconButton}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    margin: 0,
  },
}); 