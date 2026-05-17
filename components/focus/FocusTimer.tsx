/**
 * FocusTimer — RPG-styled SVG ring timer (matches Lydia reference UI).
 * Presets 25 / 45 / 60 / 90 + custom, stepper, pause / resume / end session; Supabase session lifecycle preserved.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Vibration } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { focusService } from '../../services/supabase/focus';
import { useAuth } from '../../hooks/useAuth';
import { soundComplete, tapMedium, tapHeavy, tap } from '../../utils/feedback';
import { FocusSession } from '../../types/focus';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';

const PRESETS = [25, 45, 60, 90] as const;

function Ring({
  size = 120,
  r = 50,
  strokeWidth = 8,
  progress,
  trackColor,
  color,
  children,
}: {
  size: number;
  r: number;
  strokeWidth: number;
  progress: number;
  trackColor: string;
  color: string;
  children?: React.ReactNode;
}) {
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

interface FocusTimerProps {
  taskId?: string;
  taskTitle?: string;
  onSessionComplete?: () => void;
}

function createFocusTimerStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surf,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.borderDefault,
      marginBottom: 16,
    },
    cardLabel: {
      fontSize: 11,
      color: c.parchmentFaint,
      marginBottom: 12,
      fontFamily: FONT_SERIF,
    },
    taskTitle: {
      fontSize: 12,
      color: c.parchmentMuted,
      fontStyle: 'italic',
      marginBottom: 8,
      textAlign: 'center',
      fontFamily: FONT_SERIF,
    },
    countdownTime: {
      fontSize: 30,
      fontWeight: '700',
      color: c.parchment,
      fontVariant: ['tabular-nums'],
      fontFamily: FONT_SERIF,
    },
    countdownSub: {
      fontSize: 9,
      color: c.parchmentFaint,
      marginTop: 2,
      fontFamily: FONT_SERIF,
    },
    sessionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    sessionBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: 'center',
    },
    sessionBtnText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: FONT_SERIF,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 16,
    },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.surfaceDeep,
      borderWidth: 1,
      borderColor: c.borderDefault,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontSize: 20,
      color: c.parchmentMuted,
      lineHeight: 24,
      fontFamily: FONT_SERIF,
    },
    stepValue: {
      fontSize: 36,
      fontWeight: '700',
      color: c.parchment,
      fontFamily: FONT_SERIF,
    },
    stepUnit: {
      fontSize: 10,
      color: c.parchmentFaint,
      fontFamily: FONT_SERIF,
    },
    presets: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 14,
    },
    presetBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.surfaceDeep,
      borderWidth: 1,
      borderColor: c.borderDefault,
      alignItems: 'center',
    },
    presetText: {
      fontSize: 11,
      color: c.parchmentFaint,
      fontFamily: FONT_SERIF,
    },
    customRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginBottom: 14,
    },
    applyBtn: {
      backgroundColor: c.amber,
      borderRadius: 8,
      paddingHorizontal: 14,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnText: {
      color: c.onAccent,
      fontWeight: '700',
      fontSize: 12,
      fontFamily: FONT_SERIF,
    },
    startBtn: {
      backgroundColor: c.amber,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    startBtnText: {
      color: c.onAccent,
      fontWeight: '700',
      fontSize: 14,
      fontFamily: FONT_SERIF,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCard: {
      width: 300,
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 28,
      alignItems: 'center',
      gap: 8,
    },
    modalEmoji: {
      fontSize: 48,
      marginBottom: 4,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      fontFamily: FONT_SERIF,
    },
    modalSub: {
      fontSize: 14,
      fontFamily: FONT_SERIF,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalBtn: {
      marginTop: 8,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 40,
    },
    modalBtnText: {
      fontWeight: '700',
      fontSize: 15,
      fontFamily: FONT_SERIF,
    },
  });
}

const FocusTimer: React.FC<FocusTimerProps> = ({ taskId, taskTitle, onSessionComplete }) => {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createFocusTimerStyles(c), [c]);
  const { user } = useAuth();

  const [sessionMin, setSessionMin] = useState(25);
  const [customMin, setCustomMin] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [completedMin, setCompletedMin] = useState(0);

  const currentSessionRef = useRef<FocusSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const completingRef = useRef(false);

  const handleComplete = useCallback(async () => {
    if (completingRef.current) return;
    const session = currentSessionRef.current;
    if (!session || !user) return;
    completingRef.current = true;
    try {
      await focusService.completeSession(session.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
    } catch {
      /* ignore network errors */
    } finally {
      completingRef.current = false;
      // buzz pattern: on 500ms, off 200ms, on 500ms, off 200ms, on 500ms
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      soundComplete();
      setCompletedMin(sessionMin);
      setShowComplete(true);
      setIsActive(false);
      setIsPaused(false);
      setCurrentSession(null);
      setTimeLeft(sessionMin * 60);
      setTotalSeconds(sessionMin * 60);
      onSessionComplete?.();
    }
  }, [user, sessionMin, onSessionComplete]);

  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // Countdown tick — just decrements, no side effects
  useEffect(() => {
    if (!isActive || isPaused || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused]);

  // Completion trigger — fires when timeLeft reaches 0
  useEffect(() => {
    if (isActive && !isPaused && timeLeft === 0) {
      void handleCompleteRef.current();
    }
  }, [timeLeft, isActive, isPaused]);

  // Restore active session on mount
  useEffect(() => {
    if (!user) return;
    focusService
      .getActiveSession(user.id)
      .then((session) => {
        if (!session) return;
        // Parse planned duration stored in notes (e.g. "25")
        const plannedMin = parseInt(session.notes || '', 10);
        const duration = plannedMin > 0 ? plannedMin : 25;
        const elapsed = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000);
        const remaining = duration * 60 - elapsed;
        if (remaining <= 0) {
          // Session already expired — complete it immediately
          currentSessionRef.current = session;
          void handleCompleteRef.current();
          return;
        }
        setCurrentSession(session);
        setSessionMin(duration);
        setIsActive(true);
        setTimeLeft(remaining);
        setTotalSeconds(duration * 60);
      })
      .catch(() => {});
  }, [user]);

  function pickPreset(m: number) {
    tap();
    setSessionMin(m);
    setTimeLeft(m * 60);
    setTotalSeconds(m * 60);
    setShowCustom(false);
    setCustomMin('');
  }

  function applyCustom() {
    const m = parseInt(customMin, 10);
    if (!m || m < 1 || m > 180) return;
    setSessionMin(m);
    setTimeLeft(m * 60);
    setTotalSeconds(m * 60);
    setShowCustom(false);
  }

  async function handleStart() {
    if (!user) return;
    tapMedium();
    try {
      const session = await focusService.createSession({
        user_id: user.id,
        task_id: taskId,
        start_time: new Date().toISOString(),
        status: 'active',
        interruptions: 0,
        notes: String(sessionMin), // store planned duration for restore
      });
      setCurrentSession(session);
      setIsActive(true);
      setIsPaused(false);
      setTimeLeft(sessionMin * 60);
      setTotalSeconds(sessionMin * 60);
    } catch {
      /* ignore */
    }
  }

  async function handleEnd() {
    if (!currentSession || !user) return;
    tapHeavy();
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
      setIsActive(false);
      setIsPaused(false);
      setCurrentSession(null);
      setTimeLeft(sessionMin * 60);
      setTotalSeconds(sessionMin * 60);
      onSessionComplete?.();
    } catch {
      /* ignore */
    }
  }

  const progress = totalSeconds > 0 ? 1 - timeLeft / totalSeconds : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const tealTint = `${c.teal}22`;
  const xpEarned = completedMin;

  return (
    <>
      {/* ── Timer complete modal ── */}
      <Modal
        visible={showComplete}
        transparent
        animationType="fade"
        onRequestClose={() => { Vibration.cancel(); setShowComplete(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surfaceDeep, borderColor: c.teal }]}>
            <Text style={[styles.modalEmoji]}>🎯</Text>
            <Text style={[styles.modalTitle, { color: c.teal }]}>Session Complete!</Text>
            <Text style={[styles.modalSub, { color: c.parchmentMuted }]}>
              {completedMin} min focused · +{xpEarned} XP earned
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: c.teal }]}
              onPress={() => { Vibration.cancel(); setShowComplete(false); }}
            >
              <Text style={[styles.modalBtnText, { color: c.onAccent }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isActive ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Focus session</Text>
          {taskTitle ? <Text style={styles.taskTitle}>&ldquo;{taskTitle}&rdquo;</Text> : null}

          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Ring
              size={140}
              r={58}
              strokeWidth={10}
              progress={progress}
              trackColor={c.outlineFaint}
              color={c.teal}
            >
              <Text style={styles.countdownTime}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </Text>
              <Text style={styles.countdownSub}>remaining</Text>
            </Ring>
          </View>

          <View style={styles.sessionButtons}>
            {isPaused ? (
              <TouchableOpacity
                style={[styles.sessionBtn, { backgroundColor: c.teal }]}
                onPress={() => setIsPaused(false)}
              >
                <Text style={[styles.sessionBtnText, { color: c.onAccent }]}>resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sessionBtn,
                  { backgroundColor: c.surfaceDeep, borderWidth: 0.5, borderColor: c.outlineFaint },
                ]}
                onPress={() => setIsPaused(true)}
              >
                <Text style={[styles.sessionBtnText, { color: c.parchmentMuted }]}>pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.sessionBtn,
                { backgroundColor: c.surfaceDeep, borderWidth: 0.5, borderColor: c.outlineFaint },
              ]}
              onPress={handleEnd}
            >
              <Text style={[styles.sessionBtnText, { color: c.parchmentFaint }]}>end session</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Get ready to focus</Text>

      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => pickPreset(Math.max(5, sessionMin - 5))}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.stepValue}>{sessionMin}</Text>
          <Text style={styles.stepUnit}>mins</Text>
        </View>
        <TouchableOpacity style={styles.stepBtn} onPress={() => pickPreset(Math.min(180, sessionMin + 5))}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.presets}>
        {PRESETS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[
              styles.presetBtn,
              sessionMin === m && { backgroundColor: tealTint, borderColor: c.teal },
            ]}
            onPress={() => pickPreset(m)}
          >
            <Text style={[styles.presetText, sessionMin === m && { color: c.teal }]}>{m}m</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.presetBtn, showCustom && { borderColor: c.amber }]}
          onPress={() => setShowCustom((v) => !v)}
        >
          <Text style={[styles.presetText, showCustom && { color: c.amber }]}>…</Text>
        </TouchableOpacity>
      </View>

      {showCustom && (
        <View style={styles.customRow}>
          <TextInput
            mode="outlined"
            label="mins (1–180)"
            value={customMin}
            onChangeText={setCustomMin}
            keyboardType="numeric"
            style={{ flex: 1, height: 44, backgroundColor: c.surfaceDeep }}
            outlineColor={c.outlineFaint}
            activeOutlineColor={c.amber}
            textColor={c.parchment}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={applyCustom}>
            <Text style={styles.applyBtnText}>set</Text>
          </TouchableOpacity>
        </View>
      )}

          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startBtnText}>Start focus session</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

export default FocusTimer;
