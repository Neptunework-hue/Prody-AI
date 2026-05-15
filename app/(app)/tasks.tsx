import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { feedbackSuccess, feedbackWarning } from '../../utils/feedback';
import { Text, FAB, Portal, Dialog, Button, TextInput, IconButton, Chip } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task, TaskStatus, TaskCreate, TaskPriority } from '../../types/task';
import TaskList, { TaskFolderFilter } from '../../components/tasks/TaskList';
import TaskForm from '../../components/tasks/TaskForm';
import SubtaskForm from '../../components/tasks/SubtaskForm';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import OfflineIndicator from '../../components/OfflineIndicator';
import Sidebar from '../../components/Sidebar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { ItemFolder } from '../../types/folder';
import * as foldersStorage from '../../services/foldersStorage';
import { addXP } from '../../utils/xpSystem';
import XpFlash from '../../components/XpFlash';
import ConfettiCannon from 'react-native-confetti-cannon';

function normalizeTasks(raw: Task[]): Task[] {
  return raw.map((t) => ({
    ...t,
    xp_reward: t.xp_reward ?? 15 + (t.priority ?? 0) * 5,
  }));
}

function createTaskStyles(c: ThemeColors) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    loadingText: {
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
      color: c.tx2,
      fontFamily: FONT_SERIF,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
      color: c.tx2,
      fontFamily: FONT_SERIF,
    },
    dialog: {
      maxWidth: '100%',
      backgroundColor: c.surfaceElevated,
    },
    dialogScrollView: {
      maxHeight: 560,
    },
    folderBar: {
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    folderChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      marginRight: 4,
    },
    folderChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 4,
    },
    folderDeleteBtn: {
      margin: 0,
      marginLeft: -4,
    },
  });
}

export default function TasksScreen() {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createTaskStyles(c), [c]);
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFolders, setTaskFolders] = useState<ItemFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<TaskFolderFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [selectedParentTaskId, setSelectedParentTaskId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [xpFlash, setXpFlash] = useState<{ amount: number; key: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState<number | null>(null);

  const loadFolders = useCallback(async () => {
    if (!user) return;
    const list = await foldersStorage.getTaskFolders(user.id);
    setTaskFolders(list);
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    try {
      const tasksData = await offlineTaskService.getTasks(user.id);
      const activeTasks = normalizeTasks(tasksData).filter(
        (t) => t.status !== 'completed' && t.status !== 'failed',
      );
      setTasks(activeTasks);
    } catch (error) {
      console.error('TasksScreen: Error loading tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
    loadFolders();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadTasks();
      loadFolders();
    }, [user]),
  );

  useEffect(() => {
    if (params.refresh) {
      loadTasks();
    }
  }, [params.refresh]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
    loadFolders();
  };

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (!user || !taskData.title) return;
    try {
      const newTask: TaskCreate = {
        title: taskData.title.trim(),
        description: taskData.description?.trim() || undefined,
        priority: (taskData.priority as TaskPriority) ?? 0,
        xp_reward: taskData.xp_reward ?? 25,
        folder_id: taskData.folder_id ?? null,
        deadline: taskData.deadline,
        startTime: taskData.startTime,
        endTime: taskData.endTime,
        activities: [],
      };
      await offlineTaskService.createTask(newTask, user.id);
      setShowAddDialog(false);
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleEditTask = async (taskData: Partial<Task>) => {
    if (!editingTask) return;
    try {
      const updatePayload = {
        ...editingTask,
        ...taskData,
        status: 'pending' as TaskStatus,
        activities: [],
      };
      await offlineTaskService.updateTask(editingTask.id, updatePayload);
      setEditingTask(null);
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await offlineTaskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await offlineTaskService.updateTaskStatus(taskId, status);
      if (status === 'completed') {
        feedbackSuccess();
        const task = tasks.find((t) => t.id === taskId);
        const xp = task ? (task.xp_reward ?? 15 + (task.priority ?? 0) * 5) : 15;
        const { leveledUp } = await addXP(xp);
        setXpFlash({ amount: xp, key: Date.now() });
        if (leveledUp) setLevelUpKey(Date.now());
      } else if (status === 'failed') {
        feedbackWarning();
      }
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleAddSubtask = (parentTaskId: string) => {
    setSelectedParentTaskId(parentTaskId);
    setShowSubtaskDialog(true);
  };

  const handleSubtaskSubmit = async (subtaskData: TaskCreate & { parent_task_id: string }) => {
    if (!user) return;
    try {
      await offlineTaskService.createTask(
        {
          ...subtaskData,
          activities: [],
        },
        user.id,
      );
      setShowSubtaskDialog(false);
      setSelectedParentTaskId(null);
      loadTasks();
    } catch (error) {
      console.error('Error creating subtask:', error);
    }
  };

  const handleGenerateAISubtasks = async (parentTaskId: string) => {
    if (!user) return;
    try {
      const parentTask = tasks.find((t) => t.id === parentTaskId);
      if (!parentTask) return;
      router.push({
        pathname: '/(app)/chat',
        params: {
          aiSubtaskRequest: `Create subtasks for "${parentTask.title}"`,
          parentTaskId,
        },
      });
    } catch (error) {
      console.error('Error generating AI subtasks:', error);
    }
  };

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    await foldersStorage.addTaskFolder(user.id, newFolderName.trim());
    setNewFolderName('');
    setNewFolderOpen(false);
    loadFolders();
  };

  const confirmDeleteTaskFolder = (folder: ItemFolder) => {
    Alert.alert(
      'Remove folder',
      `Delete “${folder.name}”? Tasks in this folder will be moved to Ungrouped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await offlineTaskService.clearFolderFromTasks(user.id, folder.id);
              await foldersStorage.removeTaskFolder(user.id, folder.id);
              if (folderFilter === folder.id) setFolderFilter('all');
              await loadFolders();
              await loadTasks();
            } catch (e) {
              console.error(e);
            }
          },
        },
      ],
    );
  };

  const folderChipSurface = (selected: boolean) =>
    selected
      ? { backgroundColor: c.amber, borderWidth: 0 as const }
      : { backgroundColor: c.surf, borderWidth: 1, borderColor: c.amberBorder };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <QuestLogScreenHeader
        title="Tasks"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        right={<IconButton icon="refresh" onPress={onRefresh} iconColor={c.amber} />}
      />

      <View style={styles.folderBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
          <Chip
            mode="flat"
            onPress={() => setFolderFilter('all')}
            style={[styles.chip, folderChipSurface(folderFilter === 'all')]}
            textStyle={{ color: folderFilter === 'all' ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
          >
            All
          </Chip>
          <Chip
            mode="flat"
            onPress={() => setFolderFilter('ungrouped')}
            style={[styles.chip, folderChipSurface(folderFilter === 'ungrouped')]}
            textStyle={{ color: folderFilter === 'ungrouped' ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
          >
            Ungrouped
          </Chip>
          {taskFolders.map((f) => {
            const sel = folderFilter === f.id;
            return (
              <View key={f.id} style={styles.folderChipRow}>
                <Chip
                  mode="flat"
                  onPress={() => setFolderFilter(f.id)}
                  onLongPress={() => confirmDeleteTaskFolder(f)}
                  delayLongPress={450}
                  style={[styles.chip, folderChipSurface(sel)]}
                  textStyle={{ color: sel ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
                >
                  {f.name}
                </Chip>
                <IconButton
                  icon="trash-can-outline"
                  size={18}
                  accessibilityLabel={`Delete folder ${f.name}`}
                  onPress={() => confirmDeleteTaskFolder(f)}
                  iconColor={c.tx2}
                  style={styles.folderDeleteBtn}
                />
              </View>
            );
          })}
          <Chip
            mode="outlined"
            icon="folder-plus"
            onPress={() => setNewFolderOpen(true)}
            style={[styles.chip, { borderColor: c.amber }]}
            textStyle={{ color: c.amber, fontFamily: FONT_SERIF }}
          >
            Folder
          </Chip>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 60, paddingHorizontal: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} colors={[c.amber]} />
        }
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading tasks...</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks yet. Add one to get started!</Text>
        ) : (
          <TaskList
            tasks={tasks}
            folderFilter={folderFilter}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            onDelete={handleDeleteTask}
            onAddSubtask={handleAddSubtask}
            onGenerateAISubtasks={handleGenerateAISubtasks}
            onDeleteSubtask={handleDeleteTask}
          />
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[fabAboveNavBarStyle, { backgroundColor: c.amber }]}
        color={c.onAccent}
        onPress={() => setShowAddDialog(true)}
      />

      <Portal>
        <Dialog visible={newFolderOpen} onDismiss={() => setNewFolderOpen(false)} style={styles.dialog}>
          <Dialog.Title style={{ fontFamily: FONT_SERIF, color: c.tx }}>New task folder</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Folder name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              mode="outlined"
              style={{ backgroundColor: c.surf }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button textColor={c.tx2} onPress={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button buttonColor={c.amber} textColor={c.onAccent} onPress={createFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)} style={styles.dialog}>
          <Dialog.Title style={{ fontFamily: FONT_SERIF, color: c.tx }}>Add task</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScrollView} showsVerticalScrollIndicator={false}>
              <TaskForm
                folders={taskFolders}
                onRemoveFolder={confirmDeleteTaskFolder}
                onSubmit={handleAddTask}
                onCancel={() => setShowAddDialog(false)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={!!editingTask} onDismiss={() => setEditingTask(null)} style={styles.dialog}>
          <Dialog.Title style={{ fontFamily: FONT_SERIF, color: c.tx }}>Edit task</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScrollView} showsVerticalScrollIndicator={false}>
              <TaskForm
                task={editingTask || undefined}
                folders={taskFolders}
                onRemoveFolder={confirmDeleteTaskFolder}
                onSubmit={handleEditTask}
                onCancel={() => setEditingTask(null)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={showSubtaskDialog} onDismiss={() => setShowSubtaskDialog(false)} style={styles.dialog}>
          <Dialog.Title style={{ fontFamily: FONT_SERIF, color: c.tx }}>Add subtask</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScrollView} showsVerticalScrollIndicator={false}>
              <SubtaskForm
                parentTaskId={selectedParentTaskId || ''}
                onSubmit={handleSubtaskSubmit}
                onCancel={() => setShowSubtaskDialog(false)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>
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
      <OfflineIndicator />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}

const fabAboveNavBarStyle = {
  position: 'absolute' as const,
  right: 24,
  bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
  zIndex: 200,
  elevation: 6,
};
