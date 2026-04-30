import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, IconButton, useTheme } from 'react-native-paper';
import { type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from 'expo-router';
import { taskService } from '../../services/supabase/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { Task } from '../../types/task';

function createHistoryStyles(c: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    loading: {
      textAlign: 'center',
      marginTop: 20,
    },
    empty: {
      textAlign: 'center',
      marginTop: 20,
    },
    taskCard: {
      borderRadius: 16,
      marginBottom: 16,
      padding: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.outline,
    },
    completed: {
      borderLeftWidth: 4,
      borderLeftColor: c.teal,
    },
    failed: {
      borderLeftWidth: 4,
      borderLeftColor: '#cf6679',
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    taskDesc: {
      fontSize: 14,
      marginTop: 4,
    },
    taskStatus: {
      fontSize: 13,
      fontWeight: 'bold',
      marginTop: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 32,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
    },
  });
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createHistoryStyles(c), [c]);
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPreviousTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allTasks = await taskService.getTasks(user.id);
      const previous = allTasks.filter(task => task.status === 'completed' || task.status === 'failed');
      setTasks(previous);
    } catch (e) {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPreviousTasks();
  };

  useEffect(() => {
    fetchPreviousTasks();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      fetchPreviousTasks();
    }, [user])
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} 
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Shelf</Text>
          <IconButton icon="refresh" onPress={onRefresh} iconColor={theme.colors.onSurface} />
        </View>
        {loading ? (
          <Text style={[styles.loading, { color: c.parchmentMuted }]}>Loading...</Text>
        ) : tasks.length === 0 ? (
          <Text style={[styles.empty, { color: c.parchmentMuted }]}>No completed quests yet. Trophy shelf will fill as you finish tasks.</Text>
        ) : (
          tasks.map(task => (
            <Card
              key={task.id}
              mode="elevated"
              style={[
                styles.taskCard,
                { backgroundColor: theme.colors.surfaceVariant },
                task.status === 'completed' ? styles.completed : styles.failed,
              ]}
            >
              <Card.Content>
                <Text style={[styles.taskTitle, { color: theme.colors.onSurface }]}>{task.title}</Text>
                <Text style={[styles.taskDesc, { color: c.parchmentMuted }]}>{task.description}</Text>
                <Text style={[styles.taskStatus, { color: task.status === 'completed' ? c.teal : '#cf6679' }]}>
                  {task.status === 'completed' ? 'Completed' : 'Failed'}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
} 