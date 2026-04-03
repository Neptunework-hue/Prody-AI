import { Task, TaskCreate, TaskStatus, TaskPriority } from '../../types/task';
import { offlineService } from './offlineService';
import { taskService as supabaseTaskService } from '../supabase/task';

class OfflineTaskService {
  async createTask(taskData: TaskCreate, userId: string): Promise<Task> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Always use offline service for task creation
    return await offlineService.createTask(taskData, userId);
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    // Try to get the task first to determine user ID
    const tasks = await offlineService.getTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    return await offlineService.updateTask(taskId, updates, task.user_id);
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log('OfflineTaskService: deleteTask called with taskId:', taskId);
    
    // Try to get the task first to determine user ID
    const tasks = await offlineService.getTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      console.error('OfflineTaskService: Task not found with ID:', taskId);
      throw new Error('Task not found');
    }

    console.log('OfflineTaskService: Found task:', task.title, 'with user_id:', task.user_id);

    // Find all subtasks of this task
    const subtasks = tasks.filter(t => t.parent_task_id === taskId);
    console.log('OfflineTaskService: Found', subtasks.length, 'subtasks for task:', task.title);
    
    // Delete all subtasks first
    for (const subtask of subtasks) {
      console.log(`OfflineTaskService: Deleting subtask: ${subtask.title} (ID: ${subtask.id})`);
      await offlineService.deleteTask(subtask.id, subtask.user_id);
    }
    
    // Then delete the main task
    console.log(`OfflineTaskService: Deleting main task: ${task.title} (ID: ${taskId})`);
    await offlineService.deleteTask(taskId, task.user_id);
    console.log('OfflineTaskService: Task deletion completed successfully');
  }

  async getTasks(userId: string): Promise<Task[]> {
    // First try to get from offline service
    const offlineTasks = await offlineService.getTasks(userId);
    
    // If we're online, also try to get from Supabase and merge
    if (offlineService.isCurrentlyOnline()) {
      try {
        const supabaseTasks = await supabaseTaskService.getTasks(userId);
        
        // Merge tasks, preferring offline versions for conflicts
        const mergedTasks = this.mergeTasks(offlineTasks, supabaseTasks);
        
        // Update offline storage with merged data
        for (const task of mergedTasks) {
          // Use the offline service's saveTask method
          await offlineService.saveTask(task);
        }
        
        return mergedTasks;
      } catch (error) {
        console.warn('Failed to fetch from Supabase, using offline data:', error);
        return offlineTasks;
      }
    }
    
    return offlineTasks;
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    const tasks = await offlineService.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return await this.updateTask(taskId, { status });
  }

  async updateTaskPriority(taskId: string, priority: TaskPriority): Promise<Task> {
    return await this.updateTask(taskId, { priority });
  }

  async updateTaskDeadline(taskId: string, deadline: string): Promise<Task> {
    return await this.updateTask(taskId, { deadline });
  }

  // Helper method to merge tasks from different sources
  private mergeTasks(offlineTasks: Task[], supabaseTasks: Task[]): Task[] {
    const mergedMap = new Map<string, Task>();
    
    // Add all Supabase tasks first
    for (const task of supabaseTasks) {
      mergedMap.set(task.id, task);
    }
    
    // Override with offline tasks (they're more recent)
    for (const task of offlineTasks) {
      const existing = mergedMap.get(task.id);
      if (!existing || new Date(task.updated_at) > new Date(existing.updated_at)) {
        mergedMap.set(task.id, task);
      }
    }
    
    return Array.from(mergedMap.values());
  }

  // Force sync all pending operations
  async syncPendingOperations(): Promise<void> {
    await offlineService.syncPendingOperations();
  }

  // Get offline state
  async getOfflineState() {
    return await offlineService.getOfflineState();
  }

  // Check if currently online
  isOnline(): boolean {
    return offlineService.isCurrentlyOnline();
  }
}

export const offlineTaskService = new OfflineTaskService(); 