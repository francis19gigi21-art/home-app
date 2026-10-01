import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { LogBox, Text, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AppProvider, useApp } from "@/src/context/AppContext";
import { ToastProvider } from "@/src/components/core";
import { useTheme, radius, spacing } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

function OfflineBanner() {
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (netInfo.isConnected !== false) return null;
  return (
    <View
      testID="offline-banner"
      style={{
        position: "absolute", top: insets.top + 8, alignSelf: "center",
        backgroundColor: colors.surfaceInverse, paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: radius.pill, zIndex: 10,
      }}
    >
      <Text style={{ color: colors.onSurfaceInverse, fontSize: 12, fontWeight: "500" }}>
        You're offline — changes will sync when you're back
      </Text>
    </View>
  );
}

function AuthGate() {
  const { session, household, loading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const root = segments[0] as string | undefined;
    const inAuth = root === "(auth)";
    const inOnboarding = root === "onboarding";
    if (!session && !inAuth) {
      router.replace("/(auth)/welcome");
    } else if (session && !household && !inOnboarding) {
      router.replace("/onboarding");
    } else if (session && household && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [session, household, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAF8" } }} />
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <AppProvider>
            <ToastProvider>
              <OfflineBanner />
              <AuthGate />
            </ToastProvider>
          </AppProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

void spacing;
