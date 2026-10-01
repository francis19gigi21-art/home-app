import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp } from "@/src/context/AppContext";
import { Field, PrimaryButton, IconCircle, useToast } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signIn } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Sign-in failed");
      toast("Couldn't sign you in", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable testID="login-back" onPress={() => router.back()} hitSlop={12}>
        <IconCircle icon="chevron-back" />
      </Pressable>
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm }}>
        <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Welcome back</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>Sign in to your shared home.</Text>
      </View>
      <View style={{ gap: spacing.md, flex: 1 }}>
        <Field label="Email" testID="login-email" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
        <Field label="Password" testID="login-password" value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" />
        {error ? <Text testID="login-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
        <Pressable testID="login-forgot" onPress={() => router.push("/(auth)/forgot")} hitSlop={8}>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "right" }}>Forgot password?</Text>
        </Pressable>
      </View>
      <PrimaryButton testID="login-submit" label="Sign in" onPress={handleLogin} loading={loading} />
    </KeyboardAwareScrollView>
  );
}
