import { Tabs, usePathname, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const SWIPE_ROUTES = ['dashboard', 'calendar', 'tasks', 'habits', 'focus'];

export default function AppLayout() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const currentRoute = SWIPE_ROUTES.findIndex((route) => pathname.includes(route));

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-45, 45])
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      if (currentRoute === -1) return;

      if (event.translationX < -90 && currentRoute < SWIPE_ROUTES.length - 1) {
        runOnJS(router.replace)(`/(app)/${SWIPE_ROUTES[currentRoute + 1]}`);
      }

      if (event.translationX > 90 && currentRoute > 0) {
        runOnJS(router.replace)(`/(app)/${SWIPE_ROUTES[currentRoute - 1]}`);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            tabBarHideOnKeyboard: true,
          }}
        >
          <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
          <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
          <Tabs.Screen name="focus" options={{ title: 'Focus' }} />
          <Tabs.Screen name="history" options={{ title: 'Shelf' }} />
          <Tabs.Screen name="habits" options={{ title: 'Habits' }} />
          <Tabs.Screen name="statistics" options={{ title: 'Statistics' }} />
          <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
          <Tabs.Screen name="offline-settings" options={{ title: 'Offline Settings' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
      </View>
    </GestureDetector>
  );
}