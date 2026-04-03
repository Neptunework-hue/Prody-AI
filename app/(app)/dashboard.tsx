import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, Avatar, Modal, Portal, FAB } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import TaskCardWithSubtasks from '../../components/tasks/TaskCardWithSubtasks';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { focusService } from '../../services/supabase/focus';
import { Animated as RNAnimated } from 'react-native';
import { StyleSheet as RNStyleSheet } from 'react-native';
import OfflineIndicator from '../../components/OfflineIndicator';
import HamburgerMenu from '../../components/HamburgerMenu';
import Sidebar from '../../components/Sidebar';
import UserAvatar from '../../components/UserAvatar';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import { LT } from '../../constants/lifeTrackerDesign';

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

const getPriorityColor = (priority?: number) => {
  switch (priority) {
    case 1:
      return '#4CAF50'; // Low - green
    case 2:
      return '#FFC107'; // Medium - orange
    case 3:
      return '#F44336'; // High - red
    case 4:
      return '#9C27B0'; // Urgent - purple
    default:
      return '#E0E0E0'; // Default/unspecified - grey
  }
};

const formatTime = (iso: string | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

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

// Helper function to check if a date is today
const isToday = (dateString: string): boolean => {
  try {
    const taskDate = parseDate(dateString);
    const today = new Date();
    
    // Reset both dates to start of day for comparison
    const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const result = taskDateOnly.getTime() === todayOnly.getTime();
    
    // Debug logging
    console.log(`isToday debug:`, {
      originalDate: dateString,
      parsedTaskDate: taskDate,
      taskDateOnly: taskDateOnly,
      today: today,
      todayOnly: todayOnly,
      result: result
    });
    
    return result;
  } catch (error) {
    console.error('Error parsing date for isToday check:', error);
    return false;
  }
};

export default function DashboardScreen() {
  const { session, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [allActiveTasks, setAllActiveTasks] = useState<Task[]>([]);
  const [taskOrder, setTaskOrder] = useState<string[]>([]); // store task IDs for custom order
  const [selectedTaskToSwap, setSelectedTaskToSwap] = useState<number | null>(null); // index of first selected task
  const [focusStats, setFocusStats] = useState({ total_duration: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  // Habits temporarily disabled
  // const [habits, setHabits] = useState<Habit[]>([]);

  // Listen for refresh parameter changes from chat
  useEffect(() => {
    if (params.refresh) {
      console.log('Dashboard: Refresh parameter detected:', params.refresh);
      fetchTasks();
    }
  }, [params.refresh]);

  // Listen for reset parameter changes from profile
  useEffect(() => {
    if (params.reset === 'true') {
      console.log('Dashboard: Reset parameter detected, refreshing all data');
      setStreak(0);
      setCompletedCount(0);
      setFailedCount(0);
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
    console.log('Dashboard: fetchTasks called');
    setLoading(true);
    try {
      const allTasks = await offlineTaskService.getTasks(user.id);
      console.log('Dashboard: All tasks fetched:', allTasks.length, 'tasks');
      console.log('Dashboard: User ID:', user.id);
      
      // Filter for today's tasks that are not completed or failed (for events section)
      // A task is considered "today's event" if it has a deadline for today OR if it's marked for today
      const todaysTasks = allTasks.filter(task => {
        if (task.status === 'completed' || task.status === 'failed') return false;
        
        // If task has a deadline, check if it's today
        if (task.deadline) {
          const isTodayTask = isToday(task.deadline);
          console.log(`Dashboard: Task "${task.title}" deadline: ${task.deadline}, isToday: ${isTodayTask}`);
          return isTodayTask;
        }
        
        // If no deadline but task is active, consider it for today's events
        // This allows tasks without specific dates to still show up
        console.log(`Dashboard: Task "${task.title}" has no deadline, including in today's events`);
        return true;
      });
      
      console.log('Dashboard: Today\'s tasks:', todaysTasks.length);
      setTasks(todaysTasks);
      
      // All active tasks (not completed/failed) - this is what should be shown in the main task list
      const activeTasks = allTasks.filter(task => task.status !== 'completed' && task.status !== 'failed');
      console.log('Dashboard: Active tasks:', activeTasks.length);
      console.log('Dashboard: Task statuses:', activeTasks.map(t => ({ title: t.title, status: t.status, deadline: t.deadline })));
      setAllActiveTasks(activeTasks);
    } catch (e) {
      console.error('Dashboard: Error fetching tasks:', e);
      setTasks([]);
      setAllActiveTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Habits temporarily disabled
  // // Fetch habits for the user
  // const fetchHabits = useCallback(async () => {
  //   if (!user) return;
  //   const userHabits = await habitService.getHabits(user.id);
  //   setHabits(userHabits);
  // }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
      // fetchHabits(); // Habits temporarily disabled
    }, [fetchTasks])
  );

  // useEffect(() => {
  //   fetchHabits();
  // }, [fetchHabits]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    console.log('Dashboard: useEffect triggered with refreshFlag:', refreshFlag);
    fetchTasks();
  }, [fetchTasks, refreshFlag]);

  useEffect(() => {
    if (!user) return;
    console.log('Dashboard: Fetching focus stats for user:', user.id);
    focusService.getStats(user.id).then(stats => {
      console.log('Dashboard: Focus stats received:', stats);
      setFocusStats(stats);
    });
  }, [user, refreshFlag]);

  // Calculate streak: completed tasks minus failed tasks, minimum 0
  useEffect(() => {
    if (!user) return;
    console.log('Dashboard: Calculating streak for user:', user.id);
    (async () => {
      const allTasks = await offlineTaskService.getTasks(user.id);
      let completed = 0;
      let failed = 0;
      
      // Count completed and failed tasks (ignore pending tasks)
      for (let i = 0; i < allTasks.length; i++) {
        const task = allTasks[i];
        if (task.status === 'completed') {
          completed++;
        } else if (task.status === 'failed') {
          failed++;
        }
        // Skip pending tasks as they don't affect the streak
      }
      
      // Calculate streak: completed - failed, minimum 0
      const currentStreak = Math.max(0, completed - failed);
      
      setCompletedCount(completed);
      setFailedCount(failed);
      setStreak(currentStreak);
      
      console.log('Dashboard: Streak calculation:', {
        completed,
        failed,
        streak: currentStreak,
        rawCalculation: completed - failed,
        totalTasks: allTasks.length
      });
    })();
  }, [user, refreshFlag]);

  // Add delete task handler
  const handleDeleteTask = async (taskId: string) => {
    console.log('Dashboard: handleDeleteTask called with taskId:', taskId);
    try {
      // The offlineTaskService.deleteTask now handles subtask deletion automatically
      console.log('Dashboard: Calling offlineTaskService.deleteTask...');
      await offlineTaskService.deleteTask(taskId);
      console.log('Dashboard: Task deleted successfully');
      
      // Refresh the task list
      console.log('Dashboard: Triggering refresh with setRefreshFlag');
      setRefreshFlag(f => !f);
      console.log('Dashboard: Refresh flag updated');
    } catch (error) {
      console.error('Dashboard: Error deleting task:', error);
    }
  };

  // Add delete subtask handler
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await offlineTaskService.deleteTask(subtaskId);
      setRefreshFlag(f => !f);
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  // Sort tasks by priority (highest first), then by custom order if set
  const sortedTasks = allActiveTasks
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      // If custom order exists, use it
      const idxA = taskOrder.indexOf(a.id);
      const idxB = taskOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return 0;
    });

  // Move task to previous (completed/failed) by updating its status
  const handleTaskStatus = async (task: Task, status: 'completed' | 'failed') => {
    try {
      await offlineTaskService.updateTaskStatus(task.id, status);
      setShowModal(false);
      setSelectedTask(null);
      setRefreshFlag(f => !f); // trigger refresh
    } catch (e) {}
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Handler for opening the task modal
  const handleTaskCardPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
  }, []);

  if (authLoading) return null;
  if (!session?.user) return null;

  // Filter today's tasks for events section
  const todaysEvents = tasks;
  const numEvents = todaysEvents.length;
  const mainEvent = todaysEvents[0];

  const TaskCardAnimated = ({ item, index, isSelected, onLongPress, onPress }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: withSpring(isSelected ? 1.08 : 1) },
        { translateY: withSpring(isSelected ? -8 : 0) },
        { translateX: withSpring(isSelected ? 4 : 0) },
        { rotateZ: isSelected ? '-2deg' : '0deg' },
      ] as any,
    }));

    // Use calendar card layout
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={onLongPress}
        onPress={onPress}
        style={{ width: '100%', marginBottom: 14 }}
      >
        <Animated.View style={[
          styles.taskCard,
          animatedStyle,
          { zIndex: isSelected ? 20 : 1 },
          isSelected && { borderWidth: 2, borderColor: LT.amber },
        ]}>
          <Card style={[styles.eventCard, { borderLeftColor: getPriorityColor(item.priority) }]}> 
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.eventPriorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>{item.startTime && item.endTime ? `${formatTime(item.startTime)} - ${formatTime(item.endTime)}` : 'All day'}</Text>
                {item.description && (
                  <Text style={styles.eventDescription} numberOfLines={2}>{item.description}</Text>
                )}
              </View>
            </Card.Content>
          </Card>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderTaskItem = ({ item, index }) => {
    const isSelected = selectedTaskToSwap === index;

    const handleLongPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedTaskToSwap(index);
    };

    const handlePress = () => {
      if (selectedTaskToSwap !== null && selectedTaskToSwap !== index) {
        // Swap tasks
        const newTasks = [...sortedTasks];
        const temp = newTasks[selectedTaskToSwap];
        newTasks[selectedTaskToSwap] = newTasks[index];
        newTasks[index] = temp;
        setAllActiveTasks(newTasks);
        setTaskOrder(newTasks.map(task => task.id));
        setSelectedTaskToSwap(null);
      } else if (selectedTaskToSwap === null) {
        handleTaskCardPress(item);
      } else {
        setSelectedTaskToSwap(null); // Deselect if same
      }
    };

    return (
      <TaskCardAnimated
        key={item.id}
        item={item}
        index={index}
        isSelected={isSelected}
        onLongPress={handleLongPress}
        onPress={handlePress}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView 
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <HamburgerMenu onPress={() => setSidebarVisible(true)} isOpen={sidebarVisible} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Home</Text>
              <Text style={styles.greeting}>Welcome! Let's get started!</Text>
              <Text style={styles.subtext}>Here are your plans for today</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <UserAvatar
              size={48}
              showBorder={true}
              borderColor={LT.amber}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <IconButton icon="clock-outline" size={20} iconColor={theme.colors.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{Math.floor(focusStats.total_duration / 60)}h {focusStats.total_duration % 60}m</Text>
          </View>
          {/* Streak Box */}
          <View style={[
            styles.streakCard, 
            streak >= 3 && styles.streakCardGlow,
            failedCount > 0 && streak === 0 && styles.streakCardFailed
          ]}>
            <View style={styles.streakContent}>
              <RNAnimated.Text
                style={[
                  styles.streakFire,
                  streak >= 3 && styles.streakFireGlow,
                  failedCount > 0 && streak === 0 && styles.streakFireFailed
                ]}
              >
                {failedCount > 0 && streak === 0 ? '💔' : '🔥'}
              </RNAnimated.Text>
              <View style={styles.streakTextContainer}>
                <Text style={styles.streakValue}>{streak}</Text>
                <Text style={styles.streakLabel}>Streak</Text>
                {failedCount > 0 && (
                  <Text style={styles.streakSubtext}>
                    -{failedCount} failed
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Events of Today Section - now also shows today's habits */}
        <Card style={styles.eventCard}>
          <Card.Content>
            {numEvents > 0 ? (
              <>
                <Text style={styles.eventTitle}>YOU HAVE {numEvents} {numEvents === 1 ? 'EVENT' : 'EVENTS'} TODAY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.eventMain}>{mainEvent.title}</Text>
                  <Text style={styles.eventNow}>now</Text>
                </View>
                {mainEvent.deadline && (
                  <Text style={styles.eventTime}>
                    {(() => {
                      try {
                        const date = parseDate(mainEvent.deadline);
                        return date.toLocaleDateString();
                      } catch (error) {
                        console.error('Error formatting event time:', error);
                        return 'Today';
                      }
                    })()}
                  </Text>
                )}
                {mainEvent.description && (
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    {mainEvent.description}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.eventTitle}>No events for today</Text>
                <Text style={styles.eventDescription}>
                  Create a task with today's date to see it here
                </Text>
              </>
            )}
            {/* Habits for today - temporarily disabled */}
          </Card.Content>
        </Card>

        {/* Habits Section - temporarily disabled */}

        {/* Task Section: show all active tasks with subtask support */}
        <View style={styles.taskSectionContainer}>
          <Text style={styles.taskSectionTitle}>All Tasks ({sortedTasks.length})</Text>
          <ScrollView 
            style={styles.taskScrollContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {loading ? (
              <Text style={styles.noTasks}>Loading tasks...</Text>
            ) : sortedTasks.length === 0 ? (
              <View style={styles.noTasksContainer}>
                <Text style={styles.noTasks}>No active tasks.</Text>
                <Text style={styles.noTasksSubtext}>
                  Create a new task to get started
                </Text>
              </View>
            ) : (
              <View style={styles.taskListContainer}>
                {sortedTasks.map((task) => {
                  // Skip subtasks as they'll be shown under their parent
                  if (task.parent_task_id) return null;
                  
                  return (
                    <TaskCardWithSubtasks
                      key={task.id}
                      task={task}
                      allTasks={sortedTasks}
                      variant="dashboard"
                      onStatusChange={(taskId, status) => {
                        const taskToUpdate = sortedTasks.find(t => t.id === taskId);
                        if (taskToUpdate) {
                          handleTaskStatus(taskToUpdate, status as 'completed' | 'failed');
                        }
                      }}
                      onPress={handleTaskCardPress}
                      expanded={expandedTasks.has(task.id)}
                      onToggleExpand={toggleSubtasks}
                      onDelete={handleDeleteTask}
                      onDeleteSubtask={handleDeleteSubtask}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
        <Portal>
          <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modalContainer}>
            {selectedTask && (
              <Card style={styles.detailCard}>
                <Card.Title title={selectedTask.title} />
                <Card.Content>
                  <Text style={{ marginBottom: 8 }}>{selectedTask.description}</Text>
                  <Text>Status: {selectedTask.status}</Text>
                  {selectedTask.deadline && (
                    <Text style={{ marginTop: 4 }}>Date: {(() => {
                      const date = parseDate(selectedTask.deadline);
                      return date.toLocaleDateString();
                    })()}</Text>
                  )}
                  {selectedTask.activities && selectedTask.activities.length > 0 && (
                    <View style={styles.modalActivitiesContainer}>
                      <Text style={styles.modalActivitiesTitle}>Activities:</Text>
                      <View style={styles.modalActivitiesList}>
                        {selectedTask.activities.map((activityKey, idx) => {
                          const activity = ACTIVITY_OPTIONS.find(a => a.key === activityKey);
                          return activity ? (
                            <View key={idx} style={styles.modalActivityItem}>
                              <Text style={styles.modalActivityEmoji}>{activity.emoji}</Text>
                              <Text style={styles.modalActivityLabel}>{activity.label}</Text>
                            </View>
                          ) : null;
                        })}
                      </View>
                    </View>
                  )}
                </Card.Content>
                <Card.Actions>
                  <Button mode="contained" onPress={() => handleTaskStatus(selectedTask, 'completed')} buttonColor={LT.teal} textColor={LT.bg} style={{ marginRight: 8 }}>Completed</Button>
                  <Button mode="contained" onPress={() => handleTaskStatus(selectedTask, 'failed')} buttonColor="#cf6679" textColor={LT.bg}>Failed</Button>
                  <Button onPress={() => setShowModal(false)}>Close</Button>
                </Card.Actions>
              </Card>
            )}
          </Modal>
        </Portal>
      </ScrollView>
      <BottomNavBar />
      {/* Chat FAB */}
      <FAB
        icon="chat"
        style={styles.chatFab}
        onPress={() => router.push('/(app)/chat')}
        color={LT.bg}
      />
      <OfflineIndicator />
      
      {/* Dashboard Sidebar */}
      <Sidebar 
        isVisible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </View>
  );
}

function formatEventTime(deadline: string) {
  const date = parseDate(deadline);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: LT.parchment,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: LT.parchment,
    letterSpacing: 1.2,
  },
  subtext: {
    color: LT.parchmentMuted,
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  statIcon: {
    margin: 0,
    marginRight: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: LT.parchment,
  },
  eventCard: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: LT.surfaceElevated,
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  eventPriorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: LT.parchment,
  },
  eventTime: {
    fontSize: 13,
    color: LT.parchmentMuted,
    marginTop: 2,
  },
  eventDescription: {
    fontSize: 12,
    color: LT.parchmentMuted,
    marginTop: 2,
  },
  eventMain: {
    fontSize: 18,
    fontWeight: 'bold',
    color: LT.parchment,
  },
  eventNow: {
    fontSize: 14,
    color: LT.amber,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  taskSectionContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  taskSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LT.parchment,
    marginBottom: 12,
  },
  taskScrollContainer: {
    maxHeight: 400, // Fixed height for scrollable area
  },
  taskListContainer: {
    width: '100%',
  },
  taskGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  taskCard: {
    width: '100%',
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
    minHeight: 72,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  taskCardInner: {
    backgroundColor: LT.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIcon: {
    backgroundColor: LT.amber,
    marginRight: 14,
  },
  taskTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 15,
    color: LT.parchment,
    fontWeight: 'bold',
  },
  taskTime: {
    fontSize: 13,
    color: LT.parchmentMuted,
    marginTop: 2,
  },
  activitiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activityEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  activityMore: {
    fontSize: 12,
    color: LT.parchmentMuted,
    fontWeight: 'bold',
  },
  taskCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LT.outline,
    backgroundColor: LT.surfaceElevated,
    marginLeft: 12,
  },
  noTasks: {
    color: LT.parchmentMuted,
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    marginTop: 24,
  },
  modalContainer: {
    backgroundColor: LT.surfaceElevated,
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
    color: LT.parchment,
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
    backgroundColor: LT.surface,
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
    color: LT.parchmentMuted,
  },
  priorityDot: {
    fontSize: 18,
    marginRight: 6,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    shadowColor: '#FFA726',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minWidth: 80,
    justifyContent: 'center',
  },
  streakCardGlow: {
    backgroundColor: 'rgba(239, 159, 39, 0.12)',
  },
  streakCardFailed: {
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    shadowColor: '#F44336',
  },
  streakFire: {
    fontSize: 28,
    textShadowColor: 'transparent',
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 0 },
  },
  streakFireGlow: {
    textShadowColor: '#FFA726',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  streakFireFailed: {
    textShadowColor: '#F44336',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  streakValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LT.amber,
  },
  streakLabel: {
    fontSize: 14,
    color: LT.parchmentMuted,
    fontWeight: 'bold',
  },
  streakSubtext: {
    fontSize: 12,
    color: LT.parchmentMuted,
    fontWeight: 'bold',
  },
  chatFab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20, // Position above BottomNavBar with spacing
    backgroundColor: LT.amber,
    zIndex: 200,
    elevation: 6,
  },
  noTasksContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noTasksSubtext: {
    color: LT.parchmentMuted,
    fontSize: 14,
    marginTop: 8,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakTextContainer: {
    marginLeft: 8,
  },
}); 