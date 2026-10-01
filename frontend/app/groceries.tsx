import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useGroceries } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { addToGrocery, purchaseGrocery } from "@/src/lib/actions";
import { fmtMoney, fmtQty, firstName } from "@/src/lib/format";
import {
  EmptyState, Field, IconCircle, PillRow, PressableScale, PrimaryButton, SegmentedControl,
  SkeletonCard, useToast,
} from "@/src/components/core";
import { Sheet, ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { GroceryItem } from "@/src/lib/types";

const CATEGORIES = ["Vegetables", "Fruits", "Meat", "Dairy", "Grains", "Snacks", "Drinks", "Spices", "Frozen", "Other"];
const UNITS = ["pcs", "kg", "g", "L", "ml", "packs", "bottles"];

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual", low_stock: "Low inventory", ai_meal: "AI meal", recurring: "Recurring",
};

export default function Groceries() {
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { session, household, members, profile } = useApp();
  const groceries = useGroceries();
  const toast = useToast();

  const [segment, setSegment] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<GroceryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<GroceryItem | null>(null);

  useEffect(() => {
    if (params.add === "1") setAddOpen(true);
  }, [params.add]);

  const needed = useMemo(() => (groceries.data ?? []).filter((g) => !g.purchased), [groceries.data]);
  const purchased = useMemo(() => (groceries.data ?? []).filter((g) => g.purchased), [groceries.data]);
  const filtered = segment === "Needed" ? needed : segment === "Purchased" ? purchased : (groceries.data ?? []);
  const estimated = needed.reduce((s, g) => s + Number(g.estimated_price ?? 0), 0);
  const memberById = (id: string | null) => members.find((m) => m.user_id === id);

  async function handleDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from("grocery_items").delete().eq("id", deleteItem.id);
    if (error) toast(error.message, "error");
    else toast("Removed from list", "info");
    setDeleteItem(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable testID="groceries-back" onPress={() => router.back()} hitSlop={12}>
            <IconCircle icon="chevron-back" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Groceries</Text>
            <Text testID="groceries-summary" style={{ fontSize: 13, color: colors.muted }}>
              {needed.length} needed · estimated {fmtMoney(estimated)}
            </Text>
          </View>
          <PressableScale testID="groceries-add" onPress={() => setAddOpen(true)}>
            <IconCircle icon="add" tone="dark" />
          </PressableScale>
        </View>
        <SegmentedControl testIDPrefix="groceries-segment" options={["All", "Needed", "Purchased"]} value={segment} onChange={setSegment} />
      </View>

      {groceries.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><SkeletonCard /><SkeletonCard /></View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Your shopping list is clear"
          subtitle="Add items as you run out — everyone at home sees the same list."
          actionLabel="Add item"
          actionTestID="groceries-empty-add"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
              borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
            }}>
              <Pressable
                testID={`grocery-check-${item.id}`}
                onPress={() => { if (!item.purchased) setPurchaseItem(item); }}
                style={{
                  width: 44, height: 44, alignItems: "center", justifyContent: "center",
                }}
              >
                <View style={{
                  width: 26, height: 26, borderRadius: 13, borderWidth: 2,
                  borderColor: item.purchased ? colors.success : colors.borderStrong,
                  backgroundColor: item.purchased ? colors.success : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {item.purchased ? <Text style={{ color: colors.onSuccess, fontSize: 13, fontWeight: "700" }}>✓</Text> : null}
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{
                  fontSize: 15, fontWeight: "600", color: colors.onSurface,
                  textDecorationLine: item.purchased ? "line-through" : "none",
                }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {fmtQty(item.quantity)} {item.unit}
                  {item.purchased
                    ? ` · bought by ${firstName(memberById(item.purchased_by)?.profiles?.full_name, memberById(item.purchased_by)?.profiles?.email)}`
                    : ` · ${SOURCE_LABEL[item.source] ?? "Manual"}${item.source_reference ? ` (${item.source_reference})` : ""}`}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>
                {item.purchased && item.actual_price != null ? fmtMoney(item.actual_price) : item.estimated_price != null ? `~${fmtMoney(item.estimated_price)}` : ""}
              </Text>
              <Pressable testID={`grocery-delete-${item.id}`} onPress={() => setDeleteItem(item)} hitSlop={8}>
                <IconCircle icon="trash-outline" size={36} />
              </Pressable>
            </View>
          )}
        />
      )}

      <AddGrocerySheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={async (input) => {
          if (!session?.user || !household) return;
          try {
            await addToGrocery(household.id, session.user.id, input);
            toast("Added to grocery list", "success");
            setAddOpen(false);
          } catch (e: any) {
            toast(e.message ?? "Could not add item", "error");
          }
        }}
      />

      <PurchaseSheet
        item={purchaseItem}
        onClose={() => setPurchaseItem(null)}
        onConfirm={async (cost, qty, deduct) => {
          if (!purchaseItem || !session?.user || !household) return;
          try {
            await purchaseGrocery(purchaseItem, cost, qty, deduct, {
              householdId: household.id,
              userId: session.user.id,
              actorName: profile?.full_name?.split(" ")[0] ?? "Someone",
              members,
            });
            toast("Purchased — added to inventory & expenses", "success");
            setPurchaseItem(null);
          } catch (e: any) {
            toast(e.message ?? "Could not complete purchase", "error");
          }
        }}
      />

      <ConfirmSheet
        visible={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title={`Remove ${deleteItem?.name}?`}
        confirmLabel="Remove"
        destructive
        confirmTestID="grocery-delete-confirm"
      />
    </View>
  );
}

function AddGrocerySheet({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { name: string; quantity: number; unit: string; category: string; estimated_price: number | null }) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [category, setCategory] = useState("Other");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setName(""); setQty("1"); setPrice(""); setError(null); }
  }, [visible]);

  async function save() {
    const q = Number(qty);
    if (!name.trim()) return setError("Name the item");
    if (!q || q <= 0) return setError("Quantity must be more than 0");
    setLoading(true);
    await onSave({
      name: name.trim(), quantity: q, unit,
      category: category.toLowerCase(),
      estimated_price: price ? Number(price) : null,
    });
    setLoading(false);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add grocery item">
      <View style={{ gap: spacing.md }}>
        <Field label="Item" testID="grocery-add-name" value={name} onChangeText={setName} placeholder="Milk" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Quantity" testID="grocery-add-qty" value={qty} onChangeText={setQty} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Est. price (₹)" testID="grocery-add-price" value={price} onChangeText={setPrice} keyboardType="numeric" />
          </View>
        </View>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <PillRow testIDPrefix="grocery-add-unit" options={UNITS} value={unit} onChange={setUnit} />
          <PillRow testIDPrefix="grocery-add-category" options={CATEGORIES} value={category} onChange={setCategory} />
        </View>
        {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
        <PrimaryButton testID="grocery-add-save" label="Add to list" onPress={save} loading={loading} />
      </View>
    </Sheet>
  );
}

function PurchaseSheet({ item, onClose, onConfirm }: {
  item: GroceryItem | null;
  onClose: () => void;
  onConfirm: (actualCost: number, quantity: number, deductFromBudget: boolean) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [cost, setCost] = useState("");
  const [qty, setQty] = useState("1");
  const [deduct, setDeduct] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setCost(item.estimated_price != null ? String(item.estimated_price) : "");
      setQty(String(item.quantity));
      setDeduct(true);
      setError(null);
    }
  }, [item]);

  async function confirm() {
    const c = Number(cost);
    const q = Number(qty);
    if (!c || c <= 0) return setError("Enter the actual cost");
    if (!q || q <= 0) return setError("Enter the quantity bought");
    setLoading(true);
    await onConfirm(c, q, deduct);
    setLoading(false);
  }

  return (
    <Sheet visible={!!item} onClose={onClose} title={item ? `Purchased: ${item.name}` : ""}>
      <View style={{ gap: spacing.md }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          This adds it to inventory, records the expense, and updates the food budget.
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Actual cost (₹)" testID="purchase-cost" value={cost} onChangeText={setCost} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={`Quantity (${item?.unit ?? "pcs"})`} testID="purchase-qty" value={qty} onChangeText={setQty} keyboardType="numeric" />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 14, color: colors.onSurface }}>Deduct from food budget</Text>
          <Switch testID="purchase-deduct-toggle" value={deduct} onValueChange={setDeduct} />
        </View>
        {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
        <PrimaryButton testID="purchase-confirm" label="Complete purchase" onPress={confirm} loading={loading} />
      </View>
    </Sheet>
  );
}
