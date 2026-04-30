import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase/supabase';
import { useRouter } from 'expo-router';
import SetupChecker from '../../components/SetupChecker';
import AvatarPicker from '../../components/AvatarPicker';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import UserAvatar from '../../components/UserAvatar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import Sidebar from '../../components/Sidebar';
import { FONT_SERIF } from '../../constants/lifeTrackerDesign';
import { useQuestProfileStats } from '../../hooks/useQuestProfileStats';
import { getDisplayStreak } from '../../services/questStreak';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../contexts/AppThemeContext';
import ThemeModeToggle from '../../components/ThemeModeToggle';

export default function ProfileScreen() {
  const { colors: c } = useAppTheme();
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSetupChecker, setShowSetupChecker] = useState(false);
  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [streak, setStreak] = useState(0);

  const { totalXp, level } = useQuestProfileStats(user?.id);

  const refreshStreak = useCallback(async () => {
    if (!user?.id) return;
    const s = await getDisplayStreak(user.id);
    setStreak(s);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshStreak();
    }, [refreshStreak]),
  );

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata as {
        full_name?: string;
        name?: string;
        username?: string;
        avatar_url?: string;
      };
      setUsername(meta?.username || user.email?.split('@')[0] || '');
      setFullName(meta?.full_name?.trim() || meta?.name?.trim() || '');
      setAvatarUrl(meta?.avatar_url ?? null);
    }
  }, [user]);

  const heroTitle = useMemo(() => {
    const trimmed = fullName.trim();
    if (trimmed) return trimmed;
    if (username.trim()) return username.trim();
    return user?.email?.split('@')[0] || 'Hero';
  }, [fullName, username, user?.email]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          full_name: fullName.trim(),
          name: fullName.trim(),
          avatar_url: avatarUrl,
        },
      });

      if (error) {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      } else {
        Alert.alert('Saved', 'Profile updated.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        Alert.alert('Error', 'Failed to sign out.');
        return;
      }
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  if (!user || !session) {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg }]}>
        <Text style={[styles.loginPrompt, { color: c.tx2 }]}>Sign in to view your profile.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <QuestLogScreenHeader
        title="Profile"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        titleColor={c.tx}
        right={<ThemeModeToggle />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.pageTitle, { color: c.tx }]}>Profile</Text>

        <View style={[styles.card, { backgroundColor: c.surf, borderColor: c.borderDefault }]}>
          <View style={styles.profileRow}>
            <TouchableOpacity
              onPress={() => setIsAvatarPickerVisible(true)}
              activeOpacity={0.85}
              style={[styles.avatarRing, { borderColor: c.amber, backgroundColor: c.sidebarWell }]}
            >
              <UserAvatar size={88} showBorder borderColor={c.amber} />
            </TouchableOpacity>

            <View style={styles.profileTextCol}>
              <Text style={[styles.heroName, { color: c.tx }]} numberOfLines={2}>
                {heroTitle}
              </Text>
              <Text style={styles.statsLine}>
                <Text style={[styles.lvlPart, { color: c.tx2 }]}>Lvl {level}</Text>
                <Text style={[styles.lvlPart, { color: c.tx2 }]}> • </Text>
                <Text style={[styles.xpPart, { color: c.amber }]}>{totalXp.toLocaleString()} XP</Text>
              </Text>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePro, { borderColor: c.amber }]}>
                  <Text style={[styles.badgeProText, { color: c.amber }]}>PRO</Text>
                </View>
                <View style={[styles.badgeStreak, { borderColor: c.teal }]}>
                  <Text style={[styles.badgeStreakText, { color: c.teal }]}>
                    {streak}d streak
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.formBlock}>
            <Text style={[styles.fieldLabel, styles.fieldLabelFirst, { color: c.tx2 }]}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Hero#0001"
              placeholderTextColor={c.tx2}
              style={[
                styles.input,
                { backgroundColor: c.bg2, borderColor: c.borderDefault, color: c.tx },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: c.tx2 }]}>Display name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your hero name"
              placeholderTextColor={c.tx2}
              style={[
                styles.input,
                { backgroundColor: c.bg2, borderColor: c.borderDefault, color: c.tx },
              ]}
            />

            <Pressable
              onPress={handleUpdateProfile}
              disabled={loading}
              style={({ pressed }) => [
                styles.saveBtn,
                { borderColor: c.borderDefault, opacity: pressed || loading ? 0.75 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={c.tx} size="small" />
              ) : (
                <Text style={[styles.saveBtnLabel, { color: c.tx }]}>Save changes</Text>
              )}
            </Pressable>
          </View>

          {user.email ? (
            <Text style={[styles.emailNote, { color: c.tx2 }]}>{user.email}</Text>
          ) : null}

          <View style={styles.secondaryActions}>
            <Button
              mode="text"
              onPress={() => setShowSetupChecker(true)}
              textColor={c.tx2}
              labelStyle={styles.secondaryBtnLabel}
            >
              Troubleshoot
            </Button>
            <Text style={[styles.actionSep, { color: c.tx2 }]}>·</Text>
            <Button
              mode="text"
              onPress={handleSignOut}
              textColor="#e57373"
              labelStyle={styles.secondaryBtnLabel}
            >
              Sign out
            </Button>
          </View>
        </View>
      </ScrollView>

      <AvatarPicker
        selectedAvatar={avatarUrl}
        onSelectAvatar={setAvatarUrl}
        visible={isAvatarPickerVisible}
        onClose={() => setIsAvatarPickerVisible(false)}
      />

      {showSetupChecker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surf, borderColor: c.borderDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.tx }]}>Storage setup</Text>
              <IconButton icon="close" iconColor={c.tx2} onPress={() => setShowSetupChecker(false)} />
            </View>
            <SetupChecker onComplete={() => setShowSetupChecker(false)} />
          </View>
        </View>
      )}

      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPrompt: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pageTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 30,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  heroName: {
    fontFamily: FONT_SERIF,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 6,
  },
  statsLine: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    marginBottom: 10,
  },
  lvlPart: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
  },
  xpPart: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePro: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeProText: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeStreak: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeStreakText: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    fontWeight: '600',
  },
  formBlock: {
    gap: 0,
  },
  fieldLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  fieldLabelFirst: {
    marginTop: 0,
  },
  input: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveBtn: {
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  saveBtnLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
    fontWeight: '600',
  },
  emailNote: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    marginTop: 16,
    opacity: 0.9,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  secondaryBtnLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 14,
  },
  actionSep: {
    fontFamily: FONT_SERIF,
    marginHorizontal: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 18,
    fontWeight: '600',
  },
});
