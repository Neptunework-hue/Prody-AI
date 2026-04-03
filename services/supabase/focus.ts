import { supabase } from './supabase';
import { FocusSession, FocusSessionCreate, FocusSessionUpdate, FocusSessionStats } from '../../types/focus';

export const focusService = {
  async createSession(session: FocusSessionCreate): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert(session)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getActiveSession(userId: string): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select()
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) throw error;
    return data;
  },

  async getSessions(userId: string): Promise<FocusSession[]> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select()
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateSession(sessionId: string, updates: FocusSessionUpdate): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async completeSession(sessionId: string, update: FocusSessionUpdate): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update(update)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async pauseSession(sessionId: string): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update({
        status: 'paused',
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async resumeSession(sessionId: string): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update({
        status: 'active',
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async cancelSession(sessionId: string): Promise<FocusSession> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'cancelled',
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async incrementInterruptions(sessionId: string): Promise<FocusSession> {
    const { data, error } = await supabase
      .rpc('increment_interruptions', { session_id: sessionId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getStats(userId: string): Promise<FocusSessionStats> {
    const { data: sessions, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) throw error;

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, session) => {
      const start = new Date(session.start_time).getTime();
      const end = new Date(session.end_time).getTime();
      return acc + (end - start);
    }, 0);

    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const totalInterruptions = sessions.reduce((acc, session) => acc + (session.interruptions || 0), 0);

    return {
      total_sessions: totalSessions,
      total_duration: Math.floor(totalDuration / (1000 * 60)), // Convert to minutes
      average_duration: Math.floor(averageDuration / (1000 * 60)), // Convert to minutes
      total_interruptions: totalInterruptions,
      average_interruptions: totalSessions > 0 ? totalInterruptions / totalSessions : 0,
      completion_rate: totalSessions > 0 ? 1 : 0, // Simplified for now
      longest_streak: 0, // To be implemented
    };
  }
}; 