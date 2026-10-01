import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useApp } from "@/src/context/AppContext";
import { APP_NAME } from "@/src/config";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { session, household, loading } = useApp();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text style={{ fontSize: 44, fontWeight: "700", letterSpacing: -1.5, color: colors.onSurface }}>{APP_NAME}</Text>
        <ActivityIndicator color={colors.onSurface} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!household) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
