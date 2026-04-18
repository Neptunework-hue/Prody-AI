/**
 * FocusTimer — RPG-styled SVG ring timer.
 *
 * Renders:
 *  - Session preset selector (25 / 45 / 60 / 90 / custom)
 *  - SVG countdown ring while session is active
 *  - Pause / Resume / End session controls
 *
 * All Supabase session logic preserved.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { focusService } from '../../services/supabase/focus';
import { useAuth } from '../../hooks/useAuth';
import { FocusSession } from '../../types/focus';
import { LT } from '../../constants/lifeTrackerDesign';
import { addXP } from '../../utils/xpSystem';

// ─── constants ───────────────────────────────────────────────────────────────

const PRESETS = [25, 45, 60, 90];

// ─── SVG ring helper ─────────────────────────────────────────────────────────

function Ring({
  size = 120,
  r = 50,
  strokeWidth = 8,
  progress,          // 0–1
  color,
  children,
}: {
  size: number;
  r: number;
  strokeWidth: number;
  progress: number;
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
        {/* track */}
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={LT.outlineFaint} strokeWidth={strokeWidth} />
        {/* fill */}
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
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        {children}
      </View>
    </View>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

interface FocusTimerProps {
  taskId?: string;
  taskTitle?: string;
  onSessionComplete?: () => void;
}

const FocusTimer: React.FC<FocusTimerProps> = ({ taskId, taskTitle, onSessionComplete }) => {
  const { user } = useAuth();

  const [sessionMin, setSessionMin] = useState(25);
  const [customMin, setCustomMin] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);

  // ── countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || isPaused || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); handleComplete(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused]);

  // ── resume active session on mount ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    focusService.getActiveSession(user.id).then(session => {
      if (!session) return;
      setCurrentSession(session);
      setIsActive(true);
      const elapsed = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000);
      const remaining = Math.max(0, sessionMin * 60 - elapsed);
      setTimeLeft(remaining);
      setTotalSeconds(sessionMin * 60);
    }).catch(() => {});
  }, [user]);

  function pickPreset(m: number) {
    setSessionMin(m);
    setTimeLeft(m * 60);
    setTotalSeconds(m * 60);
    setShowCustom(false);
    setCustomMin('');
  }

  function applyCustom() {
    const m = parseInt(customMin);
    if (!m || m < 1 || m > 180) return;
    setSessionMin(m);
    setTimeLeft(m * 60);
    setTotalSeconds(m * 60);
    setShowCustom(false);
  }

  async function handleStart() {
    if (!user) return;
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
      setIsPaused(false);
      setTimeLeft(sessionMin * 60);
      setTotalSeconds(sessionMin * 60);
    } catch { }
  }

  async function handleComplete() {
    if (!currentSession || !user) return;
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
      await addXP(sessionMin);           // 1 XP per planned minute
      setIsActive(false);
      setIsPaused(false);
      setCurrentSession(null);
      setTimeLeft(sessionMin * 60);
      onSessionComplete?.();
    } catch { }
  }

  async function handleEnd() {
    if (!currentSession || !user) return;
    const elapsed = totalSeconds - timeLeft;
    const earnedMin = Math.round(elapsed / 60);
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
      if (earnedMin > 0) await addXP(earnedMin);
      setIsActive(false);
      setIsPaused(false);
      setCurrentSession(null);
      setTimeLeft(sessionMin * 60);
      onSessionComplete?.();
    } catch { }
  }

  const progress = totalSeconds > 0 ? 1 - timeLeft / totalSeconds : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  // ── session active UI ──────────────────────────────────────────────────────
  if (isActive) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Focus session</Text>
        {taskTitle ? <Text style={styles.taskTitle}>"{taskTitle}"</Text> : null}

        <View style={{ alignItems: 'center', marginVertical: 16 }}>
          <Ring size={140} r={58} strokeWidth={10} progress={progress} color={LT.teal}>
            <Text style={styles.countdownTime}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </Text>
            <Text style={styles.countdownSub}>remaining</Text>
          </Ring>
        </View>

        <View style={styles.sessionButtons}>
          {isPaused ? (
            <TouchableOpacity style={[styles.sessionBtn, { backgroundColor: LT.teal }]} onPress={() => setIsPaused(false)}>
              <Text style={[styles.sessionBtnText, { color: LT.bg }]}>resume</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.sessionBtn, { backgroundColor: LT.surfaceDeep, borderWidth: 0.5, borderColor: LT.outlineFaint }]} onPress={() => setIsPaused(true)}>
              <Text style={[styles.sessionBtnText, { color: LT.parchmentMuted }]}>pause</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.sessionBtn, { backgroundColor: LT.surfaceDeep, borderWidth: 0.5, borderColor: LT.outlineFaint }]} onPress={handleEnd}>
            <Text style={[styles.sessionBtnText, { color: LT.parchmentFaint }]}>end session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── setup UI ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Get ready to focus</Text>

      {/* Stepper */}
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => pickPreset(Math.max(5, sessionMin - 5))}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.stepValue}>{sessionMin}</Text>
          <Text style={styles.stepUnit}>mins</Text>
        </View>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => pickPreset(Math.min(180, sessionMin + 5))}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Presets */}
      <View style={styles.presets}>
        {PRESETS.map(m => (
          <TouchableOpacity
            key={m}
            style={[
              styles.presetBtn,
              sessionMin === m && { backgroundColor: LT.teal + '22', borderColor: LT.teal },
            ]}
            onPress={() => pickPreset(m)}
          >
            <Text style={[styles.presetText, sessionMin === m && { color: LT.teal }]}>{m}m</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.presetBtn, showCustom && { borderColor: LT.amber }]}
          onPress={() => setShowCustom(v => !v)}
        >
          <Text style={[styles.presetText, showCustom && { color: LT.amber }]}>…</Text>
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
            style={{ flex: 1, height: 44 }}
            outlineColor={LT.outlineFaint}
            activeOutlineColor={LT.amber}
            textColor={LT.parchment}
          />
          <TouchableOpacity style={[styles.applyBtn]} onPress={applyCustom}>
            <Text style={{ color: LT.bg, fontWeight: '700', fontSize: 12 }}>set</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>Start focus session</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    color: LT.parchmentFaint,
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 12,
    color: LT.parchmentMuted,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  countdownTime: {
    fontSize: 30,
    fontWeight: '700',
    color: LT.parchment,
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    fontSize: 9,
    color: LT.parchmentFaint,
    marginTop: 2,
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
    backgroundColor: LT.surfaceElevated,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 20,
    color: LT.parchmentMuted,
    lineHeight: 24,
  },
  stepValue: {
    fontSize: 36,
    fontWeight: '700',
    color: LT.parchment,
  },
  stepUnit: {
    fontSize: 10,
    color: LT.parchmentFaint,
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
    backgroundColor: LT.bg,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11,
    color: LT.parchmentFaint,
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  applyBtn: {
    backgroundColor: LT.amber,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    backgroundColor: LT.teal,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  startBtnText: {
    color: LT.bg,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default FocusTimer;
