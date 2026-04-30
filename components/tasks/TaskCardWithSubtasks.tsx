import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton, Checkbox } from 'react-native-paper';
import { Task, TaskStatus } from '../../types/task';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';

export function taskXpValue(task: Task): number {
  return task.xp_reward ?? 15 + (task.priority ?? 0) * 5;
}

function categoryLabel(task: Task): string {
  const cat = task.category?.trim();
  if (cat) return cat;
  const raw = `${task.category ?? ''} ${(task.tags ?? []).join(' ')}`.toLowerCase();
  if (/capstone|chapter|draft|edu|learn|course/.test(raw)) return 'Capstone';
  if (/personal|journal|habit/.test(raw)) return 'Personal';
  if (/work|career|job/.test(raw)) return 'Work';
  return 'Task';
}

function formatMetaDeadline(deadline?: string): string {
  if (!deadline) return 'No date';
  let d: Date;
  if (deadline.includes('T')) {
    d = new Date(deadline);
  } else {
    const [y, m, day] = deadline.split('-').map(Number);
    d = new Date(y, m - 1, day);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (taskDay.getTime() === today.getTime()) return short;
  if (taskDay.getTime() > today.getTime()) return `Due ${short}`;
  return short;
}

function buildMetaLine(task: Task): string {
  const xp = taskXpValue(task);
  return `${formatMetaDeadline(task.deadline)} · ${categoryLabel(task)} · +${xp} XP`;
}

interface TaskCardWithSubtasksProps {
  task: Task;
  allTasks: Task[];
  variant: 'dashboard' | 'calendar';
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onPress: (task: Task) => void;
  expanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}

function createTaskCardStyles(p: ThemeColors) {
  return StyleSheet.create({
    outer: {
      marginBottom: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.ruleHairline,
    },
    card: {
      backgroundColor: p.bg,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 4,
    },
    taskTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 16,
      fontWeight: '600',
      color: p.tx,
      lineHeight: 22,
    },
    taskTitleDone: {
      textDecorationLine: 'line-through',
      color: p.tx2,
      fontWeight: '500',
    },
    taskMeta: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: p.parchmentMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    expandTap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 8,
      paddingVertical: 4,
      marginBottom: 4,
    },
    expandLabel: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      color: p.tx2,
    },
    subtasksWrap: {
      paddingLeft: 8,
      paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.ruleHairline,
      marginTop: 4,
      paddingTop: 8,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    subTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 15,
      fontWeight: '600',
      color: p.tx,
    },
    subActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingBottom: 10,
      paddingTop: 4,
      gap: 6,
    },
    actionLink: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    actionLinkText: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      color: p.tx2,
      fontWeight: '600',
    },
    actionSep: {
      color: p.tx3,
      fontSize: 12,
    },
  });
}

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
  const { colors: palette } = useAppTheme();
  const styles = useMemo(() => createTaskCardStyles(palette), [palette]);
  const subtasks = allTasks.filter((t) => t.parent_task_id === task.id);
  const hasSubtasks = subtasks.length > 0;
  const completedSubtasks = subtasks.filter((t) => t.status === 'completed').length;
  const totalSubtasks = subtasks.length;

  const handleCompleteAllSubtasks = () => {
    subtasks.forEach((subtask) => {
      if (subtask.status !== 'completed') {
        onStatusChange(subtask.id, 'completed');
      }
    });
  };

  const handleMainComplete = () => {
    onStatusChange(task.id, 'completed');
    handleCompleteAllSubtasks();
  };

  const toggleRootComplete = () => {
    if (task.status === 'completed') {
      onStatusChange(task.id, 'pending');
    } else {
      onStatusChange(task.id, 'completed');
    }
  };

  const toggleSubtaskComplete = (subtask: Task) => {
    if (subtask.status === 'completed') {
      onStatusChange(subtask.id, 'pending');
    } else {
      onStatusChange(subtask.id, 'completed');
    }
  };

  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        <View style={styles.mainRow}>
          <Checkbox
            status={task.status === 'completed' ? 'checked' : 'unchecked'}
            onPress={toggleRootComplete}
            color={palette.teal}
            uncheckedColor={palette.tx2}
          />
          <TouchableOpacity
            style={styles.textCol}
            onPress={() => onPress(task)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.taskTitle, task.status === 'completed' && styles.taskTitleDone]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <Text style={styles.taskMeta}>{buildMetaLine(task)}</Text>
          </TouchableOpacity>
        </View>

        {hasSubtasks && (
          <TouchableOpacity
            style={styles.expandTap}
            onPress={() => onToggleExpand(task.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.expandLabel}>
              Subtasks ({completedSubtasks}/{totalSubtasks})
            </Text>
            <IconButton
              icon={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              iconColor={palette.tx2}
              style={{ margin: 0 }}
            />
          </TouchableOpacity>
        )}

        {hasSubtasks && expanded && (
          <View style={styles.subtasksWrap}>
            {subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subRow}>
                {variant === 'dashboard' && (
                  <Checkbox
                    status={subtask.status === 'completed' ? 'checked' : 'unchecked'}
                    onPress={() => toggleSubtaskComplete(subtask)}
                    color={palette.teal}
                    uncheckedColor={palette.tx2}
                  />
                )}
                <TouchableOpacity
                  style={styles.textCol}
                  onPress={() => onPress(subtask)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.subTitle,
                      subtask.status === 'completed' && styles.taskTitleDone,
                    ]}
                    numberOfLines={2}
                  >
                    {subtask.title}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {formatMetaDeadline(subtask.deadline)} · {categoryLabel(subtask)} · +
                    {taskXpValue(subtask)} XP
                  </Text>
                </TouchableOpacity>
                {variant === 'dashboard' && (
                  <View style={styles.subActions}>
                    <IconButton
                      icon="pencil"
                      size={18}
                      iconColor={palette.tx2}
                      onPress={() => onPress(subtask)}
                      style={{ margin: 0 }}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={18}
                      iconColor={palette.tx2}
                      onPress={() => onDeleteSubtask(subtask.id)}
                      style={{ margin: 0 }}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleMainComplete} style={styles.actionLink}>
            <Text style={styles.actionLinkText}>Complete</Text>
          </TouchableOpacity>
          <Text style={styles.actionSep}>·</Text>
          <TouchableOpacity onPress={() => onStatusChange(task.id, 'failed')} style={styles.actionLink}>
            <Text style={styles.actionLinkText}>Fail</Text>
          </TouchableOpacity>
          <Text style={styles.actionSep}>·</Text>
          <TouchableOpacity onPress={() => onDelete(task.id)} style={styles.actionLink}>
            <Text style={styles.actionLinkText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
