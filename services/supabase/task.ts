import { supabase } from './client';
import { Task, TaskCreate, TaskUpdate, TaskStatus } from '../../types/task';

export const taskService = {
  async getTasks(userId: string): Promise<Task[]> {
    console.log('TaskService: Fetching tasks for user:', userId);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('TaskService: Error fetching tasks:', error);
      throw error;
    }
    
    console.log('TaskService: Successfully fetched', data?.length || 0, 'tasks:', data);
    return data || [];
  },

  async createTask(task: TaskCreate & { user_id: string }): Promise<Task> {
    console.log('TaskService: Creating task with data:', task);
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        ...task,
        status: 'pending',
        priority: task.priority || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('TaskService: Error creating task:', error);
      throw error;
    }
    
    console.log('TaskService: Task created successfully:', data);
    return data;
  },

  async updateTask(taskId: string, updates: TaskUpdate): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTask(taskId: string): Promise<void> {
    // First, get all tasks to find subtasks
    const { data: allTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*');

    if (fetchError) throw fetchError;

    // Find all subtasks of this task
    const subtasks = allTasks?.filter(task => task.parent_task_id === taskId) || [];
    
    // Delete all subtasks first
    for (const subtask of subtasks) {
      console.log(`Deleting subtask: ${subtask.title} (ID: ${subtask.id})`);
      const { error: subtaskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtask.id);
      
      if (subtaskError) {
        console.error(`Error deleting subtask ${subtask.id}:`, subtaskError);
        throw subtaskError;
      }
    }
    
    // Then delete the main task
    console.log(`Deleting main task (ID: ${taskId})`);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },

  async checkOverdueTasks(userId: string): Promise<void> {
    // Get today's date at midnight (local time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all pending and in_progress tasks with deadlines
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .not('deadline', 'is', null);

    if (error) throw error;

    // Update status to failed for overdue tasks (deadline date < today)
    for (const task of tasks || []) {
      let shouldFail = false;
      // 1. Deadline date is before today
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        if (deadlineDate < today) {
          shouldFail = true;
        }
      }
      // 2. End time is in the past
      if (!shouldFail && task.endTime) {
        const endTime = new Date(task.endTime);
        if (endTime < new Date()) {
          shouldFail = true;
        }
      }
      if (shouldFail) {
        await this.updateTask(task.id, { status: 'failed' });
      }
    }
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateTask(taskId, { status });
  },

  async updateTaskPriority(taskId: string, priority: number): Promise<Task> {
    return this.updateTask(taskId, { priority });
  },
}; 