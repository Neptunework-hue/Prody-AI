import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  AppState,
  Alert,
} from 'react-native';
import { Text, Card, Button, IconButton, Portal, Modal } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import { useRouter, useFocusEffect } from 'expo-router';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import Sidebar from '../../components/Sidebar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { isHabitDueOnDate } from '../../utils/habitSchedule';

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
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createCalendarStyles(c), [c]);
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'tasks'>('calendar');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const getPriorityColor = (priority?: number) => {
    switch (priority) {
      case 1:
        return c.teal;
      case 2:
        return c.amber;
      case 3:
        return c.pink;
      case 4:
        return c.blue;
      default:
        return c.tx2;
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
      const tasksWithDates = allTasks.filter((task) => task.deadline);
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadTasks();
        loadHabits();
      }
    });
    return () => sub.remove();
  }, [loadTasks, loadHabits]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    await loadHabits();
    setRefreshing(false);
  }, [loadTasks, loadHabits]);

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

  const tasksByDate = useMemo(() => {
    const by: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.deadline) continue;
      try {
        const date = parseDate(task.deadline);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!by[dateKey]) by[dateKey] = [];
        by[dateKey].push(task);
      } catch (error) {
        console.error(`Calendar: Error parsing date for task "${task.title}":`, error);
      }
    }
    return by;
  }, [tasks]);

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

  const handleDeleteTask = (task: Task) => {
    Alert.alert('Delete task', `Remove “${task.title}” from your list and calendar?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await offlineTaskService.deleteTask(task.id);
            setShowTaskModal(false);
            setSelectedTask(null);
            await loadTasks();
          } catch (e) {
            console.error('Calendar delete task:', e);
          }
        },
      },
    ]);
  };

  const tasksByDayKey = useMemo(() => {
    const roots = tasks.filter((t) => !t.parent_task_id && t.deadline);
    const byDay: Record<string, Task[]> = {};
    for (const task of roots) {
      try {
        const date = parseDate(task.deadline!);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(task);
      } catch {
        /* skip */
      }
    }
    return byDay;
  }, [tasks]);

  /** Days in the selected month only, bullet list aligned with the calendar month. */
  const listViewSortedDayKeys = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const keysSet = new Set<string>();

    for (const key of Object.keys(tasksByDayKey)) {
      const [yy, mm] = key.split('-').map(Number);
      if (yy === y && mm - 1 === m) keysSet.add(key);
    }

    const lastD = new Date(y, m + 1, 0).getDate();
    for (let day = 1; day <= lastD; day++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = new Date(y, m, day, 12, 0, 0, 0);
      if (habits.some((h) => isHabitDueOnDate(h, d))) keysSet.add(key);
    }

    return [...keysSet]
      .filter((key) => {
        const [yy, mm, dd] = key.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
        const hasTasks = (tasksByDayKey[key]?.length ?? 0) > 0;
        const hasHabits = habits.some((h) => isHabitDueOnDate(h, d));
        return hasTasks || hasHabits;
      })
      .sort();
  }, [tasksByDayKey, habits, selectedDate]);

  const formatListDayHeader = (dateKey: string) => {
    const [yy, mm, dd] = dateKey.split('-').map(Number);
    return new Date(yy, mm - 1, dd, 12, 0, 0, 0).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
      const isSelected = key === selectedDateKey;

      days.push(
        <TouchableOpacity
          key={key}
          style={[
            styles.calendarDay,
            isSelected && styles.calendarDaySelected,
            isToday && !isSelected && styles.calendarDayToday,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text
            style={[
              styles.calendarDayText,
              isSelected && styles.calendarDayTextSelected,
              isToday && !isSelected && styles.calendarDayTextToday,
            ]}
          >
            {i}
          </Text>
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
                <Text style={styles.calendarMoreTasks} numberOfLines={1}>
                  +{dayTasks.length - 3}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }
    return <View style={styles.calendarGrid}>{days}</View>;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <QuestLogScreenHeader
        title="Calendar"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="home"
              iconColor={c.amber}
              onPress={() => router.push('/(app)/dashboard')}
            />
            <IconButton
              icon={view === 'calendar' ? 'format-list-bulleted' : 'calendar-month'}
              iconColor={c.amber}
              onPress={() => setView(view === 'calendar' ? 'tasks' : 'calendar')}
            />
          </View>
        }
      />
      
      {view === 'calendar' ? (
        <>
          <View style={styles.monthRow}>
            <IconButton
              icon="chevron-left"
              iconColor={c.tx}
              onPress={goToPreviousMonth}
              style={styles.navButton}
            />
            <TouchableOpacity style={styles.monthSelector} onPress={() => setShowMonthPicker(true)}>
              <Text style={styles.monthText}>
                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <IconButton
              icon="chevron-right"
              iconColor={c.tx}
              onPress={goToNextMonth}
              style={styles.navButton}
            />
          </View>

          <View style={styles.calendarControls}>
            <Button
              mode="outlined"
              onPress={goToToday}
              style={[styles.todayButton, { borderColor: c.amber }]}
              textColor={c.amber}
              labelStyle={{ fontFamily: FONT_SERIF }}
            >
              Today
            </Button>
          </View>
          
          {renderCalendarGrid()}
          
          <View style={styles.selectedDateBar}>
            <Text style={styles.selectedDateText}>
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          
          <ScrollView
            style={styles.eventsList}
            contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={c.amber}
                colors={[c.amber]}
              />
            }
          >
            {dayTasks.length === 0 && selectedHabits.length === 0 ? (
              <Text style={styles.noEvents}>No events or habits for this day.</Text>
            ) : (
              <>
                {dayTasks.map((task) => (
                  <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
                    <Card
                      elevation={0}
                      style={[styles.eventCard, { borderLeftColor: getPriorityColor(task.priority) }]}
                    >
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
                  <View style={styles.habitsBlock}>
                    <Text style={styles.habitsBlockTitle}>Habits for this day</Text>
                    {selectedHabits.map((habit) => (
                      <Card key={habit.id} elevation={0} style={styles.habitCard}>
                        <Card.Content style={styles.habitCardContent}>
                          <Text style={styles.habitTitle}>{habit.title}</Text>
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView
          style={styles.eventsList}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.amber}
              colors={[c.amber]}
            />
          }
        >
          <Text style={styles.listViewHint}>
            Schedule by day (month: {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}) — tap a
            task for details.
          </Text>
          {listViewSortedDayKeys.length === 0 ? (
            <Text style={styles.noEvents}>No tasks or habits in this range.</Text>
          ) : (
            listViewSortedDayKeys.map((dateKey) => {
              const dayTasks = tasksByDayKey[dateKey] ?? [];
              const [yy, mm, dd] = dateKey.split('-').map(Number);
              const d = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
              const dayHabits = habits.filter((h) => isHabitDueOnDate(h, d));
              return (
                <View key={dateKey} style={styles.dayBulletSection}>
                  <Text style={styles.dayBulletSectionTitle}>{formatListDayHeader(dateKey)}</Text>
                  {dayTasks.map((task) => {
                    const subs = tasks.filter((t) => t.parent_task_id === task.id);
                    return (
                      <View key={task.id}>
                        <TouchableOpacity
                          style={styles.bulletRow}
                          onPress={() => handleTaskPress(task)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.bulletChar}>•</Text>
                          <View style={styles.bulletTextCol}>
                            <Text style={styles.bulletTitle}>{task.title}</Text>
                            {task.startTime && task.endTime ? (
                              <Text style={styles.bulletMeta}>
                                {formatTime(task.startTime)} – {formatTime(task.endTime)}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                        {subs.map((st) => (
                          <View key={st.id} style={styles.bulletRowNested}>
                            <Text style={styles.bulletCharNested}>◦</Text>
                            <Text style={styles.bulletTitleNested}>{st.title}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                  {dayHabits.map((habit) => (
                    <View key={habit.id} style={styles.bulletRow}>
                      <Text style={styles.bulletChar}>•</Text>
                      <View style={styles.bulletTextCol}>
                        <Text style={styles.bulletTitle}>
                          {habit.title}
                          <Text style={styles.bulletHabitTag}> · Habit</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      
      {/* Task Detail Modal */}
      <Portal>
        <Modal visible={showTaskModal} onDismiss={() => setShowTaskModal(false)} contentContainerStyle={styles.modalContainer}>
          {selectedTask && (
            <Card style={styles.detailCard}>
              <Card.Title
                title={selectedTask.title}
                titleStyle={{ fontFamily: FONT_SERIF, color: c.tx }}
              />
              <Card.Content>
                <Text style={styles.modalBody}>{selectedTask.description}</Text>
                <Text style={styles.modalBody}>Status: {selectedTask.status}</Text>
                {selectedTask.deadline && (
                  <Text style={styles.modalBody}>Date: {(() => {
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
                  <Text style={styles.modalBody}>
                    Time: {formatTime(selectedTask.startTime)} - {formatTime(selectedTask.endTime)}
                  </Text>
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
                  textColor="#ffffff"
                >
                  Failed
                </Button>
                <Button
                  mode="outlined"
                  textColor="#cf6679"
                  onPress={() => handleDeleteTask(selectedTask)}
                  style={{ marginRight: 8 }}
                >
                  Delete
                </Button>
                <Button textColor={c.tx2} onPress={() => setShowTaskModal(false)}>
                  Close
                </Button>
              </Card.Actions>
            </Card>
          )}
        </Modal>
      </Portal>
      
      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
};

function createCalendarStyles(c: ThemeColors) {
  return StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navButton: {
    padding: 4,
  },
  monthSelector: {
    padding: 8,
  },
  monthText: {
    fontFamily: FONT_SERIF,
    fontSize: 18,
    fontWeight: '600',
    color: c.tx,
  },
  calendarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  todayButton: {
    paddingVertical: 4,
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
    backgroundColor: c.surf,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  calendarDaySelected: {
    backgroundColor: c.amber,
    borderWidth: 2,
    borderColor: c.amber,
  },
  calendarDayToday: {
    backgroundColor: c.amberBg,
    borderWidth: 2,
    borderColor: c.amberBorder,
  },
  calendarDayText: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '600',
    color: c.tx,
  },
  calendarDayTextSelected: {
    color: c.chipSelectedFg,
  },
  calendarDayTextToday: {
    color: c.amber,
    fontWeight: '700',
  },
  calendarDotsRow: {
    flexDirection: 'row',
    marginTop: 2,
    alignItems: 'center',
  },
  calendarMoreTasks: {
    fontSize: 10,
    fontWeight: '700',
    color: c.tx2,
    marginLeft: 2,
  },
  selectedDateBar: {
    backgroundColor: c.bg2,
    padding: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  selectedDateText: {
    fontFamily: FONT_SERIF,
    color: c.tx,
    fontSize: 15,
    fontWeight: '600',
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
    backgroundColor: c.bg,
  },
  eventCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: c.surf,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  eventPriorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  eventTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
    fontWeight: '600',
    color: c.tx,
  },
  eventTime: {
    fontSize: 13,
    color: c.tx2,
    marginTop: 2,
    fontFamily: FONT_SERIF,
  },
  eventDescription: {
    fontSize: 12,
    color: c.tx2,
    marginTop: 2,
    fontFamily: FONT_SERIF,
  },
  noEvents: {
    color: c.tx2,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontFamily: FONT_SERIF,
  },
  listViewHint: {
    fontFamily: FONT_SERIF,
    fontSize: 13,
    color: c.tx2,
    marginBottom: 16,
    lineHeight: 20,
  },
  dayBulletSection: {
    marginBottom: 20,
  },
  dayBulletSectionTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
    fontWeight: '700',
    color: c.amber,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
    paddingBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 8,
  },
  bulletChar: {
    fontSize: 18,
    color: c.tx,
    marginRight: 8,
    lineHeight: 22,
    width: 14,
  },
  bulletTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bulletTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    color: c.tx,
    fontWeight: '600',
  },
  bulletMeta: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    color: c.tx2,
    marginTop: 2,
  },
  bulletRowNested: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    marginLeft: 22,
  },
  bulletCharNested: {
    fontSize: 16,
    color: c.tx2,
    marginRight: 6,
    lineHeight: 20,
  },
  bulletTitleNested: {
    fontFamily: FONT_SERIF,
    fontSize: 14,
    color: c.tx2,
    flex: 1,
  },
  bulletHabitTag: {
    fontFamily: FONT_SERIF,
    fontSize: 13,
    fontWeight: '400',
    color: c.tx2,
  },
  habitsBlock: {
    marginTop: 16,
  },
  habitsBlockTitle: {
    fontFamily: FONT_SERIF,
    fontWeight: '600',
    fontSize: 17,
    marginBottom: 8,
    color: c.tx,
  },
  habitCard: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: c.surf,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  habitCardContent: {
    paddingVertical: 4,
  },
  habitTitle: {
    fontFamily: FONT_SERIF,
    fontWeight: '600',
    fontSize: 15,
    color: c.tx,
  },
  modalContainer: {
    backgroundColor: c.surfaceElevated,
    margin: 20,
    borderRadius: 16,
    padding: 0,
    maxHeight: '80%',
  },
  detailCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 16,
  },
  modalBody: {
    color: c.tx,
    marginBottom: 8,
    fontFamily: FONT_SERIF,
  },
  modalActivitiesContainer: {
    marginTop: 12,
  },
  modalActivitiesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.tx,
    marginBottom: 8,
    fontFamily: FONT_SERIF,
  },
  modalActivitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalActivityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
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
    color: c.tx2,
    fontFamily: FONT_SERIF,
  },
});
}

export default CalendarScreen; 