import React, { useEffect } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton, GhostButton } from "@/src/components/core";

// Bottom sheet mounted in a high-level Modal so tab bars never overlap it.
export function Sheet({
  visible, onClose, children, title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(400, { duration: 160 });
    }
  }, [visible, opacity, translateY]);

  const sheetAnim = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimAnim = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, scrimAnim]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} testID="sheet-scrim" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View
            style={[styles.sheet, sheetAnim, { backgroundColor: colors.surfaceSecondary, paddingBottom: insets.bottom + spacing.lg }]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            {title ? <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text> : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function ConfirmSheet({
  visible, onClose, onConfirm, title, message, confirmLabel = "Confirm", destructive = false,
  confirmTestID = "confirm-sheet-confirm",
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  confirmTestID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {message ? (
        <Text style={{ fontSize: 15, color: colors.onSurfaceTertiary, lineHeight: 22, marginBottom: spacing.lg }}>{message}</Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <View style={destructive ? { borderRadius: radius.pill, overflow: "hidden" } : undefined}>
          <PrimaryButton testID={confirmTestID} label={confirmLabel} onPress={onConfirm} />
        </View>
        <GhostButton testID="confirm-sheet-cancel" label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,16,0.45)" },
  sheet: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "88%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: "600", marginBottom: spacing.md },
});
