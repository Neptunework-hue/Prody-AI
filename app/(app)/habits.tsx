import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Portal, Modal, FAB, TextInput, RadioButton, useTheme } from 'react-native-paper';
import { LT } from '../../constants/lifeTrackerDesign';
import { ScrollView as RNScrollView } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { habitService } from '../../services/supabase/habitService';
import { Habit } from '../../types/habit';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import DateTimePicker from '@react-native-community/datetimepicker';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HABIT_EMOJIS = ['🏃', '📚', '🧘', '💧', '🍎', '📝', '💪', '🛏️', '🧹', '🎨', '🎸', '🚴', '🏊', '🥗', '🧑‍💻', '📖', '🦷', '🧑‍🍳', '🚶', '🧑‍🎤', '🎮', '🧑‍🔬', '🧑‍🏫', '🧑‍🎓', '🧑‍🚀', '🧑‍🌾'];
const defaultForm = { title: '', description: '', frequency: 'daily', icon: '', days: [0,1,2,3,4,5,6], notifyTime: null };

export default function HabitsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchHabits = useCallback(async () => {
    if (!user) return;
    const userHabits = await habitService.getHabits(user.id);
    setHabits(userHabits);
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
    // Lazy-load so Expo Go does not run push registration side effects until user schedules a reminder
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
        hour: notifyDate.getHours(),
        minute: notifyDate.getMinutes(),
        repeats: true,
      } as any,
    });
    return notificationId;
  }

  const handleSave = async () => {
    if (!user) return;
    if (!form.title) return;
    let notificationId;
    try {
      if (form.notifyTime) {
        notificationId = await scheduleHabitNotification({
          ...form,
          title: form.title,
          description: form.description,
          notifyTime: form.notifyTime,
        });
      }
      const habitData = {
        user_id: user.id,
        userId: user.id, // Fix: add userId for Habit type
        title: form.title,
        description: form.description,
        progress: 0,
        frequency: form.frequency as 'daily' | 'weekly' | 'monthly',
        icon: form.icon,
        streak: 0,
        history: [],
        days: form.frequency === 'daily' ? [0,1,2,3,4,5,6] : form.days,
        notifyTime: form.notifyTime,
        notification_id: notificationId, // changed from notificationId
      };
      await habitService.addHabit(habitData);
      setModalVisible(false);
      setForm({ ...defaultForm });
      fetchHabits();
    } catch (e) {
      console.error('Error creating habit:', e);
      alert('Error creating habit: ' + (e.message || e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.header, { color: theme.colors.onSurface }]}>Habits</Text>
        {habits.length === 0 && <Text style={{ color: LT.parchmentMuted, marginTop: 24 }}>No habits yet.</Text>}
        {habits.map(habit => (
          <Card key={habit.id} mode="elevated" style={[styles.habitCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginRight: 12 }}>{habit.icon || '🏆'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: theme.colors.onSurface }}>{habit.title}</Text>
                <Text style={{ color: LT.parchmentMuted, fontSize: 13 }}>{habit.description} | Streak: {habit.streak}</Text>
              </View>
              <Button mode="contained-tonal" compact onPress={async () => {
                await habitService.logHabitProgress(habit.id, new Date().toISOString().slice(0,10), 1);
                fetchHabits();
              }} style={{ marginRight: 8 }}>+</Button>
              <IconButton icon="delete" size={20} onPress={async () => {
                await habitService.deleteHabit(habit.id);
                fetchHabits();
              }} />
            </View>
          </Card>
        ))}
      </ScrollView>
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setModalVisible(true)}
        label="Add Habit"
      />
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <RNScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Emoji avatar picker at the top */}
            <TouchableOpacity
              style={styles.emojiCircle}
              onPress={() => setEmojiPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 40 }}>{form.icon || '🏃'}</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, textAlign: 'center' }}>Create Habit</Text>
            {/* Title */}
            <TextInput
              label="Title"
              value={form.title}
              onChangeText={text => setForm(f => ({ ...f, title: text }))}
              style={{ marginBottom: 12 }}
            />
            {/* Description */}
            <TextInput
              label="Description"
              value={form.description}
              onChangeText={text => setForm(f => ({ ...f, description: text }))}
              style={{ marginBottom: 12 }}
              multiline
              numberOfLines={3}
            />
            {/* Frequency selection, horizontally scrollable */}
            <Text style={{ marginBottom: 4 }}>Frequency</Text>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <RadioButton.Group
                onValueChange={value => setForm(f => ({ ...f, frequency: value }))}
                value={form.frequency}
              >
                <View style={{ flexDirection: 'row' }}>
                  <RadioButton.Item label="Daily" value="daily" position="leading" style={{ marginRight: 8 }} />
                  <RadioButton.Item label="Weekly" value="weekly" position="leading" style={{ marginRight: 8 }} />
                  <RadioButton.Item label="Monthly" value="monthly" position="leading" style={{ marginRight: 8 }} />
                </View>
              </RadioButton.Group>
            </RNScrollView>
            {/* Days of week selector if needed */}
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
                          backgroundColor: selected ? LT.pink : LT.surfaceElevated,
                          borderWidth: selected ? 0 : 1,
                          borderColor: selected ? 'transparent' : LT.outline,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: selected ? 0.18 : 0.08,
                          shadowRadius: 4,
                          elevation: selected ? 4 : 1,
                        }}
                        activeOpacity={0.7}
                        onPress={() => {
                          setForm(f => ({
                            ...f,
                            days: selected ? f.days.filter(i => i !== idx) : [...f.days, idx].sort(),
                          }));
                        }}
                      >
                        <Text style={{
                          color: selected ? LT.bg : LT.parchment,
                          fontWeight: 'bold',
                          fontSize: 16,
                          letterSpacing: 1,
                        }}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </RNScrollView>
            )}
            {/* Notify Me section */}
            <Text style={{ marginBottom: 4, marginTop: 8 }}>Notify Me</Text>
            <Button
              mode="outlined"
              onPress={() => setShowTimePicker(true)}
              style={{ marginBottom: 12 }}
            >
              {form.notifyTime ? new Date(form.notifyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pick a time'}
            </Button>
            {showTimePicker && (
              <DateTimePicker
                value={form.notifyTime ? new Date(form.notifyTime) : new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) {
                    setForm(f => ({ ...f, notifyTime: selectedDate.toISOString() }));
                  }
                }}
              />
            )}
            {/* Create button */}
            <Button mode="contained" onPress={handleSave} style={{ marginTop: 8 }}>Create</Button>
          </RNScrollView>
          {/* Emoji picker modal */}
          <Portal>
            <Modal visible={emojiPickerVisible} onDismiss={() => setEmojiPickerVisible(false)} contentContainerStyle={styles.emojiPickerModal}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, textAlign: 'center' }}>Pick an Emoji</Text>
              <RNScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {HABIT_EMOJIS.map((emoji, idx) => (
                  <TouchableOpacity
                    key={emoji + idx}
                    style={styles.emojiOption}
                    onPress={() => {
                      setForm(f => ({ ...f, icon: emoji }));
                      setEmojiPickerVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 32 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </RNScrollView>
            </Modal>
          </Portal>
        </Modal>
      </Portal>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  habitCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 24,
    zIndex: 10,
  },
  emojiCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LT.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 8,
    borderWidth: 2,
    borderColor: LT.outline,
  },
  emojiPickerModal: {
    backgroundColor: LT.surfaceElevated,
    padding: 24,
    margin: 24,
    borderRadius: 16,
    maxWidth: 400,
    minWidth: 240,
    alignSelf: 'center',
  },
  emojiOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    backgroundColor: LT.surface,
    borderWidth: 1,
    borderColor: LT.outline,
  },
  modal: {
    backgroundColor: LT.surfaceElevated,
    padding: 24,
    margin: 24,
    borderRadius: 16,
    maxWidth: 400,
    minWidth: 240,
    alignSelf: 'center',
  },
}); 