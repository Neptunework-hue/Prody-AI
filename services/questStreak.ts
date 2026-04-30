import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `questlog_streak_v1_${userId}`;

export type StreakState = {
  streak: number;
  lastActiveDate: string | null;
};

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Call when dashboard loads with whether the user had any qualifying activity today
 * (completed at least one task, logged at least one habit with value &gt; 0, or completed focus time today).
 * Updates consecutive-day streak and persists.
 */
export async function syncDailyStreak(userId: string, hasActivityToday: boolean): Promise<number> {
  const raw = await AsyncStorage.getItem(key(userId));
  let state: StreakState = raw
    ? (JSON.parse(raw) as StreakState)
    : { streak: 0, lastActiveDate: null };

  const today = localDateKey(new Date());
  const yesterday = localDateKey(addDays(new Date(), -1));

  if (state.lastActiveDate && state.lastActiveDate < yesterday) {
    state.streak = 0;
  }

  if (!hasActivityToday) {
    await AsyncStorage.setItem(key(userId), JSON.stringify(state));
    return state.streak;
  }

  if (state.lastActiveDate === today) {
    await AsyncStorage.setItem(key(userId), JSON.stringify(state));
    return state.streak;
  }

  if (state.lastActiveDate === yesterday) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }
  state.lastActiveDate = today;
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  return state.streak;
}

/** Read streak for UI (same expiry rule as sync: broken if last active before yesterday). */
export async function getDisplayStreak(userId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(key(userId));
  const state: StreakState = raw
    ? (JSON.parse(raw) as StreakState)
    : { streak: 0, lastActiveDate: null };
  const yesterday = localDateKey(addDays(new Date(), -1));
  if (state.lastActiveDate && state.lastActiveDate < yesterday) {
    return 0;
  }
  return state.streak;
}
