/**
 * CampusForge Design System: "The Fluid Campus"
 * Based on Stitch Project: 2204805633564593254
 */

export const Colors = {
  // Base Surface Colors (The "No-Line" Rule)
  background: "#15151A",
  surface: "#15151A",
  surface_container_low: "#18181A",
  surface_container: "#1C1C20",
  surface_container_high: "#1f1f22",
  surface_container_highest: "#262528",
  surface_bright: "#2c2c2f",
  surface_dim: "#15151A",

  // Brand Colors
  primary: "#6B52FF",
  primary_container: "#9396ff",
  primary_dim: "#6062f2",

  secondary: "#a28efc",
  secondary_container: "#4a339d",

  tertiary: "#ffa5d8",
  tertiary_container: "#ff8ea2",

  // Feedback & Status
  success: "#34EE9A",
  error: "#ff6e84",
  error_container: "#a70138",
  warning: "#ffb2b9",

  // Contextual Colors
  outline: "#767577",
  outline_variant: "rgba(118, 117, 119, 0.15)",
  scrim: "rgba(32, 33, 36, 0.6)",

  // On-Background Colors (Typography)
  on_background: "#e8e4e7",
  on_surface: "#e8e4e7",
  on_surface_variant: "#adaaad",
  on_primary: "#ffffff",
  on_primary_container: "#0b0081",
  on_secondary: "#22006d",
  on_tertiary: "#701454",

  // --- Legacy / Alias Keys (for backward-compat with older screens) ---
  bg: "#15151A",
  bgCard: "#1C1C20",
  bgSurface: "#1f1f22",
  border: "rgba(118, 117, 119, 0.15)",
  textPrimary: "#e8e4e7",
  textSecondary: "#adaaad",
  textMuted: "#767577",

  // --- Light/Dark sub-objects (for use-theme-color / collapsible) ---
  light: {
    text: "#e8e4e7",
    background: "#15151A",
    tint: "#6B52FF",
    icon: "#adaaad",
    tabIconDefault: "#767577",
    tabIconSelected: "#6B52FF",
  },
  dark: {
    text: "#e8e4e7",
    background: "#15151A",
    tint: "#6B52FF",
    icon: "#adaaad",
    tabIconDefault: "#767577",
    tabIconSelected: "#6B52FF",
  },
};

export const Typography = {
  // Display & Headlines (Plus Jakarta Sans)
  display: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 48,
    letterSpacing: -1,
  },
  headline: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
  },
  
  // Body & Labels (Manrope)
  body: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  body_medium: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
  },
  label: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
  },
  caption: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  margin: 18, // Minimum padding from Stitch
};

export const Roundness = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999, // Pill shape for buttons/chips
};

export const Gradients = {
  primary: ["#a4a6ff", "#9396ff"] as const,
  secondary: ["#a28efc", "#4a339d"] as const,
  glass: ["rgba(14, 14, 16, 0.7)", "rgba(14, 14, 16, 0.7)"] as const,
  // Badge / category gradients used across the app
  lostBadge: ["#ff6e84", "#a70138"] as const,
  foundBadge: ["#34EE9A", "#0fa06a"] as const,
  skillOffer: ["#ffa5d8", "#a28efc"] as const,
  card: ["#1C1C20", "#262528"] as const,
};

export const Fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  bold: 'PlusJakartaSans_700Bold',
  semiBold: 'PlusJakartaSans_600SemiBold',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  label: 'Manrope_600SemiBold',
  mono: 'SpaceMono_400Regular',
  rounded: 'PlusJakartaSans_700Bold',
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  ambient: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 8,
  }
};
