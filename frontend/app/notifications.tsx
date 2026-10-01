import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { timeAgo } from "@/src/lib/format";
import { EmptyState, IconCircle, SkeletonCard } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

const TYPE_ICON: Record<string, string> = {
  task: "checkbox-outline", grocery: "cart-outline", expense: "wallet-outline",
  inventory: "cube-outline", general: "notifications-outline",
};

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const notifications = useNotifications();

  const { today, earlier } = useMemo(() => {
    const all = notifications.data ?? [];
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      today: all.filter((n) => n.created_at.slice(0, 10) === todayStr),
      earlier: all.filter((n) => n.created_at.slice(0, 10) !== todayStr),
    };
  }, [notifications.data]);

  const rows = [
    ...(today.length ? [{ header: "Today" } as const] : []),
    ...today.map((n) => ({ item: n }) as const),
    ...(earlier.length ? [{ header: "Earlier" } as const] : []),
    ...earlier.map((n) => ({ item: n }) as const),
  ];

  async function markAllRead() {
    const ids = (notifications.data ?? []).filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    notifications.refetch();
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    notifications.refetch();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{
        paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.md,
        flexDirection: "row", alignItems: "center", gap: spacing.md,
      }}>
        <Pressable testID="notifications-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Notifications</Text>
        {notifications.unread > 0 ? (
          <Pressable testID="notifications-mark-all" onPress={markAllRead} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted }}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><SkeletonCard /><SkeletonCard /></View>
      ) : rows.length === 0 ? (
        <EmptyState icon="notifications-outline" title="All quiet"
          subtitle="Household activity — completed tasks, new groceries, expenses — shows up here." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => ("header" in r ? `h-${r.header}` : r.item.id) + i}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) => {
            if ("header" in row) {
              return (
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: spacing.sm }}>
                  {row.header}
                </Text>
              );
            }
            const n = row.item;
            return (
              <Pressable
                testID={`notification-${n.id}`}
                onPress={() => !n.read && markRead(n.id)}
                style={{
                  backgroundColor: n.read ? colors.surfaceSecondary : colors.brandTertiary,
                  borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                  padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
                }}
              >
                <IconCircle icon={TYPE_ICON[n.type] ?? "notifications-outline"} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: n.read ? "400" : "600", color: colors.onSurface }}>{n.title}</Text>
                  {n.message ? <Text style={{ fontSize: 12, color: colors.muted }}>{n.message}</Text> : null}
                  <Text style={{ fontSize: 11, color: colors.muted }}>{timeAgo(n.created_at)}</Text>
                </View>
                {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.info }} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
