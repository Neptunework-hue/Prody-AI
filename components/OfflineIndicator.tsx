import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useOffline } from '../hooks/useOffline';

interface OfflineIndicatorProps {
  showPendingCount?: boolean;
  onSyncPress?: () => void;
}

export default function OfflineIndicator({ 
  showPendingCount = true, 
  onSyncPress 
}: OfflineIndicatorProps) {
  const theme = useTheme();
  const { isOnline, pendingOperationsCount, lastSync, syncData } = useOffline();
  const slideAnim = React.useRef(new Animated.Value(-50)).current;

  React.useEffect(() => {
    if (!isOnline || pendingOperationsCount > 0) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline, pendingOperationsCount, slideAnim]);

  if (isOnline && pendingOperationsCount === 0) {
    return null;
  }

  const getStatusText = () => {
    if (!isOnline) {
      return 'You\'re offline';
    }
    if (pendingOperationsCount > 0) {
      return `${pendingOperationsCount} pending changes`;
    }
    return '';
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return '#F44336'; // Red for offline
    }
    return '#FF9800'; // Orange for pending sync
  };

  const getIcon = () => {
    if (!isOnline) {
      return 'wifi-off';
    }
    return 'sync';
  };

  const handleSyncPress = () => {
    if (onSyncPress) {
      onSyncPress();
    } else {
      syncData();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getStatusColor(),
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.content}>
        <IconButton
          icon={getIcon()}
          iconColor="white"
          size={20}
          onPress={handleSyncPress}
        />
        <Text style={styles.text}>{getStatusText()}</Text>
        {showPendingCount && pendingOperationsCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingOperationsCount}</Text>
          </View>
        )}
      </View>
      {lastSync && (
        <Text style={styles.lastSync}>
          Last sync: {new Date(lastSync).toLocaleTimeString()}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  badge: {
    backgroundColor: 'white',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastSync: {
    color: 'white',
    fontSize: 11,
    opacity: 0.8,
    marginLeft: 48,
    marginTop: 2,
  },
}); 