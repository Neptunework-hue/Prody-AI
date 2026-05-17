import { FocusSession } from '../types/focus';

/** Sum completed focus minutes whose session started today (local midnight). */
export function focusMinutesCompletedToday(sessions: FocusSession[]): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  let min = 0;
  for (const s of sessions) {
    if (s.status !== 'completed' || !s.end_time) continue;
    const st = new Date(s.start_time).getTime();
    if (st >= startMs) {
      const dur = (new Date(s.end_time).getTime() - st) / (1000 * 60);
      min += Math.max(0, dur);
    }
  }
  return Math.round(min);
}
