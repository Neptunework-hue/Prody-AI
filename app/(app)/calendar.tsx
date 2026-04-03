import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, Avatar, Portal, Modal } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import { useRouter, useFocusEffect } from 'expo-router';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import TaskCardWithSubtasks from '../../components/tasks/TaskCardWithSubtasks';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';

const ACTIVITY_OPTIONS = [
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

const CalendarScreen = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'tasks'>('calendar');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [habits, setHabits] = useState<Habit[]>([]);

  const getPriorityColor = (priority?: number) => {
    switch (priority) {
      case 1: return '#4CAF50'; // Low - green
      case 2: return '#FFC107'; // Medium - orange
      case 3: return '#F44336'; // High - red
      case 4: return '#9C27B0'; // Urgent - purple
      default: return '#E0E0E0'; // Default/unspecified - grey
    }
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

  const loadTasks = useCallback(async () => {
    if (!user) return;
    try {
      const allTasks = await offlineTaskService.getTasks(user.id);
      console.log('Calendar: All tasks fetched:', allTasks);
      
      // Filter tasks that have a deadline/date set
      const tasksWithDates = allTasks.filter(task => task.deadline);
      console.log('Calendar: Tasks with dates:', tasksWithDates);
      
      setTasks(tasksWithDates);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [user]);

  const loadHabits = useCallback(async () => {
    if (!user) return;
    try {
      const userHabits = await habitService.getHabits(user.id);
      setHabits(userHabits);
    } catch (error) {
      console.error('Error loading habits:', error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadHabits();
    }, [loadTasks, loadHabits])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, [loadTasks]);

  // Navigation functions
  const goToPreviousMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const goToSpecificMonth = (month: number, year: number) => {
    setSelectedDate(new Date(year, month, 1));
  };

  // Group tasks by date for calendar dots
  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(task => {
    if (task.deadline) {
      try {
        const date = parseDate(task.deadline);
        
        // Use local date formatting to avoid timezone issues
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
        tasksByDate[dateKey].push(task);
        
        console.log(`Calendar: Task "${task.title}" mapped to date ${dateKey}`);
      } catch (error) {
        console.error(`Calendar: Error parsing date for task "${task.title}":`, error);
      }
    }
  });

  // Filter tasks for selected date
  const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const dayTasks = tasksByDate[selectedDateKey] || [];

  // For the selected date, find habits that should repeat on that day
  const selectedDayOfWeek = selectedDate.getDay(); // 0=Sunday, 6=Saturday
  const selectedHabits = habits.filter(habit => {
    if (habit.frequency === 'daily') return true;
    if ((habit.frequency === 'weekly' || habit.frequency === 'monthly') && habit.days) {
      // Our days array: 0=Mon, 6=Sun, JS getDay: 0=Sun, 6=Sat
      // So, map JS getDay to our index: Mon=1, ..., Sun=0
      const ourDayIdx = selectedDayOfWeek === 0 ? 6 : selectedDayOfWeek - 1;
      return habit.days.includes(ourDayIdx);
    }
    return false;
  });

  // Helper to format time
  const formatTime = (iso: string | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleTaskStatus = async (task: Task, status: 'completed' | 'failed') => {
    try {
      await offlineTaskService.updateTaskStatus(task.id, status);
      setShowTaskModal(false);
      setSelectedTask(null);
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      // The offlineTaskService.deleteTask now handles subtask deletion automatically
      await offlineTaskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await offlineTaskService.deleteTask(subtaskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  // Calendar grid renderer
  const renderCalendarGrid = () => {
    const now = new Date();
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty days for the first week if needed
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayTasks = tasksByDate[key] || [];
      const isToday = date.toDateString() === new Date().toDateString();
      
      days.push(
        <TouchableOpacity
          key={key}
          style={[
            styles.calendarDay,
            key === selectedDateKey && styles.calendarDaySelected,
            isToday && styles.calendarDayToday
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text style={[
            styles.calendarDayText,
            isToday && styles.calendarDayTextToday
          ]}>{i}</Text>
          {dayTasks.length > 0 && (
            <View style={styles.calendarDotsRow}>
              {dayTasks.slice(0, 3).map((task, idx) => (
                <View
                  key={idx}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: getPriorityColor(task.priority),
                    marginHorizontal: 1,
                  }}
                />
              ))}
              {dayTasks.length > 3 && (
                <Text style={styles.calendarMoreTasks}>+{dayTasks.length - 3}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }
    return <View style={styles.calendarGrid}>{days}</View>;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerActions}>
          <IconButton icon="home" onPress={() => router.push('/(app)/dashboard')} />
          <IconButton icon={view === 'calendar' ? 'format-list-bulleted' : 'calendar-month'} onPress={() => setView(view === 'calendar' ? 'tasks' : 'calendar')} />
        </View>
      </View>
      
      {view === 'calendar' ? (
        <>
          <View style={styles.monthRow}>
            <IconButton icon="chevron-left" onPress={goToPreviousMonth} style={styles.navButton} />
            <TouchableOpacity style={styles.monthSelector} onPress={() => setShowMonthPicker(true)}>
              <Text style={styles.monthText}>
                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <IconButton icon="chevron-right" onPress={goToNextMonth} style={styles.navButton} />
          </View>
          
          <View style={styles.calendarControls}>
            <Button mode="outlined" onPress={goToToday} style={styles.todayButton}>
              Today
            </Button>
          </View>
          
          {renderCalendarGrid()}
          
          <View style={styles.selectedDateBar}>
            <Text style={styles.selectedDateText}>
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          
          <ScrollView style={styles.eventsList} 
            contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {dayTasks.length === 0 && selectedHabits.length === 0 ? (
              <Text style={styles.noEvents}>No events or habits for this day.</Text>
            ) : (
              <>
                {dayTasks.map((task) => (
                  <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
                    <Card style={[styles.eventCard, { borderLeftColor: getPriorityColor(task.priority) }]}> 
                      <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.eventPriorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventTitle}>{task.title}</Text>
                          <Text style={styles.eventTime}>
                            {task.startTime && task.endTime ? `${formatTime(task.startTime)} - ${formatTime(task.endTime)}` : 'All day'}
                          </Text>
                          {task.description && (
                            <Text style={styles.eventDescription} numberOfLines={2}>{task.description}</Text>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  </TouchableOpacity>
                ))}
                {selectedHabits.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Habits for this day</Text>
                    {selectedHabits.length === 0 && <Text style={{ color: '#888' }}>No habits for this day.</Text>}
                    {selectedHabits.map(habit => (
                      <Card key={habit.id} style={{ marginBottom: 8, padding: 12, borderRadius: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 24, marginRight: 8 }}>{habit.icon || '🏆'}</Text>
                          <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{habit.title}</Text>
                          <Text style={{ marginLeft: 8, color: '#888' }}>Target: {habit.target}</Text>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView style={styles.eventsList} 
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {tasks.map(task => {
            if (task.parent_task_id) return null;
            
            return (
              <TaskCardWithSubtasks
                key={task.id}
                task={task}
                allTasks={tasks}
                variant="calendar"
                onStatusChange={(taskId, status) => {
                  const taskToUpdate = tasks.find(t => t.id === taskId);
                  if (taskToUpdate) {
                    handleTaskStatus(taskToUpdate, status as 'completed' | 'failed');
                  }
                }}
                onPress={handleTaskPress}
                expanded={expandedTasks.has(task.id)}
                onToggleExpand={toggleSubtasks}
                onDelete={handleDeleteTask}
                onDeleteSubtask={handleDeleteSubtask}
              />
            );
          })}
        </ScrollView>
      )}
      
      {/* Task Detail Modal */}
      <Portal>
        <Modal visible={showTaskModal} onDismiss={() => setShowTaskModal(false)} contentContainerStyle={styles.modalContainer}>
          {selectedTask && (
            <Card style={styles.detailCard}>
              <Card.Title title={selectedTask.title} />
              <Card.Content>
                <Text style={{ marginBottom: 8 }}>{selectedTask.description}</Text>
                <Text>Status: {selectedTask.status}</Text>
                {selectedTask.deadline && (
                  <Text style={{ marginTop: 4 }}>Date: {(() => {
                    try {
                      const date = parseDate(selectedTask.deadline);
                      return date.toLocaleDateString();
                    } catch (error) {
                      console.error('Error formatting task date:', error);
                      return 'Invalid date';
                    }
                  })()}</Text>
                )}
                {selectedTask.startTime && selectedTask.endTime && (
                  <Text style={{ marginTop: 4 }}>Time: {formatTime(selectedTask.startTime)} - {formatTime(selectedTask.endTime)}</Text>
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
                <Button mode="contained" onPress={() => handleTaskStatus(selectedTask, 'completed')} style={{ backgroundColor: '#4caf50', marginRight: 8 }}>Completed</Button>
                <Button mode="contained" onPress={() => handleTaskStatus(selectedTask, 'failed')} style={{ backgroundColor: '#ff5252' }}>Failed</Button>
                <Button onPress={() => setShowTaskModal(false)}>Close</Button>
              </Card.Actions>
            </Card>
          )}
        </Modal>
      </Portal>
      
      <BottomNavBar />
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: '#222',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  navButton: {
    padding: 4,
  },
  monthSelector: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  calendarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  todayButton: {
    padding: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  calendarDay: {
    width: 36,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  calendarDaySelected: {
    backgroundColor: '#EDE7FE',
    borderWidth: 2,
    borderColor: '#7B61FF',
  },
  calendarDayToday: {
    backgroundColor: '#EDE7FE',
    borderWidth: 2,
    borderColor: '#7B61FF',
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  calendarDayTextToday: {
    fontWeight: 'bold',
  },
  calendarDotsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  calendarMoreTasks: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    marginLeft: 4,
  },
  selectedDateBar: {
    backgroundColor: '#22223B',
    padding: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: 8,
  },
  selectedDateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  eventCard: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
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
    color: '#222',
  },
  eventTime: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  eventDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  noEvents: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  detailCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  modalActivitiesContainer: {
    marginTop: 20,
  },
  modalActivitiesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10,
  },
  modalActivitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modalActivityItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalActivityEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  modalActivityLabel: {
    fontSize: 12,
    color: '#888',
  },
});

export default CalendarScreen; 