import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, Button, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task, TaskPriority } from '../../types/task';
import { formatDateForStorage } from '../../utils/dateUtils';

interface TaskFormProps {
  task?: Task;
  onSubmit: (task: Partial<Task>) => void;
  onCancel: () => void;
}

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

async function scheduleTaskNotification(task: Partial<Task>) {
  if (!task.notifyTime) return;
  const Notifications = await import('expo-notifications');
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
  // Cancel previous notification if editing
  if (task.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(task.notificationId);
  }
  // Schedule notification
  const notifyDate = new Date(task.notifyTime);
  const now = new Date();
  // If the time is in the past for today, schedule for tomorrow
  if (notifyDate < now) {
    notifyDate.setDate(notifyDate.getDate() + 1);
  }
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: task.description || 'Task Reminder',
      sound: true,
    },
    trigger: {
      hour: notifyDate.getHours(),
      minute: notifyDate.getMinutes(),
      repeats: true,
    },
  });
  return notificationId;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 0);
  const [deadline, setDeadline] = useState<Date | null>(
    task?.deadline ? new Date(task.deadline) : null
  );
  const [startTime, setStartTime] = useState<Date | null>(
    task?.startTime ? new Date(task.startTime) : null
  );
  const [endTime, setEndTime] = useState<Date | null>(
    task?.endTime ? new Date(task.endTime) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(task?.activities || []);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [notifyTime, setNotifyTime] = useState<Date | null>(task?.notifyTime ? new Date(task.notifyTime) : null);
  const [showNotifyTimePicker, setShowNotifyTimePicker] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    let notificationId;
    if (notifyTime) {
      notificationId = await scheduleTaskNotification({
        title,
        description,
        notifyTime: notifyTime.toISOString(),
      });
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline: deadline ? formatDateForStorage(deadline) : null,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
      activities: selectedActivities,
      notifyTime: notifyTime ? notifyTime.toISOString() : undefined,
      notificationId,
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDeadline(selectedDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDate) {
      setStartTime(selectedDate);
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndTimePicker(false);
    if (selectedDate) {
      setEndTime(selectedDate);
    }
  };

  const toggleActivity = (key: string) => {
    setSelectedActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const getActivityDisplayText = () => {
    if (selectedActivities.length === 0) {
      return 'Choose Activity';
    }
    if (selectedActivities.length === 1) {
      const activity = ACTIVITY_OPTIONS.find(a => a.key === selectedActivities[0]);
      return `${activity?.emoji} ${activity?.label}`;
    }
    return `${selectedActivities.length} activities selected`;
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        mode="outlined"
      />

      <TextInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        mode="outlined"
        multiline
        numberOfLines={3}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.priorityContainer}>
          {[
            { value: 0, label: 'Low', color: '#4CAF50' },
            { value: 1, label: 'Medium', color: '#FF9800' },
            { value: 2, label: 'High', color: '#F44336' },
            { value: 3, label: 'Urgent', color: '#9C27B0' },
          ].map((priorityOption) => (
            <TouchableOpacity
              key={priorityOption.value}
              style={[
                styles.priorityButton,
                priority === priorityOption.value && [
                  styles.priorityButtonSelected,
                  { backgroundColor: priorityOption.color, borderColor: priorityOption.color }
                ]
              ]}
              onPress={() => setPriority(priorityOption.value as TaskPriority)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.priorityButtonText,
                priority === priorityOption.value && styles.priorityButtonTextSelected,
                { color: priority === priorityOption.value ? '#fff' : priorityOption.color }
              ]}>
                {priorityOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Date</Text>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          style={styles.deadlineButton}
        >
          {deadline ? deadline.toLocaleDateString() : 'Set Date'}
        </Button>
        {deadline && (
          <Button
            mode="text"
            onPress={() => setDeadline(null)}
            style={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Start Time</Text>
        <Button
          mode="outlined"
          onPress={() => setShowStartTimePicker(true)}
          style={styles.deadlineButton}
        >
          {startTime ? startTime.toLocaleTimeString() : 'Set Start Time'}
        </Button>
        {startTime && (
          <Button
            mode="text"
            onPress={() => setStartTime(null)}
            style={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </View>

      {startTime && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notify Me</Text>
          <Button
            mode="outlined"
            onPress={() => setShowNotifyTimePicker(true)}
            style={styles.deadlineButton}
          >
            {notifyTime ? notifyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pick a time'}
          </Button>
          {showNotifyTimePicker && (
            <DateTimePicker
              value={notifyTime || startTime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowNotifyTimePicker(false);
                if (selectedDate) setNotifyTime(selectedDate);
              }}
            />
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>End Time</Text>
        <Button
          mode="outlined"
          onPress={() => setShowEndTimePicker(true)}
          style={styles.deadlineButton}
        >
          {endTime ? endTime.toLocaleTimeString() : 'Set End Time'}
        </Button>
        {endTime && (
          <Button
            mode="text"
            onPress={() => setEndTime(null)}
            style={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Activities</Text>
        <Button
          mode="outlined"
          onPress={() => setShowActivityDialog(true)}
          style={styles.deadlineButton}
        >
          {getActivityDisplayText()}
        </Button>
        {selectedActivities.length > 0 && (
          <Button
            mode="text"
            onPress={() => setSelectedActivities([])}
            style={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" onPress={onCancel} style={styles.button}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          disabled={!title.trim()}
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
          onChange={handleStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime || new Date()}
          mode="time"
          display="default"
          onChange={handleEndTimeChange}
        />
      )}

      <Portal>
        <Dialog
          visible={showActivityDialog}
          onDismiss={() => setShowActivityDialog(false)}
          style={styles.activityDialog}
        >
          <Dialog.Title style={styles.activityDialogTitle}>Choose Activity</Dialog.Title>
          <Dialog.Content style={styles.activityDialogContent}>
            <ScrollView 
              style={styles.activityScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.activityScrollContent}
            >
              <View style={styles.activityGrid}>
                {ACTIVITY_OPTIONS.map((activity) => {
                  const isSelected = selectedActivities.includes(activity.key);
                  return (
                    <TouchableOpacity
                      key={activity.key}
                      style={[
                        styles.activityButton,
                        isSelected && styles.activityButtonSelected
                      ]}
                      onPress={() => toggleActivity(activity.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                      <Text style={[
                        styles.activityLabel,
                        isSelected && styles.activityLabelSelected
                      ]}>
                        {activity.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={styles.activityDialogActions}>
            <Button onPress={() => setShowActivityDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    minWidth: 100,
  },
  deadlineButton: {
    marginBottom: 8,
  },
  clearButton: {
    marginTop: 4,
  },
  activityDialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
  },
  activityDialogTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    paddingBottom: 8,
  },
  activityDialogContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  activityScrollView: {
    maxHeight: 400,
  },
  activityScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityButton: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 8,
  },
  activityButtonSelected: {
    backgroundColor: '#7B61FF',
    borderColor: '#7B61FF',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  activityEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  activityLabelSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  activityDialogActions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#f8f9fa',
    borderColor: '#dee2e6',
  },
  priorityButtonSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  priorityButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TaskForm; 