/**
 * XP / Gamification System
 *
 * Persists XP, level, and daily XP to AsyncStorage.
 * Screens call `addXP(amount)` when the user completes tasks/habits/focus.
 * `loadXPState()` returns the current snapshot for display.
 *
 * Storage key: "prody_xp_v1"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const XP_PER_LEVEL = 100;
export const STORAGE_KEY = 'prody_xp_v1';

export interface XPState {
  totalXP: number;
  dailyXP: number;
  lastDate: string;        // YYYY-MM-DD — used to detect day rollover
  completedProjects: CompletedProject[];
}

export interface CompletedProject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  trophy: string;          // emoji
  completedOn: string;     // YYYY-MM-DD
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function getLevelInfo(xp: number): { level: number; xpInLevel: number } {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpInLevel: xp % XP_PER_LEVEL,
  };
}

const DEFAULT_STATE: XPState = {
  totalXP: 0,
  dailyXP: 0,
  lastDate: todayStr(),
  completedProjects: [],
};

function resetDailyIfNeeded(state: XPState): XPState {
  const t = todayStr();
  if (state.lastDate !== t) {
    return { ...state, dailyXP: 0, lastDate: t };
  }
  return state;
}

export async function loadXPState(): Promise<XPState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed: XPState = JSON.parse(raw);
    return resetDailyIfNeeded(parsed);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveXPState(state: XPState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silently fail — XP is non-critical
  }
}

/** Add XP and persist. Returns updated state and whether a level-up occurred. */
export async function addXP(amount: number): Promise<{ state: XPState; leveledUp: boolean; newLevel: number }> {
  const state = await loadXPState();
  const prevLevel = getLevelInfo(state.totalXP).level;
  const updated: XPState = {
    ...state,
    totalXP: state.totalXP + amount,
    dailyXP: state.dailyXP + amount,
  };
  await saveXPState(updated);
  const newLevel = getLevelInfo(updated.totalXP).level;
  return { state: updated, leveledUp: newLevel > prevLevel, newLevel };
}

/** Add a completed project to the shelf and award 50 XP. */
export async function completeProject(project: Omit<CompletedProject, 'completedOn'>): Promise<XPState> {
  const state = await loadXPState();
  const updated: XPState = {
    ...state,
    totalXP: state.totalXP + 50,
    dailyXP: state.dailyXP + 50,
    completedProjects: [
      ...state.completedProjects,
      { ...project, completedOn: todayStr() },
    ],
  };
  await saveXPState(updated);
  return updated;
}

/** Remove a project from the shelf (undo). */
export async function removeCompletedProject(projectId: string): Promise<XPState> {
  const state = await loadXPState();
  const updated: XPState = {
    ...state,
    completedProjects: state.completedProjects.filter(p => p.id !== projectId),
  };
  await saveXPState(updated);
  return updated;
}
