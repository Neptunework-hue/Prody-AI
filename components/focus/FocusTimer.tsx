import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ProgressBar, useTheme, Portal, Dialog, TextInput, SegmentedButtons } from 'react-native-paper';
import { focusService } from '../../services/supabase/focus';
import { useAuth } from '../../hooks/useAuth';
import { FocusSession } from '../../types/focus';
import BreakTimer from './BreakTimer';

interface FocusTimerProps {
  taskId?: string;
  taskTitle?: string;
  onSessionComplete?: () => void;
  onBreakComplete?: () => void;
  isBreak?: boolean;
}

const DEFAULT_DURATIONS = {
  '25m': 25 * 60,
  '45m': 45 * 60,
  '60m': 60 * 60,
  'custom': 0
};

const DEFAULT_BREAK_DURATIONS = {
  '5m': 5 * 60,
  '10m': 10 * 60,
  '15m': 15 * 60,
  'custom': 0
};

const FocusTimer: React.FC<FocusTimerProps> = ({ 
  taskId, 
  taskTitle, 
  onSessionComplete,
  onBreakComplete,
  isBreak = false 
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATIONS['25m']);
  const [isActive, setIsActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('25m');
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedBreakDuration, setSelectedBreakDuration] = useState('5m');
  const [customBreakMinutes, setCustomBreakMinutes] = useState('');
  const [showCustomBreakInput, setShowCustomBreakInput] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(DEFAULT_BREAK_DURATIONS['5m']);
  const [isBreakActive, setIsBreakActive] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, []);

  const loadActiveSession = async () => {
    if (!user) return;
    try {
      const session = await focusService.getActiveSession(user.id);
      if (session) {
        setCurrentSession(session);
        setIsActive(true);
        const startTime = new Date(session.start_time).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        setTimeLeft(Math.max(0, DEFAULT_DURATIONS[selectedDuration] - elapsedSeconds));
      }
    } catch (error) {
      console.error('Error loading active session:', error);
    }
  };

  const handleDurationSelect = (value: string) => {
    setSelectedDuration(value);
    if (value === 'custom') {
      setShowCustomInput(true);
      setTimeLeft(0);
    } else {
      setShowCustomInput(false);
      setTimeLeft(DEFAULT_DURATIONS[value]);
      setCustomMinutes('');
    }
  };

  const handleBreakDurationSelect = (value: string) => {
    setSelectedBreakDuration(value);
    if (value === 'custom') {
      setShowCustomBreakInput(true);
      setBreakTimeLeft(0);
    } else {
      setShowCustomBreakInput(false);
      setBreakTimeLeft(DEFAULT_BREAK_DURATIONS[value]);
      setCustomBreakMinutes('');
    }
  };

  const handleCustomDuration = () => {
    const minutes = parseInt(customMinutes);
    if (minutes > 0 && minutes <= 120) {
      setTimeLeft(minutes * 60);
      setShowCustomInput(false);
    }
  };

  const handleCustomBreakDuration = () => {
    const minutes = parseInt(customBreakMinutes);
    if (minutes > 0 && minutes <= 30) {
      setBreakTimeLeft(minutes * 60);
      setShowCustomBreakInput(false);
    }
  };

  const handleStart = async () => {
    if (!user) return;
    if (selectedDuration === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0 || parseInt(customMinutes) > 120)) {
      return;
    }
    try {
      const session = await focusService.createSession({
        user_id: user.id,
        task_id: taskId,
        start_time: new Date().toISOString(),
        status: 'active',
        interruptions: 0,
        notes: '',
      });
      setCurrentSession(session);
      setIsActive(true);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleStartBreak = () => {
    if (selectedBreakDuration === 'custom' && (!customBreakMinutes || parseInt(customBreakMinutes) <= 0 || parseInt(customBreakMinutes) > 30)) {
      return;
    }
    setIsBreakActive(true);
  };

  const handleComplete = async () => {
    if (!currentSession || !user) return;
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
      setIsActive(false);
      setCurrentSession(null);
      if (onSessionComplete) {
        onSessionComplete();
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleComplete();
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isBreakActive && breakTimeLeft > 0) {
      interval = setInterval(() => {
        setBreakTimeLeft((time) => time - 1);
      }, 1000);
    } else if (breakTimeLeft === 0 && isBreakActive) {
      if (onBreakComplete) {
        onBreakComplete();
      }
    }

    return () => clearInterval(interval);
  }, [isBreakActive, breakTimeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / (DEFAULT_DURATIONS[selectedDuration] || parseInt(customMinutes) * 60);
  const breakProgress = 1 - breakTimeLeft / (DEFAULT_BREAK_DURATIONS[selectedBreakDuration] || parseInt(customBreakMinutes) * 60);

  if (isBreak) {
    if (isBreakActive) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Break Time</Text>
          <Text style={styles.subtitle}>Take a moment to rest and recharge</Text>
          
          <View style={styles.timerContainer}>
            <Text style={styles.timer}>{formatTime(breakTimeLeft)}</Text>
            <ProgressBar
              progress={breakProgress}
              color={theme.colors.primary}
              style={styles.progressBar}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => setIsBreakActive(false)}
              style={styles.button}
            >
              Pause
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setIsBreakActive(false);
                if (onBreakComplete) {
                  onBreakComplete();
                }
              }}
              style={styles.button}
            >
              Skip
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Break Time</Text>
        <Text style={styles.subtitle}>Take a moment to rest and recharge</Text>
        
        <SegmentedButtons
          value={selectedBreakDuration}
          onValueChange={handleBreakDurationSelect}
          buttons={[
            { value: '5m', label: '5m' },
            { value: '10m', label: '10m' },
            { value: '15m', label: '15m' },
            { value: 'custom', label: 'Custom' },
          ]}
          style={styles.durationButtons}
        />
        
        {showCustomBreakInput && (
          <View style={styles.customInputContainer}>
            <TextInput
              label="Minutes (1-30)"
              value={customBreakMinutes}
              onChangeText={setCustomBreakMinutes}
              keyboardType="numeric"
              style={styles.customInput}
              mode="outlined"
            />
            <Button 
              mode="contained" 
              onPress={handleCustomBreakDuration}
              disabled={!customBreakMinutes || parseInt(customBreakMinutes) <= 0 || parseInt(customBreakMinutes) > 30}
            >
              Set
            </Button>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleStartBreak}
          disabled={selectedBreakDuration === 'custom' && (!customBreakMinutes || parseInt(customBreakMinutes) <= 0 || parseInt(customBreakMinutes) > 30)}
          style={styles.button}
        >
          Start Break
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {taskTitle && (
        <Text style={styles.taskTitle}>Focusing on: {taskTitle}</Text>
      )}
      
      {!isActive ? (
        <>
          <Text style={styles.title}>Select Duration</Text>
          <SegmentedButtons
            value={selectedDuration}
            onValueChange={handleDurationSelect}
            buttons={[
              { value: '25m', label: '25m' },
              { value: '45m', label: '45m' },
              { value: '60m', label: '60m' },
              { value: 'custom', label: 'Custom' },
            ]}
            style={styles.durationButtons}
          />
          
          {showCustomInput && (
            <View style={styles.customInputContainer}>
              <TextInput
                label="Minutes (1-120)"
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="numeric"
                style={styles.customInput}
                mode="outlined"
              />
              <Button 
                mode="contained" 
                onPress={handleCustomDuration}
                disabled={!customMinutes || parseInt(customMinutes) <= 0 || parseInt(customMinutes) > 120}
              >
                Set
              </Button>
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleStart}
            disabled={selectedDuration === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0 || parseInt(customMinutes) > 120)}
            style={styles.button}
          >
            Start Focus Session
          </Button>
        </>
      ) : (
        <>
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
              onPress={() => setIsActive(false)}
              style={styles.button}
            >
              Pause
            </Button>
            <Button
              mode="contained"
              onPress={handleComplete}
              style={styles.button}
            >
              Complete
            </Button>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  taskTitle: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
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
  durationButtons: {
    marginBottom: 16,
    width: '100%',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  customInput: {
    width: 120,
  },
});

export default FocusTimer; 