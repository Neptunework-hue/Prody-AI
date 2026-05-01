import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Portal, Dialog, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Task } from '../../types/task';

interface TaskFocusButtonProps {
  task: Task;
}

const TaskFocusButton: React.FC<TaskFocusButtonProps> = ({ task }) => {
  const [showDialog, setShowDialog] = useState(false);

  const handleStartFocus = () => {
    setShowDialog(false);
    router.push({
      pathname: '/(app)/focus',
      params: { taskId: task.id, taskTitle: task.title }
    });
  };

  return (
    <>
      <Button
        mode="contained"
        onPress={() => setShowDialog(true)}
        style={styles.button}
      >
        Focus
      </Button>

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>Start Focus Session</Dialog.Title>
          <Dialog.Content>
            <Text>Start a focus session for task: {task.title}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button onPress={handleStartFocus}>Start</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    marginLeft: 8,
  },
});

export default TaskFocusButton; 