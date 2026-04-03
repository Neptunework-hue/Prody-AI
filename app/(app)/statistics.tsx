import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, IconButton, useTheme } from 'react-native-paper';
import { LT } from '../../constants/lifeTrackerDesign';
// import a chart library if available, else use a placeholder
// import { LineChart } from 'react-native-chart-kit';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { offlineTaskService } from '../../services/offline/taskService';
import { habitService } from '../../services/supabase/habitService';
import { useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';

// Removed mock placeholders; pulling real data

export default function StatisticsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [focusSessions, setFocusSessions] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [failedTasks, setFailedTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitCounts, setHabitCounts] = useState<Record<string, number>>({});

  // Centralized loader
  const loadData = React.useCallback(async () => {
    if (!user) return;
    const [sessions, all, userHabits] = await Promise.all([
      focusService.getSessions(user.id),
      offlineTaskService.getTasks(user.id),
      habitService.getHabits(user.id),
    ]);
    setFocusSessions(sessions as any);
    setAllTasks(all as any);
    // Derive completed/failed from offline tasks
    const comp = (all as any).filter((t: any) => t.status === 'completed');
    const fail = (all as any).filter((t: any) => t.status === 'failed');
    setCompletedTasks(comp);
    setFailedTasks(fail);
    setHabits(userHabits as any);
    const ids = (userHabits as any).map((h: any) => h.id);
    if (ids.length > 0) {
      const history = await habitService.getHabitHistoryByHabitIds(ids);
      const counts: Record<string, number> = {};
      history.forEach((row: any) => {
        counts[row.habit_id] = (counts[row.habit_id] || 0) + (row.value || 0);
      });
      setHabitCounts(counts);
    } else {
      setHabitCounts({});
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on screen focus
  useFocusEffect(React.useCallback(() => {
    loadData();
    return () => {};
  }, [loadData]));

  // Realtime subscriptions for immediate updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${user.id}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_history' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.header, { color: theme.colors.onSurface }]}>Statistics</Text>
        <Text style={[styles.subheader, { color: LT.parchmentMuted }]}>Your productivity overview</Text>
        {/* Habit summary - horizontal scrollable */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            {habits.map((h: any) => (
              <Card key={h.id} mode="elevated" style={[styles.habitCard, { marginRight: 12, backgroundColor: theme.colors.surfaceVariant }]}> 
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <Text style={{ fontSize: 28 }}>{h.icon || '🧩'}</Text>
                  <IconButton icon="delete" onPress={async () => { await habitService.deleteHabit(h.id); const updated = await habitService.getHabits(user!.id); setHabits(updated as any); }} size={18} style={{ margin: 0 }} />
                </View>
                <Text style={{ fontWeight: 'bold', marginTop: 4, color: theme.colors.onSurface }} numberOfLines={1}>{h.title}</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 12 }}>+{habitCounts[h.id] || 0} times</Text>
              </Card>
            ))}
          </View>
        </ScrollView>
        {/* Completion rate */}
        <Card mode="elevated" style={[styles.chartCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.onSurface }}>Tasks Completion Rate</Text>
          {(() => {
            const total = allTasks.length || 0;
            const completed = completedTasks.length || 0;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <View style={{ height: 80, justifyContent: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.colors.primary }}>{rate}%</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 12 }}>{completed} of {total} tasks completed</Text>
              </View>
            );
          })()}
        </Card>
        {/* History Section */}
        <Card mode="elevated" style={[styles.historyCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.onSurface }}>History</Text>
          {focusSessions.length === 0 && completedTasks.length === 0 && failedTasks.length === 0 && <Text style={{ color: LT.parchmentMuted }}>No history yet.</Text>}
          {focusSessions.map(session => (
            <View key={session.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>⏱️</Text>
              <View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>Focus Session</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 12 }}>{session.notes || 'No notes'} - {session.start_time.slice(0, 10)}</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 11, opacity: 0.8 }}>{session.start_time.slice(0, 10)}</Text>
              </View>
            </View>
          ))}
          {completedTasks.map(task => (
            <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>✅</Text>
              <View>
                <Text style={{ fontWeight: 'bold', color: LT.teal }}>Task Completed</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 12 }}>{task.title} - {task.updated_at.slice(0, 10)}</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 11, opacity: 0.8 }}>{task.updated_at.slice(0, 10)}</Text>
              </View>
            </View>
          ))}
          {failedTasks.map(task => (
            <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>❌</Text>
              <View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.error }}>Task Failed</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 12 }}>{task.title} - {task.updated_at.slice(0, 10)}</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 11, opacity: 0.8 }}>{task.updated_at.slice(0, 10)}</Text>
              </View>
            </View>
          ))}
        </Card>
        {/* Add more analytics as needed */}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 14,
    marginBottom: 16,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  habitCard: {
    width: 140,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    elevation: 2,
  },
  chartCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
  },
  historyCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
  },
}); 