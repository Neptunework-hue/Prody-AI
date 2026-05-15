import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, AppState, TouchableOpacity } from 'react-native';
import { Text, useTheme, IconButton, ProgressBar, TextInput, Button } from 'react-native-paper';
import { useAppTheme } from '../../contexts/AppThemeContext';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import Sidebar from '../../components/Sidebar';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { FocusSession } from '../../types/focus';
import FocusTimer from '../../components/focus/FocusTimer';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { offlineTaskService } from '../../services/offline/taskService';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import { Task } from '../../types/task';
import { taskXpValue } from '../../components/tasks/TaskCardWithSubtasks';
import { getDisplayStreak, localDateKey } from '../../services/questStreak';
import { FONT_SERIF } from '../../constants/lifeTrackerDesign';
import {
  getDailyFocusGoalMinutes,
  setDailyFocusGoalMinutes,
  DAILY_FOCUS_GOAL_MIN_DEFAULT,
} from '../../services/dailyFocusGoalStorage';
import { focusMinutesCompletedToday } from '../../utils/focusMinutesToday';

const GOAL_PRESETS = [60, 90, 120, 180] as const;

function habitXpReward(h: Habit): number {
  return h.xp_reward ?? 15;
}

function computeDailyXpToday(
  today: string,
  tasks: Task[],
  habits: Habit[],
  habitHistory: { habit_id: string; date: string; value?: number }[],
  focusTodayMin: number,
): number {
  const tasksCompletedToday = tasks.filter(
    (t) =>
      t.status === 'completed' &&
      t.updated_at &&
      localDateKey(new Date(t.updated_at)) === today,
  );
  const taskXpToday = tasksCompletedToday.reduce((s, t) => s + taskXpValue(t), 0);
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  let habitXpToday = 0;
  for (const row of habitHistory) {
    if (row.date !== today || (row.value ?? 0) <= 0) continue;
    const h = habitMap.get(row.habit_id);
    if (!h) continue;
    habitXpToday += habitXpReward(h);
  }
  return taskXpToday + habitXpToday + focusTodayMin;
}

export default function FocusScreen() {
  const theme = useTheme();
  const { colors: c } = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [allTasksCache, setAllTasksCache] = useState<Task[]>([]);
  const [habitsList, setHabitsList] = useState<Habit[]>([]);
  const [habitHistoryFull, setHabitHistoryFull] = useState<{ habit_id: string; date: string; value?: number }[]>([]);
  const [focusTodayMin, setFocusTodayMin] = useState(0);
  const [streak, setStreak] = useState(0);
  const [calendarDayKey, setCalendarDayKey] = useState(() => localDateKey(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [dailyFocusGoalMin, setDailyFocusGoalMin] = useState(DAILY_FOCUS_GOAL_MIN_DEFAULT);
  const [goalInput, setGoalInput] = useState(String(DAILY_FOCUS_GOAL_MIN_DEFAULT));

  const shell = useMemo(
    () => ({
      bg: c.bg,
      surf: c.surf,
      tx: c.tx,
      tx2: c.tx2,
      tx3: c.tx3,
      border: c.borderDefault,
    }),
    [c],
  );

  const syncCalendarDay = useCallback(() => {
    setCalendarDayKey(localDateKey(new Date()));
  }, []);

  const loadDailyGoal = useCallback(async () => {
    const g = await getDailyFocusGoalMinutes();
    setDailyFocusGoalMin(g);
    setGoalInput(String(g));
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [sessionsData, tasks, habits] = await Promise.all([
        focusService.getSessions(user.id),
        offlineTaskService.getTasks(user.id),
        habitService.getHabits(user.id),
      ]);
      setSessions(sessionsData);
      setAllTasksCache(tasks);
      setHabitsList(habits);

      const ftm = focusMinutesCompletedToday(sessionsData);
      setFocusTodayMin(ftm);

      let hist: { habit_id: string; date: string; value?: number }[] = [];
      if (habits.length > 0) {
        hist = await habitService.getHabitHistoryByHabitIds(habits.map((h) => h.id));
      }
      setHabitHistoryFull(hist);

      const s = await getDisplayStreak(user.id);
      setStreak(s);
    } catch (error) {
      console.error('Error loading focus data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      syncCalendarDay();
      void loadDailyGoal();
      void loadData();
    }, [syncCalendarDay, loadData, loadDailyGoal]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncCalendarDay();
        void loadData();
      }
    });
    return () => sub.remove();
  }, [syncCalendarDay, loadData]);

  useEffect(() => {
    const id = setInterval(() => {
      const k = localDateKey(new Date());
      setCalendarDayKey((prev) => (prev !== k ? k : prev));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    syncCalendarDay();
    void loadDailyGoal();
    loadData();
  };

  const dailyXpToday = useMemo(
    () =>
      computeDailyXpToday(calendarDayKey, allTasksCache, habitsList, habitHistoryFull, focusTodayMin),
    [calendarDayKey, allTasksCache, habitsList, habitHistoryFull, focusTodayMin],
  );

  const goalCap = Math.max(1, dailyFocusGoalMin);
  const focusProgress = Math.min(1, focusTodayMin / goalCap);
  const focusRemain = Math.max(0, dailyFocusGoalMin - focusTodayMin);

  const applyDailyGoal = useCallback(async () => {
    const n = parseInt(goalInput.replace(/\D/g, ''), 10);
    const v = await setDailyFocusGoalMinutes(Number.isFinite(n) ? n : dailyFocusGoalMin);
    setDailyFocusGoalMin(v);
    setGoalInput(String(v));
  }, [goalInput, dailyFocusGoalMin]);

  const pickGoalPreset = useCallback(async (m: number) => {
    const v = await setDailyFocusGoalMinutes(m);
    setDailyFocusGoalMin(v);
    setGoalInput(String(v));
  }, []);

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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <QuestLogScreenHeader
        title="Focus Session"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        right={<IconButton icon="refresh" onPress={onRefresh} iconColor={c.amber} />}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: c.bg }]}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} colors={[c.amber]} />
        }
      >
        <View style={styles.content}>
          <View style={styles.statGrid}>
            <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
              <Text style={[styles.statCellValue, { color: c.amber }]}>+{dailyXpToday}</Text>
              <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Daily goal (XP)</Text>
            </View>
            <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
              <Text style={[styles.statCellValue, { color: c.teal }]}>{streak}d</Text>
              <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Streak</Text>
            </View>
          </View>

          <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <View style={styles.focusHeader}>
              <Text style={[styles.sectionHeading, { color: shell.tx, marginBottom: 0 }]}>Daily deep work goal</Text>
              <Text style={[styles.focusRatio, { color: shell.tx2 }]}>
                {focusTodayMin} / {dailyFocusGoalMin} min
              </Text>
            </View>
            <ProgressBar progress={focusProgress} color={c.teal} style={styles.focusBar} />
            <Text style={[styles.focusHint, { color: shell.tx2 }]}>
              {focusRemain === 0
                ? 'Daily goal reached'
                : `${focusRemain} minutes to reach daily goal`}
            </Text>
          </View>

          <FocusTimer
            taskId={params.taskId as string}
            taskTitle={params.taskTitle as string}
            onSessionComplete={loadData}
          />

          <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <Text style={[styles.sectionHeading, { color: shell.tx }]}>Set daily deep work target</Text>
            <Text style={[styles.goalHelp, { color: shell.tx2 }]}>
              Minutes per day for your progress bar (15–480). Same value is used on the dashboard “Focus today”
              card.
            </Text>
            <View style={styles.goalRow}>
              <TextInput
                mode="outlined"
                label="Minutes"
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="number-pad"
                dense
                style={[styles.goalInput, { backgroundColor: c.surfaceDeep }]}
                outlineColor={c.outlineFaint}
                activeOutlineColor={c.amber}
                textColor={c.parchment}
              />
              <Button mode="contained" onPress={() => void applyDailyGoal()} buttonColor={c.teal} textColor={c.onAccent}>
                Save
              </Button>
            </View>
            <View style={styles.goalPresets}>
              {GOAL_PRESETS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.goalPresetBtn,
                    {
                      borderColor: dailyFocusGoalMin === m ? c.teal : c.outlineFaint,
                      backgroundColor: dailyFocusGoalMin === m ? c.tealBg : c.bg,
                    },
                  ]}
                  onPress={() => void pickGoalPreset(m)}
                >
                  <Text style={[styles.goalPresetText, { color: dailyFocusGoalMin === m ? c.teal : shell.tx2 }]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sessionsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Recent Sessions</Text>
            {sessions.length === 0 && (
              <Text style={[styles.sessionDate, { color: c.parchmentMuted, textAlign: 'center', marginVertical: 12 }]}>
                No sessions yet — start a timer above to log your first focus block.
              </Text>
            )}
            {sessions.map((session) => (
              <View
                key={session.id}
                style={[
                  styles.sessionItem,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: c.outline,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Text style={[styles.sessionDate, { color: theme.colors.onSurface }]}>
                  {new Date(session.start_time).toLocaleDateString()}
                </Text>
                <Text style={[styles.sessionTime, { color: c.parchmentMuted }]}>
                  {new Date(session.start_time).toLocaleTimeString()} -{' '}
                  {session.end_time ? new Date(session.end_time).toLocaleTimeString() : 'In Progress'}
                </Text>
                <Text style={[styles.sessionDuration, { color: c.parchmentMuted }]}>
                  Duration: {formatDuration(calculateDuration(session))}
                </Text>
                {session.notes ? (
                  <Text style={[styles.sessionNotes, { color: c.parchmentMuted }]}>Notes: {session.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
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
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  statCellValue: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '700',
  },
  statCellLabel: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: FONT_SERIF,
  },
  sectionCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeading: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  focusRatio: {
    fontSize: 14,
    fontFamily: FONT_SERIF,
  },
  focusBar: {
    height: 10,
    borderRadius: 5,
  },
  focusHint: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONT_SERIF,
  },
  goalHelp: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    fontFamily: FONT_SERIF,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  goalInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    fontSize: 16,
  },
  goalPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalPresetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  goalPresetText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_SERIF,
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
});
