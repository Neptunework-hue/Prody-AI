import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, FAB, Portal, Dialog, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task, TaskStatus, TaskCreate, TaskPriority } from '../../types/task';
import TaskList from '../../components/tasks/TaskList';
import TaskForm from '../../components/tasks/TaskForm';
import SubtaskForm from '../../components/tasks/SubtaskForm';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import OfflineIndicator from '../../components/OfflineIndicator';
import { LT } from '../../constants/lifeTrackerDesign';
import { addXP } from '../../utils/xpSystem';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

function CompletionBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.min(1, done / total);
  return (
    <View style={{ marginTop: 20, marginHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: LT.parchmentFaint }}>Daily completion</Text>
        <Text style={{ fontSize: 10, color: LT.teal }}>{done}/{total}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 99, backgroundColor: LT.outlineFaint, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: LT.teal, borderRadius: 99 }} />
      </View>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [selectedParentTaskId, setSelectedParentTaskId] = useState<string | null>(null);

  const loadTasks = async () => {
    if (!user) return;
    try {
      const all = await offlineTaskService.getTasks(user.id);
      setTasks(all.filter(t => t.status !== 'completed' && t.status !== 'failed'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadTasks(); }, [user]);
  useFocusEffect(React.useCallback(() => { loadTasks(); }, [user]));
  useEffect(() => { if (params.refresh) loadTasks(); }, [params.refresh]);

  const onRefresh = () => { setRefreshing(true); loadTasks(); };

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (!user || !taskData.title) return;
    try {
      const newTask: TaskCreate = {
        title: taskData.title.trim(),
        description: taskData.description?.trim() || undefined,
        priority: taskData.priority as TaskPriority,
        deadline: taskData.deadline,
        startTime: taskData.startTime,
        endTime: taskData.endTime,
        activities: taskData.activities?.length > 0 ? taskData.activities : undefined,
      };
      await offlineTaskService.createTask(newTask, user.id);
      setShowAddDialog(false);
      loadTasks();
    } catch { }
  };

  const handleEditTask = async (taskData: Partial<Task>) => {
    if (!editingTask) return;
    try {
      await offlineTaskService.updateTask(editingTask.id, { ...editingTask, ...taskData, status: 'pending' as TaskStatus });
      setEditingTask(null);
      loadTasks();
    } catch { }
  };

  const handleDeleteTask = async (taskId: string) => {
    try { await offlineTaskService.deleteTask(taskId); loadTasks(); } catch { }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await offlineTaskService.updateTaskStatus(taskId, status);
      if (status === 'completed') {
        // Award XP for completing a task: base 10 XP, or scale by priority if available
        const task = tasks.find(t => t.id === taskId);
        const xp = task ? Math.max(10, (task.priority ?? 1) * 5 + 5) : 10;
        await addXP(xp);
      }
      loadTasks();
    } catch { }
  };

  const handleAddSubtask = (parentTaskId: string) => {
    setSelectedParentTaskId(parentTaskId);
    setShowSubtaskDialog(true);
  };

  const handleSubtaskSubmit = async (subtaskData: TaskCreate & { parent_task_id: string }) => {
    if (!user) return;
    try {
      await offlineTaskService.createTask({ ...subtaskData }, user.id);
      setShowSubtaskDialog(false);
      setSelectedParentTaskId(null);
      loadTasks();
    } catch { }
  };

  const handleGenerateAISubtasks = async (parentTaskId: string) => {
    if (!user) return;
    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;
    router.push({
      pathname: '/(app)/chat',
      params: { aiSubtaskRequest: `Create subtasks for "${parentTask.title}"`, parentTaskId },
    });
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const rootTasks = tasks.filter(t => !t.parent_task_id);

  return (
    <View style={{ flex: 1, backgroundColor: LT.bg }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerEyebrow}>{todayLabel()}</Text>
          <Text style={styles.headerTitle}>Daily</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={{ color: LT.parchmentFaint, fontSize: 18 }}>↻</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.headerSub}>Expand steps. Completing all steps earns XP.</Text>

      {/* ── TASK LIST ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LT.amber} />}
      >
        {loading ? (
          <Text style={styles.stateText}>Loading quests...</Text>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 36 }}>⚔️</Text>
            <Text style={styles.stateText}>No tasks yet.</Text>
            <Text style={styles.stateSub}>Tap + to add your first quest.</Text>
          </View>
        ) : (
          <TaskList
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            onDelete={handleDeleteTask}
            onAddSubtask={handleAddSubtask}
            onGenerateAISubtasks={handleGenerateAISubtasks}
            onDeleteSubtask={handleDeleteTask}
          />
        )}

        <CompletionBar done={completedCount} total={rootTasks.length} />
      </ScrollView>

      {/* ── ADD TASK FAB ──────────────────────────────────────────────────── */}
      <FAB
        icon="plus"
        style={styles.fab}
        color={LT.bg}
        onPress={() => setShowAddDialog(true)}
      />

      {/* ── DIALOGS ───────────────────────────────────────────────────────── */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>New Quest</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
              <TaskForm onSubmit={handleAddTask} onCancel={() => setShowAddDialog(false)} />
            </ScrollView>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={!!editingTask} onDismiss={() => setEditingTask(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Edit Quest</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
              <TaskForm task={editingTask || undefined} onSubmit={handleEditTask} onCancel={() => setEditingTask(null)} />
            </ScrollView>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={showSubtaskDialog} onDismiss={() => setShowSubtaskDialog(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add Step</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
              <SubtaskForm
                parentTaskId={selectedParentTaskId || ''}
                onSubmit={handleSubtaskSubmit}
                onCancel={() => setShowSubtaskDialog(false)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>
      </Portal>

      <BottomNavBar />
      <OfflineIndicator />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: LT.surfaceDeep,
  },
  headerEyebrow: {
    fontSize: 10,
    color: LT.parchmentFaint,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: LT.parchment,
  },
  refreshBtn: {
    paddingTop: 12,
    paddingLeft: 12,
  },
  headerSub: {
    fontSize: 10,
    color: LT.parchmentFaint,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  stateText: {
    color: LT.parchmentFaint,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  stateSub: {
    color: LT.parchmentFaint,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
    backgroundColor: LT.amber,
    zIndex: 200,
    elevation: 6,
  },
  dialog: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
  },
  dialogTitle: {
    color: LT.parchment,
    fontSize: 16,
    fontWeight: '700',
  },
});
