import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Task, TaskStatus } from '../../types/task';
import { useAuth } from '../../hooks/useAuth';
import { taskService } from '../../services/supabase/task';
import TaskCardWithSubtasks from './TaskCardWithSubtasks';

export type TaskFolderFilter = 'all' | 'ungrouped' | string;

interface TaskListProps {
  tasks: Task[];
  /** When set, only root tasks matching this folder filter are listed. */
  folderFilter?: TaskFolderFilter;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  onGenerateAISubtasks?: (parentTaskId: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  folderFilter = 'all',
  onStatusChange,
  onEdit,
  onDelete,
  onAddSubtask,
  onGenerateAISubtasks,
  onDeleteSubtask,
}) => {
  const { user } = useAuth();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkOverdueTasks = async () => {
      if (user) {
        await taskService.checkOverdueTasks(user.id);
      }
    };
    checkOverdueTasks();
  }, [user]);

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

  // Get subtasks for a task
  const getSubtasks = (taskId: string) => {
    return tasks.filter(task => task.parent_task_id === taskId);
  };

  const parentTasks = tasks.filter((task) => {
    if (task.parent_task_id) return false;
    if (folderFilter === 'all') return true;
    if (folderFilter === 'ungrouped') return !task.folder_id;
    return task.folder_id === folderFilter;
  });
  
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

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 16,
  },
});

export default TaskList; 