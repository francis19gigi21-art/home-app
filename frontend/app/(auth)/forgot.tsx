import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { Field, PrimaryButton, IconCircle } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

export default function Forgot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!email.trim()) return setError("Enter your email");
    setLoading(true);
    setError(null);
    try {
      const redirectTo = Platform.OS === "web" ? window.location.origin : Linking.createURL("auth/callback");
      await resetPassword(email, redirectTo);
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md }}>
      <Pressable testID="forgot-back" onPress={() => router.back()} hitSlop={12}>
        <IconCircle icon="chevron-back" />
      </Pressable>
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm }}>
        <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Reset password</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>
          {sent ? "Check your inbox — we sent a reset link." : "We'll email you a reset link."}
        </Text>
      </View>
      {!sent ? (
        <View style={{ gap: spacing.md }}>
          <Field label="Email" testID="forgot-email" value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          {error ? <Text testID="forgot-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
          <PrimaryButton testID="forgot-submit" label="Send reset link" onPress={handleReset} loading={loading} />
        </View>
      ) : (
        <PrimaryButton testID="forgot-back-to-login" label="Back to sign in" onPress={() => router.replace("/(auth)/login")} />
      )}
    </View>
  );
}
