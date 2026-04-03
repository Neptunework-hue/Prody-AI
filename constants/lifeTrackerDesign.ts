/**
 * Life Tracker — dark RPG terminal palette (design.md).
 * Used by Paper theme + screens that need static StyleSheet colors.
 */
import { Platform } from 'react-native';
import { MD3DarkTheme, configureFonts } from 'react-native-paper';

export const LT = {
  bg: '#0f0f14',
  parchment: '#e8e0cc',
  parchmentMuted: '#c4bba8',
  amber: '#EF9F27',
  teal: '#1D9E75',
  blue: '#378ADD',
  pink: '#D4537E',
  surface: '#1a1a22',
  surfaceElevated: '#22222c',
  outline: '#4a4a55',
} as const;

export const FONT_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
}) as string;

const serif = { fontFamily: FONT_SERIF };

const fontConfig = {
  ...MD3DarkTheme.fonts,
  displayLarge: { ...MD3DarkTheme.fonts.displayLarge, ...serif },
  displayMedium: { ...MD3DarkTheme.fonts.displayMedium, ...serif },
  displaySmall: { ...MD3DarkTheme.fonts.displaySmall, ...serif },
  headlineLarge: { ...MD3DarkTheme.fonts.headlineLarge, ...serif },
  headlineMedium: { ...MD3DarkTheme.fonts.headlineMedium, ...serif },
  headlineSmall: { ...MD3DarkTheme.fonts.headlineSmall, ...serif },
  titleLarge: { ...MD3DarkTheme.fonts.titleLarge, ...serif },
  titleMedium: { ...MD3DarkTheme.fonts.titleMedium, ...serif },
  titleSmall: { ...MD3DarkTheme.fonts.titleSmall, ...serif },
  bodyLarge: { ...MD3DarkTheme.fonts.bodyLarge, ...serif },
  bodyMedium: { ...MD3DarkTheme.fonts.bodyMedium, ...serif },
  bodySmall: { ...MD3DarkTheme.fonts.bodySmall, ...serif },
  labelLarge: { ...MD3DarkTheme.fonts.labelLarge, ...serif },
  labelMedium: { ...MD3DarkTheme.fonts.labelMedium, ...serif },
  labelSmall: { ...MD3DarkTheme.fonts.labelSmall, ...serif },
};

export const lifeTrackerPaperTheme = {
  ...MD3DarkTheme,
  roundness: 12,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: LT.amber,
    onPrimary: LT.bg,
    primaryContainer: '#3d2e14',
    onPrimaryContainer: LT.parchment,
    secondary: LT.teal,
    onSecondary: LT.bg,
    secondaryContainer: '#0f2a1f',
    onSecondaryContainer: LT.parchment,
    tertiary: LT.blue,
    onTertiary: LT.bg,
    tertiaryContainer: '#142a3d',
    onTertiaryContainer: LT.parchment,
    background: LT.bg,
    surface: LT.surface,
    surfaceVariant: LT.surfaceElevated,
    onSurface: LT.parchment,
    onSurfaceVariant: LT.parchmentMuted,
    outline: LT.outline,
    outlineVariant: '#353540',
    error: '#cf6679',
    onError: LT.bg,
    elevation: MD3DarkTheme.colors.elevation,
  },
};
