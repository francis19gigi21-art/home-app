import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp } from "@/src/context/AppContext";
import { useInventory } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { Field, IconCircle, PillRow, PrimaryButton, QuantityStepper, useToast } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

const CATEGORIES = ["Vegetables", "Fruits", "Meat", "Dairy", "Grains", "Snacks", "Drinks", "Spices", "Frozen", "Other"];
const UNITS = ["pcs", "kg", "g", "L", "ml", "packs", "bottles"];
const EXPIRY_OPTIONS = [
  { label: "No expiry", days: null },
  { label: "+2 days", days: 2 },
  { label: "+4 days", days: 4 },
  { label: "+1 week", days: 7 },
  { label: "+2 weeks", days: 14 },
  { label: "+1 month", days: 30 },
];
const QUICK_ADD: { name: string; category: string; unit: string }[] = [
  { name: "Eggs", category: "Dairy", unit: "pcs" },
  { name: "Milk", category: "Dairy", unit: "L" },
  { name: "Rice", category: "Grains", unit: "kg" },
  { name: "Bread", category: "Grains", unit: "packs" },
  { name: "Tomato", category: "Vegetables", unit: "pcs" },
  { name: "Onion", category: "Vegetables", unit: "pcs" },
  { name: "Chicken", category: "Meat", unit: "g" },
];

export default function NewInventoryItem() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { session, household } = useApp();
  const inventory = useInventory();
  const toast = useToast();

  const editing = useMemo(() => (inventory.data ?? []).find((i) => i.id === params.id), [inventory.data, params.id]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Vegetables");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [expiryLabel, setExpiryLabel] = useState("+1 week");
  const [cost, setCost] = useState("");
  const [minQty, setMinQty] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCategory(capitalize(editing.category));
      setQuantity(Number(editing.quantity));
      setUnit(editing.unit);
      setCost(editing.estimated_cost != null ? String(editing.estimated_cost) : "");
      setMinQty(editing.minimum_quantity != null ? String(editing.minimum_quantity) : "");
      setNotes(editing.notes ?? "");
      if (!editing.expiry_date) setExpiryLabel("No expiry");
      else {
        const days = Math.round((new Date(editing.expiry_date).getTime() - Date.now()) / 86400000);
        const match = EXPIRY_OPTIONS.reduce((best, o) =>
          o.days !== null && Math.abs(o.days - days) < Math.abs((best.days ?? 999) - days) ? o : best, EXPIRY_OPTIONS[3]);
        setExpiryLabel(match.label);
      }
    }
  }, [editing]);

  async function save() {
    if (!name.trim()) return setError("Name the item");
    if (quantity <= 0) return setError("Quantity must be more than 0");
    if (cost && Number(cost) < 0) return setError("Cost can't be negative");
    if (!household || !session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const expiryDays = EXPIRY_OPTIONS.find((o) => o.label === expiryLabel)?.days ?? null;
      const expiry = expiryDays
        ? new Date(Date.now() + expiryDays * 86400000).toISOString().slice(0, 10)
        : null;
      const payload = {
        name: name.trim(),
        category: category.toLowerCase(),
        quantity,
        unit,
        expiry_date: expiry,
        estimated_cost: cost ? Number(cost) : null,
        minimum_quantity: minQty ? Number(minQty) : null,
        notes: notes.trim() || null,
      };
      if (editing) {
        const { error: dbErr } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
        if (dbErr) throw new Error(dbErr.message);
        toast("Item updated", "success");
      } else {
        const { error: dbErr } = await supabase.from("inventory_items").insert({
          ...payload,
          household_id: household.id,
          purchase_date: new Date().toISOString().slice(0, 10),
          added_by: session.user.id,
        });
        if (dbErr) throw new Error(dbErr.message);
        toast(`${name.trim()} added to inventory`, "success");
      }
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Could not save item");
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
        <Pressable testID="inventory-new-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>
          {editing ? "Edit item" : "Add item"}
        </Text>
      </View>

      {!editing ? (
        <>
          <Text style={lbl(colors.muted)}>Quick add</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
            {QUICK_ADD.map((q) => (
              <Pressable
                key={q.name}
                testID={`quick-add-${q.name.toLowerCase()}`}
                onPress={() => { setName(q.name); setCategory(q.category); setUnit(q.unit); }}
                style={{
                  flexShrink: 0, height: 40, paddingHorizontal: 16, borderRadius: 999,
                  backgroundColor: name === q.name ? colors.surfaceInverse : colors.surfaceSecondary,
                  borderWidth: name === q.name ? 0 : 1, borderColor: colors.border,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: name === q.name ? colors.onSurfaceInverse : colors.onSurface }}>
                  {q.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Field label="Item name" testID="inventory-name" value={name} onChangeText={setName} placeholder="Chicken" />

      <Text style={lbl(colors.muted)}>Category</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="inventory-category" options={CATEGORIES} value={category} onChange={setCategory} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={lbl(colors.muted)}>Quantity</Text>
        <QuantityStepper testID="inventory-qty" value={quantity} onChange={setQuantity} min={0.5}
          step={unit === "g" || unit === "ml" ? 50 : unit === "kg" || unit === "L" ? 0.5 : 1} />
      </View>

      <Text style={lbl(colors.muted)}>Unit</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="inventory-unit" options={UNITS} value={unit} onChange={setUnit} />
      </View>

      <Text style={lbl(colors.muted)}>Expires</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="inventory-expiry" options={EXPIRY_OPTIONS.map((o) => o.label)} value={expiryLabel} onChange={setExpiryLabel} />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Est. cost (₹)" testID="inventory-cost" value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="180" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Min. quantity" testID="inventory-min" value={minQty} onChangeText={setMinQty} keyboardType="numeric" placeholder="Optional" />
        </View>
      </View>

      <Field label="Notes (optional)" testID="inventory-notes" value={notes} onChangeText={setNotes} placeholder="Freezer, top shelf…" />

      {error ? <Text testID="inventory-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
      <PrimaryButton testID="inventory-save" label={editing ? "Save changes" : "Add to inventory"} onPress={save} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

function lbl(color: string) {
  return { fontSize: 13, fontWeight: "500" as const, color, marginLeft: 4 };
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
