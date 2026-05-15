import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, AppState } from 'react-native';
import { Text, Card, Button, Modal, Portal, FAB, Checkbox, ProgressBar } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { focusService } from '../../services/supabase/focus';
import OfflineIndicator from '../../components/OfflineIndicator';
import Sidebar from '../../components/Sidebar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import { habitService } from '../../services/supabase/habitService';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import ThemeModeToggle from '../../components/ThemeModeToggle';
import { taskXpValue } from '../../components/tasks/TaskCardWithSubtasks';
import { getTaskFolders } from '../../services/foldersStorage';
import { syncDailyStreak, localDateKey } from '../../services/questStreak';
import { getDailyFocusGoalMinutes, DAILY_FOCUS_GOAL_MIN_DEFAULT } from '../../services/dailyFocusGoalStorage';
import { focusMinutesCompletedToday } from '../../utils/focusMinutesToday';
import { isHabitDueOnDate } from '../../utils/habitSchedule';
import { getLevelProgress } from '../../utils/leveling';
import { countHabitCompletions, HABIT_DOT_DAY_COUNT } from '../../utils/habitCardHelpers';
import { Habit } from '../../types/habit';
import HabitQuestCard from '../../components/habits/HabitQuestCard';
import { addXP } from '../../utils/xpSystem';
import XpFlash from '../../components/XpFlash';
import ConfettiCannon from 'react-native-confetti-cannon';

// Activity mapping for display
const ACTIVITY_OPTIONS = [
  // Most frequently used activities first
  { key: 'exercise', label: 'Exercise', emoji: '🏋️' },
  { key: 'reading', label: 'Reading', emoji: '📖' },
  { key: 'meditation', label: 'Meditation', emoji: '🧘' },
  { key: 'working', label: 'Working', emoji: '💻' },
  { key: 'study', label: 'Study', emoji: '📚' },
  { key: 'writing', label: 'Writing', emoji: '📝' },
  { key: 'jogging', label: 'Jogging', emoji: '🏃' },
  { key: 'cooking', label: 'Cooking', emoji: '👨‍🍳' },
  { key: 'guitar', label: 'Guitar', emoji: '🎸' },
  { key: 'painting', label: 'Painting', emoji: '🎨' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'party', label: 'Party', emoji: '🎉' },
  { key: 'trading', label: 'Trading', emoji: '📊' },
  { key: 'loving', label: 'Loving', emoji: '❤️' },
  { key: 'drink', label: 'Drink', emoji: '💧' },
];

// Helper function to parse date consistently
const parseDate = (dateString: string): Date => {
  if (!dateString) {
    throw new Error('Date string is empty or undefined');
  }
  
  if (dateString.includes('T')) {
    // ISO string format (old format)
    return new Date(dateString);
  } else {
    // Date string format (YYYY-MM-DD, new format)
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(`Invalid date components: ${dateString}`);
    }
    return new Date(year, month - 1, day);
  }
};

/** Max height for dashboard list sections (~2 items visible; rest scroll inside). */
const SECTION_SCROLL_MAX_HEIGHT = 280;

function parseLocalDayKeyToDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** True if task deadline falls on the given calendar day (YYYY-MM-DD, local). */
function deadlineOnCalendarDay(deadline: string, dayKey: string): boolean {
  try {
    const taskDate = parseDate(deadline);
    const ref = parseLocalDayKeyToDate(dayKey);
    return (
      taskDate.getFullYear() === ref.getFullYear() &&
      taskDate.getMonth() === ref.getMonth() &&
      taskDate.getDate() === ref.getDate()
    );
  } catch {
    return false;
  }
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function inferQuestTier(task: Task): { label: string; accentKey: 'amber' | 'teal' | 'blue' | 'pink' } {
  const raw = `${task.category ?? ''} ${(task.tags ?? []).join(' ')}`.toLowerCase();
  if (/study|edu|learn|school|course|capstone|chapter|draft/.test(raw)) return { label: 'Edu', accentKey: 'blue' };
  if (/health|gym|workout|run|meditation|morning|ritual|evening/.test(raw)) return { label: 'Health', accentKey: 'teal' };
  if (/habit|personal|journal/.test(raw)) return { label: 'Habit', accentKey: 'pink' };
  if (/work|career|job|portfolio|site/.test(raw)) return { label: 'Career', accentKey: 'amber' };
  return { label: 'Quest', accentKey: 'amber' };
}

function habitXpReward(h: Habit): number {
  return h.xp_reward ?? 15;
}

function tierColor(accentKey: 'amber' | 'teal' | 'blue' | 'pink', c: ThemeColors): string {
  switch (accentKey) {
    case 'blue':
      return c.blue;
    case 'teal':
      return c.teal;
    case 'pink':
      return c.pink;
    default:
      return c.amber;
  }
}

/** Root task with no folder (null, undefined, or empty). */
function isUngroupedRoot(t: Task): boolean {
  if (t.parent_task_id) return false;
  const f = t.folder_id;
  return f == null || String(f).trim() === '';
}

function taskBelongsToFolder(t: Task, folderId: string): boolean {
  return !!t.folder_id && String(t.folder_id) === String(folderId);
}

/** Active quests only track work still in play (not completed, failed, or deleted). */
function isQuestActiveTask(t: Task): boolean {
  return t.status === 'pending' || t.status === 'in_progress';
}

function computeRootQuestProgress(task: Task, allTasks: Task[]): number {
  const subs = allTasks.filter((x) => x.parent_task_id === task.id);
  if (subs.length > 0) {
    const done = subs.filter((s) => s.status === 'completed').length;
    return Math.min(100, Math.round((done / subs.length) * 100));
  }
  if (task.status === 'completed') return 100;
  const tier = Math.min(3, Math.floor(taskXpValue(task) / 35));
  if (task.status === 'in_progress') return Math.min(90, 40 + tier * 12);
  return Math.min(45, 18 + tier * 9);
}

export default function DashboardScreen() {
  const { colors: c } = useAppTheme();
  const { session, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [allActiveTasks, setAllActiveTasks] = useState<Task[]>([]);
  const [allTasksCache, setAllTasksCache] = useState<Task[]>([]);
  const [focusTodayMin, setFocusTodayMin] = useState(0);
  const [habitsList, setHabitsList] = useState<Habit[]>([]);
  const [habitHistoryFull, setHabitHistoryFull] = useState<
    { habit_id: string; date: string; value?: number }[]
  >([]);
  const [taskFolders, setTaskFolders] = useState<{ id: string; name: string }[]>([]);
  const [focusStats, setFocusStats] = useState({ total_duration: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  /** Local calendar day for “today” lists; advances at midnight / resume / focus. */
  const [calendarDayKey, setCalendarDayKey] = useState(() => localDateKey(new Date()));
  const [dailyFocusGoalMin, setDailyFocusGoalMin] = useState(DAILY_FOCUS_GOAL_MIN_DEFAULT);
  const [xpFlash, setXpFlash] = useState<{ amount: number; key: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState<number | null>(null);

  const syncCalendarDay = useCallback(() => {
    setCalendarDayKey(localDateKey(new Date()));
  }, []);

  // Listen for refresh parameter changes from chat
  useEffect(() => {
    if (params.refresh) {
      fetchTasks();
    }
  }, [params.refresh]);

  // Listen for reset parameter changes from profile
  useEffect(() => {
    if (params.reset === 'true') {
      setStreak(0);
      setFocusStats({ total_duration: 0 });
      fetchTasks();
      // Clear the reset parameter
      router.setParams({ reset: undefined });
    }
  }, [params.reset]);

  // Never call router.replace during render — it triggers "Cannot update a component while rendering"
  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      router.replace('/(auth)/login');
    }
  }, [authLoading, session?.user, router]);

  // Fetch tasks for today
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allTasks = await offlineTaskService.getTasks(user.id);
      setAllTasksCache(allTasks);
      const activeTasks = allTasks.filter(task => task.status !== 'completed' && task.status !== 'failed');
      setAllActiveTasks(activeTasks);
    } catch (e) {
      console.error('Dashboard: Error fetching tasks:', e);
      setAllTasksCache([]);
      setAllActiveTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const loadDashboardHabits = useCallback(async () => {
    if (!user) return;
    try {
      const habits = await habitService.getHabits(user.id);
      setHabitsList(habits);
      if (habits.length === 0) {
        setHabitHistoryFull([]);
        return;
      }
      const ids = habits.map((h) => h.id);
      const hist = await habitService.getHabitHistoryByHabitIds(ids);
      setHabitHistoryFull(hist);
    } catch {
      setHabitsList([]);
      setHabitHistoryFull([]);
    }
  }, [user]);

  const loadTaskFolders = useCallback(async () => {
    if (!user) return;
    try {
      const folders = await getTaskFolders(user.id);
      setTaskFolders(folders);
    } catch {
      setTaskFolders([]);
    }
  }, [user]);

  /** Today’s focus minutes + lifetime focus stats (keeps dashboard in sync with the focus timer). */
  const refreshFocusMetrics = useCallback(async () => {
    if (!user) return;
    try {
      const [sessions, stats] = await Promise.all([
        focusService.getSessions(user.id),
        focusService.getStats(user.id),
      ]);
      setFocusTodayMin(focusMinutesCompletedToday(sessions));
      setFocusStats(stats);
    } catch {
      setFocusTodayMin(0);
      setFocusStats({ total_duration: 0 });
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      syncCalendarDay();
      void getDailyFocusGoalMinutes().then(setDailyFocusGoalMin);
      void refreshFocusMetrics();
      fetchTasks();
      loadDashboardHabits();
      loadTaskFolders();
    }, [syncCalendarDay, refreshFocusMetrics, fetchTasks, loadDashboardHabits, loadTaskFolders]),
  );

  const onRefresh = useCallback(async () => {
    syncCalendarDay();
    setRefreshing(true);
    await refreshFocusMetrics();
    await fetchTasks();
    await loadDashboardHabits();
    await loadTaskFolders();
  }, [syncCalendarDay, refreshFocusMetrics, fetchTasks, loadDashboardHabits, loadTaskFolders]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshFlag]);

  useEffect(() => {
    void refreshFocusMetrics();
  }, [refreshFocusMetrics, refreshFlag, calendarDayKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncCalendarDay();
        void refreshFocusMetrics();
      }
    });
    return () => sub.remove();
  }, [syncCalendarDay, refreshFocusMetrics]);

  useEffect(() => {
    const id = setInterval(() => {
      const k = localDateKey(new Date());
      setCalendarDayKey((prev) => (prev !== k ? k : prev));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void getDailyFocusGoalMinutes().then(setDailyFocusGoalMin);
  }, [refreshFlag]);

  useEffect(() => {
    loadTaskFolders();
  }, [loadTaskFolders, refreshFlag]);

  useEffect(() => {
    loadDashboardHabits();
  }, [loadDashboardHabits, refreshFlag]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const todayLocal = calendarDayKey;
      const allTasks = await offlineTaskService.getTasks(user.id);
      if (cancelled) return;
      const taskActivityToday = allTasks.some(
        (t) =>
          t.status === 'completed' &&
          t.updated_at &&
          localDateKey(new Date(t.updated_at)) === todayLocal,
      );
      let habitActivityToday = false;
      try {
        const habits = await habitService.getHabits(user.id);
        if (habits.length > 0) {
          const ids = habits.map((h) => h.id);
          const hist = await habitService.getHabitHistoryByHabitIds(ids);
          habitActivityToday = hist.some(
            (h) => h.date === todayLocal && (h.value ?? 0) > 0,
          );
        }
      } catch {
        habitActivityToday = false;
      }
      let focusActivityToday = false;
      try {
        const sessions = await focusService.getSessions(user.id);
        if (cancelled) return;
        focusActivityToday = focusMinutesCompletedToday(sessions) > 0;
      } catch {
        focusActivityToday = false;
      }
      const s = await syncDailyStreak(
        user.id,
        taskActivityToday || habitActivityToday || focusActivityToday,
      );
      if (!cancelled) setStreak(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshFlag, calendarDayKey]);

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

  const activeQuestRows = useMemo(() => {
    const pool = allTasksCache.length ? allTasksCache : [];
    const roots = pool.filter((t) => !t.parent_task_id);
    const folderIds = new Set(taskFolders.map((f) => f.id));
    const accentRotate: Array<'amber' | 'teal' | 'blue' | 'pink'> = ['amber', 'teal', 'blue'];
    const rows: {
      id: string;
      title: string;
      tier: string;
      accentKey: 'amber' | 'teal' | 'blue' | 'pink';
      color: string;
      progress: number;
      totalTasks: number;
      completedTasks: number;
      deadline?: string;
    }[] = [];

    function nearestDeadline(tasks: Task[]): string | undefined {
      const deadlines = tasks
        .filter((t) => t.deadline && t.status !== 'completed')
        .map((t) => t.deadline as string)
        .sort();
      return deadlines[0];
    }

    for (const f of taskFolders) {
      const rootsInFolder = roots.filter((t) => taskBelongsToFolder(t, f.id));
      const activeInFolder = rootsInFolder.filter(isQuestActiveTask);
      if (activeInFolder.length === 0) continue;
      const totalRoots = rootsInFolder.length;
      const completedRoots = rootsInFolder.filter((t) => t.status === 'completed').length;
      const progress =
        totalRoots > 0 ? Math.min(100, Math.round((completedRoots / totalRoots) * 100)) : 0;
      const accentKey = accentRotate[rows.length % accentRotate.length];
      const { label: tierLabel } = inferQuestTier(activeInFolder[0]);
      rows.push({
        id: `folder-${f.id}`,
        title: f.name.length > 40 ? `${f.name.slice(0, 38)}…` : f.name,
        tier: tierLabel,
        accentKey,
        color: tierColor(accentKey, c),
        progress,
        totalTasks: totalRoots,
        completedTasks: completedRoots,
        deadline: nearestDeadline(rootsInFolder),
      });
    }

    const ungroupedRoots = roots.filter(
      (t) =>
        isUngroupedRoot(t) ||
        (!!t.folder_id && String(t.folder_id).trim() !== '' && !folderIds.has(String(t.folder_id))),
    );
    for (const task of ungroupedRoots) {
      if (!isQuestActiveTask(task)) continue;
      const subtasks = pool.filter((x) => x.parent_task_id === task.id);
      const completedSubs = subtasks.filter((x) => x.status === 'completed').length;
      const progress = computeRootQuestProgress(task, pool);
      const { label, accentKey } = inferQuestTier(task);
      rows.push({
        id: `task-${task.id}`,
        title: task.title.length > 40 ? `${task.title.slice(0, 38)}…` : task.title,
        tier: label,
        accentKey,
        color: tierColor(accentKey, c),
        progress,
        totalTasks: subtasks.length > 0 ? subtasks.length : 1,
        completedTasks: subtasks.length > 0 ? completedSubs : (task.status === 'completed' ? 1 : 0),
        deadline: task.deadline ?? undefined,
      });
    }

    rows.sort((a, b) => a.progress - b.progress);
    return rows.slice(0, 5);
  }, [allTasksCache, taskFolders, c]);

  const todayTasksList = useMemo(() => {
    const all = allTasksCache.length ? allTasksCache : allActiveTasks;
    const roots = all.filter((t) => !t.parent_task_id);
    const onToday = roots.filter((t) => {
      if (!t.deadline) return false;
      return deadlineOnCalendarDay(t.deadline, calendarDayKey);
    });
    return onToday
      .slice()
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return taskXpValue(b) - taskXpValue(a);
      })
      .slice(0, 8);
  }, [allTasksCache, allActiveTasks, calendarDayKey]);

  const habitDueStats = useMemo(() => {
    const ref = parseLocalDayKeyToDate(calendarDayKey);
    const due = habitsList.filter((h) => isHabitDueOnDate(h, ref));
    const doneIds = new Set(
      habitHistoryFull
        .filter((h) => h.date === calendarDayKey && (h.value ?? 0) > 0)
        .map((h) => h.habit_id),
    );
    return {
      dueToday: due.length,
      doneAmongDue: due.filter((h) => doneIds.has(h.id)).length,
    };
  }, [habitsList, habitHistoryFull, calendarDayKey]);

  const totalXP = useMemo(() => {
    const completedTasks = allTasksCache.filter((t) => t.status === 'completed');
    const taskXp = completedTasks.reduce((s, t) => s + taskXpValue(t), 0);
    const habitMap = new Map(habitsList.map((h) => [h.id, h]));
    let habitXp = 0;
    for (const row of habitHistoryFull) {
      if ((row.value ?? 0) <= 0) continue;
      const h = habitMap.get(row.habit_id);
      if (!h) continue;
      habitXp += habitXpReward(h);
    }
    const focusXp = Math.floor(focusStats.total_duration);
    return Math.max(0, taskXp + habitXp + focusXp);
  }, [allTasksCache, habitsList, habitHistoryFull, focusStats.total_duration]);

  const levelProgress = useMemo(() => getLevelProgress(totalXP), [totalXP]);

  /** All habits scheduled for today (incl. brand-new), sorted by most lifetime logs; caps list length. */
  const dashboardHabits = useMemo(() => {
    const ref = parseLocalDayKeyToDate(calendarDayKey);
    const due = habitsList.filter((h) => isHabitDueOnDate(h, ref));
    return due
      .slice()
      .sort(
        (a, b) =>
          countHabitCompletions(b.id, habitHistoryFull) -
          countHabitCompletions(a.id, habitHistoryFull),
      )
      .slice(0, 8);
  }, [habitsList, habitHistoryFull, calendarDayKey]);

  const logHabitToday = useCallback(
    async (habitId: string) => {
      try {
        await habitService.logHabitProgress(habitId, localDateKey(new Date()), 1);
        setRefreshFlag((f) => !f);
      } catch (e) {
        console.error('logHabitToday', e);
      }
    },
    [],
  );

  const dailyXPBadge = useMemo(() => {
    const today = calendarDayKey;
    const all = allTasksCache.length ? allTasksCache : [];
    const tasksCompletedToday = all.filter(
      (t) =>
        t.status === 'completed' &&
        t.updated_at &&
        localDateKey(new Date(t.updated_at)) === today,
    );
    const taskXpToday = tasksCompletedToday.reduce((s, t) => s + taskXpValue(t), 0);
    const habitMap = new Map(habitsList.map((h) => [h.id, h]));
    let habitXpToday = 0;
    for (const row of habitHistoryFull) {
      if (row.date !== today || (row.value ?? 0) <= 0) continue;
      const h = habitMap.get(row.habit_id);
      if (!h) continue;
      habitXpToday += habitXpReward(h);
    }
    return taskXpToday + habitXpToday + focusTodayMin;
  }, [allTasksCache, focusTodayMin, habitsList, habitHistoryFull, calendarDayKey]);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string; username?: string } | undefined;
    return meta?.full_name?.trim() || meta?.name?.trim() || meta?.username?.trim() || user?.email?.split('@')[0] || 'Hero';
  }, [user]);

  const taskMetaLine = (task: Task) => {
    const q = inferQuestTier(task);
    const label = task.category?.trim() || q.label;
    return `${label} · +${taskXpValue(task)} XP`;
  };

  // Move task to previous (completed/failed) by updating its status
  const handleTaskStatus = async (task: Task, status: 'completed' | 'failed') => {
    try {
      await offlineTaskService.updateTaskStatus(task.id, status);
      setShowModal(false);
      setSelectedTask(null);
      setRefreshFlag(f => !f); // trigger refresh
    } catch (e) {}
  };

  const toggleTodayTaskComplete = async (task: Task) => {
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      await offlineTaskService.updateTaskStatus(task.id, nextStatus);
      if (nextStatus === 'completed') {
        const xp = taskXpValue(task);
        const { leveledUp } = await addXP(xp);
        setXpFlash({ amount: xp, key: Date.now() });
        if (leveledUp) setLevelUpKey(Date.now());
      }
      setRefreshFlag((f) => !f);
    } catch (e) {
      console.error('toggleTodayTaskComplete', e);
    }
  };

  // Handler for opening the task modal
  const handleTaskCardPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
  }, []);

  if (authLoading) return null;
  if (!session?.user) return null;

  const goalCap = Math.max(1, dailyFocusGoalMin);
  const focusProgress = Math.min(1, focusTodayMin / goalCap);
  const focusRemain = Math.max(0, dailyFocusGoalMin - focusTodayMin);

  return (
    <View style={{ flex: 1, backgroundColor: shell.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: shell.bg }}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <QuestLogScreenHeader
          title="Dashboard"
          sidebarVisible={sidebarVisible}
          onOpenSidebar={() => setSidebarVisible(true)}
          titleColor={shell.tx}
          right={<ThemeModeToggle />}
        />

        <View style={styles.heroBlock}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.levelBadgeRow}>
              <View style={[styles.levelBadge, { backgroundColor: c.amber }]}>
                <Text style={[styles.levelBadgeText, { color: c.bg }]}>LVL {levelProgress.level}</Text>
              </View>
              {levelProgress.xpSpanThisLevel > 0 && (
                <View style={[styles.xpBarOuter, { backgroundColor: c.amberBg, borderColor: c.amberBorder }]}>
                  <View
                    style={[
                      styles.xpBarInner,
                      {
                        backgroundColor: c.amber,
                        width: `${Math.round((levelProgress.xpIntoLevel / levelProgress.xpSpanThisLevel) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              )}
              <Text style={[styles.xpBarLabel, { color: c.amber }]}>
                {levelProgress.xpIntoLevel}/{levelProgress.xpSpanThisLevel} XP
              </Text>
            </View>
            <Text style={[styles.heroGreeting, { color: shell.tx }]}>
              {getTimeGreeting()}, {displayName}
            </Text>
            <Text style={[styles.heroSub, { color: shell.tx2 }]}>{formatHeaderDate()}</Text>
          </View>
          <View style={[styles.dailyXpPill, { borderColor: c.amberBorder, backgroundColor: c.amberBg }]}>
            <Text style={[styles.dailyXpPillText, { color: c.amber }]}>+{dailyXPBadge} XP today</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <Text style={[styles.statCellValue, { color: c.amber }]}>{totalXP.toLocaleString()}</Text>
            <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Total XP</Text>
          </View>
          <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <Text style={[styles.statCellValue, { color: c.teal }]}>{streak}d</Text>
            <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Streak</Text>
          </View>
          <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <Text style={[styles.statCellValue, { color: c.blue }]}>
              {Math.round(focusStats.total_duration)}m
            </Text>
            <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Focus</Text>
          </View>
          <View style={[styles.statCell, { borderColor: shell.border, backgroundColor: shell.surf }]}>
            <Text style={[styles.statCellValue, { color: c.pink }]}>
              {habitDueStats.dueToday > 0
                ? `${habitDueStats.doneAmongDue}/${habitDueStats.dueToday}`
                : '—'}
            </Text>
            <Text style={[styles.statCellLabel, { color: shell.tx2 }]}>Habits</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionHeading, { color: shell.tx, marginBottom: 0 }]}>Active Quests</Text>
            <Pressable onPress={() => router.push('/(app)/tasks')}>
              <Text style={[styles.sectionSeeAll, { color: c.amber }]}>See all →</Text>
            </Pressable>
          </View>
          {loading ? (
            <Text style={[styles.mutedCenter, { color: shell.tx2 }]}>Loading…</Text>
          ) : activeQuestRows.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: shell.tx2 }]}>
              No active quests yet. Add tasks or folders in the Tasks tab to see them here.
            </Text>
          ) : (
            <View style={styles.questCardList}>
              {activeQuestRows.map((row) => {
                const accentBg =
                  row.accentKey === 'blue' ? c.blueBg
                  : row.accentKey === 'teal' ? c.tealBg
                  : row.accentKey === 'pink' ? c.pinkBg
                  : c.amberBg;
                const accentBorder =
                  row.accentKey === 'blue' ? c.blueBorder
                  : row.accentKey === 'teal' ? c.tealBorder
                  : row.accentKey === 'pink' ? c.pinkBorder
                  : c.amberBorder;
                const deadlineLabel = row.deadline
                  ? (() => {
                      try {
                        const d = parseDate(row.deadline);
                        return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                      } catch { return ''; }
                    })()
                  : '';
                return (
                  <Pressable
                    key={row.id}
                    style={[styles.questCard, { backgroundColor: c.surfaceDeep, borderColor: accentBorder }]}
                    onPress={() => router.push('/(app)/tasks')}
                  >
                    <View style={styles.questCardTop}>
                      <View style={[styles.tierPill, { backgroundColor: accentBg, borderColor: accentBorder }]}>
                        <Text style={[styles.tierPillText, { color: row.color }]}>{row.tier}</Text>
                      </View>
                      <Text numberOfLines={1} style={[styles.questCardTitle, { color: shell.tx }]}>
                        {row.title}
                      </Text>
                    </View>
                    <ProgressBar progress={row.progress / 100} color={row.color} style={styles.questBar} />
                    <View style={styles.questCardMeta}>
                      <Text style={[styles.questCardMetaText, { color: shell.tx2 }]}>
                        {row.completedTasks}/{row.totalTasks} tasks
                      </Text>
                      <View style={styles.questCardMetaRight}>
                        {deadlineLabel ? (
                          <Text style={[styles.questCardMetaText, { color: shell.tx3 }]}>{deadlineLabel}</Text>
                        ) : null}
                        <Text style={[styles.questPct, { color: row.color }]}>{row.progress}%</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
          <Text style={[styles.sectionHeading, { color: shell.tx }]}>Habits</Text>
          {dashboardHabits.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: shell.tx2 }]}>
              Habits that are due today appear here (new habits included). Dots show the last {HABIT_DOT_DAY_COUNT}{' '}
              days.
            </Text>
          ) : (
            <ScrollView
              nestedScrollEnabled
              style={styles.sectionScroll}
              contentContainerStyle={styles.sectionScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {dashboardHabits.map((habit) => (
                <HabitQuestCard
                  key={habit.id}
                  habit={habit}
                  rowsForHabit={habitHistoryFull
                    .filter((r) => r.habit_id === habit.id)
                    .map((r) => ({ date: r.date, value: r.value }))}
                  onLogToday={() => logHabitToday(habit.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
          <Text style={[styles.sectionHeading, { color: shell.tx }]}>Today's Tasks</Text>
          {loading ? (
            <Text style={[styles.mutedCenter, { color: shell.tx2 }]}>Loading…</Text>
          ) : todayTasksList.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: shell.tx2 }]}>
              No tasks due today. Set a deadline for today on a task to see it here.
            </Text>
          ) : (
            <ScrollView
              nestedScrollEnabled
              style={styles.sectionScroll}
              contentContainerStyle={styles.sectionScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {todayTasksList.map((task, i) => {
                const done = task.status === 'completed';
                return (
                  <View
                    key={task.id}
                    style={[styles.todayRow, i > 0 && [styles.todayDivider, { borderTopColor: shell.border }]]}
                  >
                    <Checkbox
                      status={done ? 'checked' : 'unchecked'}
                      onPress={() => toggleTodayTaskComplete(task)}
                      color={c.teal}
                    />
                    <Pressable style={styles.todayTextCol} onPress={() => handleTaskCardPress(task)}>
                      <Text
                        style={[
                          styles.todayTitle,
                          { color: done ? shell.tx2 : shell.tx },
                          done && styles.todayTitleDone,
                        ]}
                      >
                        {task.title}
                      </Text>
                      <Text style={[styles.todayMeta, { color: shell.tx3 }]}>{taskMetaLine(task)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={[styles.sectionCard, { borderColor: shell.border, backgroundColor: shell.surf }]}>
          <View style={styles.focusHeader}>
            <Text style={[styles.sectionHeading, { color: shell.tx, marginBottom: 0 }]}>Focus today</Text>
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
      </ScrollView>

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: c.surfaceElevated }]}
        >
          {selectedTask && (
            <Card style={styles.detailCard}>
              <Card.Title title={selectedTask.title} />
              <Card.Content>
                <Text style={{ marginBottom: 8 }}>{selectedTask.description}</Text>
                <Text>Status: {selectedTask.status}</Text>
                {selectedTask.deadline && (
                  <Text style={{ marginTop: 4 }}>
                    Date:{' '}
                    {(() => {
                      const date = parseDate(selectedTask.deadline);
                      return date.toLocaleDateString();
                    })()}
                  </Text>
                )}
                {selectedTask.activities && selectedTask.activities.length > 0 && (
                  <View style={styles.modalActivitiesContainer}>
                    <Text style={[styles.modalActivitiesTitle, { color: c.tx }]}>Activities:</Text>
                    <View style={styles.modalActivitiesList}>
                      {selectedTask.activities.map((activityKey, idx) => {
                        const activity = ACTIVITY_OPTIONS.find((a) => a.key === activityKey);
                        return activity ? (
                          <View key={idx} style={[styles.modalActivityItem, { backgroundColor: c.surface }]}>
                            <Text style={styles.modalActivityEmoji}>{activity.emoji}</Text>
                            <Text style={[styles.modalActivityLabel, { color: c.parchmentMuted }]}>{activity.label}</Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  </View>
                )}
              </Card.Content>
              <Card.Actions>
                <Button
                  mode="contained"
                  onPress={() => handleTaskStatus(selectedTask, 'completed')}
                  buttonColor={c.teal}
                  textColor={c.onAccent}
                  style={{ marginRight: 8 }}
                >
                  Completed
                </Button>
                <Button
                  mode="contained"
                  onPress={() => handleTaskStatus(selectedTask, 'failed')}
                  buttonColor="#cf6679"
                  textColor={c.onAccent}
                >
                  Failed
                </Button>
                <Button onPress={() => setShowModal(false)}>Close</Button>
              </Card.Actions>
            </Card>
          )}
        </Modal>
      </Portal>

      {xpFlash && (
        <XpFlash
          key={xpFlash.key}
          amount={xpFlash.amount}
          onDone={() => setXpFlash(null)}
        />
      )}
      {levelUpKey && (
        <ConfettiCannon
          key={levelUpKey}
          count={120}
          origin={{ x: 200, y: 0 }}
          fadeOut
          autoStart
          onAnimationEnd={() => setLevelUpKey(null)}
        />
      )}
      <BottomNavBar />
      {/* AI Oracle FAB — docs/design.md ✦ */}
      
      <FAB
        icon="star-four-points"
        style={[styles.chatFab, { backgroundColor: c.amber }]}
        onPress={() => router.push('/(app)/chat')}
        color={c.onAccent}
        accessibilityLabel="Open AI Oracle"
      />
      {/*<OfflineIndicator /> */}
      
      {/* Dashboard Sidebar */}
      <Sidebar 
        isVisible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  levelBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontFamily: FONT_SERIF,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  xpBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  xpBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  xpBarLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 11,
    fontWeight: '600',
  },
  heroGreeting: {
    fontFamily: FONT_SERIF,
    fontSize: 22,
    fontWeight: '600',
  },
  heroSub: {
    fontSize: 14,
    marginTop: 2,
    fontFamily: FONT_SERIF,
  },
  dailyXpPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  dailyXpPillText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
  },
  statGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
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
    marginHorizontal: 16,
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
  sectionScroll: {
    maxHeight: SECTION_SCROLL_MAX_HEIGHT,
  },
  sectionScrollContent: {
    paddingBottom: 8,
  },
  mutedCenter: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FONT_SERIF,
    paddingVertical: 8,
  },
  questRow: {
    marginBottom: 14,
  },
  questTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questTitle: {
    flex: 1,
    fontFamily: FONT_SERIF,
    fontSize: 15,
  },
  questRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
  },
  questPct: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
    minWidth: 36,
    textAlign: 'right',
  },
  questBar: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSeeAll: {
    fontSize: 13,
    fontFamily: FONT_SERIF,
    fontWeight: '600',
  },
  questCardList: {
    gap: 10,
  },
  questCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  questCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  questCardTitle: {
    flex: 1,
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '600',
  },
  questCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  questCardMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  questCardMetaText: {
    fontSize: 12,
    fontFamily: FONT_SERIF,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  todayDivider: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  todayTextCol: {
    flex: 1,
    marginLeft: 4,
    paddingVertical: 2,
  },
  todayTitle: {
    fontSize: 15,
    fontFamily: FONT_SERIF,
  },
  todayTitleDone: {
    textDecorationLine: 'line-through',
  },
  todayMeta: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT_SERIF,
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
  modalContainer: {
    margin: 20,
    borderRadius: 16,
    padding: 0,
  },
  detailCard: {
    borderRadius: 16,
  },
  modalActivitiesContainer: {
    marginTop: 12,
  },
  modalActivitiesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalActivitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalActivityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalActivityEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  modalActivityLabel: {
    fontSize: 12,
  },
  chatFab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 80,
    zIndex: 200,
    elevation: 6,
  },
}); 