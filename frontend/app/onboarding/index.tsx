import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale, IconCircle } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

export default function OnboardingChoice() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={[colors.gradHomeA, colors.surface]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%" }}
      />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: insets.top + 80 }}>
        <Text style={{ fontSize: 34, fontWeight: "600", letterSpacing: -1, color: colors.onSurface, marginBottom: 8 }}>
          Set up your home
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, marginBottom: spacing.xl }}>
          Start a new household or join one with an invite code.
        </Text>
        <View style={{ gap: spacing.md }}>
          <PressableScale testID="onboarding-create" onPress={() => router.push("/onboarding/create")}>
            <View style={{
              backgroundColor: colors.surfaceInverse, borderRadius: radius.xl, padding: spacing.lg,
              minHeight: 140, justifyContent: "space-between",
            }}>
              <IconCircle icon="home" tone="frosted" />
              <View>
                <Text style={{ color: colors.onSurfaceInverse, fontSize: 22, fontWeight: "600" }}>Create a house</Text>
                <Text style={{ color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 14, marginTop: 4 }}>
                  You'll get an invite code to share
                </Text>
              </View>
            </View>
          </PressableScale>
          <PressableScale testID="onboarding-join" onPress={() => router.push("/onboarding/join")}>
            <View style={{
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, padding: spacing.lg,
              minHeight: 140, justifyContent: "space-between", borderWidth: 1, borderColor: colors.border,
            }}>
              <IconCircle icon="key" />
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "600" }}>Join a house</Text>
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
                  Enter the 6-character code from a housemate
                </Text>
              </View>
            </View>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
