import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons, PressableScale } from "@/src/components/core";
import { Sheet } from "@/src/components/sheets";
import { useTheme, radius, spacing } from "@/src/theme";

// Custom floating black pill nav with center quick-add button.
// JS Tabs on all platforms: the center action button is core to the design and
// can't be expressed with native tab triggers; also keeps web preview accurate.

const TAB_META: Record<string, { label: string; icon: string; iconActive: string }> = {
  index: { label: "Home", icon: "home-outline", iconActive: "home" },
  tasks: { label: "Tasks", icon: "checkbox-outline", iconActive: "checkbox" },
  inventory: { label: "Pantry", icon: "cube-outline", iconActive: "cube" },
  profile: { label: "Profile", icon: "person-outline", iconActive: "person" },
};

const QUICK_ACTIONS = [
  { label: "Ask AI", icon: "sparkles", route: "/ai" },
  { label: "Add Task", icon: "checkbox", route: "/tasks/new" },
  { label: "Add Inventory", icon: "cube", route: "/inventory/new" },
  { label: "Add Grocery", icon: "cart", route: "/groceries?add=1" },
  { label: "Add Expense", icon: "wallet", route: "/expenses/new" },
] as const;

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);

  const routes = state.routes.filter((r) => TAB_META[r.name]);

  const tabButton = (route: (typeof routes)[number], index: number) => {
    const meta = TAB_META[route.name];
    const focused = state.index === state.routes.findIndex((r) => r.key === route.key);
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={{
          flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 14,
          borderRadius: radius.pill,
          backgroundColor: focused ? colors.onSurfaceInverse : "transparent",
        }}
      >
        <Ionicons
          name={(focused ? meta.iconActive : meta.icon) as any}
          size={20}
          color={focused ? colors.surfaceInverse : "rgba(250,250,248,0.55)"}
        />
        {focused ? (
          <Text style={{ color: colors.surfaceInverse, fontSize: 13, fontWeight: "600" }}>{meta.label}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <View
        testID="floating-tab-bar"
        style={{
          position: "absolute", bottom: insets.bottom + 12, left: spacing.md, right: spacing.md,
          height: 64, borderRadius: radius.pill, backgroundColor: colors.surfaceInverse,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: spacing.sm,
          shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        {routes.slice(0, 2).map((r, i) => tabButton(r, i))}
        <PressableScale
          testID="tab-quick-add"
          onPress={() => setQuickOpen(true)}
          style={{
            width: 52, height: 52, borderRadius: 26, backgroundColor: colors.onSurfaceInverse,
            alignItems: "center", justifyContent: "center", marginTop: -18,
          }}
        >
          <Ionicons name="add" size={28} color={colors.surfaceInverse} />
        </PressableScale>
        {routes.slice(2).map((r, i) => tabButton(r, i + 2))}
      </View>

      <Sheet visible={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add">
        <View style={{ gap: spacing.sm }}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              testID={`quick-${a.label.toLowerCase().replace(/\s+/g, "-")}`}
              onPress={() => {
                setQuickOpen(false);
                router.push(a.route as any);
              }}
              style={{
                flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56,
                backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name={a.icon as any} size={18} color={colors.onSurface} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: colors.onSurface }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        ...(Platform.OS === "web" ? { tabBarStyle: { height: 64 } } : {}),
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
