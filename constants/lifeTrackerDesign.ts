/**
 * QuestLog design system — Georgia serif, dark RPG base + light mode palette.
 */
import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';

export const darkThemeColors = {
  bg: '#0f0f14',
  bg2: '#14141c',
  surf: '#1e1e2c',
  surface: '#1e1e2c',
  surfaceElevated: '#14141c',
  parchment: '#e8e0cc',
  tx: '#e8e0cc',
  tx2: '#a09078',
  tx3: '#6b5c46',
  parchmentMuted: '#a09078',
  amber: '#EF9F27',
  teal: '#1D9E75',
  blue: '#378ADD',
  pink: '#D4537E',
  amberBg: 'rgba(239,159,39,0.11)',
  amberBorder: 'rgba(239,159,39,0.26)',
  tealBg: 'rgba(29,158,117,0.11)',
  tealBorder: 'rgba(29,158,117,0.26)',
  blueBg: 'rgba(55,138,221,0.11)',
  blueBorder: 'rgba(55,138,221,0.26)',
  pinkBg: 'rgba(212,83,126,0.11)',
  pinkBorder: 'rgba(212,83,126,0.26)',
  borderDefault: 'rgba(232,224,204,0.07)',
  borderHover: 'rgba(232,224,204,0.14)',
  borderStrong: 'rgba(232,224,204,0.24)',
  outline: 'rgba(232,224,204,0.14)',
  /** Text/icon on filled amber (chips, FAB) */
  chipSelectedFg: '#0f0f14',
  onAccent: '#0f0f14',
  /** Sidebar drawer (dark RPG) */
  sidebarDrawerBg: '#121214',
  sidebarIconBoxBg: '#1a1a1e',
  sidebarIconBoxBorder: 'rgba(232,224,204,0.08)',
  sidebarMutedGold: '#a09078',
  /** Bottom nav inactive icon */
  navInactive: '#a09078',
  sidebarWell: '#0c0c0e',
  ruleHairline: 'rgba(232,224,204,0.1)',
  /** Lydia-style focus timer card / controls */
  surfaceDeep: '#16161f',
  outlineFaint: 'rgba(232,224,204,0.1)',
  parchmentFaint: 'rgba(232,224,204,0.45)',
} as const;

export const lightThemeColors = {
  bg: '#f4f1ea',
  bg2: '#e8e4da',
  surf: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#ece8de',
  parchment: '#3d3428',
  tx: '#1c1916',
  tx2: '#5c5348',
  tx3: '#7a7064',
  parchmentMuted: '#6b6558',
  amber: '#b85a00',
  teal: '#0a7a58',
  blue: '#1e6cb5',
  pink: '#a83262',
  amberBg: 'rgba(184,90,0,0.14)',
  amberBorder: 'rgba(184,90,0,0.35)',
  tealBg: 'rgba(10,122,88,0.12)',
  tealBorder: 'rgba(10,122,88,0.32)',
  blueBg: 'rgba(30,108,181,0.12)',
  blueBorder: 'rgba(30,108,181,0.3)',
  pinkBg: 'rgba(168,50,98,0.12)',
  pinkBorder: 'rgba(168,50,98,0.28)',
  borderDefault: 'rgba(28,25,22,0.1)',
  borderHover: 'rgba(28,25,22,0.16)',
  borderStrong: 'rgba(28,25,22,0.24)',
  outline: 'rgba(28,25,22,0.14)',
  chipSelectedFg: '#ffffff',
  onAccent: '#ffffff',
  sidebarDrawerBg: '#f0ece4',
  sidebarIconBoxBg: '#ffffff',
  sidebarIconBoxBorder: 'rgba(28,25,22,0.1)',
  sidebarMutedGold: '#6b5c48',
  navInactive: '#6b6558',
  sidebarWell: '#e4e0d8',
  ruleHairline: 'rgba(28,25,22,0.1)',
  surfaceDeep: '#e6e2da',
  outlineFaint: 'rgba(28,25,22,0.12)',
  parchmentFaint: 'rgba(92,83,72,0.65)',
} as const;

export type ThemeColors = typeof darkThemeColors | typeof lightThemeColors;

/** @deprecated Use `useAppTheme().colors` — kept for gradual migration */
export const LT = darkThemeColors;

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

export function buildLifeTrackerPaperTheme(isLight: boolean) {
  const c = isLight ? lightThemeColors : darkThemeColors;
  const base = isLight ? MD3LightTheme : MD3DarkTheme;
  const elev = {
    ...base.colors.elevation,
    level0: c.bg,
    level1: c.surf,
    level2: c.surf,
    level3: c.surf,
    level4: c.surf,
    level5: c.surf,
  };

  return {
    ...base,
    roundness: 12,
    fonts: configureFonts({ config: fontConfig }),
    colors: {
      ...base.colors,
      primary: c.amber,
      onPrimary: c.onAccent,
      primaryContainer: c.amberBg,
      onPrimaryContainer: c.tx,
      secondary: c.teal,
      onSecondary: c.onAccent,
      secondaryContainer: c.tealBg,
      onSecondaryContainer: c.tx,
      tertiary: c.blue,
      onTertiary: c.onAccent,
      tertiaryContainer: c.blueBg,
      onTertiaryContainer: c.tx,
      background: c.bg,
      surface: c.surf,
      surfaceVariant: c.bg2,
      onSurface: c.tx,
      onSurfaceVariant: c.tx2,
      outline: c.outline,
      outlineVariant: c.borderDefault,
      error: '#cf6679',
      onError: '#ffffff',
      elevation: elev,
    },
  };
}

export const lifeTrackerPaperTheme = buildLifeTrackerPaperTheme(false);
