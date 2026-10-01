import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp } from "@/src/context/AppContext";
import { Field, PrimaryButton, IconCircle } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signUp } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    if (!name.trim()) return setError("Tell us your name");
    if (!email.trim() || !email.includes("@")) return setError("Enter a valid email");
    if (password.length < 6) return setError("Password needs at least 6 characters");
    setLoading(true);
    setError(null);
    try {
      await signUp(name, email, password);
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e.message ?? "Sign-up failed");
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
      <Pressable testID="signup-back" onPress={() => router.back()} hitSlop={12}>
        <IconCircle icon="chevron-back" />
      </Pressable>
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm }}>
        <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Create account</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>A minute now, a calmer home later.</Text>
      </View>
      <View style={{ gap: spacing.md, flex: 1 }}>
        <Field label="Name" testID="signup-name" value={name} onChangeText={setName} placeholder="Alex" />
        <Field label="Email" testID="signup-email" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
        <Field label="Password" testID="signup-password" value={password} onChangeText={setPassword}
          secureTextEntry placeholder="At least 6 characters" />
        {error ? <Text testID="signup-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
      </View>
      <PrimaryButton testID="signup-submit" label="Create account" onPress={handleSignup} loading={loading} />
    </KeyboardAwareScrollView>
  );
}
