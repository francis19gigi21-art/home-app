import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, radius, spacing, useTheme, type ThemeColors } from "@/src/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------- Toast
type ToastTone = "success" | "error" | "info";
const ToastCtx = createContext<(msg: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone; key: number } | null>(null);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, tone: ToastTone = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ msg, tone, key: Date.now() });
      opacity.value = withTiming(1, { duration: 180 });
      timer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 250 });
      }, 2600);
    },
    [opacity],
  );

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const bg = toast?.tone === "error" ? colors.error : toast?.tone === "success" ? colors.success : colors.surfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[toastStyles.wrap, { bottom: insets.bottom + 96, backgroundColor: bg }, style]}
        >
          <Text style={toastStyles.text}>{toast.msg}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const toastStyles = StyleSheet.create({
  wrap: {
    position: "absolute", alignSelf: "center", left: spacing.lg, right: spacing.lg,
    paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    alignItems: "center",
  },
  text: { color: "#FAFAF8", fontSize: 14, fontWeight: "500", textAlign: "center" },
});

// ---------------------------------------------------------------- Screen
export function Screen({
  children, scroll = true, onRefresh, refreshing, contentStyle, style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.surface }, style]}
      contentContainerStyle={[{ paddingBottom: 140 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={undefined}
      keyboardShouldPersistTaps="handled"
    >
      {onRefresh ? <RefreshHelper onRefresh={onRefresh} refreshing={!!refreshing} /> : null}
      {children}
    </ScrollView>
  );
}

function RefreshHelper(_: { onRefresh: () => void; refreshing: boolean }) {
  return null;
}

// ---------------------------------------------------------------- Pressable scale
export function PressableScale({
  onPress, style, children, testID, disabled,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 15 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
      style={[anim, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------- Buttons
export function PrimaryButton({
  label, onPress, loading, disabled, testID, icon,
}: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID: string; icon?: string;
}) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} disabled={disabled || loading}
      style={[styles.primary, (disabled || loading) && { opacity: 0.55 }]}>
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Ionicons name={icon as any} size={18} color={colors.onBrandPrimary} /> : null}
          <Text style={styles.primaryText}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

export function GhostButton({
  label, onPress, testID, icon,
}: { label: string; onPress: () => void; testID: string; icon?: string }) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} style={styles.ghost}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Ionicons name={icon as any} size={18} color={colors.onSurface} /> : null}
        <Text style={styles.ghostText}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const useButtonStyles = makeStyles((colors) => ({
  primary: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill, minHeight: 54,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg,
  },
  primaryText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "600" },
  ghost: {
    backgroundColor: "transparent", borderRadius: radius.pill, minHeight: 54, borderWidth: 1,
    borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg,
  },
  ghostText: { color: colors.onSurface, fontSize: 16, fontWeight: "500" },
}));

// ---------------------------------------------------------------- Typography helpers
export function SectionHeader({ title, actionLabel, onAction, testID }: {
  title: string; actionLabel?: string; onAction?: () => void; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
      <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>{title}</Text>
      {actionLabel ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.muted }}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Pills / Segmented
export function PillRow({ options, value, onChange, testIDPrefix }: {
  options: string[]; value: string; onChange: (v: string) => void; testIDPrefix: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            testID={`${testIDPrefix}-${opt.toLowerCase().replace(/\s+/g, "-")}`}
            onPress={() => onChange(opt)}
            style={{
              flexShrink: 0, height: 36, paddingHorizontal: 18, borderRadius: radius.pill,
              alignItems: "center", justifyContent: "center",
              backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
              borderWidth: active ? 0 : 1, borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "500", color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SegmentedControl({ options, value, onChange, testIDPrefix }: {
  options: string[]; value: string; onChange: (v: string) => void; testIDPrefix: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            testID={`${testIDPrefix}-${opt.toLowerCase().replace(/\s+/g, "-")}`}
            onPress={() => onChange(opt)}
            style={{
              flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
              backgroundColor: active ? colors.surfaceSecondary : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: active ? "600" : "500", color: active ? colors.onSurface : colors.muted }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Avatar / IconCircle
const AVATAR_TONES = ["#E7C98F", "#B7C69A", "#AFC6DD", "#E3B7A5", "#CDB9D9", "#B9D4C8"];
export function Avatar({ name, size = 40, uri }: { name: string; size?: number; uri?: string | null }) {
  const { colors } = useTheme();
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const tone = AVATAR_TONES[(name || "").length % AVATAR_TONES.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: uri ? colors.surfaceTertiary : tone,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      {uri ? (
        <Animated.Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size * 0.42, fontWeight: "600", color: colors.onSurface }}>{initial}</Text>
      )}
    </View>
  );
}

export function IconCircle({ icon, size = 44, tone = "light", badge }: {
  icon: string; size?: number; tone?: "light" | "dark" | "frosted"; badge?: boolean;
}) {
  const { colors } = useTheme();
  const bg = tone === "dark" ? colors.surfaceInverse : tone === "frosted" ? "rgba(255,255,255,0.55)" : colors.surfaceSecondary;
  const iconColor = tone === "dark" ? colors.onSurfaceInverse : colors.onSurface;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
      alignItems: "center", justifyContent: "center",
      borderWidth: tone === "light" ? 1 : 0, borderColor: colors.border,
    }}>
      <Ionicons name={icon as any} size={size * 0.42} color={iconColor} />
      {badge ? (
        <View style={{
          position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: 5,
          backgroundColor: colors.error, borderWidth: 1.5, borderColor: colors.surface,
        }} />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Cards
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{
      backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    }, style]}>
      {children}
    </View>
  );
}

export function GradientHero({ colors: grad, children, style }: {
  colors: [string, string, string]; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius.xl, padding: spacing.lg, overflow: "hidden" }, style]}>
      {children}
    </LinearGradient>
  );
}

export function MetricTile({ icon, label, value, suffix, badge, onPress, testID }: {
  icon: string; label: string; value: string; suffix?: string; badge?: boolean;
  onPress?: () => void; testID: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ minHeight: 148, justifyContent: "space-between" }}>
        <IconCircle icon={icon} badge={badge} />
        <View>
          <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "500", marginBottom: 2 }}>{label}</Text>
          <Text style={{ fontSize: 34, fontWeight: "300", letterSpacing: -1, color: colors.onSurface }}>
            {value}
            {suffix ? <Text style={{ fontSize: 15, color: colors.muted, fontWeight: "400" }}> {suffix}</Text> : null}
          </Text>
        </View>
      </Card>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Inputs
export function Field({ label, ...props }: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const styles = useFieldStyles();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8E8E88" style={styles.input} {...props} />
    </View>
  );
}

const useFieldStyles = makeStyles((colors) => ({
  label: { fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 4 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 18, minHeight: 54, fontSize: 16, color: colors.onSurface,
  },
}));

export function SearchBar({ value, onChangeText, placeholder, testID }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, height: 52,
    }}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{ flex: 1, fontSize: 15, color: colors.onSurface, height: "100%" }}
      />
    </View>
  );
}

export function QuantityStepper({ value, onChange, min = 0, step = 1, testID }: {
  value: number; onChange: (v: number) => void; min?: number; step?: number; testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary,
      borderRadius: radius.pill, padding: 4, gap: 4,
    }}>
      <Pressable testID={`${testID}-minus`} onPress={() => onChange(Math.max(min, value - step))}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={20} color={colors.onSurface} />
      </Pressable>
      <Text testID={`${testID}-value`} style={{ minWidth: 44, textAlign: "center", fontSize: 17, fontWeight: "600", color: colors.onSurface }}>
        {value}
      </Text>
      <Pressable testID={`${testID}-plus`} onPress={() => onChange(value + step)}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={20} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- Empty / Skeleton / Offline
export function EmptyState({ icon, title, subtitle, actionLabel, onAction, actionTestID }: {
  icon: string; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void; actionTestID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <IconCircle icon={icon} size={64} />
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.onSurface, textAlign: "center", marginTop: spacing.sm }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch" }}>
          <PrimaryButton testID={actionTestID ?? "empty-state-action"} label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function Skeleton({ width = "100%", height = 16, style }: {
  width?: number | string; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withSpring(1, { damping: 2, stiffness: 60 });
    const loop = setInterval(() => {
      opacity.value = withTiming(opacity.value > 0.6 ? 0.4 : 1, { duration: 700 });
    }, 750);
    return () => clearInterval(loop);
  }, [opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{
      width: width as any, height, borderRadius: 10, backgroundColor: colors.surfaceTertiary,
    }, anim, style]} />
  );
}

export function SkeletonCard() {
  return (
    <Card style={{ gap: 12 }}>
      <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={30} />
    </Card>
  );
}

// Big centered metric, e.g. ₹1,250 or 24
export function GiantMetric({ value, suffix, label, color }: {
  value: string; suffix?: string; label?: string; color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted }}>{label}</Text> : null}
      <Text style={{ fontSize: 56, fontWeight: "300", letterSpacing: -2, color: color ?? colors.onSurface }}>
        {value}
        {suffix ? <Text style={{ fontSize: 20, color: colors.muted, fontWeight: "400" }}>{suffix}</Text> : null}
      </Text>
    </View>
  );
}

export function StatusTag({ label, tone }: { label: string; tone: "fresh" | "soon" | "urgent" | "expired" | "neutral" }) {
  const { colors } = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    fresh: { bg: "#E8EFE2", fg: colors.success },
    soon: { bg: "#F6EBD3", fg: colors.warning },
    urgent: { bg: "#F8DFCE", fg: "#B35A1F" },
    expired: { bg: "#F6DAD5", fg: colors.error },
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
  };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.fg }}>{label}</Text>
    </View>
  );
}

export { Ionicons };
export type { ThemeColors };
