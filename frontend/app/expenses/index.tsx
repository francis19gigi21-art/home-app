import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { computeBalances, useExpenses, useSettlements } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { fmtDate, fmtMoney, fmtMoneyDecimals } from "@/src/lib/format";
import { EmptyState, IconCircle, PillRow, PressableScale, SkeletonCard, useToast } from "@/src/components/core";
import { ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";

const FILTERS = ["All", "Groceries", "Bills", "Rent", "Food", "Other"];
const CATEGORY_ICON: Record<string, string> = {
  groceries: "cart", bills: "flash", utilities: "flash", rent: "home", food: "restaurant", other: "receipt",
};

export default function Expenses() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household, profile } = useApp();
  const expenses = useExpenses();
  const settlements = useSettlements();
  const toast = useToast();
  const [filter, setFilter] = useState("All");
  const [settlePair, setSettlePair] = useState<{ from: string; to: string; amount: number } | null>(null);

  const uid = session?.user.id ?? "";
  const memberById = (id: string | null) => members.find((m) => m.user_id === id);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = useMemo(
    () => (expenses.data ?? []).filter((e) => e.expense_date?.startsWith(monthPrefix)),
    [expenses.data, monthPrefix],
  );
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const totalParts = fmtMoneyDecimals(monthTotal);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of thisMonth) map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
    return map;
  }, [thisMonth]);

  const { pairs } = useMemo(
    () => computeBalances(expenses.data ?? [], settlements.data ?? [], members.map((m) => m.user_id)),
    [expenses.data, settlements.data, members],
  );

  const filtered = useMemo(() => {
    const list = expenses.data ?? [];
    if (filter === "All") return list;
    return list.filter((e) => e.category === filter.toLowerCase());
  }, [expenses.data, filter]);

  async function handleSettle() {
    if (!settlePair || !household) return;
    try {
      const { error } = await supabase.from("settlements").insert({
        household_id: household.id,
        from_user: settlePair.from,
        to_user: settlePair.to,
        amount: settlePair.amount,
      });
      if (error) throw new Error(error.message);
      toast("Settled — ledger updated", "success");
    } catch (e: any) {
      toast(e.message ?? "Could not settle", "error");
    }
    setSettlePair(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Pressable testID="expenses-back" onPress={() => router.back()} hitSlop={12}>
                <IconCircle icon="chevron-back" />
              </Pressable>
              <Text style={{ flex: 1, fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Expenses</Text>
              <PressableScale testID="expenses-budget-link" onPress={() => router.push("/budget")}>
                <IconCircle icon="wallet-outline" />
              </PressableScale>
            </View>

            {/* Monthly total */}
            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "500" }}>This month · household spending</Text>
              <Text testID="expenses-month-total" style={{ fontSize: 56, fontWeight: "300", letterSpacing: -2, color: colors.onSurface }}>
                {totalParts.whole}
                <Text style={{ fontSize: 24, color: colors.muted }}>{totalParts.decimals}</Text>
              </Text>
            </View>

            {/* Category cards */}
            <FlatList
              horizontal
              data={["groceries", "bills", "rent", "food", "other"]}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md }}
              renderItem={({ item }) => (
                <View style={{
                  width: 132, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
                  borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
                }}>
                  <IconCircle icon={CATEGORY_ICON[item] ?? "receipt"} size={36} />
                  <Text style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize" }}>{item}</Text>
                  <Text style={{ fontSize: 20, fontWeight: "500", letterSpacing: -0.5, color: colors.onSurface }}>
                    {fmtMoney(byCategory[item] ?? 0)}
                  </Text>
                </View>
              )}
            />

            {/* Black action band */}
            <View style={{
              backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, padding: 6,
              flexDirection: "row", gap: 6,
            }}>
              {[
                { label: "Add expense", icon: "add", action: () => router.push("/expenses/new"), testID: "expenses-add" },
                { label: "Food budget", icon: "wallet", action: () => router.push("/budget"), testID: "expenses-budget" },
              ].map((a) => (
                <Pressable key={a.label} testID={a.testID} onPress={a.action}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(250,250,248,0.25)",
                  }}>
                  <IconCircle icon={a.icon} size={28} tone="frosted" />
                  <Text style={{ color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "500" }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Balances */}
            {pairs.length > 0 ? (
              <View style={{
                backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
                borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
              }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onSurface }}>Settle up</Text>
                {pairs.map((p, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text testID={`balance-pair-${i}`} style={{ fontSize: 14, color: colors.onSurface }}>
                        <Text style={{ fontWeight: "600" }}>{displayNameOf(memberById(p.from))}</Text>
                        {" owes "}
                        <Text style={{ fontWeight: "600" }}>{displayNameOf(memberById(p.to))}</Text>
                        {` ${fmtMoney(p.amount)}`}
                      </Text>
                    </View>
                    {(p.from === uid || p.to === uid) ? (
                      <Pressable testID={`settle-btn-${i}`} onPress={() => setSettlePair(p)}
                        style={{
                          backgroundColor: colors.surfaceInverse, borderRadius: radius.pill,
                          paddingHorizontal: 14, paddingVertical: 8,
                        }}>
                        <Text style={{ color: colors.onSurfaceInverse, fontSize: 12, fontWeight: "600" }}>Mark settled</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          expenses.isLoading ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}><SkeletonCard /><SkeletonCard /></View>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No shared expenses yet"
              subtitle="Add the first one — splitting is automatic."
              actionLabel="Add expense"
              actionTestID="expenses-empty-add"
              onAction={() => router.push("/expenses/new")}
            />
          )
        }
        renderItem={({ item }) => {
          const splits = item.expense_splits ?? [];
          return (
            <View style={{
              marginHorizontal: spacing.lg, marginTop: spacing.sm,
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
              borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
            }}>
              <IconCircle icon={CATEGORY_ICON[item.category] ?? "receipt"} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Paid by {displayNameOf(memberById(item.paid_by))} · {fmtDate(item.expense_date)}
                </Text>
                {splits.length ? (
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Split: {splits.map((s) => `${displayNameOf(memberById(s.user_id)).split(" ")[0]} ${fmtMoney(s.share_amount)}`).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 17, fontWeight: "500", letterSpacing: -0.3, color: colors.onSurface }}>
                {fmtMoney(item.amount)}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: spacing.md }}>
            <PillRow testIDPrefix="expenses-filter" options={FILTERS} value={filter} onChange={setFilter} />
          </View>
        }
      />

      <ConfirmSheet
        visible={!!settlePair}
        onClose={() => setSettlePair(null)}
        onConfirm={handleSettle}
        title="Mark as settled?"
        message={settlePair ? `Record that ${displayNameOf(memberById(settlePair.from))} paid back ${displayNameOf(memberById(settlePair.to))} ${fmtMoney(settlePair.amount)}. No money moves in the app — it's just the ledger.` : ""}
        confirmLabel="Mark settled"
        confirmTestID="settle-confirm"
      />
      {void profile}
    </View>
  );
}
