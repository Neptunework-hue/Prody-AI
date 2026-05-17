import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemFolder } from '../types/folder';

const K_TASK = (userId: string) => `questlog_task_folders_${userId}`;
const K_HABIT = (userId: string) => `questlog_habit_folders_${userId}`;
const K_HABIT_MAP = (userId: string) => `questlog_habit_folder_map_${userId}`;

function genId(): string {
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getTaskFolders(userId: string): Promise<ItemFolder[]> {
  try {
    const raw = await AsyncStorage.getItem(K_TASK(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ItemFolder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTaskFolders(userId: string, folders: ItemFolder[]): Promise<void> {
  await AsyncStorage.setItem(K_TASK(userId), JSON.stringify(folders));
}

export async function addTaskFolder(userId: string, name: string): Promise<ItemFolder> {
  const folders = await getTaskFolders(userId);
  const folder: ItemFolder = {
    id: genId(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };
  await saveTaskFolders(userId, [...folders, folder]);
  return folder;
}

/** Reuse an existing folder (case-insensitive name) or create it. */
export async function getOrCreateTaskFolderByName(userId: string, name: string): Promise<ItemFolder> {
  const trimmed = name.trim();
  if (!trimmed) {
    return addTaskFolder(userId, 'General');
  }
  const folders = await getTaskFolders(userId);
  const hit = folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
  if (hit) return hit;
  return addTaskFolder(userId, trimmed);
}

export async function removeTaskFolder(userId: string, folderId: string): Promise<void> {
  const folders = await getTaskFolders(userId);
  await saveTaskFolders(
    userId,
    folders.filter((f) => f.id !== folderId),
  );
}

export async function getHabitFolders(userId: string): Promise<ItemFolder[]> {
  try {
    const raw = await AsyncStorage.getItem(K_HABIT(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ItemFolder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHabitFolders(userId: string, folders: ItemFolder[]): Promise<void> {
  await AsyncStorage.setItem(K_HABIT(userId), JSON.stringify(folders));
}

export async function addHabitFolder(userId: string, name: string): Promise<ItemFolder> {
  const folders = await getHabitFolders(userId);
  const folder: ItemFolder = {
    id: genId(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };
  await saveHabitFolders(userId, [...folders, folder]);
  return folder;
}

export async function removeHabitFolder(userId: string, folderId: string): Promise<void> {
  const folders = await getHabitFolders(userId);
  await saveHabitFolders(
    userId,
    folders.filter((f) => f.id !== folderId),
  );
}

export async function getHabitFolderMap(userId: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(K_HABIT_MAP(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setHabitFolderAssignment(
  userId: string,
  habitId: string,
  folderId: string | null,
): Promise<void> {
  const map = await getHabitFolderMap(userId);
  if (folderId === null || folderId === '') {
    delete map[habitId];
  } else {
    map[habitId] = folderId;
  }
  await AsyncStorage.setItem(K_HABIT_MAP(userId), JSON.stringify(map));
}

/** Remove all habit→folder mappings pointing at a deleted folder. */
export async function clearHabitFolderMapEntriesForFolder(userId: string, folderId: string): Promise<void> {
  const map = await getHabitFolderMap(userId);
  let changed = false;
  for (const habitId of Object.keys(map)) {
    if (map[habitId] === folderId) {
      delete map[habitId];
      changed = true;
    }
  }
  if (changed) {
    await AsyncStorage.setItem(K_HABIT_MAP(userId), JSON.stringify(map));
  }
}
