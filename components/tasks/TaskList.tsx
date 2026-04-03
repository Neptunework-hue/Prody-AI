import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Menu, Divider, Text, useTheme, Card, Chip, Button } from 'react-native-paper';
import { Task, TaskStatus } from '../../types/task';
import TaskFocusButton from './TaskFocusButton';
import { useAuth } from '../../hooks/useAuth';
import { taskService } from '../../services/supabase/task';
import TaskCardWithSubtasks from './TaskCardWithSubtasks';

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

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  onGenerateAISubtasks?: (parentTaskId: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
  onAddSubtask,
  onGenerateAISubtasks,
  onDeleteSubtask,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = React.useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkOverdueTasks = async () => {
      if (user) {
        await taskService.checkOverdueTasks(user.id);
      }
    };
    checkOverdueTasks();
  }, [user]);

  const handleMenuOpen = (taskId: string) => {
    setMenuVisible(taskId);
  };

  const handleMenuClose = () => {
    setMenuVisible(null);
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

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'in_progress':
        return 'progress-clock';
      case 'failed':
        return 'close-circle';
      default:
        return 'circle-outline';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'failed':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return null;
    
    // Handle both ISO string format and date string format
    let date: Date;
    if (deadline.includes('T')) {
      // ISO string format (old format)
      date = new Date(deadline);
    } else {
      // Date string format (YYYY-MM-DD, new format)
      const [year, month, day] = deadline.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    return date.toLocaleDateString();
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    
    // Handle both ISO string format and date string format
    let date: Date;
    if (deadline.includes('T')) {
      // ISO string format (old format)
      date = new Date(deadline);
    } else {
      // Date string format (YYYY-MM-DD, new format)
      const [year, month, day] = deadline.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    return date < new Date();
  };

  // Get activities display
  const getActivitiesDisplay = (task: Task) => {
    if (!task.activities || task.activities.length === 0) return null;
    
    return (
      <View style={styles.activitiesContainer}>
        {task.activities.slice(0, 3).map((activityKey, idx) => {
          const activity = ACTIVITY_OPTIONS.find(a => a.key === activityKey);
          return activity ? (
            <Text key={idx} style={styles.activityEmoji}>
              {activity.emoji}
            </Text>
          ) : null;
        })}
        {task.activities.length > 3 && (
          <Text style={styles.activityMore}>+{task.activities.length - 3}</Text>
        )}
      </View>
    );
  };

  // Get subtasks for a task
  const getSubtasks = (taskId: string) => {
    return tasks.filter(task => task.parent_task_id === taskId);
  };

  // Filter out subtasks from main list (they'll be shown under parents)
  const parentTasks = tasks.filter(task => !task.parent_task_id);
  
  // Debug log to verify subtasks are being found
  const allSubtasks = tasks.filter(task => task.parent_task_id);
  if (allSubtasks.length > 0) {
    console.log('TaskList: Found subtasks:', allSubtasks.map(s => ({ id: s.id, title: s.title, parent: s.parent_task_id })));
  }

  // Create a delete subtask handler that uses onDelete if onDeleteSubtask is not provided
  const handleDeleteSubtask = (subtaskId: string) => {
    if (onDeleteSubtask) {
      onDeleteSubtask(subtaskId);
    } else {
      onDelete(subtaskId); // Fallback to regular delete
    }
  };

  return (
    <View style={styles.listContainer}>
      {parentTasks.map((task) => (
        <TaskCardWithSubtasks
          key={task.id}
          task={task}
          allTasks={tasks}
          variant="dashboard"
          onStatusChange={onStatusChange}
          onPress={onEdit}
          expanded={expandedTasks.has(task.id)}
          onToggleExpand={toggleSubtasks}
          onDelete={onDelete}
          onDeleteSubtask={handleDeleteSubtask}
        />
      ))}
    </View>
  );
};

function getPriorityColor(priority: number) {
  if (priority >= 3) return '#ff5252'; // High
  if (priority === 2) return '#ffb300'; // Medium
  return '#4caf50'; // Low
}

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 16,
  },
  taskCard: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  completed: {
    textDecorationLine: 'line-through',
    color: '#bbb',
  },
  description: {
    fontSize: 14,
    color: '#666',
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
    color: '#888',
    fontWeight: 'bold',
  },
  priorityChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 2,
    height: 24,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  subtasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  subtasksInfo: {
    flex: 1,
  },
  subtasksLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  subtasksHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  subtasksContainer: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  subtaskItem: {
    marginTop: 8,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  subtaskInfo: {
    flex: 1,
    marginLeft: 8,
  },
  subtaskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  subtaskDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  subtaskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default TaskList; 