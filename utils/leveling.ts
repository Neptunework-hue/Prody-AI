/**
 * Total-XP leveling curve (cumulative):
 * - Lvl 1: 0–99 XP   (100 XP to reach Lvl 2)
 * - Lvl 2: 100–299 XP (200 XP in this level; 300 total to reach Lvl 3)
 * - Lvl 3: 300–599 XP (300 XP in this level; 600 total to reach Lvl 4)
 * Each level n requires 100×n total XP to complete that tier (width grows: 100, 200, 300, …).
 *
 * XP at the start of level L (1-based): 0 for L=1, else 100 × (L−1) × L / 2.
 */

const BASE = 100;

/** Minimum total XP at which level `level` begins (level is 1-based). */
export function xpAtStartOfLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  return (BASE * (level - 1) * level) / 2;
}

/** Current level from lifetime total XP (minimum 1). */
export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  // xpAtStartOfLevel(level+1) <= xp  →  user has reached at least level+1's threshold
  while (xpAtStartOfLevel(level + 1) <= xp) {
    level += 1;
    if (level > 1_000_000) break;
  }
  return level;
}

export type LevelProgress = {
  level: number;
  /** XP earned within the current level (0 .. xpSpanThisLevel). */
  xpIntoLevel: number;
  /** XP required to finish the current level (span from start to next level). */
  xpSpanThisLevel: number;
  /** Remaining XP until the next level. */
  xpToNextLevel: number;
  /** 0–1 progress through the current level. */
  progressToNext: number;
};

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  const level = levelFromTotalXp(xp);
  const start = xpAtStartOfLevel(level);
  const nextStart = xpAtStartOfLevel(level + 1);
  const xpSpanThisLevel = nextStart - start;
  const xpIntoLevel = xp - start;
  const xpToNextLevel = Math.max(0, nextStart - xp);
  const progressToNext =
    xpSpanThisLevel > 0 ? Math.min(1, Math.max(0, xpIntoLevel / xpSpanThisLevel)) : 1;
  return {
    level,
    xpIntoLevel,
    xpSpanThisLevel,
    xpToNextLevel,
    progressToNext,
  };
}
