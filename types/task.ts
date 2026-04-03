export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 0 | 1 | 2 | 3; // 0: Low, 1: Medium, 2: High, 3: Urgent

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string; // ISO string format
  startTime?: string; // ISO string format - matches database column
  endTime?: string; // ISO string format - matches database column
  created_at: string;
  updated_at: string;
  category?: string;
  tags: string[];
  is_deep_work: boolean;
  ai_priority_score?: number;
  parent_task_id?: string;
  activities?: string[]; // Array of activity keys or emojis
  notifyTime?: string | null;
  notificationId?: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string;
  startTime?: string; // matches database column
  endTime?: string; // matches database column
  activities?: string[];
  parent_task_id?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  startTime?: string; // matches database column
  endTime?: string; // matches database column
  activities?: string[];
} 