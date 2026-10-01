import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { addExpenseRecord } from "@/src/lib/actions";
import { fmtMoney } from "@/src/lib/format";
import { Field, IconCircle, PillRow, PrimaryButton, SegmentedControl, useToast } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

const CATEGORIES = ["Groceries", "Bills", "Rent", "Food", "Other"];
const SPLIT_MODES = ["Equal", "Custom", "Only me"];

export default function NewExpense() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household, profile } = useApp();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [paidBy, setPaidBy] = useState<string>(session?.user.id ?? "");
  const [notes, setNotes] = useState("");
  const [splitMode, setSplitMode] = useState("Equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [fromBudget, setFromBudget] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amt = Number(amount) || 0;
  const showBudgetToggle = category === "Groceries" || category === "Food";

  const splits = useMemo(() => {
    if (!members.length || amt <= 0) return [];
    if (splitMode === "Only me") return [{ user_id: paidBy, share_amount: amt }];
    if (splitMode === "Equal") {
      const each = Math.round((amt / members.length) * 100) / 100;
      return members.map((m) => ({ user_id: m.user_id, share_amount: each }));
    }
    return members
      .map((m) => ({ user_id: m.user_id, share_amount: Number(custom[m.user_id]) || 0 }))
      .filter((s) => s.share_amount > 0);
  }, [splitMode, members, amt, paidBy, custom]);

  const customTotal = splitMode === "Custom" ? splits.reduce((s, x) => s + x.share_amount, 0) : amt;

  async function save() {
    if (!title.trim()) return setError("Give the expense a title");
    if (!amt || amt <= 0) return setError("Amount must be more than 0");
    if (!paidBy) return setError("Who paid?");
    if (splitMode === "Custom" && Math.abs(customTotal - amt) > 0.5) {
      return setError(`Custom split must add up to ${fmtMoney(amt)} (currently ${fmtMoney(customTotal)})`);
    }
    if (!household) return;
    setLoading(true);
    setError(null);
    try {
      await addExpenseRecord(
        {
          title: title.trim(),
          amount: amt,
          category: category.toLowerCase(),
          paidBy,
          date: new Date().toISOString().slice(0, 10),
          notes: notes.trim() || undefined,
          fromBudget: showBudgetToggle && fromBudget,
          splits,
        },
        { householdId: household.id, actorName: profile?.full_name?.split(" ")[0] ?? "Someone", members },
      );
      toast("Expense added", "success");
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Could not save expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}>
        <Pressable testID="expense-new-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Add expense</Text>
      </View>

      <Field label="Title" testID="expense-title" value={title} onChangeText={setTitle} placeholder="Supermarket run" />
      <Field label="Amount (₹)" testID="expense-amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="650" />

      <Text style={labelStyle(colors.muted)}>Category</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="expense-category" options={CATEGORIES} value={category} onChange={setCategory} />
      </View>

      <Text style={labelStyle(colors.muted)}>Paid by</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow
          testIDPrefix="expense-paidby"
          options={members.map((m) => displayNameOf(m))}
          value={displayNameOf(members.find((m) => m.user_id === paidBy) ?? null)}
          onChange={(label) => {
            const m = members.find((mm) => displayNameOf(mm) === label);
            if (m) setPaidBy(m.user_id);
          }}
        />
      </View>

      <Text style={labelStyle(colors.muted)}>Split</Text>
      <SegmentedControl testIDPrefix="expense-split" options={SPLIT_MODES} value={splitMode} onChange={setSplitMode} />

      {splitMode === "Equal" && amt > 0 ? (
        <Text style={{ fontSize: 13, color: colors.muted, marginLeft: 4 }}>
          {fmtMoney(amt)} ÷ {members.length} people = {fmtMoney(amt / members.length)} each
        </Text>
      ) : null}

      {splitMode === "Custom" ? (
        <View style={{ gap: spacing.sm }}>
          {members.map((m) => (
            <View key={m.user_id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Text style={{ flex: 1, fontSize: 15, color: colors.onSurface }}>{displayNameOf(m)}</Text>
              <TextInput
                testID={`expense-custom-${m.user_id}`}
                value={custom[m.user_id] ?? ""}
                onChangeText={(t) => setCustom((c) => ({ ...c, [m.user_id]: t }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={{
                  width: 110, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
                  borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 48,
                  fontSize: 16, color: colors.onSurface, textAlign: "right",
                }}
              />
            </View>
          ))}
          <Text style={{ fontSize: 13, color: Math.abs(customTotal - amt) > 0.5 ? colors.error : colors.success, marginLeft: 4 }}>
            Total {fmtMoney(customTotal)} of {fmtMoney(amt)}
          </Text>
        </View>
      ) : null}

      {showBudgetToggle ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 14, color: colors.onSurface }}>Deduct from food budget</Text>
          <Switch testID="expense-budget-toggle" value={fromBudget} onValueChange={setFromBudget} />
        </View>
      ) : null}

      <Field label="Notes (optional)" testID="expense-notes" value={notes} onChangeText={setNotes} placeholder="Weekly supermarket run" />

      {error ? <Text testID="expense-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
      <PrimaryButton testID="expense-save" label="Add expense" onPress={save} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

function labelStyle(color: string) {
  return { fontSize: 13, fontWeight: "500" as const, color, marginLeft: 4 };
}

void ScrollView;
