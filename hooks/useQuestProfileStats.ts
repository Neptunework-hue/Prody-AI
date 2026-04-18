import { useState, useEffect } from 'react';
import { offlineTaskService } from '../services/offline/taskService';
import { habitService } from '../services/supabase/habitService';
import { focusService } from '../services/supabase/focus';
import { taskXpValue } from '../components/tasks/TaskCardWithSubtasks';
import { getLevelProgress } from '../utils/leveling';
import { Habit } from '../types/habit';

function habitXpReward(h: Habit): number {
  return h.xp_reward ?? 15;
}

export function levelFlavorName(level: number): string {
  if (level >= 20) return 'Legend';
  if (level >= 12) return 'Scholar';
  if (level >= 6) return 'Adventurer';
  return 'Novice';
}

/**
 * Lifetime XP / level aligned with the dashboard (tasks + habits + focus minutes).
 */
export function useQuestProfileStats(userId: string | undefined) {
  const [totalXp, setTotalXp] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const tasks = await offlineTaskService.getTasks(userId);
        const habits = await habitService.getHabits(userId);
        const habitMap = new Map(habits.map((h) => [h.id, h]));
        let habitXp = 0;
        if (habits.length > 0) {
          const hist = await habitService.getHabitHistoryByHabitIds(habits.map((h) => h.id));
          for (const row of hist) {
            if ((row.value ?? 0) <= 0) continue;
            const h = habitMap.get(row.habit_id);
            if (!h) continue;
            habitXp += habitXpReward(h);
          }
        }
        const taskXp = tasks
          .filter((t) => t.status === 'completed')
          .reduce((s, t) => s + taskXpValue(t), 0);
        const stats = await focusService.getStats(userId);
        const focusXp = Math.floor(stats.total_duration);
        const total = Math.max(0, taskXp + habitXp + focusXp);
        const lp = getLevelProgress(total);
        if (!cancelled) {
          setTotalXp(total);
          setLevel(lp.level);
        }
      } catch {
        if (!cancelled) {
          setTotalXp(0);
          setLevel(1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { totalXp, level, flavor: levelFlavorName(level) };
}
