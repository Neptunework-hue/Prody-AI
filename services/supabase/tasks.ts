import { supabase } from './supabase';
import { Task, TaskStatus, TaskPriority } from '../../types/task';

export const taskService = {
  async getTasks(userId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Task[];
  },

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  async updateTask(id: string, updates: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  async deleteTask(id: string) {
    // First, get all tasks to find subtasks
    const { data: allTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*');

    if (fetchError) throw fetchError;

    // Find all subtasks of this task
    const subtasks = allTasks?.filter(task => task.parent_task_id === id) || [];
    
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
    console.log(`Deleting main task (ID: ${id})`);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async updateTaskStatus(id: string, status: TaskStatus) {
    return this.updateTask(id, { status });
  },

  async updateTaskPriority(id: string, priority: TaskPriority) {
    return this.updateTask(id, { priority });
  },

  async getTasksByStatus(userId: string, status: TaskStatus) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Task[];
  },

  async getTasksByPriority(userId: string, priority: TaskPriority) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('priority', priority)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Task[];
  },
}; 