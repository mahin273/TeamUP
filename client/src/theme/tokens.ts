import { argbFromHex, themeFromSourceColor } from '@material/material-color-utilities';

const SEED_PRIMARY = '#6366F1'; // Indigo
const SEED_SECONDARY = '#14B8A6'; // Teal
const SEED_TERTIARY = '#F43F5E'; // Coral

// Generate M3 Theme Palette
const m3Theme = themeFromSourceColor(argbFromHex(SEED_PRIMARY), [
  { name: 'secondary', value: argbFromHex(SEED_SECONDARY), blend: true },
  { name: 'tertiary', value: argbFromHex(SEED_TERTIARY), blend: true },
]);

function hexFromArgb(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

export const lightColorScheme: ColorScheme = {
  primary: hexFromArgb(m3Theme.schemes.light.primary),
  onPrimary: hexFromArgb(m3Theme.schemes.light.onPrimary),
  primaryContainer: hexFromArgb(m3Theme.schemes.light.primaryContainer),
  onPrimaryContainer: hexFromArgb(m3Theme.schemes.light.onPrimaryContainer),
  secondary: hexFromArgb(m3Theme.schemes.light.secondary),
  onSecondary: hexFromArgb(m3Theme.schemes.light.onSecondary),
  secondaryContainer: hexFromArgb(m3Theme.schemes.light.secondaryContainer),
  onSecondaryContainer: hexFromArgb(m3Theme.schemes.light.onSecondaryContainer),
  tertiary: hexFromArgb(m3Theme.schemes.light.tertiary),
  onTertiary: hexFromArgb(m3Theme.schemes.light.onTertiary),
  tertiaryContainer: hexFromArgb(m3Theme.schemes.light.tertiaryContainer),
  onTertiaryContainer: hexFromArgb(m3Theme.schemes.light.onTertiaryContainer),
  background: '#F8FAFC',
  onBackground: hexFromArgb(m3Theme.schemes.light.onBackground),
  surface: '#FFFFFF',
  onSurface: hexFromArgb(m3Theme.schemes.light.onSurface),
  surfaceVariant: '#F1F5F9',
  onSurfaceVariant: hexFromArgb(m3Theme.schemes.light.onSurfaceVariant),
  outline: hexFromArgb(m3Theme.schemes.light.outline),
  outlineVariant: '#E2E8F0',
  error: hexFromArgb(m3Theme.schemes.light.error),
  onError: hexFromArgb(m3Theme.schemes.light.onError),
  errorContainer: hexFromArgb(m3Theme.schemes.light.errorContainer),
  onErrorContainer: hexFromArgb(m3Theme.schemes.light.onErrorContainer),
  shadow: 'transparent',
  scrim: hexFromArgb(m3Theme.schemes.light.scrim),
  inverseSurface: hexFromArgb(m3Theme.schemes.light.inverseSurface),
  inverseOnSurface: hexFromArgb(m3Theme.schemes.light.inverseOnSurface),
  inversePrimary: hexFromArgb(m3Theme.schemes.light.inversePrimary),
};

export const darkColorScheme: ColorScheme = {
  primary: hexFromArgb(m3Theme.schemes.dark.primary),
  onPrimary: hexFromArgb(m3Theme.schemes.dark.onPrimary),
  primaryContainer: hexFromArgb(m3Theme.schemes.dark.primaryContainer),
  onPrimaryContainer: hexFromArgb(m3Theme.schemes.dark.onPrimaryContainer),
  secondary: hexFromArgb(m3Theme.schemes.dark.secondary),
  onSecondary: hexFromArgb(m3Theme.schemes.dark.onSecondary),
  secondaryContainer: hexFromArgb(m3Theme.schemes.dark.secondaryContainer),
  onSecondaryContainer: hexFromArgb(m3Theme.schemes.dark.onSecondaryContainer),
  tertiary: hexFromArgb(m3Theme.schemes.dark.tertiary),
  onTertiary: hexFromArgb(m3Theme.schemes.dark.onTertiary),
  tertiaryContainer: hexFromArgb(m3Theme.schemes.dark.tertiaryContainer),
  onTertiaryContainer: hexFromArgb(m3Theme.schemes.dark.onTertiaryContainer),
  background: '#0F172A',
  onBackground: hexFromArgb(m3Theme.schemes.dark.onBackground),
  surface: '#1E293B',
  onSurface: hexFromArgb(m3Theme.schemes.dark.onSurface),
  surfaceVariant: '#334155',
  onSurfaceVariant: hexFromArgb(m3Theme.schemes.dark.onSurfaceVariant),
  outline: hexFromArgb(m3Theme.schemes.dark.outline),
  outlineVariant: '#475569',
  error: hexFromArgb(m3Theme.schemes.dark.error),
  onError: hexFromArgb(m3Theme.schemes.dark.onError),
  errorContainer: hexFromArgb(m3Theme.schemes.dark.errorContainer),
  onErrorContainer: hexFromArgb(m3Theme.schemes.dark.onErrorContainer),
  shadow: 'transparent',
  scrim: hexFromArgb(m3Theme.schemes.dark.scrim),
  inverseSurface: hexFromArgb(m3Theme.schemes.dark.inverseSurface),
  inverseOnSurface: hexFromArgb(m3Theme.schemes.dark.inverseOnSurface),
  inversePrimary: hexFromArgb(m3Theme.schemes.dark.inversePrimary),
};

export const typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  headlineMedium: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  titleMedium: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  bento: 16, // rounded-2xl (16px radius)
  pill: 9999,
};
