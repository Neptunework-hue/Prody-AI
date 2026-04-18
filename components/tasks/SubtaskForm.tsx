import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { TaskCreate } from '../../types/task';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';

interface SubtaskFormProps {
  parentTaskId: string;
  onSubmit: (subtaskData: TaskCreate & { parent_task_id: string }) => void;
  onCancel: () => void;
}

function createSubtaskFormStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      color: c.tx,
      fontFamily: FONT_SERIF,
    },
    input: {
      marginBottom: 16,
      backgroundColor: c.surf,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
      color: c.tx2,
      fontFamily: FONT_SERIF,
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
    },
  });
}

const SubtaskForm: React.FC<SubtaskFormProps> = ({ parentTaskId, onSubmit, onCancel }) => {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createSubtaskFormStyles(c), [c]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [xpInput, setXpInput] = useState('20');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const parseXp = () => {
    const n = parseInt(xpInput.replace(/\D/g, ''), 10);
    if (Number.isNaN(n)) return 20;
    return Math.max(1, Math.min(9999, n));
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const subtaskData: TaskCreate & { parent_task_id: string } = {
      title: title.trim(),
      description: description.trim() || undefined,
      xp_reward: parseXp(),
      priority: 0,
      parent_task_id: parentTaskId,
      activities: [],
      ...(deadline && { deadline: deadline.toISOString().split('T')[0] }),
      ...(startTime && { startTime: startTime.toISOString() }),
      ...(endTime && { endTime: endTime.toISOString() }),
    };
    onSubmit(subtaskData);
  };

  const formatDate = (date: Date) => date.toLocaleDateString();
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Add Subtask</Text>

      <TextInput
        label="Subtask title *"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        mode="outlined"
        textColor={c.tx}
      />

      <TextInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        mode="outlined"
        multiline
        numberOfLines={3}
        textColor={c.tx}
      />

      <Text style={styles.sectionTitle}>XP reward</Text>
      <TextInput
        label="XP"
        value={xpInput}
        onChangeText={setXpInput}
        keyboardType="number-pad"
        style={styles.input}
        mode="outlined"
        textColor={c.tx}
      />

      <Text style={styles.sectionTitle}>Date & time</Text>

      <Button
        mode="outlined"
        onPress={() => setShowDatePicker(true)}
        style={styles.dateButton}
        textColor={c.amber}
        labelStyle={{ fontFamily: FONT_SERIF }}
      >
        {deadline ? formatDate(deadline) : 'Set deadline'}
      </Button>

      <View style={styles.timeContainer}>
        <Button
          mode="outlined"
          onPress={() => setShowStartTimePicker(true)}
          style={[styles.timeButton, styles.timeButtonLeft]}
          textColor={c.tx}
          labelStyle={{ fontFamily: FONT_SERIF }}
        >
          {startTime ? formatTime(startTime) : 'Start time'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => setShowEndTimePicker(true)}
          style={[styles.timeButton, styles.timeButtonRight]}
          textColor={c.tx}
          labelStyle={{ fontFamily: FONT_SERIF }}
        >
          {endTime ? formatTime(endTime) : 'End time'}
        </Button>
      </View>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" textColor={c.tx2} onPress={onCancel} style={styles.cancelButton}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!title.trim()}
          style={styles.submitButton}
          buttonColor={c.amber}
          textColor={c.onAccent}
        >
          Add Subtask
        </Button>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={deadline || new Date()}
          mode="date"
          onChange={(_e, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDeadline(selectedDate);
          }}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="time"
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
          onChange={(_e, selectedDate) => {
            setShowEndTimePicker(false);
            if (selectedDate) setEndTime(selectedDate);
          }}
        />
      )}
    </ScrollView>
  );
};

export default SubtaskForm;
