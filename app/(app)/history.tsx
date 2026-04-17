/**
 * History (Shelf) Screen — Trophy shelf + completed task history.
 *
 * Two sections:
 *  1. Trophy Shelf  — completed projects from the XP system (emoji grid + detail cards)
 *  2. Task History  — completed/failed tasks from Supabase
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { LT, TROPHY_ICONS } from '../../constants/lifeTrackerDesign';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from 'expo-router';
import { taskService } from '../../services/supabase/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { Task } from '../../types/task';
import {
  loadXPState, completeProject, removeCompletedProject,
  XPState, CompletedProject, TROPHY_ICONS as XP_TROPHY_ICONS,
} from '../../utils/xpSystem';

// re-export TROPHY_ICONS from design for convenience
// (they're the same list but it's fine to use either)

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtFull(ds: string): string {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [xpState, setXPState] = useState<XPState>({ totalXP: 0, dailyXP: 0, lastDate: '', completedProjects: [] });

  // ── load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const all = await taskService.getTasks(user.id);
      setTasks(all.filter(t => t.status === 'completed' || t.status === 'failed'));
    } catch { setTasks([]); }
    const xs = await loadXPState();
    setXPState(xs);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadData(); }, [user]);
  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const completedProjects = xpState.completedProjects ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: LT.bg }}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>COMPLETED QUESTS</Text>
          <Text style={styles.title}>Shelf</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ paddingTop: 12 }}>
          <Text style={{ color: LT.parchmentFaint, fontSize: 18 }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LT.amber} />}
      >

        {/* ── TROPHY SHELF (XP Projects) ───────────────────────────────── */}
        <Text style={styles.sectionLabel}>TROPHY SHELF</Text>
        <Text style={styles.sectionSub}>Every completed project lives here forever.</Text>

        {completedProjects.length === 0 ? (
          <View style={styles.emptyShelf}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
            <Text style={styles.emptyText}>Your shelf is empty — for now.</Text>
            <Text style={styles.emptySub}>Complete a project to earn your first trophy.</Text>
          </View>
        ) : (
          <>
            {/* emoji grid */}
            <View style={styles.trophyGrid}>
              {completedProjects.map(p => (
                <View key={p.id} style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 36 }}>{p.trophy}</Text>
                  <Text style={styles.trophyName} numberOfLines={2}>
                    {p.name.split(' ').slice(0, 2).join(' ')}
                  </Text>
                </View>
              ))}
            </View>

            {/* detail cards */}
            {[...completedProjects].reverse().map(p => (
              <View key={p.id} style={styles.trophyCard}>
                <Text style={{ fontSize: 34, marginRight: 12 }}>{p.trophy}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trophyCardName}>{p.name}</Text>
                  {p.description ? (
                    <Text style={styles.trophyCardDesc}>{p.description}</Text>
                  ) : null}
                  <Text style={[styles.trophyCardDate, { color: p.color || LT.amber }]}>
                    Completed {fmtFull(p.completedOn)}
                  </Text>
                </View>
                <Text style={styles.trophyCardPct}>100%</Text>
              </View>
            ))}
          </>
        )}

        {/* ── TASK HISTORY ─────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>TASK HISTORY</Text>
            <Text style={styles.sectionSub}>All completed and failed tasks.</Text>
            {loading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : (
              tasks.map(task => (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    { borderLeftColor: task.status === 'completed' ? LT.teal : '#cf6679' },
                  ]}
                >
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  <Text style={[styles.taskStatus, { color: task.status === 'completed' ? LT.teal : '#cf6679' }]}>
                    {task.status === 'completed' ? 'Completed ✓' : 'Failed ✗'}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        {!loading && tasks.length === 0 && completedProjects.length === 0 && (
          <Text style={styles.emptySub}>No history yet. Complete tasks and projects to fill this shelf.</Text>
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
  sectionLabel: { fontSize: 10, color: LT.parchmentFaint, letterSpacing: 2, marginBottom: 2 },
  sectionSub: { fontSize: 10, color: LT.parchmentFaint, marginBottom: 16 },
  emptyShelf: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: { color: LT.parchmentFaint, fontSize: 13, textAlign: 'center' },
  emptySub: { color: LT.parchmentFaint, fontSize: 11, textAlign: 'center', marginTop: 6, opacity: 0.6 },
  trophyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    backgroundColor: LT.surfaceDeep,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 16,
  },
  trophyName: {
    fontSize: 8,
    color: LT.parchmentFaint,
    textAlign: 'center',
    maxWidth: 50,
  },
  trophyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceDeep,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    marginBottom: 10,
  },
  trophyCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: LT.parchmentMuted,
  },
  trophyCardDesc: {
    fontSize: 10,
    color: LT.parchmentFaint,
    marginTop: 2,
  },
  trophyCardDate: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  trophyCardPct: {
    fontSize: 18,
    fontWeight: '700',
    color: LT.teal,
  },
  taskCard: {
    backgroundColor: LT.surfaceDeep,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: LT.outlineFaint,
    borderLeftWidth: 4,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.parchment,
  },
  taskDesc: {
    fontSize: 12,
    color: LT.parchmentMuted,
    marginTop: 4,
  },
  taskStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});
