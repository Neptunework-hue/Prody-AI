import { Habit } from '../types/habit';

/** JS getDay(): 0=Sun..6=Sat → habit `days` index: Mon=0 .. Sun=6 */
export function habitDayIndexFromDate(d: Date): number {
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

/** Whether this habit is scheduled on the given calendar day (local). */
export function isHabitDueOnDate(habit: Habit, d: Date): boolean {
  const freq = String(habit.frequency ?? 'daily')
    .toLowerCase()
    .trim() as Habit['frequency'];
  if (freq === 'daily') return true;
  const idx = habitDayIndexFromDate(d);
  if (freq === 'weekly' || freq === 'monthly') {
    if (!habit.days || habit.days.length === 0) return true;
    return habit.days.includes(idx);
  }
  return true;
}
