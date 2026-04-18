import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { FONT_SERIF } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import ThemeModeToggle from '../../components/ThemeModeToggle';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import Sidebar from '../../components/Sidebar';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { offlineTaskService } from '../../services/offline/taskService';
import { habitService } from '../../services/supabase/habitService';
import { useFocusEffect } from 'expo-router';
import { Task } from '../../types/task';
import { FocusSession } from '../../types/focus';
import { Habit } from '../../types/habit';
import { taskXpValue } from '../../components/tasks/TaskCardWithSubtasks';
import StatsMultiLineChart, {
  StatsSeriesKey,
  StatsSeries,
  StatsVisibility,
} from '../../components/statistics/StatsMultiLineChart';
import {
  lastNDayKeys,
  buildDailyStatsSeries,
  computeHabitCompletionRates,
} from '../../utils/statisticsData';

const DAYS = 30;

export default function StatisticsScreen() {
  const { colors: c, isLight } = useAppTheme();
  const { user } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitHistory, setHabitHistory] = useState<
    { habit_id: string; date: string; value?: number }[]
  >([]);

  const [totalXp, setTotalXp] = useState(0);
  const [questsDone, setQuestsDone] = useState(0);
  const [focusHours, setFocusHours] = useState(0);
  const [habitRatePct, setHabitRatePct] = useState(0);

  const [series30, setSeries30] = useState<StatsSeries>({
    xp: Array(DAYS).fill(0),
    quests: Array(DAYS).fill(0),
    focus: Array(DAYS).fill(0),
    habits: Array(DAYS).fill(0),
  });
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [habitRates, setHabitRates] = useState<{ id: string; title: string; rate: number }[]>([]);

  const [visible, setVisible] = useState<StatsVisibility>({
    xp: true,
    quests: true,
    focus: true,
    habits: true,
  });

  const shell = useMemo(
    () => ({
      bg: c.bg,
      surf: c.surf,
      tx: c.tx,
      tx2: c.tx2,
      border: c.borderDefault,
      mutedGold: c.sidebarMutedGold,
    }),
    [c],
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const keys = lastNDayKeys(DAYS);
      setDayKeys(keys);

      const [allTasks, focusSessionsList, userHabits, stats] = await Promise.all([
        offlineTaskService.getTasks(user.id),
        focusService.getSessions(user.id),
        habitService.getHabits(user.id),
        focusService.getStats(user.id),
      ]);

      setTasks(allTasks);
      setSessions(focusSessionsList);

      let hist: { habit_id: string; date: string; value?: number }[] = [];
      if (userHabits.length > 0) {
        hist = await habitService.getHabitHistoryByHabitIds(userHabits.map((h) => h.id));
      }
      setHabitHistory(hist);
      setHabits(userHabits);

      const series = buildDailyStatsSeries(keys, allTasks, focusSessionsList, userHabits, hist);
      setSeries30(series);

      const habitMap = new Map(userHabits.map((h) => [h.id, h]));
      let hx = 0;
      for (const row of hist) {
        if ((row.value ?? 0) <= 0) continue;
        const h = habitMap.get(row.habit_id);
        if (h) hx += h.xp_reward ?? 15;
      }
      const completed = allTasks.filter((t) => t.status === 'completed');
      const taskXp = completed.reduce((s, t) => s + taskXpValue(t), 0);
      const focusXp = Math.floor(stats.total_duration);
      setTotalXp(Math.max(0, taskXp + hx + focusXp));
      setQuestsDone(completed.length);
      setFocusHours(Math.round(stats.total_duration / 60));

      let slots = 0;
      let fills = 0;
      for (const h of userHabits) {
        for (const dk of keys) {
          slots++;
          if (hist.some((r) => r.habit_id === h.id && r.date === dk && (r.value ?? 0) > 0)) {
            fills++;
          }
        }
      }
      setHabitRatePct(slots ? Math.round((fills / slots) * 100) : 0);

      setHabitRates(computeHabitCompletionRates(userHabits, hist, keys));
    } catch (e) {
      console.error('Statistics load', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const toggleTrack = useCallback((k: StatsSeriesKey) => {
    setVisible((v) => {
      const next = { ...v, [k]: !v[k] };
      if (!Object.values(next).some(Boolean)) return v;
      return next;
    });
  }, []);

  const statCards = useMemo(
    () =>
      [
        {
          key: 'xp' as const,
          value: totalXp.toLocaleString(),
          label: 'Total XP',
          color: c.amber,
        },
        {
          key: 'quests' as const,
          value: String(questsDone),
          label: 'Quests done',
          color: c.teal,
        },
        {
          key: 'focus' as const,
          value: `${focusHours}h`,
          label: 'Focus',
          color: c.blue,
        },
        {
          key: 'habits' as const,
          value: `${habitRatePct}%`,
          label: 'Habit rate',
          color: c.pink,
        },
      ] as const,
    [totalXp, questsDone, focusHours, habitRatePct, c],
  );

  const barColors = useMemo(() => [c.amber, c.teal, c.blue, c.pink], [c]);

  return (
    <View style={{ flex: 1, backgroundColor: shell.bg }}>
      <QuestLogScreenHeader
        title="Statistics"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        titleColor={shell.tx}
        right={<ThemeModeToggle />}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={c.amber} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.statGrid}>
              {statCards.map((card) => {
                const on = visible[card.key];
                return (
                  <Pressable
                    key={card.key}
                    onPress={() => toggleTrack(card.key)}
                    style={({ pressed }) => [
                      styles.statCard,
                      {
                        backgroundColor: shell.surf,
                        borderColor: on ? card.color : shell.border,
                        borderWidth: on ? 2 : 1,
                        opacity: pressed ? 0.92 : on ? 1 : 0.42,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${card.label}. Tap to ${on ? 'hide' : 'show'} on chart.`}
                  >
                    <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { color: shell.mutedGold }]}>{card.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: shell.mutedGold }]}>
              Activity — last {DAYS} days
            </Text>
            <StatsMultiLineChart
              series={series30}
              visible={visible}
              dayKeys={dayKeys}
              gridColor={shell.border}
              labelColor={shell.tx2}
              surfaceColor={isLight ? '#e4e0d8' : c.bg2}
            />

            <View style={styles.legendRow}>
              {(['xp', 'quests', 'focus', 'habits'] as StatsSeriesKey[]).map((k) => {
                const legendColors: Record<StatsSeriesKey, string> = {
                  xp: c.amber,
                  quests: c.teal,
                  focus: c.blue,
                  habits: c.pink,
                };
                const labels: Record<StatsSeriesKey, string> = {
                  xp: 'XP',
                  quests: 'Quests',
                  focus: 'Focus',
                  habits: 'Habits',
                };
                return (
                  <Text
                    key={k}
                    style={[
                      styles.legendItem,
                      { color: legendColors[k], opacity: visible[k] ? 1 : 0.35 },
                    ]}
                  >
                    ● {labels[k]}
                  </Text>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: shell.mutedGold, marginTop: 20 }]}>
              Habit completion rates
            </Text>
            <View style={[styles.habitPanel, { backgroundColor: shell.surf, borderColor: shell.border }]}>
              {habitRates.length === 0 ? (
                <Text style={[styles.emptyHabits, { color: shell.tx2 }]}>
                  No habits yet. Add habits to see completion rates.
                </Text>
              ) : (
                habitRates.map((h, i) => {
                  const bar = barColors[i % barColors.length];
                  return (
                    <View key={h.id} style={styles.habitRow}>
                      <View style={styles.habitTitleRow}>
                        <Text style={[styles.habitName, { color: shell.tx }]} numberOfLines={1}>
                          {h.title}
                        </Text>
                        <Text style={[styles.habitPct, { color: bar }]}>{h.rate}%</Text>
                      </View>
                      <View
                        style={[
                          styles.habitTrack,
                          {
                            backgroundColor: isLight ? 'rgba(28,25,22,0.08)' : 'rgba(232,224,204,0.08)',
                          },
                        ]}
                      >
                        <View style={[styles.habitFill, { width: `${h.rate}%`, backgroundColor: bar }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionLabel: {
    fontFamily: FONT_SERIF,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  legendItem: {
    fontFamily: FONT_SERIF,
    fontSize: 12,
    fontWeight: '600',
  },
  habitPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  emptyHabits: {
    fontFamily: FONT_SERIF,
    fontSize: 14,
  },
  habitRow: {
    marginBottom: 16,
  },
  habitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitName: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  habitPct: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    fontWeight: '700',
  },
  habitTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  habitFill: {
    height: '100%',
    borderRadius: 4,
  },
});
