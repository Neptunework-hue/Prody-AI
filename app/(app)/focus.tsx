/**
 * Focus Screen — RPG deep-work tracker.
 *
 * Sections:
 *  1. Stats row  (yesterday / daily goal / streak)
 *  2. Daily ring (SVG circle showing today's focus % toward goal)
 *  3. Weekly bar chart (toggleable via "daily goal" card tap)
 *  4. FocusTimer component (session setup + active countdown ring)
 *  5. Goal selector  (1h / 2h / 3h / 4h)
 *  6. Recent sessions list
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LT } from '../../constants/lifeTrackerDesign';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { FocusSession, FocusSessionStats } from '../../types/focus';
import FocusTimer from '../../components/focus/FocusTimer';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';

// ─── constants & helpers ──────────────────────────────────────────────────────

const GOAL_KEY = 'prody_focus_goal_min';
const LOG_KEY  = 'prody_focus_logs';
const DEFAULT_GOAL = 180;   // 3 h

function todayStr() { return new Date().toISOString().split('T')[0]; }

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function dayLetter(ds: string): string {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
}

function fmtMins(m: number): string {
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0 && mins > 0) return `${h}h ${mins}m`;
  if (h > 0) return `${h}h`;
  return `${mins}m`;
}

// ─── SVG ring ─────────────────────────────────────────────────────────────────

function DailyRing({
  pct, todayMin, goalMin, active, onPress,
}: {
  pct: number; todayMin: number; goalMin: number; active: boolean; onPress: () => void;
}) {
  const size = 200, r = 82, cx = 100;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, pct / 100)));
  return (
    <TouchableOpacity style={{ alignItems: 'center' }} activeOpacity={0.8} onPress={onPress}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={cx} cy={cx} r={r} fill="none" stroke={LT.surfaceElevated} strokeWidth={14} />
          <Circle cx={cx} cy={cx} r={r} fill="none" stroke={LT.teal} strokeWidth={14}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 10, color: LT.parchmentFaint, marginBottom: 2 }}>Deep work</Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: LT.parchment }}>{fmtMins(todayMin)}</Text>
          <Text style={{ fontSize: 10, color: LT.parchmentFaint }}>of {fmtMins(goalMin)} goal</Text>
          {!active && <Text style={{ fontSize: 10, color: LT.teal, marginTop: 6 }}>tap to start</Text>}
        </View>
      </View>
      <Text style={{ fontSize: 10, color: LT.parchmentFaint, marginTop: 4 }}>
        Completed: {todayMin} minutes
      </Text>
    </TouchableOpacity>
  );
}

// ─── weekly bar chart ─────────────────────────────────────────────────────────

function WeeklyBars({ logs, goal, bank }: { logs: Record<string, number>; goal: number; bank: number }) {
  const days = getLast7Days();
  const today = todayStr();
  return (
    <View style={styles.weekCard}>
      <Text style={styles.weekLabel}>WEEKLY BUCKETS</Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginBottom: 16 }}>
        {days.map(d => {
          const mins = logs[d] || 0;
          const pct = Math.min(100, Math.round((mins / goal) * 100));
          const isToday = d === today;
          const color = pct >= 100 ? LT.teal : pct >= 50 ? LT.amber : LT.outlineFaint;
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 9, color: isToday ? LT.amber : LT.parchmentFaint }}>{pct}%</Text>
              <View style={{ width: '100%', backgroundColor: LT.surfaceElevated, borderRadius: 4, height: 60, justifyContent: 'flex-end', overflow: 'hidden' }}>
                <View style={{ width: '100%', height: `${pct}%`, backgroundColor: color, borderRadius: 4, minHeight: pct > 0 ? 3 : 0 }} />
              </View>
              <Text style={{ fontSize: 8, color: isToday ? LT.amber : LT.parchmentFaint }}>{dayLetter(d)}</Text>
            </View>
          );
        })}
      </View>
      {bank > 0 && (
        <View style={styles.bankRow}>
          <Text style={{ fontSize: 11, color: LT.parchmentFaint }}>Banked focus time</Text>
          <Text style={{ fontSize: 12, color: LT.amber, fontWeight: '600' }}>{bank} min</Text>
        </View>
      )}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusSessionStats>({
    total_sessions: 0, total_duration: 0, average_duration: 0,
    total_interruptions: 0, average_interruptions: 0, completion_rate: 0, longest_streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Local focus logs (keyed by YYYY-MM-DD, value = minutes)
  const [focusLogs, setFocusLogs] = useState<Record<string, number>>({});
  const [goalMin, setGoalMin] = useState(DEFAULT_GOAL);
  const [showWeekly, setShowWeekly] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  // ── load persisted goal & logs ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const g = await AsyncStorage.getItem(GOAL_KEY);
        if (g) setGoalMin(parseInt(g));
        const l = await AsyncStorage.getItem(LOG_KEY);
        if (l) setFocusLogs(JSON.parse(l));
      } catch {}
    })();
  }, []);

  const saveLogs = useCallback(async (logs: Record<string, number>) => {
    try { await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs)); } catch {}
  }, []);

  const saveGoal = useCallback(async (m: number) => {
    try { await AsyncStorage.setItem(GOAL_KEY, String(m)); } catch {}
  }, []);

  // ── supabase data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [s, st] = await Promise.all([
        focusService.getSessions(user.id),
        focusService.getStats(user.id),
      ]);
      setSessions(s);
      setStats(st);

      // Sync daily minutes from Supabase sessions into local logs
      const today = todayStr();
      const todaySessions = s.filter(sess => sess.start_time.startsWith(today) && sess.status === 'completed');
      const todayMin = todaySessions.reduce((acc, sess) => {
        if (!sess.end_time) return acc;
        return acc + Math.round((new Date(sess.end_time).getTime() - new Date(sess.start_time).getTime()) / 60000);
      }, 0);
      setFocusLogs(prev => {
        const next = { ...prev, [today]: todayMin };
        saveLogs(next);
        return next;
      });
    } catch { } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [user]);
  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── derived values ────────────────────────────────────────────────────────
  const today = todayStr();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
  const todayMin = focusLogs[today] || 0;
  const yesterdayMin = focusLogs[yesterday] || 0;
  const focusPct = Math.round((todayMin / goalMin) * 100);
  const bank = focusLogs['focus_bank'] || 0;

  const focusStreak = (() => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().split('T')[0];
      if ((focusLogs[ds] || 0) >= goalMin) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    return streak;
  })();

  const formatDuration = (minutes: number) => fmtMins(minutes);

  return (
    <View style={{ flex: 1, backgroundColor: LT.bg }}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>DEEP WORK</Text>
          <Text style={styles.title}>Focus</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ paddingTop: 12 }}>
          <Text style={{ color: LT.parchmentFaint, fontSize: 18 }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LT.amber} />}
      >
        {/* ── STATS ROW ─────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            {
              label: 'Yesterday',
              val: yesterdayMin > 0 ? fmtMins(yesterdayMin) : '—',
              color: yesterdayMin >= goalMin ? LT.teal : LT.parchmentFaint,
            },
            {
              label: 'Daily goal',
              val: fmtMins(goalMin),
              color: LT.amber,
              tappable: true,
            },
            {
              label: 'Streak',
              val: `${focusStreak} days`,
              color: focusStreak > 0 ? LT.pink : LT.parchmentFaint,
            },
          ].map(({ label, val, color, tappable }) => (
            <TouchableOpacity
              key={label}
              style={[styles.statCard, tappable && showWeekly && { borderColor: LT.amber }]}
              activeOpacity={tappable ? 0.7 : 1}
              onPress={tappable ? () => setShowWeekly(v => !v) : undefined}
            >
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={[styles.statVal, { color }]}>{val}</Text>
              {tappable && <Text style={{ fontSize: 8, color: LT.parchmentFaint, marginTop: 2 }}>tap to expand</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── WEEKLY CHART ──────────────────────────────────────────────── */}
        {showWeekly && <WeeklyBars logs={focusLogs} goal={goalMin} bank={bank} />}

        {/* ── DAILY RING ────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginVertical: 16 }}>
          <DailyRing
            pct={focusPct}
            todayMin={todayMin}
            goalMin={goalMin}
            active={timerActive}
            onPress={() => !timerActive && setTimerActive(true)}
          />
        </View>

        {/* ── FOCUS TIMER ───────────────────────────────────────────────── */}
        <FocusTimer
          taskId={params.taskId as string}
          taskTitle={params.taskTitle as string}
          onSessionComplete={() => { setTimerActive(false); loadData(); }}
        />

        {/* ── GOAL EDITOR ───────────────────────────────────────────────── */}
        <View style={styles.goalCard}>
          <View>
            <Text style={styles.goalCardLabel}>Daily deep work goal</Text>
            <Text style={styles.goalCardSub}>Currently {fmtMins(goalMin)}</Text>
          </View>
          <View style={styles.goalBtns}>
            {[60, 120, 180, 240].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.goalBtn, goalMin === m && { backgroundColor: LT.amber + '22', borderColor: LT.amber }]}
                onPress={() => { setGoalMin(m); saveGoal(m); }}
              >
                <Text style={[styles.goalBtnText, goalMin === m && { color: LT.amber }]}>{m / 60}h</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── RECENT SESSIONS ───────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
            {sessions.slice(0, 5).map(session => {
              const startMs = new Date(session.start_time).getTime();
              const endMs = session.end_time ? new Date(session.end_time).getTime() : Date.now();
              const dur = Math.floor((endMs - startMs) / 60000);
              return (
                <View key={session.id} style={styles.sessionItem}>
                  <Text style={styles.sessionDate}>{session.start_time.slice(0, 10)}</Text>
                  <Text style={styles.sessionTime}>
                    {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {session.end_time ? ` → ${new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                  </Text>
                  <Text style={styles.sessionDur}>{formatDuration(dur)}</Text>
                  {session.notes ? <Text style={styles.sessionNotes}>{session.notes}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: LT.surfaceDeep,
  },
  eyebrow: { fontSize: 10, color: LT.parchmentFaint, letterSpacing: 2, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: LT.parchment },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: LT.surfaceDeep,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: LT.parchmentFaint, marginBottom: 4 },
  statVal: { fontSize: 15, fontWeight: '600' },
  weekCard: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 20,
  },
  weekLabel: { fontSize: 10, color: LT.parchmentFaint, letterSpacing: 2, marginBottom: 12 },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LT.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LT.surfaceDeep,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 16,
  },
  goalCardLabel: { fontSize: 11, color: LT.parchmentMuted },
  goalCardSub: { fontSize: 10, color: LT.parchmentFaint, marginTop: 2 },
  goalBtns: { flexDirection: 'row', gap: 4 },
  goalBtn: {
    backgroundColor: LT.bg,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  goalBtnText: { fontSize: 10, color: LT.parchmentFaint },
  sectionLabel: { fontSize: 10, color: LT.parchmentFaint, letterSpacing: 2, marginBottom: 10 },
  sessionItem: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
  },
  sessionDate: { fontSize: 13, fontWeight: '700', color: LT.parchment, marginBottom: 2 },
  sessionTime: { fontSize: 11, color: LT.parchmentMuted, marginBottom: 2 },
  sessionDur: { fontSize: 11, color: LT.parchmentMuted },
  sessionNotes: { fontSize: 11, color: LT.parchmentFaint, fontStyle: 'italic', marginTop: 4 },
});
