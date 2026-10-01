import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useExpenses, useGroceries, useInventory, useNotifications, useSettlements, useTasks, useWallet, computeBalances } from "@/src/lib/hooks";
import { fmtMoney, greeting, firstName, expiryInfo, relativeDay, daysUntil } from "@/src/lib/format";
import { Avatar, Card, GradientHero, IconCircle, MetricTile, PressableScale, SectionHeader, SkeletonCard, StatusTag, Ionicons } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { profile, household, members, session } = useApp();
  const tasks = useTasks();
  const inventory = useInventory();
  const groceries = useGroceries();
  const expenses = useExpenses();
  const settlements = useSettlements();
  const wallet = useWallet();
  const { unread } = useNotifications();

  const uid = session?.user.id ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const todaysTasks = useMemo(
    () => (tasks.data ?? []).filter((t) => t.status !== "completed" && (!t.due_date || t.due_date <= today)).slice(0, 4),
    [tasks.data, today],
  );
  const todayCount = useMemo(
    () => (tasks.data ?? []).filter((t) => t.status !== "completed" && (!t.due_date || t.due_date <= today)).length,
    [tasks.data, today],
  );
  const neededGroceries = useMemo(() => (groceries.data ?? []).filter((g) => !g.purchased), [groceries.data]);
  const useSoon = useMemo(
    () => (inventory.data ?? []).filter((i) => {
      const d = daysUntil(i.expiry_date);
      return d !== null && d <= 3 && i.quantity > 0;
    }),
    [inventory.data],
  );
  const owed = useMemo(() => {
    const { pairs } = computeBalances(expenses.data ?? [], settlements.data ?? [], members.map((m) => m.user_id));
    return pairs.filter((p) => p.from === uid).reduce((s, p) => s + p.amount, 0);
  }, [expenses.data, settlements.data, members, uid]);

  const memberById = (id: string | null) => members.find((m) => m.user_id === id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={[colors.gradHomeA, colors.gradHomeC, colors.surface]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 380 }}
      />
      <FlatList
        data={[]}
        renderItem={() => null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar name={profile?.full_name ?? "?"} uri={profile?.avatar_url} size={44} />
                <View>
                  <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary }}>{greeting()}</Text>
                  <Text testID="home-user-name" style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>
                    {firstName(profile?.full_name, profile?.email)}
                  </Text>
                </View>
              </View>
              <Pressable testID="home-notifications" onPress={() => router.push("/notifications")} hitSlop={8}>
                <IconCircle icon="notifications-outline" badge={unread > 0} tone="frosted" />
              </Pressable>
            </View>

            {/* Giant budget metric */}
            <View style={{ alignItems: "center", marginTop: spacing.md }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: colors.onSurfaceTertiary }}>
                {household?.name ?? "Home"} · Food budget
              </Text>
              <Text testID="home-budget-remaining" style={{ fontSize: 64, fontWeight: "300", letterSpacing: -2.5, color: colors.onSurface }}>
                {fmtMoney(wallet.balance)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>remaining</Text>
            </View>

            {/* Frosted sub-tiles */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {[
                { label: "Spent this month", value: fmtMoney(monthSpend(expenses.data ?? [])) },
                { label: "Contributed", value: fmtMoney(Object.values(wallet.contributions).reduce((a, b) => a + b, 0)) },
              ].map((t) => (
                <View key={t.label} style={{
                  flex: 1, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: radius.lg,
                  padding: spacing.md, gap: 2,
                }}>
                  <Text style={{ fontSize: 12, color: colors.onSurfaceTertiary }}>{t.label}</Text>
                  <Text style={{ fontSize: 22, fontWeight: "500", letterSpacing: -0.5, color: colors.onSurface }}>{t.value}</Text>
                </View>
              ))}
            </View>

            {/* Tonight's suggestion hero */}
            <PressableScale testID="home-meal-hero" onPress={() => router.push("/ai")}>
              <GradientHero colors={[colors.gradAiA, colors.gradAiB, colors.gradAiC]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <IconCircle icon="sparkles" tone="frosted" size={48} />
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceInverse,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name="arrow-up" size={18} color={colors.onSurfaceInverse} style={{ transform: [{ rotate: "45deg" }] }} />
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, marginTop: spacing.lg }}>Tonight's suggestion</Text>
                <Text style={{ fontSize: 24, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginTop: 2 }}>
                  What can we cook?
                </Text>
                <Text style={{ fontSize: 14, color: colors.onSurfaceTertiary, marginTop: 6, lineHeight: 20 }}>
                  {inventory.data?.length
                    ? `Kitchen AI will check your ${inventory.data.length} inventory items and budget first.`
                    : "Add what's in your kitchen and I'll plan dinner around it."}
                </Text>
              </GradientHero>
            </PressableScale>

            {/* Metric grid */}
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <MetricTile testID="metric-tasks" icon="checkbox" label="Today" value={String(todayCount)} suffix="tasks"
                  badge={todayCount > 0} onPress={() => router.push("/(tabs)/tasks")} />
                <MetricTile testID="metric-groceries" icon="cart" label="Groceries" value={String(neededGroceries.length)} suffix="needed"
                  onPress={() => router.push("/groceries")} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <MetricTile testID="metric-inventory" icon="cube" label="Inventory" value={String(inventory.data?.length ?? 0)} suffix="items"
                  badge={useSoon.length > 0} onPress={() => router.push("/(tabs)/inventory")} />
                <MetricTile testID="metric-owed" icon="wallet" label="You owe" value={fmtMoney(owed)}
                  onPress={() => router.push("/expenses")} />
              </View>
            </View>

            {/* Today's tasks */}
            <View>
              <SectionHeader title="Today's tasks" actionLabel="All tasks" testID="home-see-tasks"
                onAction={() => router.push("/(tabs)/tasks")} />
              {tasks.isLoading ? (
                <SkeletonCard />
              ) : todaysTasks.length === 0 ? (
                <Card><Text style={{ color: colors.muted, fontSize: 14 }}>Nothing to do right now. Enjoy it.</Text></Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {todaysTasks.map((t) => (
                    <PressableScale key={t.id} testID={`home-task-${t.id}`} onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: t.id } })}>
                      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
                        <IconCircle icon="time-outline" size={40} badge={!!t.due_date && t.due_date < today} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{t.title}</Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>
                            {displayNameOf(memberById(t.assigned_to))} · {relativeDay(t.due_date)}
                          </Text>
                        </View>
                      </Card>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>

            {/* Use soon */}
            {useSoon.length > 0 ? (
              <View>
                <SectionHeader title="Use soon" actionLabel="Inventory" testID="home-see-inventory"
                  onAction={() => router.push("/(tabs)/inventory")} />
                <FlatList
                  horizontal
                  data={useSoon}
                  keyExtractor={(i) => i.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.md }}
                  renderItem={({ item }) => {
                    const e = expiryInfo(item);
                    return (
                      <PressableScale testID={`use-soon-${item.id}`}
                        onPress={() => router.push({ pathname: "/inventory/[id]", params: { id: item.id } })}>
                        <Card style={{ width: 160, minHeight: 120, justifyContent: "space-between" }}>
                          <StatusTag label={e.label} tone={e.tone} />
                          <View>
                            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onSurface }}>{item.name}</Text>
                            <Text style={{ fontSize: 12, color: colors.muted }}>{item.quantity} {item.unit}</Text>
                          </View>
                        </Card>
                      </PressableScale>
                    );
                  }}
                />
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function monthSpend(expenses: { expense_date: string; amount: number }[]): number {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return expenses.filter((e) => e.expense_date?.startsWith(prefix)).reduce((s, e) => s + Number(e.amount), 0);
}
