export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  notes: string;
  interruptions: number;
  created_at: string;
  updated_at: string;
}

export interface FocusSessionCreate {
  user_id: string;
  task_id?: string;
  start_time: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  notes: string;
  interruptions: number;
}

export interface FocusSessionUpdate {
  end_time?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  notes?: string;
  interruptions?: number;
}

export interface FocusSessionStats {
  total_sessions: number;
  total_duration: number;
  average_duration: number;
  total_interruptions: number;
  average_interruptions: number;
  completion_rate: number;
  longest_streak: number;
} 