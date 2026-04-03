import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton, Chip, useTheme, Checkbox } from 'react-native-paper';
import { Task } from '../../types/task';

// Activity mapping for display
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

interface TaskCardWithSubtasksProps {
  task: Task;
  allTasks: Task[];
  variant: 'dashboard' | 'calendar';
  onStatusChange: (taskId: string, status: 'completed' | 'failed') => void;
  onPress: (task: Task) => void;
  expanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return '#4CAF50';
    case 'failed':
      return '#F44336';
    case 'in_progress':
      return '#2196F3';
    default:
      return '#FF9800';
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

const formatDate = (deadline: string | undefined) => {
  if (!deadline) return '';
  
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

export default function TaskCardWithSubtasks({
  task,
  allTasks,
  variant,
  onStatusChange,
  onPress,
  expanded,
  onToggleExpand,
  onDelete,
  onDeleteSubtask,
}: TaskCardWithSubtasksProps) {
  const theme = useTheme();
  
  // Get subtasks for this task
  const subtasks = allTasks.filter(t => t.parent_task_id === task.id);
  const hasSubtasks = subtasks.length > 0;
  
  // Calculate completion status
  const completedSubtasks = subtasks.filter(t => t.status === 'completed').length;
  const totalSubtasks = subtasks.length;
  
  // Debug log to verify subtasks are being found
  if (hasSubtasks) {
    console.log(`TaskCardWithSubtasks: Task "${task.title}" has ${subtasks.length} subtasks:`, subtasks.map(s => s.title));
  }
  
  const handleStatusChange = (status: 'completed' | 'failed') => {
    onStatusChange(task.id, status);
  };

  // Handler to complete all subtasks if main task is completed
  const handleCompleteAllSubtasks = () => {
    subtasks.forEach((subtask) => {
      if (subtask.status !== 'completed') {
        onStatusChange(subtask.id, 'completed');
      }
    });
  };

  // Wrap main Complete button to also complete subtasks
  const handleMainComplete = () => {
    onStatusChange(task.id, 'completed');
    handleCompleteAllSubtasks();
  };

  return (
    <View style={styles.container}>
      <Card style={[styles.card, { borderLeftColor: getPriorityColor(task.priority) }]}>
        <TouchableOpacity onPress={() => onPress(task)} activeOpacity={0.7}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.headerRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={2}>
                  {task.title}
                </Text>
                {task.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {task.description}
                  </Text>
                )}
              </View>
              
              <View style={styles.statusContainer}>
                <Chip
                  mode="outlined"
                  textStyle={styles.statusText}
                  style={[styles.statusChip, { borderColor: getStatusColor(task.status) }]}
                >
                  {task.status.replace('_', ' ')}
                </Chip>
              </View>
            </View>
            
            <View style={styles.detailsRow}>
              {task.deadline && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(task.deadline)}</Text>
                </View>
              )}
              
              {task.startTime && task.endTime && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Time:</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(task.startTime)} - {formatTime(task.endTime)}
                  </Text>
                </View>
              )}
            </View>
            
            {task.activities && task.activities.length > 0 && (
              <View style={styles.activitiesContainer}>
                <Text style={styles.activitiesLabel}>Activities:</Text>
                <View style={styles.activitiesList}>
                  {task.activities.map((activityKey, idx) => {
                    const activity = ACTIVITY_OPTIONS.find(a => a.key === activityKey);
                    return activity ? (
                      <View key={idx} style={styles.activityItem}>
                        <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                        <Text style={styles.activityLabel}>{activity.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </View>
            )}
            
            {hasSubtasks && (
              <View style={styles.subtasksHeader}>
                <Text style={styles.subtasksLabel}>
                  Subtasks ({completedSubtasks}/{totalSubtasks})
                </Text>
                <IconButton
                  icon={expanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  onPress={() => onToggleExpand(task.id)}
                />
              </View>
            )}
          </Card.Content>
        </TouchableOpacity>
        
        {hasSubtasks && expanded && (
          <View style={styles.subtasksContainer}>
            {subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subtaskItem}>
                <View style={styles.subtaskRow}>
                  {/* Priority indicator */}
                  <View style={[styles.subtaskPriorityDot, { backgroundColor: getPriorityColor(subtask.priority) }]} />
                  {/* Checkbox for dashboard variant */}
                  {variant === 'dashboard' && (
                    <Checkbox
                      status={subtask.status === 'completed' ? 'checked' : 'unchecked'}
                      onPress={() => {
                        if (subtask.status !== 'completed') {
                          onStatusChange(subtask.id, 'completed');
                        } else {
                          onStatusChange(subtask.id, 'failed');
                        }
                      }}
                      color={getPriorityColor(subtask.priority)}
                      uncheckedColor={'#bbb'}
                    />
                  )}
                  <View style={styles.subtaskInfo}>
                    <Text style={styles.subtaskTitle}>{subtask.title}</Text>
                    {subtask.description && (
                      <Text style={styles.subtaskDescription}>{subtask.description}</Text>
                    )}
                  </View>
                  <Chip
                    mode="outlined"
                    textStyle={styles.subtaskStatusText}
                    style={[styles.subtaskStatusChip, { borderColor: getStatusColor(subtask.status) }]}
                  >
                    {subtask.status.replace('_', ' ')}
                  </Chip>
                  {/* Edit button for dashboard/tasks section */}
                  {variant === 'dashboard' && (
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => onPress(subtask)}
                      style={{ marginLeft: 2 }}
                    />
                  )}
                  {/* Delete button for subtasks */}
                  {variant === 'dashboard' && (
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => onDeleteSubtask(subtask.id)}
                      style={{ marginLeft: 2 }}
                      accessibilityLabel="Delete Subtask"
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        
        <Card.Actions style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleMainComplete}
          >
            <Text style={styles.actionButtonText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.failButton]}
            onPress={() => handleStatusChange('failed')}
          >
            <Text style={styles.actionButtonText}>Fail</Text>
          </TouchableOpacity>
          <IconButton
            icon="delete"
            size={24}
            onPress={() => {
              console.log('Delete button pressed for task:', task.id, task.title);
              onDelete(task.id);
            }}
            style={{ marginLeft: 4 }}
            accessibilityLabel="Delete Task"
          />
        </Card.Actions>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  detailValue: {
    fontSize: 12,
    color: '#222',
    fontWeight: '500',
  },
  activitiesContainer: {
    marginBottom: 12,
  },
  activitiesLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  activitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  activityLabel: {
    fontSize: 12,
    color: '#666',
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
  subtasksLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  subtasksContainer: {
    backgroundColor: '#f7f7fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    marginHorizontal: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  subtaskItem: {
    marginBottom: 8,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  subtaskPriorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  subtaskInfo: {
    flex: 1,
    marginRight: 8,
  },
  subtaskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
  },
  subtaskDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  subtaskStatusChip: {
    height: 22,
    marginLeft: 8,
  },
  subtaskStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  failButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
}); 