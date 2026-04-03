export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  target?: number; // e.g., 2000 steps, 1 time, 12 hours, etc. (optional)
  progress: number; // current progress for the period
  frequency: 'daily' | 'weekly' | 'monthly';
  icon?: string; // emoji or icon name
  streak: number; // consecutive days/weeks/months completed
  history: HabitHistoryEntry[];
  days?: number[]; // days of week (0=Mon, 6=Sun) for weekly/monthly habits
  notifyTime?: string | null;
}

export interface HabitHistoryEntry {
  date: string; // ISO date string
  completed: boolean;
  value: number; // progress value for that day
} 