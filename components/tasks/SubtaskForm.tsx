import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Chip, useTheme, IconButton } from 'react-native-paper';
import { Task, TaskCreate, TaskPriority } from '../../types/task';
import DateTimePicker from '@react-native-community/datetimepicker';

// Activity options for subtasks
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

interface SubtaskFormProps {
  parentTaskId: string;
  onSubmit: (subtaskData: TaskCreate & { parent_task_id: string }) => void;
  onCancel: () => void;
}

const SubtaskForm: React.FC<SubtaskFormProps> = ({
  parentTaskId,
  onSubmit,
  onCancel,
}) => {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(1);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  
  // Date/Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;

    const subtaskData: TaskCreate & { parent_task_id: string } = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      parent_task_id: parentTaskId,
      activities: selectedActivities.length > 0 ? selectedActivities : undefined,
      ...(deadline && { deadline: deadline.toISOString().split('T')[0] }),
      ...(startTime && { startTime: startTime.toISOString() }),
      ...(endTime && { endTime: endTime.toISOString() }),
    };

    onSubmit(subtaskData);
  };

  const toggleActivity = (activityKey: string) => {
    setSelectedActivities(prev => 
      prev.includes(activityKey)
        ? prev.filter(key => key !== activityKey)
        : [...prev, activityKey]
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Add Subtask</Text>
      
      <TextInput
        label="Subtask Title *"
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

      <Text style={styles.sectionTitle}>Priority</Text>
      <View style={styles.priorityContainer}>
        {[0, 1, 2, 3].map((p) => (
          <Chip
            key={p}
            selected={priority === p}
            onPress={() => setPriority(p as TaskPriority)}
            style={[styles.priorityChip, priority === p && styles.priorityChipSelected]}
            textStyle={priority === p ? styles.priorityTextSelected : styles.priorityText}
          >
            {['Low', 'Medium', 'High', 'Urgent'][p]}
          </Chip>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Date & Time</Text>
      
      <Button
        mode="outlined"
        onPress={() => setShowDatePicker(true)}
        style={styles.dateButton}
        icon="calendar"
      >
        {deadline ? formatDate(deadline) : 'Set Deadline'}
      </Button>

      <View style={styles.timeContainer}>
        <Button
          mode="outlined"
          onPress={() => setShowStartTimePicker(true)}
          style={[styles.timeButton, styles.timeButtonLeft]}
          icon="clock-start"
        >
          {startTime ? formatTime(startTime) : 'Start Time'}
        </Button>
        
        <Button
          mode="outlined"
          onPress={() => setShowEndTimePicker(true)}
          style={[styles.timeButton, styles.timeButtonRight]}
          icon="clock-end"
        >
          {endTime ? formatTime(endTime) : 'End Time'}
        </Button>
      </View>

      <Text style={styles.sectionTitle}>Activities</Text>
      <View style={styles.activitiesContainer}>
        {ACTIVITY_OPTIONS.map((activity) => (
          <Chip
            key={activity.key}
            selected={selectedActivities.includes(activity.key)}
            onPress={() => toggleActivity(activity.key)}
            style={[
              styles.activityChip,
              selectedActivities.includes(activity.key) && styles.activityChipSelected
            ]}
            textStyle={selectedActivities.includes(activity.key) ? styles.activityTextSelected : styles.activityText}
          >
            {activity.emoji} {activity.label}
          </Chip>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" onPress={onCancel} style={styles.cancelButton}>
          Cancel
        </Button>
        <Button 
          mode="contained" 
          onPress={handleSubmit}
          disabled={!title.trim()}
          style={styles.submitButton}
        >
          Add Subtask
        </Button>
      </View>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={deadline || new Date()}
          mode="date"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDeadline(selectedDate);
          }}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="time"
          onChange={(event, selectedDate) => {
            setShowStartTimePicker(false);
            if (selectedDate) setStartTime(selectedDate);
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime || new Date()}
          mode="time"
          onChange={(event, selectedDate) => {
            setShowEndTimePicker(false);
            if (selectedDate) setEndTime(selectedDate);
          }}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#222',
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#222',
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  priorityChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  priorityChipSelected: {
    backgroundColor: '#7B61FF',
  },
  priorityText: {
    color: '#666',
  },
  priorityTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dateButton: {
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeButton: {
    flex: 1,
  },
  timeButtonLeft: {
    marginRight: 8,
  },
  timeButtonRight: {
    marginLeft: 8,
  },
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  activityChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  activityChipSelected: {
    backgroundColor: '#EDE7FE',
    borderColor: '#7B61FF',
  },
  activityText: {
    color: '#666',
  },
  activityTextSelected: {
    color: '#7B61FF',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#7B61FF',
  },
});

export default SubtaskForm; 