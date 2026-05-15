import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import Sidebar from '../../components/Sidebar';

const VERSIONS = [
  {
    version: 'v5.0',
    label: 'Current',
    date: 'May 2026',
    accent: 'amber' as const,
    icon: 'star-four-points' as const,
    changes: [
      'AI Oracle with voice input and tool-calling agent',
      'Offline-first task sync with pending queue',
      'Light / dark mode with warm parchment palette',
      'XP flash animations and level-up confetti',
      'Full-width calendar with habit dots and status pills',
      'Weekly AI summary from focus, habit, and task data',
      'Human-like TTS voice with auto-silence detection',
      'Swipe navigation between main screens',
    ],
  },
  {
    version: 'v4.0',
    label: 'Beta',
    date: 'March 2026',
    accent: 'blue' as const,
    icon: 'rocket-launch-outline' as const,
    changes: [
      'Supabase real-time sync across devices',
      'Focus session history and interruption tracking',
      'Habit streak calculations and dot grid visualization',
      'Statistics screen with focus and task analytics',
      'Profile screen with avatar upload',
      'Offline settings and manual sync controls',
    ],
  },
  {
    version: 'v3.0',
    label: 'Alpha',
    date: 'February 2026',
    accent: 'teal' as const,
    icon: 'leaf-circle-outline' as const,
    changes: [
      'Subtask support with collapsible parent tasks',
      'Folder/quest grouping for tasks',
      'Calendar view with task and habit overlays',
      'Daily habit logging with frequency scheduling',
      'Focus timer with pause, resume, and session notes',
      'Task priority scoring and XP rewards per task',
    ],
  },
  {
    version: 'v2.0',
    label: 'RPG Redesign',
    date: 'January 2026',
    accent: 'pink' as const,
    icon: 'shield-star-outline' as const,
    changes: [
      'Full RPG "Quest Log" visual redesign',
      'XP and leveling system (AsyncStorage-backed)',
      'Dark theme with gold, teal, blue, and pink palette',
      'Georgia serif typeface throughout',
      'Dashboard redesigned as quest board',
      'Gamification: level badges, XP progress bar',
    ],
  },
  {
    version: 'v1.0',
    label: 'Foundation',
    date: 'December 2025',
    accent: 'teal' as const,
    icon: 'sprout-outline' as const,
    changes: [
      'Initial React Native / Expo app with TypeScript',
      'Supabase authentication (email + password)',
      'Basic task creation, editing, and status management',
      'Pomodoro focus timer',
      'Daily habit tracking',
      'Bottom navigation with five main tabs',
    ],
  },
];

const STACK = [
  { icon: 'language-typescript' as const, label: 'TypeScript + React Native' },
  { icon: 'routes' as const, label: 'Expo Router (SDK 54)' },
  { icon: 'database' as const, label: 'Supabase (auth + Postgres)' },
  { icon: 'robot-outline' as const, label: 'OpenAI GPT-4o-mini + Whisper' },
  { icon: 'wifi-off' as const, label: 'Offline-first with AsyncStorage' },
  { icon: 'palette-outline' as const, label: 'React Native Paper (MD3)' },
];

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    hero: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 24,
      paddingHorizontal: 24,
      borderBottomWidth: 1,
      borderBottomColor: c.amberBorder,
    },
    heroIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: c.amberBg,
      borderWidth: 1.5,
      borderColor: c.amberBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    heroTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 26,
      fontWeight: '700',
      color: c.tx,
      letterSpacing: 1,
    },
    heroVersion: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      color: c.amber,
      fontWeight: '600',
      marginTop: 4,
      letterSpacing: 0.5,
    },
    heroDesc: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      color: c.tx2,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 10,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      fontWeight: '700',
      color: c.tx3,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 14,
    },
    stackGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    stackChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderDefault,
      backgroundColor: c.surf,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    stackChipText: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      color: c.tx2,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.ruleHairline,
      marginHorizontal: 20,
      marginVertical: 8,
    },
    versionCard: {
      marginHorizontal: 20,
      marginBottom: 14,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: c.surf,
      overflow: 'hidden',
    },
    versionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    versionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    versionTextBlock: {
      flex: 1,
    },
    versionNum: {
      fontFamily: FONT_SERIF,
      fontSize: 16,
      fontWeight: '700',
      color: c.tx,
    },
    versionMeta: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: c.tx3,
      marginTop: 1,
    },
    versionLabel: {
      fontFamily: FONT_SERIF,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      overflow: 'hidden',
    },
    changeList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.ruleHairline,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    changeDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 7,
      flexShrink: 0,
    },
    changeText: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      color: c.tx2,
      lineHeight: 20,
      flex: 1,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 28,
      gap: 4,
    },
    footerText: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: c.tx3,
    },
    footerAccent: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: c.amber,
      fontWeight: '600',
    },
  });
}

export default function AboutScreen() {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = React.useState(false);

  function accentColor(key: 'amber' | 'teal' | 'blue' | 'pink') {
    return key === 'amber' ? c.amber : key === 'teal' ? c.teal : key === 'blue' ? c.blue : c.pink;
  }
  function accentBg(key: 'amber' | 'teal' | 'blue' | 'pink') {
    return key === 'amber' ? c.amberBg : key === 'teal' ? c.tealBg : key === 'blue' ? c.blueBg : c.pinkBg;
  }
  function accentBorder(key: 'amber' | 'teal' | 'blue' | 'pink') {
    return key === 'amber' ? c.amberBorder : key === 'teal' ? c.tealBorder : key === 'blue' ? c.blueBorder : c.pinkBorder;
  }

  return (
    <View style={styles.container}>
      <QuestLogScreenHeader
        title="About"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="star-four-points" size={34} color={c.amber} />
          </View>
          <Text style={styles.heroTitle}>ProdyAI</Text>
          <Text style={styles.heroVersion}>Version 5.0 · May 2026</Text>
          <Text style={styles.heroDesc}>
            A gamified productivity companion — tasks, focus sessions, habits, and an AI oracle, unified in one quest-themed workspace.
          </Text>
        </View>

        {/* Tech stack */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built With</Text>
          <View style={styles.stackGrid}>
            {STACK.map((item) => (
              <View key={item.label} style={styles.stackChip}>
                <MaterialCommunityIcons name={item.icon} size={15} color={c.amber} />
                <Text style={styles.stackChipText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.rule} />

        {/* Version history */}
        <View style={[styles.section, { paddingBottom: 4 }]}>
          <Text style={styles.sectionTitle}>Version History</Text>
        </View>

        {VERSIONS.map((v) => (
          <View
            key={v.version}
            style={[styles.versionCard, { borderColor: accentBorder(v.accent) }]}
          >
            <View style={[styles.versionHeader, { backgroundColor: accentBg(v.accent) }]}>
              <View style={[styles.versionIconWrap, { backgroundColor: accentBg(v.accent) }]}>
                <MaterialCommunityIcons name={v.icon} size={20} color={accentColor(v.accent)} />
              </View>
              <View style={styles.versionTextBlock}>
                <Text style={styles.versionNum}>{v.version}</Text>
                <Text style={styles.versionMeta}>{v.date}</Text>
              </View>
              <View style={[styles.versionLabel, { backgroundColor: accentBg(v.accent), borderWidth: 1, borderColor: accentBorder(v.accent) }]}>
                <Text style={[styles.versionLabel, { color: accentColor(v.accent), backgroundColor: 'transparent' }]}>
                  {v.label}
                </Text>
              </View>
            </View>
            <View style={styles.changeList}>
              {v.changes.map((change, i) => (
                <View key={i} style={styles.changeRow}>
                  <View style={[styles.changeDot, { backgroundColor: accentColor(v.accent) }]} />
                  <Text style={styles.changeText}>{change}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ProdyAI · Graduation Project 2026</Text>
          <Text style={styles.footerAccent}>Built with React Native + Expo</Text>
          <Text style={styles.footerText}>Powered by Supabase · OpenAI</Text>
        </View>
      </ScrollView>

      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}
