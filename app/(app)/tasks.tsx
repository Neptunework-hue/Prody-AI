import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, FAB, Portal, Dialog, useTheme, Button, TextInput, IconButton } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task, TaskStatus, TaskCreate, TaskPriority } from '../../types/task';
import TaskList from '../../components/tasks/TaskList';
import TaskForm from '../../components/tasks/TaskForm';
import SubtaskForm from '../../components/tasks/SubtaskForm';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import DateTimePicker from '@react-native-community/datetimepicker';
import OfflineIndicator from '../../components/OfflineIndicator';

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
      console.log('TasksScreen: Loading tasks for user:', user.id);
      const tasksData = await offlineTaskService.getTasks(user.id);
      console.log('TasksScreen: Tasks loaded:', tasksData);
      // Only show active tasks (hide completed and failed)
      const activeTasks = tasksData.filter(
        (t) => t.status !== 'completed' && t.status !== 'failed'
      );
      console.log('TasksScreen: Active tasks after filter:', activeTasks);
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
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadTasks();
    }, [user])
  );

  // Listen for refresh parameter changes from chat
  useEffect(() => {
    if (params.refresh) {
      console.log('TasksScreen: Refresh parameter detected:', params.refresh);
      loadTasks();
    }
  }, [params.refresh]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

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
      };
      console.log('Updating task with:', updatePayload);
      await offlineTaskService.updateTask(editingTask.id, updatePayload);
      setEditingTask(null);
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // The offlineTaskService.deleteTask now handles subtask deletion automatically
      await offlineTaskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await offlineTaskService.updateTaskStatus(taskId, status);
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
      await offlineTaskService.createTask({
        ...subtaskData,
      }, user.id);
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
      const parentTask = tasks.find(t => t.id === parentTaskId);
      if (!parentTask) return;

      // Navigate to chat with AI subtask generation request
      router.push({
        pathname: '/(app)/chat',
        params: { 
          aiSubtaskRequest: `Create subtasks for "${parentTask.title}"`,
          parentTaskId: parentTaskId
        }
      });
    } catch (error) {
      console.error('Error generating AI subtasks:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Daily</Text>
        <IconButton icon="refresh" onPress={onRefresh} iconColor={theme.colors.onSurface} />
      </View>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading tasks...</Text>
        ) : tasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No tasks yet. Add one to get started!</Text>
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
      </ScrollView>
      <FAB
        icon="plus"
        style={[fabAboveNavBarStyle, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setShowAddDialog(true)}
      />
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => setShowAddDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Add New Task</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScrollView} showsVerticalScrollIndicator={false}>
              <TaskForm
                onSubmit={handleAddTask}
                onCancel={() => setShowAddDialog(false)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>
        <Dialog
          visible={!!editingTask}
          onDismiss={() => setEditingTask(null)}
          style={styles.dialog}
        >
          <Dialog.Title>Edit Task</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScrollView} showsVerticalScrollIndicator={false}>
              <TaskForm
                task={editingTask || undefined}
                onSubmit={handleEditTask}
                onCancel={() => setEditingTask(null)}
              />
            </ScrollView>
          </Dialog.Content>
        </Dialog>
        <Dialog
          visible={showSubtaskDialog}
          onDismiss={() => setShowSubtaskDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Add Subtask</Dialog.Title>
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
      <BottomNavBar />
      <OfflineIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    margin: 16,
    marginBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  dialog: {
    maxWidth: '100%',
  },
  dialogScrollView: {
    maxHeight: 600,
  },
  form: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
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

const fabAboveNavBarStyle = {
  position: 'absolute' as const,
  right: 24,
  bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
  zIndex: 200,
}; 