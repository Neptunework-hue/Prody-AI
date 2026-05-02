import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, IconButton, Portal, Modal, FAB, TextInput, RadioButton, Chip } from 'react-native-paper';
import { ScrollView as RNScrollView } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import Sidebar from '../../components/Sidebar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { ItemFolder } from '../../types/folder';
import * as foldersStorage from '../../services/foldersStorage';
import { localDateKey } from '../../services/questStreak';
import HabitQuestCard from '../../components/habits/HabitQuestCard';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type HabitFolderFilter = 'all' | 'ungrouped' | string;

const defaultForm = {
  title: '',
  description: '',
  frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
  days: [0, 1, 2, 3, 4, 5, 6],
  notifyTime: null as string | null,
  folderId: null as string | null,
};

function createHabitStyles(c: ThemeColors) {
  return StyleSheet.create({
    folderBar: {
      marginBottom: 16,
      maxHeight: 44,
    },
    chip: {
      marginRight: 8,
    },
    folderChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 4,
    },
    folderDeleteBtn: {
      margin: 0,
      marginLeft: -6,
    },
    empty: {
      color: c.tx2,
      marginTop: 24,
      fontFamily: FONT_SERIF,
    },
    fab: {
      position: 'absolute',
      right: 24,
      bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
      zIndex: 200,
      elevation: 6,
      backgroundColor: c.amber,
    },
    modal: {
      backgroundColor: c.surfaceElevated,
      padding: 24,
      margin: 24,
      borderRadius: 16,
      maxWidth: 400,
      alignSelf: 'center',
    },
    modalTitle: {
      fontWeight: '600',
      fontSize: 18,
      marginBottom: 12,
      color: c.tx,
      fontFamily: FONT_SERIF,
    },
    label: {
      marginBottom: 8,
      marginTop: 8,
      color: c.tx2,
      fontFamily: FONT_SERIF,
    },
  });
}

export default function HabitsScreen() {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createHabitStyles(c), [c]);
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitFolders, setHabitFolders] = useState<ItemFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<HabitFolderFilter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [habitHistoryFull, setHabitHistoryFull] = useState<
    { habit_id: string; date: string; value?: number }[]
  >([]);

  const fetchHabits = useCallback(async () => {
    if (!user) return;
    const [userHabits, map, folders] = await Promise.all([
      habitService.getHabits(user.id),
      foldersStorage.getHabitFolderMap(user.id),
      foldersStorage.getHabitFolders(user.id),
    ]);
    setHabitFolders(folders);
    setHabits(
      userHabits.map((h) => ({
        ...h,
        folder_id: map[h.id] ?? null,
      })),
    );
    if (userHabits.length === 0) {
      setHabitHistoryFull([]);
      return;
    }
    const hist = await habitService.getHabitHistoryByHabitIds(userHabits.map((h) => h.id));
    setHabitHistoryFull(hist);
  }, [user]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  async function scheduleHabitNotification(habit: {
    title: string;
    description?: string;
    notifyTime: string | Date;
    notification_id?: string;
  }) {
    if (!habit.notifyTime) return;
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
    if (habit.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(habit.notification_id);
    }
    const notifyDate = new Date(habit.notifyTime);
    const now = new Date();
    if (notifyDate < now) {
      notifyDate.setDate(notifyDate.getDate() + 1);
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: habit.title,
        body: habit.description || 'Habit Reminder',
        sound: true,
      },
      trigger: {
      type: 'daily',
      hour: notifyDate.getHours(),
      minute: notifyDate.getMinutes(),
    } as any,
    });
    return notificationId;
  }

  const handleSave = async () => {
    if (!user) return;
    if (!form.title) return;
    let notificationId: string | null = null;
    try {
      if (form.notifyTime) {
        notificationId = (await scheduleHabitNotification({
          ...form,
          title: form.title,
          description: form.description,
          notifyTime: form.notifyTime,
        })) ?? null ;
      }
      const habitData: any  = {
        user_id: user.id,
        title: form.title,
        description: form.description,
        progress: 0,
        frequency: form.frequency,
        streak: 0,
        history: [],
        days: form.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : form.days,
        notify_time: form.notifyTime
      ? new Date(form.notifyTime).toTimeString().slice(0, 8)
      : null,
        notification_id: notificationId,
      };
      const created = await habitService.addHabit(habitData);
      if (form.folderId) {
        await foldersStorage.setHabitFolderAssignment(user.id, created.id, form.folderId);
      }
      setModalVisible(false);
      setForm({ ...defaultForm });
      fetchHabits();
    } catch (e: unknown) {
      console.error('Error creating habit:', e);
      const msg = e instanceof Error ? e.message : String(e);
      alert('Error creating habit: ' + msg);
    }
  };

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    await foldersStorage.addHabitFolder(user.id, newFolderName.trim());
    setNewFolderName('');
    setNewFolderOpen(false);
    const folders = await foldersStorage.getHabitFolders(user.id);
    setHabitFolders(folders);
  };

  const confirmDeleteHabitFolder = (folder: ItemFolder) => {
    Alert.alert(
      'Remove folder',
      `Delete “${folder.name}”? Habits in this folder become ungrouped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await foldersStorage.clearHabitFolderMapEntriesForFolder(user.id, folder.id);
              await foldersStorage.removeHabitFolder(user.id, folder.id);
              if (folderFilter === folder.id) setFolderFilter('all');
              setForm((f) => (f.folderId === folder.id ? { ...f, folderId: null } : f));
              await fetchHabits();
            } catch (e) {
              console.error(e);
            }
          },
        },
      ],
    );
  };

  const folderChipSurface = (selected: boolean) =>
    selected
      ? { backgroundColor: c.amber, borderWidth: 0 as const }
      : { backgroundColor: c.surf, borderWidth: 1, borderColor: c.amberBorder };

  const visibleHabits = habits.filter((h) => {
    if (folderFilter === 'all') return true;
    if (folderFilter === 'ungrouped') return !h.folder_id;
    return h.folder_id === folderFilter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <QuestLogScreenHeader
        title="Habits"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
        right={<IconButton icon="refresh" onPress={() => fetchHabits()} iconColor={c.amber} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 72 }}
      >
        <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderBar}>
          <Chip
            mode="flat"
            onPress={() => setFolderFilter('all')}
            style={[styles.chip, folderChipSurface(folderFilter === 'all')]}
            textStyle={{ color: folderFilter === 'all' ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
          >
            All
          </Chip>
          <Chip
            mode="flat"
            onPress={() => setFolderFilter('ungrouped')}
            style={[styles.chip, folderChipSurface(folderFilter === 'ungrouped')]}
            textStyle={{ color: folderFilter === 'ungrouped' ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
          >
            Ungrouped
          </Chip>
          {habitFolders.map((f) => {
            const sel = folderFilter === f.id;
            return (
              <View key={f.id} style={styles.folderChipRow}>
                <Chip
                  mode="flat"
                  onPress={() => setFolderFilter(f.id)}
                  onLongPress={() => confirmDeleteHabitFolder(f)}
                  delayLongPress={450}
                  style={[styles.chip, folderChipSurface(sel)]}
                  textStyle={{ color: sel ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
                >
                  {f.name}
                </Chip>
                <IconButton
                  icon="trash-can-outline"
                  size={18}
                  accessibilityLabel={`Delete folder ${f.name}`}
                  onPress={() => confirmDeleteHabitFolder(f)}
                  iconColor={c.tx2}
                  style={styles.folderDeleteBtn}
                />
              </View>
            );
          })}
          <Chip
            mode="outlined"
            icon="folder-plus"
            onPress={() => setNewFolderOpen(true)}
            style={[styles.chip, { borderColor: c.amber }]}
            textStyle={{ color: c.amber, fontFamily: FONT_SERIF }}
          >
            Folder
          </Chip>
        </RNScrollView>

        {visibleHabits.length === 0 && (
          <Text style={styles.empty}>No habits in this view.</Text>
        )}
        {visibleHabits.map((habit) => (
          <HabitQuestCard
            key={habit.id}
            habit={habit}
            rowsForHabit={habitHistoryFull
              .filter((r) => r.habit_id === habit.id)
              .map((r) => ({ date: r.date, value: r.value }))}
            onLogToday={async () => {
              await habitService.logHabitProgress(habit.id, localDateKey(new Date()), 1);
              fetchHabits();
            }}
            onDelete={async () => {
              await habitService.deleteHabit(habit.id);
              if (user) await foldersStorage.setHabitFolderAssignment(user.id, habit.id, null);
              fetchHabits();
            }}
          />
        ))}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        color={c.onAccent}
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal visible={newFolderOpen} onDismiss={() => setNewFolderOpen(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>New habit folder</Text>
          <TextInput
            label="Folder name"
            value={newFolderName}
            onChangeText={setNewFolderName}
            mode="outlined"
            style={{ marginBottom: 12, backgroundColor: c.surf }}
          />
          <Button textColor={c.tx2} onPress={() => setNewFolderOpen(false)}>
            Cancel
          </Button>
          <Button buttonColor={c.amber} textColor={c.onAccent} onPress={createFolder} disabled={!newFolderName.trim()}>
            Create
          </Button>
        </Modal>

        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <RNScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.modalTitle}>Create habit</Text>
            <TextInput
              label="Title"
              value={form.title}
              onChangeText={(text) => setForm((f) => ({ ...f, title: text }))}
              style={{ marginBottom: 12 }}
              mode="outlined"
              textColor={c.tx}
            />
            <TextInput
              label="Description"
              value={form.description}
              onChangeText={(text) => setForm((f) => ({ ...f, description: text }))}
              style={{ marginBottom: 12 }}
              multiline
              numberOfLines={3}
              mode="outlined"
              textColor={c.tx}
            />

            <Text style={styles.label}>Folder</Text>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Chip
                mode="flat"
                onPress={() => setForm((f) => ({ ...f, folderId: null }))}
                style={[styles.chip, folderChipSurface(form.folderId === null)]}
                textStyle={{
                  color: form.folderId === null ? c.chipSelectedFg : c.amber,
                  fontFamily: FONT_SERIF,
                }}
              >
                None
              </Chip>
              {habitFolders.map((f) => {
                const sel = form.folderId === f.id;
                return (
                  <View key={f.id} style={styles.folderChipRow}>
                    <Chip
                      mode="flat"
                      onPress={() => setForm((fo) => ({ ...fo, folderId: f.id }))}
                      onLongPress={() => confirmDeleteHabitFolder(f)}
                      delayLongPress={450}
                      style={[styles.chip, folderChipSurface(sel)]}
                      textStyle={{ color: sel ? c.chipSelectedFg : c.amber, fontFamily: FONT_SERIF }}
                    >
                      {f.name}
                    </Chip>
                    <IconButton
                      icon="trash-can-outline"
                      size={18}
                      accessibilityLabel={`Delete folder ${f.name}`}
                      onPress={() => confirmDeleteHabitFolder(f)}
                      iconColor={c.tx2}
                      style={styles.folderDeleteBtn}
                    />
                  </View>
                );
              })}
            </RNScrollView>

            <Text style={styles.label}>Frequency</Text>
            <RadioButton.Group
              onValueChange={(value) => setForm((f) => ({ ...f, frequency: value as typeof f.frequency }))}
              value={form.frequency}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <RadioButton.Item label="Daily" value="daily" position="leading" />
                <RadioButton.Item label="Weekly" value="weekly" position="leading" />
                <RadioButton.Item label="Monthly" value="monthly" position="leading" />
              </View>
            </RadioButton.Group>

            {(form.frequency === 'weekly' || form.frequency === 'monthly') && (
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {DAYS.map((d, idx) => {
                    const selected = form.days.includes(idx);
                    return (
                      <TouchableOpacity
                        key={d + idx}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          marginHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? c.amber : c.surf,
                          borderWidth: 1,
                          borderColor: selected ? c.amberBorder : c.borderDefault,
                        }}
                        activeOpacity={0.7}
                        onPress={() => {
                          setForm((f) => ({
                            ...f,
                            days: selected ? f.days.filter((i) => i !== idx) : [...f.days, idx].sort(),
                          }));
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? c.chipSelectedFg : c.tx,
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </RNScrollView>
            )}

            <Text style={styles.label}>Notify me</Text>
            <Button
              mode="outlined"
              onPress={() => setShowTimePicker(true)}
              style={{ marginBottom: 12 }}
              textColor={c.amber}
            >
              {form.notifyTime
                ? new Date(form.notifyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Pick a time'}
            </Button>
            {showTimePicker && (
              <DateTimePicker
                value={form.notifyTime ? new Date(form.notifyTime) : new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) {
                    setForm((f) => ({ ...f, notifyTime: selectedDate.toISOString() }));
                  }
                }}
              />
            )}

            <Button mode="contained" onPress={handleSave} buttonColor={c.amber} textColor={c.onAccent}>
              Create
            </Button>
          </RNScrollView>
        </Modal>
      </Portal>
      <BottomNavBar />
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}
