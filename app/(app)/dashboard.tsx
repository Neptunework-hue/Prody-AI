import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated as RNAnimated,
} from 'react-native';
import { Text, Portal, Modal, Button, FAB } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import TaskCardWithSubtasks from '../../components/tasks/TaskCardWithSubtasks';
import { focusService } from '../../services/supabase/focus';
import OfflineIndicator from '../../components/OfflineIndicator';
import Sidebar from '../../components/Sidebar';
import UserAvatar from '../../components/UserAvatar';
import HamburgerMenu from '../../components/HamburgerMenu';
import { LT } from '../../constants/lifeTrackerDesign';
import { loadXPState, getLevelInfo, XP_PER_LEVEL, XPState } from '../../utils/xpSystem';
import Svg, { Circle } from 'react-native-svg';

// ─── helpers ────────────────────────────────────────────────────────────────

const getPriorityColor = (priority?: number) => {
  switch (priority) {
    case 1: return '#4CAF50';
    case 2: return '#FFC107';
    case 3: return '#F44336';
    case 4: return '#9C27B0';
    default: return '#E0E0E0';
  }
};

const parseDate = (dateString: string): Date => {
  if (!dateString) throw new Error('empty date');
  if (dateString.includes('T')) return new Date(dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isToday = (dateString: string): boolean => {
  try {
    const d = parseDate(dateString);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch { return false; }
};

// ─── XP progress bar ─────────────────────────────────────────────────────────

function XPBar({ xpInLevel }: { xpInLevel: number }) {
  const pct = Math.min(1, xpInLevel / XP_PER_LEVEL);
  return (
    <View style={{ height: 5, borderRadius: 99, backgroundColor: LT.outlineFaint, overflow: 'hidden', width: '100%' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: LT.amber, borderRadius: 99 }} />
    </View>
  );
}

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { session, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allActiveTasks, setAllActiveTasks] = useState<Task[]>([]);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [selectedTaskToSwap, setSelectedTaskToSwap] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);

  const [focusStats, setFocusStats] = useState({ total_duration: 0 });
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const [xpState, setXPState] = useState<XPState>({ totalXP: 0, dailyXP: 0, lastDate: '', completedProjects: [] });

  // ── auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) router.replace('/(auth)/login');
  }, [authLoading, session?.user, router]);

  // ── load XP ─────────────────────────────────────────────────────────────────
  const refreshXP = useCallback(async () => {
    const s = await loadXPState();
    setXPState(s);
  }, []);

  // ── fetch tasks ─────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allTasks = await offlineTaskService.getTasks(user.id);
      const todaysTasks = allTasks.filter(task => {
        if (task.status === 'completed' || task.status === 'failed') return false;
        if (task.deadline) return isToday(task.deadline);
        return true;
      });
      setTasks(todaysTasks);
      setAllActiveTasks(allTasks.filter(t => t.status !== 'completed' && t.status !== 'failed'));
    } catch {
      setTasks([]);
      setAllActiveTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { if (params.refresh) fetchTasks(); }, [params.refresh]);
  useEffect(() => {
    if (params.reset === 'true') {
      setStreak(0); setCompletedCount(0); setFailedCount(0); setFocusStats({ total_duration: 0 });
      fetchTasks();
      router.setParams({ reset: undefined });
    }
  }, [params.reset]);

  useFocusEffect(useCallback(() => { fetchTasks(); refreshXP(); }, [fetchTasks, refreshXP]));
  useEffect(() => { fetchTasks(); refreshXP(); }, [fetchTasks, refreshFlag]);

  useEffect(() => {
    if (!user) return;
    focusService.getStats(user.id).then(setFocusStats);
  }, [user, refreshFlag]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all = await offlineTaskService.getTasks(user.id);
      let comp = 0, fail = 0;
      for (const t of all) {
        if (t.status === 'completed') comp++;
        else if (t.status === 'failed') fail++;
      }
      setCompletedCount(comp); setFailedCount(fail);
      setStreak(Math.max(0, comp - fail));
    })();
  }, [user, refreshFlag]);

  const handleDeleteTask = async (taskId: string) => {
    try { await offlineTaskService.deleteTask(taskId); setRefreshFlag(f => !f); } catch {}
  };
  const handleDeleteSubtask = async (subtaskId: string) => {
    try { await offlineTaskService.deleteTask(subtaskId); setRefreshFlag(f => !f); } catch {}
  };
  const handleTaskStatus = async (task: Task, status: 'completed' | 'failed') => {
    try {
      await offlineTaskService.updateTaskStatus(task.id, status);
      setShowModal(false); setSelectedTask(null); setRefreshFlag(f => !f);
    } catch {}
  };
  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks(prev => {
      const n = new Set(prev);
      n.has(taskId) ? n.delete(taskId) : n.add(taskId);
      return n;
    });
  };
  const handleTaskCardPress = useCallback((task: Task) => { setSelectedTask(task); setShowModal(true); }, []);

  if (authLoading || !session?.user) return null;

  const sortedTasks = allActiveTasks.slice().sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const ia = taskOrder.indexOf(a.id), ib = taskOrder.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return 0;
  });

  const { level, xpInLevel } = getLevelInfo(xpState.totalXP);
  const doneTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = sortedTasks.length;
  const trophyCount = xpState.completedProjects?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: LT.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); refreshXP(); }} />}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <HamburgerMenu onPress={() => setSidebarVisible(true)} isOpen={sidebarVisible} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.headerEyebrow}>Life HQ</Text>
                <Text style={styles.headerTitle}>Quest Log</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>LVL {level}</Text>
              </View>
              <Text style={styles.xpTotal}>{xpState.totalXP} XP</Text>
              <UserAvatar size={40} showBorder borderColor={LT.amber} />
            </View>
          </View>

          {/* XP progress bar */}
          <View style={{ marginTop: 10 }}>
            <View style={styles.xpBarRow}>
              <Text style={styles.xpBarLabel}>Level progress</Text>
              <Text style={styles.xpBarValue}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
            </View>
            <XPBar xpInLevel={xpInLevel} />
          </View>

          {/* 4 stat cards */}
          <View style={styles.statsRow}>
            <StatCard value={xpState.dailyXP} label="today XP" color={LT.amber} />
            <StatCard value={`${doneTasks}/${totalTasks}`} label="tasks" color={LT.teal} />
            <StatCard
              value={`${Math.floor(focusStats.total_duration / 60)}h`}
              label="focus"
              color={LT.blue}
            />
            <StatCard value={trophyCount} label="trophies" color={LT.pink} />
          </View>
        </View>

        {/* ── STREAK BANNER ───────────────────────────────────────────────── */}
        {streak >= 3 && (
          <View style={[styles.streakBanner, { borderColor: LT.amber + '55' }]}>
            <Text style={{ fontSize: 18 }}>🔥</Text>
            <Text style={styles.streakText}>{streak}-task streak</Text>
          </View>
        )}
        {failedCount > 0 && streak === 0 && (
          <View style={[styles.streakBanner, { borderColor: '#cf667955' }]}>
            <Text style={{ fontSize: 18 }}>💔</Text>
            <Text style={[styles.streakText, { color: '#cf6679' }]}>Streak broken — {failedCount} failed</Text>
          </View>
        )}

        {/* ── TODAY'S QUESTS ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALL ACTIVE QUESTS</Text>
          <Text style={styles.sectionSub}>{totalTasks} quest{totalTasks !== 1 ? 's' : ''} · tap to view or complete</Text>

          {loading ? (
            <Text style={styles.emptyText}>Loading quests...</Text>
          ) : sortedTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32 }}>⚔️</Text>
              <Text style={styles.emptyText}>No active quests.</Text>
              <Text style={styles.emptySub}>Head to Daily to create your first task.</Text>
            </View>
          ) : (
            sortedTasks.map((task) => {
              if (task.parent_task_id) return null;
              const isSelected = selectedTaskToSwap === sortedTasks.indexOf(task);
              return (
                <TouchableOpacity
                  key={task.id}
                  activeOpacity={0.85}
                  onLongPress={() => setSelectedTaskToSwap(sortedTasks.indexOf(task))}
                  onPress={() => {
                    const idx = sortedTasks.indexOf(task);
                    if (selectedTaskToSwap !== null && selectedTaskToSwap !== idx) {
                      const newTasks = [...sortedTasks];
                      const tmp = newTasks[selectedTaskToSwap];
                      newTasks[selectedTaskToSwap] = newTasks[idx];
                      newTasks[idx] = tmp;
                      setAllActiveTasks(newTasks);
                      setTaskOrder(newTasks.map(t => t.id));
                      setSelectedTaskToSwap(null);
                    } else if (selectedTaskToSwap === null) {
                      handleTaskCardPress(task);
                    } else {
                      setSelectedTaskToSwap(null);
                    }
                  }}
                  style={{ width: '100%', marginBottom: 10 }}
                >
                  <TaskCardWithSubtasks
                    task={task}
                    allTasks={sortedTasks}
                    variant="dashboard"
                    onStatusChange={(taskId, status) => {
                      const t = sortedTasks.find(x => x.id === taskId);
                      if (t) handleTaskStatus(t, status as 'completed' | 'failed');
                    }}
                    onPress={handleTaskCardPress}
                    expanded={expandedTasks.has(task.id)}
                    onToggleExpand={toggleSubtasks}
                    onDelete={handleDeleteTask}
                    onDeleteSubtask={handleDeleteSubtask}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── TASK MODAL ──────────────────────────────────────────────────── */}
        <Portal>
          <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
            {selectedTask && (
              <View>
                <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                {selectedTask.description ? (
                  <Text style={styles.modalDesc}>{selectedTask.description}</Text>
                ) : null}
                <View style={[styles.priorityPill, { backgroundColor: getPriorityColor(selectedTask.priority) + '22' }]}>
                  <Text style={[styles.priorityPillText, { color: getPriorityColor(selectedTask.priority) }]}>
                    Priority {selectedTask.priority ?? '—'}
                  </Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: LT.teal }]}
                    onPress={() => handleTaskStatus(selectedTask, 'completed')}
                  >
                    <Text style={styles.modalBtnText}>Complete ✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#cf6679' }]}
                    onPress={() => handleTaskStatus(selectedTask, 'failed')}
                  >
                    <Text style={styles.modalBtnText}>Failed ✗</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: LT.surfaceDeep }]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={[styles.modalBtnText, { color: LT.parchmentMuted }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Modal>
        </Portal>
      </ScrollView>

      <BottomNavBar />
      <FAB
        icon="chat"
        style={styles.chatFab}
        onPress={() => router.push('/(app)/chat')}
        color={LT.bg}
      />
      <OfflineIndicator />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: LT.surfaceDeep,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 10,
    color: LT.parchmentFaint,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: LT.parchment,
  },
  levelBadge: {
    backgroundColor: LT.amber + '22',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.amber,
  },
  xpTotal: {
    fontSize: 10,
    color: LT.parchmentFaint,
    marginTop: 2,
  },
  xpBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpBarLabel: { fontSize: 10, color: LT.parchmentFaint },
  xpBarValue: { fontSize: 10, color: LT.amber },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: LT.surfaceDeep,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 8,
    color: LT.parchmentFaint,
    marginTop: 1,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: LT.surfaceDeep,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  streakText: {
    fontSize: 12,
    color: LT.amber,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 10,
    color: LT.parchmentFaint,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 10,
    color: LT.parchmentFaint,
    marginBottom: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: LT.parchmentFaint,
    fontSize: 14,
    textAlign: 'center',
  },
  emptySub: {
    color: LT.parchmentFaint,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
  },
  modal: {
    backgroundColor: LT.surfaceDeep,
    margin: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LT.parchment,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: LT.parchmentMuted,
    marginBottom: 10,
  },
  priorityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 16,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.bg,
  },
  chatFab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
    backgroundColor: LT.amber,
    zIndex: 200,
    elevation: 6,
  },
});
