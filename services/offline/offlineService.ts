import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Task, TaskCreate } from '../../types/task';
import { FocusSession } from '../../types/focus';
import { taskService } from '../supabase/task';

// Storage keys
const STORAGE_KEYS = {
  TASKS: 'offline_tasks',
  FOCUS_SESSIONS: 'offline_focus_sessions',
  PENDING_OPERATIONS: 'offline_pending_operations',
  LAST_SYNC: 'offline_last_sync',
  USER_ID: 'offline_user_id'
};

/** True if `id` matches Supabase `tasks.id` (uuid). Local-only tasks use `offline_…` from generateOfflineId. */
function isUuidTaskId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
}

// Operation types for pending operations
export type OperationType = 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_FOCUS_SESSION' | 'UPDATE_FOCUS_SESSION';

export interface PendingOperation {
  id: string;
  type: OperationType;
  data: any;
  timestamp: number;
  userId: string;
}

export interface OfflineState {
  isOnline: boolean;
  lastSync: number | null;
  pendingOperations: PendingOperation[];
  tasks: Task[];
  focusSessions: FocusSession[];
}

class OfflineService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: ((state: OfflineState) => void)[] = [];

  constructor() {
    this.initializeNetworkListener();
  }

  // Initialize network connectivity listener
  private async initializeNetworkListener() {
    // Get initial network state
    const netInfo = await NetInfo.fetch();
    this.isOnline = netInfo.isConnected ?? true;

    // Listen for network changes
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? true;
      
      if (!wasOnline && this.isOnline) {
        // Came back online - sync data
        this.syncPendingOperations();
      }
      
      this.notifyListeners();
    });
  }

  // Subscribe to offline state changes
  subscribe(listener: (state: OfflineState) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of state changes
  private async notifyListeners() {
    const state = await this.getOfflineState();
    this.listeners.forEach(listener => listener(state));
  }

  // Get current offline state
  async getOfflineState(): Promise<OfflineState> {
    const [lastSync, pendingOperations, tasks, focusSessions] = await Promise.all([
      this.getLastSync(),
      this.getPendingOperations(),
      this.getTasks(),
      this.getFocusSessions()
    ]);

    return {
      isOnline: this.isOnline,
      lastSync,
      pendingOperations,
      tasks,
      focusSessions
    };
  }

  // Check if currently online
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  // Task operations
  async createTask(taskData: TaskCreate, userId: string): Promise<Task> {
    const xp = taskData.xp_reward ?? 25;
    const task: Task = {
      id: this.generateOfflineId(),
      user_id: userId,
      title: taskData.title,
      description: taskData.description || '',
      status: 'pending',
      priority: taskData.priority ?? 0,
      xp_reward: xp,
      folder_id: taskData.folder_id ?? null,
      deadline: taskData.deadline,
      startTime: taskData.startTime,
      endTime: taskData.endTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: undefined,
      tags: [],
      is_deep_work: false,
      ai_priority_score: undefined,
      parent_task_id: taskData.parent_task_id,
      activities: taskData.activities ?? [],
    };

    if (this.isOnline) {
      // If online, try to save to server first
      try {
        // This would be the actual API call to your backend
        // const serverTask = await taskService.createTask(taskData);
        // await this.saveTask(serverTask);
        // return serverTask;
        
        // For now, just save locally
        await this.saveTask(task);
        return task;
      } catch (error) {
        // If server fails, save locally and queue for sync
        await this.saveTask(task);
        await this.addPendingOperation('CREATE_TASK', task, userId);
        return task;
      }
    } else {
      // Offline - save locally and queue for sync
      await this.saveTask(task);
      await this.addPendingOperation('CREATE_TASK', task, userId);
      return task;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>, userId: string): Promise<Task> {
    const tasks = await this.getTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    const updatedTask = {
      ...tasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (this.isOnline) {
      try {
        // Try to update on server first
        // const serverTask = await taskService.updateTask(taskId, updates);
        // await this.updateLocalTask(updatedTask);
        // return serverTask;
        
        // For now, just update locally
        await this.updateLocalTask(updatedTask);
        return updatedTask;
      } catch (error) {
        // If server fails, update locally and queue for sync
        await this.updateLocalTask(updatedTask);
        await this.addPendingOperation('UPDATE_TASK', { id: taskId, updates }, userId);
        return updatedTask;
      }
    } else {
      // Offline - update locally and queue for sync
      await this.updateLocalTask(updatedTask);
      await this.addPendingOperation('UPDATE_TASK', { id: taskId, updates }, userId);
      return updatedTask;
    }
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    console.log('OfflineService: deleteTask called with taskId:', taskId, 'userId:', userId);

    await this.removeLocalTask(taskId);
    await this.notifyListeners();

    if (this.isOnline) {
      if (!isUuidTaskId(taskId)) {
        return;
      }
      try {
        await taskService.deleteTask(taskId);
      } catch (error) {
        console.warn('OfflineService: Server delete failed, queueing DELETE_TASK', error);
        await this.addPendingOperation('DELETE_TASK', { id: taskId }, userId);
      }
    } else if (isUuidTaskId(taskId)) {
      await this.addPendingOperation('DELETE_TASK', { id: taskId }, userId);
    }
    console.log('OfflineService: deleteTask completed for taskId:', taskId);
  }

  /** Task IDs waiting for server delete — merged Supabase fetch must ignore these or ghosts reappear. */
  async getPendingDeleteTaskIds(userId: string): Promise<Set<string>> {
    const operations = await this.getPendingOperations();
    const ids = new Set<string>();
    for (const op of operations) {
      if (
        op.type === 'DELETE_TASK' &&
        op.userId === userId &&
        op.data?.id != null &&
        isUuidTaskId(String(op.data.id))
      ) {
        ids.add(String(op.data.id));
      }
    }
    return ids;
  }

  async getTasks(userId?: string): Promise<Task[]> {
    const tasks = await this.getLocalTasks();
    if (userId) {
      return tasks.filter(task => task.user_id === userId);
    }
    return tasks;
  }

  // Focus session operations
  async createFocusSession(sessionData: Partial<FocusSession>, userId: string): Promise<FocusSession> {
    const session: FocusSession = {
      id: this.generateOfflineId(),
      user_id: userId,
      task_id: sessionData.task_id,
      start_time: sessionData.start_time || new Date().toISOString(),
      end_time: sessionData.end_time,
      status: sessionData.status || 'active',
      notes: sessionData.notes || '',
      interruptions: sessionData.interruptions || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.isOnline) {
      try {
        // Try to save to server first
        // const serverSession = await focusService.createSession(sessionData);
        // await this.saveFocusSession(serverSession);
        // return serverSession;
        
        // For now, just save locally
        await this.saveFocusSession(session);
        return session;
      } catch (error) {
        await this.saveFocusSession(session);
        await this.addPendingOperation('CREATE_FOCUS_SESSION', session, userId);
        return session;
      }
    } else {
      await this.saveFocusSession(session);
      await this.addPendingOperation('CREATE_FOCUS_SESSION', session, userId);
      return session;
    }
  }

  async updateFocusSession(sessionId: string, updates: Partial<FocusSession>, userId: string): Promise<FocusSession> {
    const sessions = await this.getFocusSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
      throw new Error('Focus session not found');
    }

    const updatedSession = {
      ...sessions[sessionIndex],
      ...updates
    };

    if (this.isOnline) {
      try {
        // await focusService.updateSession(sessionId, updates);
        await this.updateLocalFocusSession(updatedSession);
        return updatedSession;
      } catch (error) {
        await this.updateLocalFocusSession(updatedSession);
        await this.addPendingOperation('UPDATE_FOCUS_SESSION', { id: sessionId, updates }, userId);
        return updatedSession;
      }
    } else {
      await this.updateLocalFocusSession(updatedSession);
      await this.addPendingOperation('UPDATE_FOCUS_SESSION', { id: sessionId, updates }, userId);
      return updatedSession;
    }
  }

  async getFocusSessions(userId?: string): Promise<FocusSession[]> {
    const sessions = await this.getLocalFocusSessions();
    if (userId) {
      return sessions.filter(session => session.user_id === userId);
    }
    return sessions;
  }

  // Sync operations
  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    
    try {
      const pendingOperations = await this.getPendingOperations();
      
      for (const operation of pendingOperations) {
        try {
          switch (operation.type) {
            case 'CREATE_TASK':
              // await taskService.createTask(operation.data);
              break;
            case 'UPDATE_TASK':
              // await taskService.updateTask(operation.data.id, operation.data.updates);
              break;
            case 'DELETE_TASK': {
              const delId = operation.data?.id;
              if (delId != null && isUuidTaskId(String(delId))) {
                await taskService.deleteTask(String(delId));
              }
              break;
            }
            case 'CREATE_FOCUS_SESSION':
              // await focusService.createSession(operation.data);
              break;
            case 'UPDATE_FOCUS_SESSION':
              // await focusService.updateSession(operation.data.id, operation.data.updates);
              break;
          }
          
          // Remove successful operation
          await this.removePendingOperation(operation.id);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
        }
      }
      
      await this.setLastSync(Date.now());
      await this.notifyListeners();
    } finally {
      this.syncInProgress = false;
    }
  }

  // Local storage operations
  async saveTask(task: Task): Promise<void> {
    const tasks = await this.getLocalTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  private async updateLocalTask(updatedTask: Task): Promise<void> {
    const tasks = await this.getLocalTasks();
    const taskIndex = tasks.findIndex(t => t.id === updatedTask.id);
    
    if (taskIndex >= 0) {
      tasks[taskIndex] = updatedTask;
      await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }

  private async removeLocalTask(taskId: string): Promise<void> {
    console.log('OfflineService: removeLocalTask called with taskId:', taskId);
    const tasks = await this.getLocalTasks();
    console.log('OfflineService: Current local tasks count:', tasks.length);
    
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    console.log('OfflineService: After filtering, tasks count:', filteredTasks.length);
    
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filteredTasks));
    console.log('OfflineService: Task removed from local storage');
  }

  private async getLocalTasks(): Promise<Task[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading local tasks:', error);
      return [];
    }
  }

  private async saveFocusSession(session: FocusSession): Promise<void> {
    const sessions = await this.getLocalFocusSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(sessions));
  }

  private async updateLocalFocusSession(updatedSession: FocusSession): Promise<void> {
    const sessions = await this.getLocalFocusSessions();
    const sessionIndex = sessions.findIndex(s => s.id === updatedSession.id);
    
    if (sessionIndex >= 0) {
      sessions[sessionIndex] = updatedSession;
      await AsyncStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(sessions));
    }
  }

  private async getLocalFocusSessions(): Promise<FocusSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading local focus sessions:', error);
      return [];
    }
  }

  // Pending operations management
  private async addPendingOperation(type: OperationType, data: any, userId: string): Promise<void> {
    const operations = await this.getPendingOperations();
    const operation: PendingOperation = {
      id: this.generateOfflineId(),
      type,
      data,
      timestamp: Date.now(),
      userId
    };
    
    operations.push(operation);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
  }

  private async removePendingOperation(operationId: string): Promise<void> {
    const operations = await this.getPendingOperations();
    const filteredOperations = operations.filter(op => op.id !== operationId);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(filteredOperations));
  }

  private async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading pending operations:', error);
      return [];
    }
  }

  // Utility functions
  private generateOfflineId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getLastSync(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? parseInt(data, 10) : null;
    } catch (error) {
      return null;
    }
  }

  private async setLastSync(timestamp: number): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
  }

  // Clear all offline data (useful for logout)
  async clearOfflineData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.TASKS),
      AsyncStorage.removeItem(STORAGE_KEYS.FOCUS_SESSIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.PENDING_OPERATIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_ID)
    ]);
  }
}

// Export singleton instance
export const offlineService = new OfflineService(); 