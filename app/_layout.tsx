import { Stack } from 'expo-router';
import { PaperProvider, Portal } from 'react-native-paper';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
          <Portal.Host>
            <Stack>
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
          </Portal.Host>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
