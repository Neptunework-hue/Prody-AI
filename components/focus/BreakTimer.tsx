import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ProgressBar, useTheme } from 'react-native-paper';

interface BreakTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip: () => void;
}

const BreakTimer: React.FC<BreakTimerProps> = ({ duration, onComplete, onSkip }) => {
  const theme = useTheme();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      onComplete();
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / duration;

  return (
    <View style={styles.container}>
      <View style={styles.timerContainer}>
        <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={onSkip}
          style={styles.button}
        >
          Skip Break
        </Button>
        <Button
          mode="contained"
          onPress={() => setIsActive(!isActive)}
          style={styles.button}
        >
          {isActive ? 'Pause' : 'Resume'}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  timerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    minWidth: 120,
  },
});

export default BreakTimer; 