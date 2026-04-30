import { Task } from '../types/task';
import { FocusSession } from '../types/focus';
import { Habit } from '../types/habit';
import { localDateKey } from '../services/questStreak';
import { taskXpValue } from '../components/tasks/TaskCardWithSubtasks';

export function lastNDayKeys(n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  return keys;
}

export type DailySeries = {
  xp: number[];
  quests: number[];
  focus: number[];
  habits: number[];
};

/**
 * Per calendar day (last `dayKeys.length` days): XP earned, quests completed,
 * focus minutes, habit completion events (rows with value &gt; 0).
 */
export function buildDailyStatsSeries(
  dayKeys: string[],
  tasks: Task[],
  sessions: FocusSession[],
  habits: Habit[],
  habitHistory: { habit_id: string; date: string; value?: number }[],
): DailySeries {
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  const xp: number[] = [];
  const quests: number[] = [];
  const focus: number[] = [];
  const habitsDone: number[] = [];

  for (const dk of dayKeys) {
    let xpDay = 0;
    let qDay = 0;
    let fMin = 0;
    let hDay = 0;

    for (const t of tasks) {
      if (t.status !== 'completed' || !t.updated_at) continue;
      if (localDateKey(new Date(t.updated_at)) !== dk) continue;
      xpDay += taskXpValue(t);
      qDay += 1;
    }

    for (const row of habitHistory) {
      if (row.date !== dk || (row.value ?? 0) <= 0) continue;
      const h = habitMap.get(row.habit_id);
      if (h) xpDay += h.xp_reward ?? 15;
      hDay += 1;
    }

    for (const s of sessions) {
      if (s.status !== 'completed' || !s.end_time) continue;
      if (localDateKey(new Date(s.start_time)) !== dk) continue;
      const ms = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      fMin += Math.max(0, ms / (1000 * 60));
    }

    xp.push(Math.round(xpDay));
    quests.push(qDay);
    focus.push(Math.round(fMin));
    habitsDone.push(hDay);
  }

  return { xp, quests, focus, habits: habitsDone };
}

export function computeHabitCompletionRates(
  habits: Habit[],
  habitHistory: { habit_id: string; date: string; value?: number }[],
  dayKeys: string[],
): { id: string; title: string; rate: number }[] {
  return habits.map((h) => {
    let done = 0;
    for (const dk of dayKeys) {
      if (
        habitHistory.some(
          (r) => r.habit_id === h.id && r.date === dk && (r.value ?? 0) > 0,
        )
      ) {
        done++;
      }
    }
    const rate = dayKeys.length ? Math.round((done / dayKeys.length) * 100) : 0;
    return { id: h.id, title: h.title, rate };
  });
}
