import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import UserAvatar from './UserAvatar';
import { FONT_SERIF, type ThemeColors } from '../constants/lifeTrackerDesign';
import { useQuestProfileStats } from '../hooks/useQuestProfileStats';
import { useOffline } from '../hooks/useOffline';
import { useAppTheme } from '../contexts/AppThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;

const SETTINGS_ICON = '#b4a3d6';

function createSidebarStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      zIndex: 999,
    },
    overlayTouchable: {
      flex: 1,
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: SIDEBAR_WIDTH,
      height: '100%',
      backgroundColor: c.sidebarDrawerBg,
      zIndex: 1000,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.sidebarIconBoxBorder,
    },
    header: {
      paddingTop: 56,
      paddingHorizontal: 22,
      paddingBottom: 22,
      alignItems: 'center',
    },
    avatarRing: {
      width: 78,
      height: 78,
      borderRadius: 39,
      borderWidth: 2,
      borderColor: c.amber,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
      backgroundColor: c.sidebarWell,
    },
    avatarWrap: {
      backgroundColor: c.sidebarWell,
    },
    userName: {
      fontFamily: FONT_SERIF,
      fontSize: 18,
      fontWeight: '600',
      color: c.tx,
      marginBottom: 6,
      textAlign: 'center',
    },
    levelLine: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      color: c.sidebarMutedGold,
      textAlign: 'center',
    },
    primaryNav: {
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: c.sidebarIconBoxBg,
      borderWidth: 1,
      borderColor: c.sidebarIconBoxBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    logoutIconBox: {
      backgroundColor: 'rgba(229,115,115,0.12)',
      borderColor: 'rgba(229,115,115,0.28)',
    },
    navLabel: {
      fontFamily: FONT_SERIF,
      fontSize: 16,
      color: c.tx,
      fontWeight: '500',
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.ruleHairline,
      marginHorizontal: 20,
      marginVertical: 8,
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 22,
    },
    logoutLabel: {
      fontFamily: FONT_SERIF,
      fontSize: 16,
      fontWeight: '600',
      color: '#c62828',
    },
    footer: {
      paddingHorizontal: 22,
      paddingBottom: 36,
      paddingTop: 8,
    },
    footerText: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: c.tx2,
    },
    footerSynced: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createSidebarStyles(c), [c]);
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  const { totalXp, level, flavor } = useQuestProfileStats(user?.id);
  const { isOnline, pendingOperationsCount } = useOffline();

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string; username?: string } | undefined;
    return (
      meta?.full_name?.trim() ||
      meta?.name?.trim() ||
      meta?.username ||
      session?.user?.user_metadata?.username ||
      user?.email?.split('@')[0] ||
      'Hero'
    );
  }, [user, session]);

  React.useEffect(() => {
    if (isVisible) {
      translateX.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: 300 });
      overlayOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isVisible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfile = () => {
    onClose();
    router.push('/(app)/profile');
  };

  const handleSettings = () => {
    onClose();
    router.push('/(app)/offline-settings');
  };

  const handleHome = () => {
    onClose();
    router.push('/(app)/dashboard');
  };

  const handleStatistics = () => {
    onClose();
    router.push('/(app)/statistics');
  };

  const handleChat = () => {
    onClose();
    router.push('/(app)/chat');
  };

  const handleAbout = () => {
    onClose();
    router.push('/(app)/about');
  };

  const syncLabel = !isOnline ? 'Offline' : pendingOperationsCount > 0 ? 'Sync pending' : 'Synced';
  const syncColor = !isOnline || pendingOperationsCount > 0 ? c.amber : c.teal;

  const primaryItems = [
    { icon: 'home-outline' as const, label: 'Home', onPress: handleHome, iconColor: c.amber },
    { icon: 'chart-line' as const, label: 'Statistics', onPress: handleStatistics, iconColor: c.blue },
    { icon: 'account-circle-outline' as const, label: 'Profile', onPress: handleProfile, iconColor: c.blue },
    { icon: 'cog-outline' as const, label: 'Settings', onPress: handleSettings, iconColor: SETTINGS_ICON },
    { icon: 'star-four-points' as const, label: 'AI Oracle', onPress: handleChat, iconColor: c.amber },
    { icon: 'information-outline' as const, label: 'About', onPress: handleAbout, iconColor: c.blue },
  ];

  return (
    <>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[styles.sidebar, sidebarStyle]}
      >
        <View style={styles.header}>
          <View style={styles.avatarRing}>
            <UserAvatar size={72} style={styles.avatarWrap} showBorder borderColor={c.amber} />
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.levelLine}>
            Lvl {level} {flavor} · {totalXp.toLocaleString()} XP
          </Text>
        </View>

        <View style={styles.primaryNav}>
          {primaryItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.navRow}
              onPress={item.onPress}
              activeOpacity={0.65}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rule} />

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.65}>
          <View style={[styles.iconBox, styles.logoutIconBox]}>
            <MaterialCommunityIcons name="logout" size={22} color="#c62828" />
          </View>
          <Text style={styles.logoutLabel}>Log out</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <View style={styles.rule} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ProdyAI v5.0{' '}
            <Text style={[styles.footerSynced, { color: syncColor }]}>· {syncLabel}</Text>
          </Text>
        </View>
      </Animated.View>
    </>
  );
}
