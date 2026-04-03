import { supabase } from './supabase';
import { Habit, HabitHistoryEntry } from '../../types/habit';

export const habitService = {
  async getHabits(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async addHabit(habit: Omit<Habit, 'id'> & { user_id: string }): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .insert([{ ...habit }]);
    if (error) throw error;
  },
  async updateHabit(habitId: string, updates: Partial<Habit>): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId);
    if (error) throw error;
  },
  async deleteHabit(habitId: string): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId);
    if (error) throw error;
  },
  async logHabitProgress(habitId: string, date: string, value: number): Promise<void> {
    // This assumes a habit_history table exists for logging progress
    const { error } = await supabase
      .from('habit_history')
      .upsert({ habit_id: habitId, date, value });
    if (error) throw error;
  },
  async getHabitHistoryByHabitIds(habitIds: string[]): Promise<Pick<HabitHistoryEntry, 'date' | 'value'> & { habit_id: string }[]> {
    if (!habitIds || habitIds.length === 0) return [] as any;
    const { data, error } = await supabase
      .from('habit_history')
      .select('habit_id,date,value')
      .in('habit_id', habitIds);
    if (error) throw error;
    return (data as any) || [];
  },
}; 