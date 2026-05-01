import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import React from 'react';
import { View } from 'react-native';

export default function AppLayout() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar since we have custom BottomNavBar
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{
            title: 'Focus',
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Shelf',
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: 'Habits',
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            title: 'Statistics',
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
          }}
        />
        <Tabs.Screen
          name="offline-settings"
          options={{
            title: 'Offline Settings',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
      </Tabs>
    </View>
  );
} 