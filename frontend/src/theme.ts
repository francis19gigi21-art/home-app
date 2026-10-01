// Design tokens for Roomie. Light theme only (see /app/design_guidelines.json).
// Plain key = background, its `on` partner = text/icons on top of it.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FAFAF8", // warm off-white canvas
  onSurface: "#101010",
  surfaceSecondary: "#FFFFFF", // cards
  onSurfaceSecondary: "#101010",
  surfaceTertiary: "#F1F0EC", // inputs, chips, segmented track
  onSurfaceTertiary: "#4B4B48",
  surfaceInverse: "#101010", // floating nav, black CTAs
  onSurfaceInverse: "#FAFAF8",
  muted: "#8E8E88",

  // Brand (monochrome)
  brand: "#101010",
  onBrand: "#FAFAF8",
  brandPrimary: "#101010",
  onBrandPrimary: "#FAFAF8",
  brandSecondary: "#E9E7E0",
  onBrandSecondary: "#101010",
  brandTertiary: "#F4F3EF",
  onBrandTertiary: "#101010",

  // Status
  success: "#3E7C4F",
  onSuccess: "#FFFFFF",
  warning: "#B7791F",
  onWarning: "#FFFFFF",
  error: "#C2412F",
  onError: "#FFFFFF",
  info: "#2F5E8F",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E8E6E0",
  borderStrong: "#D6D3CA",
  divider: "#ECEAE4",

  // Section gradient heroes (blurred, restrained — one per section)
  gradHomeA: "#F7E9C4",
  gradHomeB: "#EFD9A0",
  gradHomeC: "#FAF6EA",
  gradInventoryA: "#DCE3B0",
  gradInventoryB: "#C2CD8A",
  gradInventoryC: "#F1F0DC",
  gradAiA: "#F5D9B0",
  gradAiB: "#F3E6C8",
  gradAiC: "#D7E3F0",
  gradExpensesA: "#F3C6AE",
  gradExpensesB: "#EFD3A8",
  gradExpensesC: "#FAF1E4",
  gradTasksA: "#D5DFF0",
  gradTasksB: "#E8EDF5",
  gradTasksC: "#FAF7F0",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Spacing (8pt grid) & radius tokens
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 16, md: 24, lg: 28, xl: 32, pill: 999 };
