import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useWallet } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { fmtMoney, fmtMoneyDecimals, timeAgo } from "@/src/lib/format";
import { EmptyState, Field, IconCircle, PressableScale, PrimaryButton, SegmentedControl, SkeletonCard, useToast } from "@/src/components/core";
import { Sheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";

export default function Budget() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household, profile } = useApp();
  const wallet = useWallet();
  const toast = useToast();
  const [tab, setTab] = useState("Overview");
  const [mode, setMode] = useState<"contribution" | "expense" | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberById = (id: string | null) => members.find((m) => m.user_id === id);
  const parts = fmtMoneyDecimals(wallet.balance);

  async function save() {
    const a = Number(amount);
    if (!a || a <= 0) return setError("Amount must be more than 0");
    if (mode === "expense" && !desc.trim()) return setError("What was it for?");
    if (!household || !session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase.from("wallet_transactions").insert({
        household_id: household.id,
        user_id: session.user.id,
        type: mode,
        amount: mode === "contribution" ? a : -a,
        description: mode === "contribution" ? "Contribution" : desc.trim(),
      });
      if (dbErr) throw new Error(dbErr.message);
      toast(mode === "contribution" ? "Contribution added" : "Expense recorded", "success");
      setMode(null);
      setAmount("");
      setDesc("");
    } catch (e: any) {
      setError(e.message ?? "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={tab === "History" ? wallet.data ?? [] : []}
        keyExtractor={(t) => t.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Pressable testID="budget-back" onPress={() => router.back()} hitSlop={12}>
                <IconCircle icon="chevron-back" />
              </Pressable>
              <Text style={{ flex: 1, fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Food budget</Text>
            </View>

            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "500" }}>Available</Text>
              <Text testID="budget-available" style={{ fontSize: 56, fontWeight: "300", letterSpacing: -2, color: colors.onSurface }}>
                {parts.whole}
                <Text style={{ fontSize: 24, color: colors.muted }}>{parts.decimals}</Text>
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>spent {fmtMoney(wallet.spent)} so far</Text>
            </View>

            {/* Black action band */}
            <View style={{
              backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, padding: 6,
              flexDirection: "row", gap: 6,
            }}>
              <Pressable testID="budget-add-contribution" onPress={() => setMode("contribution")}
                style={{ flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(250,250,248,0.25)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "500" }}>Contribute</Text>
              </Pressable>
              <Pressable testID="budget-add-expense" onPress={() => setMode("expense")}
                style={{ flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(250,250,248,0.25)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "500" }}>Add expense</Text>
              </Pressable>
            </View>

            <SegmentedControl testIDPrefix="budget-tab" options={["Overview", "History"]} value={tab} onChange={setTab} />

            {tab === "Overview" ? (
              wallet.isLoading ? (
                <SkeletonCard />
              ) : members.length === 0 ? null : (
                <View style={{ gap: spacing.sm }}>
                  {members.map((m) => (
                    <View key={m.user_id} style={{
                      backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
                      borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center",
                    }}>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.onSurface }}>
                        {displayNameOf(m)}
                      </Text>
                      <Text testID={`budget-contrib-${m.user_id}`} style={{ fontSize: 17, fontWeight: "500", color: colors.onSurface }}>
                        {fmtMoney(wallet.contributions[m.user_id] ?? 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            ) : null}
          </View>
        }
        ListEmptyComponent={
          tab === "History" && !wallet.isLoading ? (
            <EmptyState icon="time-outline" title="No budget activity yet"
              subtitle="Contributions and grocery spend will appear here."
              actionLabel="Add contribution" actionTestID="budget-empty-add" onAction={() => setMode("contribution")} />
          ) : null
        }
        renderItem={({ item }) => {
          const positive = Number(item.amount) >= 0;
          return (
            <View style={{
              marginHorizontal: spacing.lg, marginTop: spacing.sm,
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
              borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
            }}>
              <IconCircle icon={positive ? "arrow-down" : "arrow-up"} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>
                  {item.type === "contribution"
                    ? `${displayNameOf(memberById(item.user_id))} added money`
                    : item.description ?? "Expense"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={{
                fontSize: 17, fontWeight: "500",
                color: positive ? colors.success : colors.onSurface,
              }}>
                {positive ? "+" : "−"}{fmtMoney(Math.abs(Number(item.amount)))}
              </Text>
            </View>
          );
        }}
      />

      <Sheet visible={!!mode} onClose={() => setMode(null)}
        title={mode === "contribution" ? "Add contribution" : "Budget expense"}>
        <View style={{ gap: spacing.md }}>
          {mode === "expense" ? (
            <Field label="What for?" testID="budget-expense-desc" value={desc} onChangeText={setDesc} placeholder="Supermarket" />
          ) : null}
          <Field label="Amount (₹)" testID="budget-amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" />
          {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
          <PrimaryButton testID="budget-save" label={mode === "contribution" ? "Add contribution" : "Record expense"}
            onPress={save} loading={loading} />
        </View>
      </Sheet>
      {void (profile && PressableScale)}
    </View>
  );
}
