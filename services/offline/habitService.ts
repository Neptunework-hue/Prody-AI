import { Habit, HabitHistoryEntry } from '../../types/habit';

// Simple in-memory store for demo (replace with persistent storage as needed)
let habits: Habit[] = [];

export const offlineHabitService = {
  getHabits: async (userId: string): Promise<Habit[]> => {
    return habits.filter(h => h.userId === userId);
  },
  addHabit: async (habit: Habit): Promise<void> => {
    habits.push(habit);
  },
  updateHabit: async (habit: Habit): Promise<void> => {
    const idx = habits.findIndex(h => h.id === habit.id);
    if (idx !== -1) habits[idx] = habit;
  },
  deleteHabit: async (habitId: string): Promise<void> => {
    habits = habits.filter(h => h.id !== habitId);
  },
  logHabitProgress: async (habitId: string, date: string, value: number): Promise<void> => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    let entry = habit.history.find(e => e.date === date);
    if (!entry) {
      entry = { date, completed: false, value: 0 };
      habit.history.push(entry);
    }
    entry.value += value;
    entry.completed = entry.value >= habit.target;
    habit.progress = entry.value;
    // Update streak
    // (Simple: increment if today completed, reset if not)
    if (entry.completed) {
      habit.streak = (habit.streak || 0) + 1;
    } else {
      habit.streak = 0;
    }
  },
}; 