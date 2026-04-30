import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkThemeColors,
  lightThemeColors,
  type ThemeColors,
} from '../constants/lifeTrackerDesign';

const STORAGE_LIGHT = 'questlog-theme-light';
const STORAGE_PARCHMENT_LEGACY = 'questlog-theme-parchment';

type AppThemeContextValue = {
  isLight: boolean;
  colors: ThemeColors;
  setLight: (next: boolean) => Promise<void>;
  toggleLight: () => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLight, setIsLightState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lightRaw, parchmentRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_LIGHT),
        AsyncStorage.getItem(STORAGE_PARCHMENT_LEGACY),
      ]);
      if (cancelled) return;
      let light = lightRaw === '1';
      if (lightRaw == null && parchmentRaw === '1') {
        light = true;
        await AsyncStorage.setItem(STORAGE_LIGHT, '1');
        await AsyncStorage.removeItem(STORAGE_PARCHMENT_LEGACY);
      }
      setIsLightState(light);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLight = useCallback(async (next: boolean) => {
    setIsLightState(next);
    await AsyncStorage.setItem(STORAGE_LIGHT, next ? '1' : '0');
  }, []);

  const toggleLight = useCallback(async () => {
    await setLight(!isLight);
  }, [isLight, setLight]);

  const colors = useMemo(() => (isLight ? lightThemeColors : darkThemeColors), [isLight]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      isLight,
      colors,
      setLight,
      toggleLight,
    }),
    [isLight, colors, setLight, toggleLight],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}
