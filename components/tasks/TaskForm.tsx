import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, ScrollView, Platform } from 'react-native';
import { TextInput, Button, Chip, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task } from '../../types/task';
import { formatDateForStorage } from '../../utils/dateUtils';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { ItemFolder } from '../../types/folder';

interface TaskFormProps {
  task?: Task;
  folders?: ItemFolder[];
  /** When set, each folder chip shows a delete control that calls this (parent should confirm). */
  onRemoveFolder?: (folder: ItemFolder) => void;
  onSubmit: (task: Partial<Task>) => void;
  onCancel: () => void;
}

function defaultXpString(task?: Task): string {
  if (task?.xp_reward != null) return String(task.xp_reward);
  return String(15 + (task?.priority ?? 0) * 5);
}

async function scheduleTaskNotification(task: Partial<Task>) {
  if (!task.notifyTime) return;
  const Notifications = await import('expo-notifications');
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  if (task.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(task.notificationId);
  }
  const notifyDate = new Date(task.notifyTime);
  const now = new Date();
  if (notifyDate < now) {
    notifyDate.setDate(notifyDate.getDate() + 1);
  }
  const trigger: any = {
    hour: notifyDate.getHours(),
    minute: notifyDate.getMinutes(),
    repeats: true,
  };
  if (Platform.OS === 'android') {
    trigger.channelId = 'task-reminders';
  }
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: task.description || 'Task Reminder',
      sound: true,
    },
    trigger,
  });
  return notificationId;
}

function createTaskFormStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 16,
    },
    input: {
      marginBottom: 12,
      backgroundColor: c.surf,
    },
    section: {
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: c.tx2,
      marginBottom: 8,
      fontFamily: FONT_SERIF,
    },
    folderRow: {
      marginBottom: 12,
      maxHeight: 44,
    },
    folderChip: {
      marginRight: 8,
    },
    folderChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 4,
    },
    folderDeleteBtn: {
      margin: 0,
      marginLeft: -6,
    },
    outlineBtn: {
      marginBottom: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 8,
    },
    button: {
      minWidth: 100,
    },
  });
}

const TaskForm: React.FC<TaskFormProps> = ({ task, folders = [], onRemoveFolder, onSubmit, onCancel }) => {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createTaskFormStyles(c), [c]);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [xpInput, setXpInput] = useState(defaultXpString(task));
  const [folderId, setFolderId] = useState<string | null>(task?.folder_id ?? null);
  const [deadline, setDeadline] = useState<Date | null>(
    task?.deadline ? new Date(task.deadline) : null,
  );
  const [startTime, setStartTime] = useState<Date | null>(
    task?.startTime ? new Date(task.startTime) : null,
  );
  const [endTime, setEndTime] = useState<Date | null>(task?.endTime ? new Date(task.endTime) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [notifyTime, setNotifyTime] = useState<Date | null>(
    task?.notifyTime ? new Date(task.notifyTime) : null,
  );
  const [showNotifyTimePicker, setShowNotifyTimePicker] = useState(false);

  useEffect(() => {
    if (folderId && !folders.some((f) => f.id === folderId)) {
      setFolderId(null);
    }
  }, [folders, folderId]);

  const parseXp = () => {
    const n = parseInt(xpInput.replace(/\D/g, ''), 10);
    if (Number.isNaN(n)) return 25;
    return Math.max(1, Math.min(9999, n));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    let notificationId: string | undefined;
    if (notifyTime) {
      notificationId = await scheduleTaskNotification({
        title,
        description,
        notifyTime: notifyTime.toISOString(),
        notificationId: task?.notificationId,
      });
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      xp_reward: parseXp(),
      folder_id: folderId,
      priority: 0,
      deadline: deadline ? formatDateForStorage(deadline) : undefined,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
      activities: [],
      notifyTime: notifyTime ? notifyTime.toISOString() : undefined,
      notificationId,
    });
  };

  const handleDateChange = (_e: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDeadline(selectedDate);
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        mode="outlined"
        textColor={c.tx}
        theme={{ colors: { onSurfaceVariant: c.tx2 } }}
      />

      <TextInput
        label="Description"
         value={description}
         onChangeText={setDescription}
         style={[styles.input, { height: 120 }]}
        mode="outlined"
        multiline
         textColor={c.tx}
      />

      <Text style={styles.sectionLabel}>XP reward</Text>
      <TextInput
        label="XP"
        value={xpInput}
        onChangeText={setXpInput}
        keyboardType="number-pad"
        style={styles.input}
        mode="outlined"
        textColor={c.tx}
      />

      <Text style={styles.sectionLabel}>Folder</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderRow}>
        <Chip
          mode="flat"
          selected={folderId === null}
          onPress={() => setFolderId(null)}
          style={styles.folderChip}
          selectedColor={c.amberBg}
        >
          None
        </Chip>
        {folders.map((f) =>
          onRemoveFolder ? (
            <View key={f.id} style={styles.folderChipRow}>
              <Chip
                mode="flat"
                selected={folderId === f.id}
                onPress={() => setFolderId(f.id)}
                style={styles.folderChip}
                selectedColor={c.amberBg}
              >
                {f.name}
              </Chip>
              <IconButton
                icon="trash-can-outline"
                size={18}
                accessibilityLabel={`Delete folder ${f.name}`}
                onPress={() => onRemoveFolder(f)}
                iconColor={c.tx2}
                style={styles.folderDeleteBtn}
              />
            </View>
          ) : (
            <Chip
              key={f.id}
              mode="flat"
              selected={folderId === f.id}
              onPress={() => setFolderId(f.id)}
              style={styles.folderChip}
              selectedColor={c.amberBg}
            >
              {f.name}
            </Chip>
          ),
        )}
      </ScrollView>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Date</Text>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          style={[styles.outlineBtn, { borderColor: c.amber }]}
          textColor={c.amber}
          labelStyle={{ fontFamily: FONT_SERIF }}
        >
          {deadline ? deadline.toLocaleDateString() : 'Set date'}
        </Button>
        {deadline && (
          <Button mode="text" textColor={c.tx2} onPress={() => setDeadline(null)}>
            Clear
          </Button>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Start time</Text>
        <Button
          mode="outlined"
          onPress={() => setShowStartTimePicker(true)}
          style={[styles.outlineBtn, { borderColor: c.borderStrong }]}
          textColor={c.tx}
          labelStyle={{ fontFamily: FONT_SERIF }}
        >
          {startTime ? startTime.toLocaleTimeString() : 'Set start time'}
        </Button>
        {startTime && (
          <Button mode="text" textColor={c.tx2} onPress={() => setStartTime(null)}>
            Clear
          </Button>
        )}
      </View>

      {startTime && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notify me</Text>
          <Button
            mode="outlined"
            onPress={() => setShowNotifyTimePicker(true)}
            style={[styles.outlineBtn, { borderColor: c.borderStrong }]}
            textColor={c.tx}
            labelStyle={{ fontFamily: FONT_SERIF }}
          >
            {notifyTime
              ? notifyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Pick a time'}
          </Button>
          {showNotifyTimePicker && (
            <DateTimePicker
              value={notifyTime || startTime}
              mode="time"
              display="default"
              onChange={(_e, selectedDate) => {
                setShowNotifyTimePicker(false);
                if (selectedDate) setNotifyTime(selectedDate);
              }}
            />
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>End time</Text>
        <Button
          mode="outlined"
          onPress={() => setShowEndTimePicker(true)}
          style={[styles.outlineBtn, { borderColor: c.borderStrong }]}
          textColor={c.tx}
          labelStyle={{ fontFamily: FONT_SERIF }}
        >
          {endTime ? endTime.toLocaleTimeString() : 'Set end time'}
        </Button>
        {endTime && (
          <Button mode="text" textColor={c.tx2} onPress={() => setEndTime(null)}>
            Clear
          </Button>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" textColor={c.tx2} onPress={onCancel} style={styles.button}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          disabled={!title.trim()}
          buttonColor={c.amber}
          textColor={c.onAccent}
        >
          {task ? 'Update' : 'Create'}
        </Button>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={deadline || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="time"
          display="default"
          onChange={(_e, selectedDate) => {
            setShowStartTimePicker(false);
            if (selectedDate) setStartTime(selectedDate);
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime || new Date()}
          mode="time"
          display="default"
          onChange={(_e, selectedDate) => {
            setShowEndTimePicker(false);
            if (selectedDate) setEndTime(selectedDate);
          }}
        />
      )}
    </View>
  );
};

export default TaskForm;
