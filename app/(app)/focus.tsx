import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { LT } from '../../constants/lifeTrackerDesign';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { FocusSession, FocusSessionStats } from '../../types/focus';
import FocusTimer from '../../components/focus/FocusTimer';
import FocusStats from '../../components/focus/FocusStats';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';

export default function FocusScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusSessionStats>({
    total_sessions: 0,
    total_duration: 0,
    average_duration: 0,
    total_interruptions: 0,
    average_interruptions: 0,
    completion_rate: 0,
    longest_streak: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const [sessionsData, statsData] = await Promise.all([
        focusService.getSessions(user.id),
        focusService.getStats(user.id)
      ]);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading focus data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const calculateDuration = (session: FocusSession) => {
    const start = new Date(session.start_time).getTime();
    const end = session.end_time ? new Date(session.end_time).getTime() : Date.now();
    return Math.floor((end - start) / (1000 * 60));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Focus</Text>
        <IconButton icon="refresh" onPress={onRefresh} iconColor={theme.colors.onSurface} />
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <FocusTimer
            taskId={params.taskId as string}
            taskTitle={params.taskTitle as string}
            onSessionComplete={loadData}
          />

          <FocusStats stats={stats} />

          <View style={styles.sessionsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Recent Sessions</Text>
            {sessions.map((session) => (
              <View
                key={session.id}
                style={[
                  styles.sessionItem,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: LT.outline, borderWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.sessionDate, { color: theme.colors.onSurface }]}>
                  {new Date(session.start_time).toLocaleDateString()}
                </Text>
                <Text style={[styles.sessionTime, { color: LT.parchmentMuted }]}>
                  {new Date(session.start_time).toLocaleTimeString()} -{' '}
                  {session.end_time
                    ? new Date(session.end_time).toLocaleTimeString()
                    : 'In Progress'}
                </Text>
                <Text style={[styles.sessionDuration, { color: LT.parchmentMuted }]}>
                  Duration: {formatDuration(calculateDuration(session))}
                </Text>
                {session.notes && (
                  <Text style={[styles.sessionNotes, { color: LT.parchmentMuted }]}>Notes: {session.notes}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sessionsContainer: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sessionItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    marginBottom: 4,
  },
  sessionDuration: {
    fontSize: 14,
    marginBottom: 4,
  },
  sessionNotes: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 