import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'questlog_daily_focus_goal_min';

/** Default matches the original dashboard constant. */
export const DAILY_FOCUS_GOAL_MIN_DEFAULT = 120;

function clampGoal(minutes: number): number {
  if (!Number.isFinite(minutes) || Number.isNaN(minutes)) return DAILY_FOCUS_GOAL_MIN_DEFAULT;
  return Math.max(15, Math.min(480, Math.round(minutes)));
}

export async function getDailyFocusGoalMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') return DAILY_FOCUS_GOAL_MIN_DEFAULT;
    return clampGoal(parseInt(raw, 10));
  } catch {
    return DAILY_FOCUS_GOAL_MIN_DEFAULT;
  }
}

export async function setDailyFocusGoalMinutes(minutes: number): Promise<number> {
  const v = clampGoal(minutes);
  await AsyncStorage.setItem(STORAGE_KEY, String(v));
  return v;
}
