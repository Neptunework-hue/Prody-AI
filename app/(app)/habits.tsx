/**
 * Habits Screen — RPG 14-day dot grid + bank system.
 *
 * Each habit card shows:
 *  - Name, daily goal, optional note
 *  - 14-day dot grid (SVG filled/partial circles)
 *  - Bank pill for surplus units
 *  - Today progress bar + log input
 *
 * Habit data lives in Supabase (habitService).
 * Bank & log data is persisted locally in AsyncStorage (BANK_KEY).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, TextInput as RNTextInput,
} from 'react-native';
import { Text, FAB, Portal, Modal, TextInput, RadioButton, useTheme } from 'react-native-paper';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LT } from '../../constants/lifeTrackerDesign';
import { useAuth } from '../../hooks/useAuth';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { addXP } from '../../utils/xpSystem';

// ─── types & constants ────────────────────────────────────────────────────────

const BANK_KEY = 'prody_habit_logs_v1';
const DAYS_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HABIT_EMOJIS = ['🏃','📚','🧘','💧','🍎','📝','💪','🛏️','🧹','🎨','🎸','🚴','🏊','🥗','🧑‍💻','📖','🦷','🧑‍🍳','🚶','🧑‍🎤','🎮','🧑‍🔬','🧑‍🏫','🧑‍🎓','🧑‍🚀','🧑‍🌾'];
const COLORS = [LT.amber, LT.teal, LT.blue, LT.pink, LT.purple];

type HabitLogs = Record<string, number>;  // key: `${habitId}_${YYYY-MM-DD}` or `${habitId}_bank`

function todayStr() { return new Date().toISOString().split('T')[0]; }

function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
}

function fmtDate(ds: string): string {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function dayLetter(ds: string): string {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
}

// ─── SVG dot (pie-sector fill) ────────────────────────────────────────────────

function DayDot({ ratio, color }: { ratio: number; color: string }) {
  const size = 16, r = 6, cx = 8, cy = 8;
  const angle = Math.min(ratio, 1) * 360;

  if (ratio >= 1) {
    return (
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Circle cx={cx} cy={cy} r={r} fill={color} />
      </Svg>
    );
  }
  if (angle <= 0) {
    return (
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Circle cx={cx} cy={cy} r={r} fill={LT.surfaceElevated} stroke={LT.outlineFaint} strokeWidth={0.5} />
      </Svg>
    );
  }
  // Pie sector
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(0));
  const sy = cy + r * Math.sin(rad(0));
  const ex = cx + r * Math.cos(rad(angle));
  const ey = cy + r * Math.sin(rad(angle));
  const la = angle > 180 ? 1 : 0;
  const d = `M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${la},1 ${ex},${ey} Z`;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={cx} cy={cy} r={r} fill={LT.surfaceElevated} stroke={LT.outlineFaint} strokeWidth={0.5} />
      <Path d={d} fill={color} />
    </Svg>
  );
}

// ─── progress bar ─────────────────────────────────────────────────────────────

function HabitBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <View style={{ height: 4, borderRadius: 99, backgroundColor: LT.outlineFaint, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

// ─── bank modal ───────────────────────────────────────────────────────────────

interface BankModalProps {
  habit: Habit;
  date: string;
  bank: number;
  current: number;
  onApply: (amount: number) => void;
  onClose: () => void;
}

function BankModal({ habit, date, bank, current, onApply, onClose }: BankModalProps) {
  const [val, setVal] = useState('');
  const goal = (habit as any).dailyGoal ?? 20;
  const remaining = Math.max(0, goal - current);
  const max = Math.min(bank, remaining);
  return (
    <View style={styles.bankModalInner}>
      <Text style={styles.bankModalTitle}>Spend from bank</Text>
      <Text style={styles.bankModalSub}>{fmtDate(date)} · {habit.title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={styles.bankInfoBox}>
          <Text style={[styles.bankInfoVal, { color: COLORS[0] }]}>{bank}</Text>
          <Text style={styles.bankInfoLabel}>banked</Text>
        </View>
        <View style={styles.bankInfoBox}>
          <Text style={styles.bankInfoVal}>{remaining}</Text>
          <Text style={styles.bankInfoLabel}>still needed</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <RNTextInput
          value={val}
          onChangeText={setVal}
          placeholder={`Max ${max}`}
          keyboardType="numeric"
          placeholderTextColor={LT.parchmentFaint}
          style={styles.bankInput}
        />
        <TouchableOpacity style={[styles.bankApplyBtn, { backgroundColor: COLORS[0] }]}
          onPress={() => { const n = parseInt(val); if (n > 0) { onApply(Math.min(n, max)); onClose(); } }}>
          <Text style={{ color: LT.bg, fontWeight: '700', fontSize: 12 }}>apply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bankCancelBtn} onPress={onClose}>
          <Text style={{ color: LT.parchmentFaint, fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── default form ─────────────────────────────────────────────────────────────

const defaultForm = {
  title: '', description: '', frequency: 'daily',
  icon: '', days: [0,1,2,3,4,5,6], notifyTime: null as string | null,
  dailyGoal: 20, unit: 'min', color: LT.amber,
};

// ─── main screen ─────────────────────────────────────────────────────────────

export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLogs>({});
  const [logInputs, setLogInputs] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [bankModal, setBankModal] = useState<{ habitId: string; date: string } | null>(null);

  const days14 = getLast14Days();

  // ── load/save logs ────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(BANK_KEY);
      if (raw) setHabitLogs(JSON.parse(raw));
    } catch {}
  }, []);

  const saveLogs = useCallback(async (logs: HabitLogs) => {
    try { await AsyncStorage.setItem(BANK_KEY, JSON.stringify(logs)); } catch {}
  }, []);

  // ── fetch habits ──────────────────────────────────────────────────────────
  const fetchHabits = useCallback(async () => {
    if (!user) return;
    const h = await habitService.getHabits(user.id);
    setHabits(h);
  }, [user]);

  useEffect(() => { fetchHabits(); loadLogs(); }, [fetchHabits, loadLogs]);

  // ── log habit progress ────────────────────────────────────────────────────
  function logHabit(habitId: string) {
    const amt = parseInt(logInputs[habitId] || '');
    if (!amt || amt <= 0) return;
    const habit = habits.find(h => h.id === habitId) as any;
    if (!habit) return;
    const goal = habit.dailyGoal ?? 20;
    const key = `${habitId}_${todayStr()}`;
    const bankKey = `${habitId}_bank`;
    const prev = habitLogs[key] || 0;
    const nv = prev + amt;
    const gain = Math.max(0, nv - goal) - Math.max(0, prev - goal);
    const newLogs: HabitLogs = { ...habitLogs, [key]: nv };
    if (gain > 0) newLogs[bankKey] = (habitLogs[bankKey] || 0) + gain;
    // Award XP when goal first crossed today
    if (prev < goal && nv >= goal) addXP(5);
    setHabitLogs(newLogs);
    saveLogs(newLogs);
    setLogInputs(v => ({ ...v, [habitId]: '' }));
    // Also persist to Supabase for history
    habitService.logHabitProgress(habitId, todayStr(), 1).catch(() => {});
  }

  // ── spend from bank ───────────────────────────────────────────────────────
  function spendBank(habitId: string, date: string, amount: number) {
    const bankKey = `${habitId}_bank`;
    const dateKey = `${habitId}_${date}`;
    const bank = habitLogs[bankKey] || 0;
    const prev = habitLogs[dateKey] || 0;
    const actual = Math.min(amount, bank);
    const newLogs: HabitLogs = {
      ...habitLogs,
      [dateKey]: prev + actual,
      [bankKey]: bank - actual,
    };
    setHabitLogs(newLogs);
    saveLogs(newLogs);
  }

  // ── save habit ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !form.title) return;
    let notificationId: string | undefined;
    try {
      if (form.notifyTime) {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') await Notifications.requestPermissionsAsync();
        const nd = new Date(form.notifyTime);
        if (nd < new Date()) nd.setDate(nd.getDate() + 1);
        notificationId = await Notifications.scheduleNotificationAsync({
          content: { title: form.title, body: form.description || 'Habit Reminder', sound: true },
          trigger: { hour: nd.getHours(), minute: nd.getMinutes(), repeats: true } as any,
        });
      }
      await habitService.addHabit({
        user_id: user.id,
        userId: user.id,
        title: form.title,
        description: form.description,
        progress: 0,
        frequency: form.frequency as 'daily' | 'weekly' | 'monthly',
        icon: form.icon,
        streak: 0,
        history: [],
        days: form.frequency === 'daily' ? [0,1,2,3,4,5,6] : form.days,
        notifyTime: form.notifyTime,
        notification_id: notificationId,
        // extra fields stored in habit object for local use
        dailyGoal: form.dailyGoal,
        unit: form.unit,
        color: form.color,
      } as any);
      setModalVisible(false);
      setForm({ ...defaultForm });
      fetchHabits();
    } catch (e: any) { alert('Error creating habit: ' + (e.message || e)); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: LT.bg, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT }}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>DAILY RITUALS</Text>
          <Text style={styles.title}>Habits</Text>
        </View>
      </View>
      <Text style={styles.headerSub}>Surplus goes to your bank. Tap a past incomplete dot to fill it.</Text>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 80 }}>
        {habits.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 36 }}>🌱</Text>
            <Text style={{ color: LT.parchmentFaint, marginTop: 12 }}>No habits yet.</Text>
          </View>
        )}

        {habits.map((habit: any, idx) => {
          const color = habit.color || COLORS[idx % COLORS.length];
          const goal = habit.dailyGoal ?? 20;
          const unit = habit.unit ?? 'units';
          const bankKey = `${habit.id}_bank`;
          const bank = habitLogs[bankKey] || 0;
          const todayKey = `${habit.id}_${todayStr()}`;
          const todayVal = habitLogs[todayKey] || 0;

          return (
            <View key={habit.id} style={styles.habitCard}>
              {/* header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{habit.icon ? `${habit.icon} ` : ''}{habit.title}</Text>
                  <Text style={styles.habitGoal}>Goal: {goal} {unit}/day</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {bank > 0 && (
                    <View style={[styles.bankPill, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.bankPillText, { color }]}>{bank} {unit} banked</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={async () => {
                    await habitService.deleteHabit(habit.id);
                    fetchHabits();
                  }}>
                    <Text style={{ color: LT.parchmentFaint, fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 14-day dot grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {days14.map(d => {
                  const val = habitLogs[`${habit.id}_${d}`] || 0;
                  const ratio = val / goal;
                  const isToday = d === todayStr();
                  const isPast = d < todayStr();
                  const canSpend = isPast && ratio < 1 && bank > 0;
                  return (
                    <TouchableOpacity
                      key={d}
                      activeOpacity={canSpend ? 0.7 : 1}
                      onPress={() => canSpend && setBankModal({ habitId: habit.id, date: d })}
                      style={{ alignItems: 'center', gap: 2, opacity: isToday ? 1 : isPast ? 0.9 : 0.35 }}
                    >
                      <DayDot ratio={ratio} color={canSpend ? color : ratio >= 1 ? color : LT.parchmentFaint} />
                      <Text style={{ fontSize: 7, color: isToday ? color : LT.outlineFaint }}>{dayLetter(d)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.dotHint}>14 days · tap incomplete past dot to fill with bank</Text>

              {/* today progress */}
              <View style={{ borderTopWidth: 0.5, borderTopColor: LT.outlineFaint, paddingTop: 10, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={styles.todayLabel}>Today: {todayVal} / {goal} {unit}</Text>
                  {todayVal >= goal && <Text style={[styles.todayLabel, { color }]}>complete ✓</Text>}
                </View>
                <HabitBar value={todayVal} max={goal} color={color} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <RNTextInput
                    value={logInputs[habit.id] || ''}
                    onChangeText={t => setLogInputs(v => ({ ...v, [habit.id]: t }))}
                    placeholder={`Log ${unit}...`}
                    placeholderTextColor={LT.parchmentFaint}
                    keyboardType="numeric"
                    style={styles.logInput}
                  />
                  <TouchableOpacity
                    style={[styles.logBtn, { backgroundColor: color }]}
                    onPress={() => logHabit(habit.id)}
                  >
                    <Text style={{ color: LT.bg, fontWeight: '700', fontSize: 12 }}>log</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <FAB
        icon="plus"
        style={styles.fab}
        color={LT.bg}
        onPress={() => setModalVisible(true)}
        label="Add Habit"
      />

      {/* ── CREATE HABIT MODAL ───────────────────────────────────────────── */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {/* emoji picker trigger */}
            <TouchableOpacity style={styles.emojiCircle} onPress={() => setEmojiPickerVisible(true)} activeOpacity={0.7}>
              <Text style={{ fontSize: 40 }}>{form.icon || '🏃'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Habit</Text>

            <TextInput label="Title" value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} style={{ marginBottom: 12 }} />
            <TextInput label="Description" value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} multiline numberOfLines={2} style={{ marginBottom: 12 }} />

            {/* daily goal & unit */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput label="Daily goal" value={String(form.dailyGoal)} keyboardType="numeric"
                onChangeText={t => setForm(f => ({ ...f, dailyGoal: parseInt(t) || 20 }))} style={{ flex: 1 }} />
              <TextInput label="Unit" value={form.unit} onChangeText={t => setForm(f => ({ ...f, unit: t }))} style={{ flex: 1 }} />
            </View>

            {/* color picker */}
            <Text style={{ color: LT.parchmentMuted, marginBottom: 6 }}>Color</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderWidth: form.color === c ? 3 : 0, borderColor: LT.parchment }]}
                  onPress={() => setForm(f => ({ ...f, color: c }))} />
              ))}
            </View>

            {/* frequency */}
            <Text style={{ color: LT.parchmentMuted, marginBottom: 4 }}>Frequency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <RadioButton.Group onValueChange={v => setForm(f => ({ ...f, frequency: v }))} value={form.frequency}>
                <View style={{ flexDirection: 'row' }}>
                  <RadioButton.Item label="Daily" value="daily" position="leading" style={{ marginRight: 8 }} />
                  <RadioButton.Item label="Weekly" value="weekly" position="leading" style={{ marginRight: 8 }} />
                  <RadioButton.Item label="Monthly" value="monthly" position="leading" />
                </View>
              </RadioButton.Group>
            </ScrollView>

            {/* notify time */}
            <Text style={{ color: LT.parchmentMuted, marginBottom: 4 }}>Reminder</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={{ color: form.notifyTime ? LT.parchment : LT.parchmentFaint }}>
                {form.notifyTime ? new Date(form.notifyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pick a time (optional)'}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={form.notifyTime ? new Date(form.notifyTime) : new Date()}
                mode="time" display="default"
                onChange={(_, d) => { setShowTimePicker(false); if (d) setForm(f => ({ ...f, notifyTime: d.toISOString() })); }}
              />
            )}

            <TouchableOpacity style={styles.createBtn} onPress={handleSave}>
              <Text style={{ color: LT.bg, fontWeight: '700', fontSize: 14 }}>Create Habit</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* emoji picker sub-modal */}
          <Portal>
            <Modal visible={emojiPickerVisible} onDismiss={() => setEmojiPickerVisible(false)} contentContainerStyle={styles.emojiModal}>
              <Text style={styles.modalTitle}>Pick an Emoji</Text>
              <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {HABIT_EMOJIS.map((e, i) => (
                  <TouchableOpacity key={e + i} style={styles.emojiOption}
                    onPress={() => { setForm(f => ({ ...f, icon: e })); setEmojiPickerVisible(false); }}>
                    <Text style={{ fontSize: 30 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Modal>
          </Portal>
        </Modal>

        {/* ── BANK MODAL ──────────────────────────────────────────────────── */}
        {bankModal && (() => {
          const habit = habits.find(h => h.id === bankModal.habitId) as any;
          if (!habit) return null;
          const goal = habit.dailyGoal ?? 20;
          const bank = habitLogs[`${habit.id}_bank`] || 0;
          const current = habitLogs[`${habit.id}_${bankModal.date}`] || 0;
          return (
            <Modal
              visible={!!bankModal}
              onDismiss={() => setBankModal(null)}
              contentContainerStyle={styles.bankModalOuter}
            >
              <BankModal
                habit={habit}
                date={bankModal.date}
                bank={bank}
                current={current}
                onApply={(amount) => spendBank(bankModal.habitId, bankModal.date, amount)}
                onClose={() => setBankModal(null)}
              />
            </Modal>
          );
        })()}
      </Portal>

      <BottomNavBar />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LT.surfaceDeep,
  },
  eyebrow: { fontSize: 10, color: LT.parchmentFaint, letterSpacing: 2, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: LT.parchment },
  headerSub: { fontSize: 10, color: LT.parchmentFaint, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 },
  habitCard: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 12,
  },
  habitName: { fontSize: 13, fontWeight: '600', color: LT.parchmentMuted },
  habitGoal: { fontSize: 10, color: LT.parchmentFaint, marginTop: 2 },
  bankPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  bankPillText: { fontSize: 10, fontWeight: '500' },
  dotHint: { fontSize: 9, color: LT.outlineFaint, marginBottom: 8 },
  todayLabel: { fontSize: 10, color: LT.parchmentFaint },
  logInput: {
    flex: 1,
    backgroundColor: LT.bg,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: LT.parchmentMuted,
    fontSize: 12,
  },
  logBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 24,
    backgroundColor: LT.amber,
    zIndex: 10,
  },
  modal: {
    backgroundColor: LT.surfaceDeep,
    padding: 24,
    margin: 24,
    borderRadius: 16,
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: LT.parchment,
    marginBottom: 12,
    textAlign: 'center',
  },
  emojiCircle: {
    alignSelf: 'center',
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: LT.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, marginTop: 8,
    borderWidth: 2, borderColor: LT.outline,
  },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  timeBtn: {
    borderWidth: 0.5, borderColor: LT.outline,
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  createBtn: {
    backgroundColor: LT.amber, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  emojiModal: {
    backgroundColor: LT.surfaceDeep,
    padding: 24, margin: 24, borderRadius: 16,
    maxWidth: 400, alignSelf: 'center',
    borderWidth: 0.5, borderColor: LT.outlineFaint,
  },
  emojiOption: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    margin: 6, backgroundColor: LT.surface,
    borderWidth: 1, borderColor: LT.outline,
  },
  bankModalOuter: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bankModalInner: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 14,
    padding: 20,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    width: '100%',
    maxWidth: 320,
  },
  bankModalTitle: { fontSize: 13, color: LT.parchmentMuted, fontWeight: '600', marginBottom: 3 },
  bankModalSub: { fontSize: 11, color: LT.parchmentFaint, marginBottom: 12 },
  bankInfoBox: {
    flex: 1, backgroundColor: LT.bg, borderRadius: 8,
    padding: 8, alignItems: 'center',
  },
  bankInfoVal: { fontWeight: '600', fontSize: 15, color: LT.parchmentMuted },
  bankInfoLabel: { fontSize: 10, color: LT.parchmentFaint },
  bankInput: {
    flex: 1, backgroundColor: LT.bg,
    borderWidth: 0.5, borderColor: LT.outlineFaint,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    color: LT.parchmentMuted, fontSize: 12,
  },
  bankApplyBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  bankCancelBtn: {
    backgroundColor: LT.surfaceElevated, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    alignItems: 'center', justifyContent: 'center',
  },
});
