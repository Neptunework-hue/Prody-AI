import { Stack } from 'expo-router';
import { PaperProvider, Portal } from 'react-native-paper';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { lifeTrackerPaperTheme } from '../constants/lifeTrackerDesign';

export default function Layout() {
  const appTheme = useMemo(() => lifeTrackerPaperTheme, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <StatusBar style="light" />
      <PaperProvider theme={appTheme}>
        <Portal.Host>
          <Stack>
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </Portal.Host>
      </PaperProvider>
    </GestureHandlerRootView>
  );
} 