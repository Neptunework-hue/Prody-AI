import { localDateKey } from '../services/questStreak';
import { Habit } from '../types/habit';
import { isHabitDueOnDate } from './habitSchedule';

export const HABIT_DOT_DAY_COUNT = 14;

/** Date keys from oldest → newest (today last), length `days`. */
export function localDateKeysEndingToday(days: number): string[] {
  const keys: string[] = [];
  for (let age = days - 1; age >= 0; age--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - age);
    keys.push(localDateKey(d));
  }
  return keys;
}

export function countHabitCompletions(
  habitId: string,
  rows: { habit_id: string; value?: number }[],
): number {
  return rows.filter((r) => r.habit_id === habitId && (r.value ?? 0) > 0).length;
}

/** Completion rate % over the dot window: done ÷ scheduled days (when habit was due). */
export function habitScheduleRateInWindow(
  habit: Habit,
  rowsForThisHabit: { date: string; value?: number }[],
  windowDays: number,
): number {
  const keys = localDateKeysEndingToday(windowDays);
  const mine = new Map(rowsForThisHabit.map((r) => [r.date, r.value ?? 0] as const));
  let due = 0;
  let done = 0;
  for (const dateKey of keys) {
    const [y, mo, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, mo - 1, d);
    if (!isHabitDueOnDate(habit, dt)) continue;
    due += 1;
    if ((mine.get(dateKey) ?? 0) > 0) done += 1;
  }
  if (due === 0) return 100;
  return Math.min(100, Math.round((100 * done) / due));
}

export function habitFrequencySubtitle(habit: Habit): string {
  const desc = habit.description?.trim() ?? '';
  const minM = desc.match(/(\d+)\s*min(?:ute)?s?\s*(?:\/|\s*per\s*)?\s*day/i);
  if (minM) return `${minM[1]} min/day`;
  if (habit.frequency === 'daily') return 'Daily';
  if (habit.frequency === 'weekly') {
    const n = habit.days?.length ?? 0;
    return n > 0 ? `${n}×/week` : 'Weekly';
  }
  if (habit.frequency === 'monthly') {
    const n = habit.days?.length ?? 0;
    return n > 0 ? `${n}×/month` : 'Monthly';
  }
  return 'Habit';
}
