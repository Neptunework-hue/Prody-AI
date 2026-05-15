import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useOffline } from '../hooks/useOffline';
import { FONT_SERIF } from '../constants/lifeTrackerDesign';
import { useAppTheme } from '../contexts/AppThemeContext';
import { BOTTOM_NAV_TOTAL_HEIGHT } from './BottomNavBar';

interface OfflineIndicatorProps {
  showPendingCount?: boolean;
  onSyncPress?: () => void;
}

export default function OfflineIndicator({
  showPendingCount = true,
  onSyncPress,
}: OfflineIndicatorProps) {
  const { colors: c } = useAppTheme();
  const { isOnline, pendingOperationsCount, syncData } = useOffline();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const visible = !isOnline || pendingOperationsCount > 0;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const isOffline = !isOnline;
  const label = isOffline
    ? 'Offline'
    : `${pendingOperationsCount} pending${pendingOperationsCount === 1 ? '' : ''}`;
  const icon = isOffline ? 'wifi-off' : 'sync';
  const pillBg = isOffline ? 'rgba(180,60,60,0.12)' : c.amberBg;
  const pillBorder = isOffline ? 'rgba(180,60,60,0.3)' : c.amberBorder;
  const pillColor = isOffline ? '#c62828' : c.amber;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { bottom: BOTTOM_NAV_TOTAL_HEIGHT + 10, opacity: fadeAnim }]}
    >
      <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
        <IconButton icon={icon} iconColor={pillColor} size={14} style={styles.pillIcon} />
        <Text style={[styles.pillText, { color: pillColor }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 500,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingRight: 12,
    paddingLeft: 2,
  },
  pillIcon: {
    margin: 0,
    width: 28,
    height: 28,
  },
  pillText: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    fontWeight: '600',
  },
}); 