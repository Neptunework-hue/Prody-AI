import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, Portal } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthLinkHandler from '../components/AuthLinkHandler';
import { buildLifeTrackerPaperTheme } from '../constants/lifeTrackerDesign';
import { AppThemeProvider, useAppTheme } from '../contexts/AppThemeContext';

function ThemedRoot() {
  const { isLight } = useAppTheme();
  const paperTheme = useMemo(() => buildLifeTrackerPaperTheme(isLight), [isLight]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
      <SafeAreaProvider>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        <PaperProvider theme={paperTheme}>
          <AuthLinkHandler />
          <Portal.Host>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </Portal.Host>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
