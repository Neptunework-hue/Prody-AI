import { supabase } from './supabase';
import { Habit } from '../../types/habit';

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
  async addHabit(habit: Omit<Habit, 'id'> & { user_id: string }): Promise<Habit> {
    const { data, error } = await supabase
      .from('habits')
      .insert([{ ...habit }])
      .select()
      .single();
    if (error) throw error;
    return data as Habit;
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
  async getHabitHistoryByHabitIds(
    habitIds: string[],
  ): Promise<{ habit_id: string; date: string; value?: number }[]> {
    if (!habitIds || habitIds.length === 0) return [];
    const { data, error } = await supabase
      .from('habit_history')
      .select('habit_id,date,value')
      .in('habit_id', habitIds);
    if (error) throw error;
    return (data as { habit_id: string; date: string; value?: number }[]) || [];
  },
}; 