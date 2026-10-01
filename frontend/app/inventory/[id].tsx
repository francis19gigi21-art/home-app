import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useInventory } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { addToGrocery, useInventoryQuantity } from "@/src/lib/actions";
import { expiryInfo, fmtDate, fmtMoney, fmtQty } from "@/src/lib/format";
import { GhostButton, IconCircle, PrimaryButton, QuantityStepper, SkeletonCard, StatusTag, useToast } from "@/src/components/core";
import { ConfirmSheet, Sheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";

export default function InventoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { session, household } = useApp();
  const inventory = useInventory();
  const toast = useToast();

  const [useOpen, setUseOpen] = useState(false);
  const [useQty, setUseQty] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const item = useMemo(() => (inventory.data ?? []).find((i) => i.id === id), [inventory.data, id]);

  const step = item && (item.unit === "g" || item.unit === "ml") ? 50 : item && (item.unit === "kg" || item.unit === "L") ? 0.5 : 1;

  async function handleUse() {
    if (!item) return;
    setWorking(true);
    try {
      const newQty = await useInventoryQuantity(item, useQty);
      toast(`Used ${fmtQty(useQty)} ${item.unit} — ${fmtQty(newQty)} ${item.unit} left`, "success");
      setUseOpen(false);
      if (newQty <= 0) setFinishedOpen(true);
    } catch (e: any) {
      toast(e.message ?? "Could not update", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddToGrocery() {
    if (!item || !household || !session?.user) return;
    try {
      await addToGrocery(household.id, session.user.id, {
        name: item.name, quantity: 1, unit: item.unit, category: item.category,
        estimated_price: item.estimated_cost, source: "low_stock",
      });
      toast(`${item.name} added to groceries`, "success");
    } catch (e: any) {
      toast(e.message ?? "Could not add", "error");
    }
    setFinishedOpen(false);
  }

  async function handleDelete() {
    if (!item) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) toast(error.message, "error");
    else {
      toast("Item removed", "info");
      router.back();
    }
    setDeleteOpen(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable testID="inventory-detail-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Pressable testID="inventory-detail-delete" onPress={() => setDeleteOpen(true)} hitSlop={12}>
          <IconCircle icon="trash-outline" />
        </Pressable>
      </View>

      {inventory.isLoading || !item ? (
        <SkeletonCard />
      ) : (
        <>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <IconCircle icon="nutrition-outline" size={72} badge={["urgent", "expired"].includes(expiryInfo(item).tone)} />
            <Text testID="inventory-detail-name" style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "300", letterSpacing: -0.5, color: colors.onSurface }}>
              {fmtQty(item.quantity)} <Text style={{ fontSize: 15, color: colors.muted }}>{item.unit}</Text>
            </Text>
            <StatusTag label={expiryInfo(item).label} tone={expiryInfo(item).tone} />
            {item.minimum_quantity != null && item.quantity <= item.minimum_quantity && item.quantity > 0 ? (
              <StatusTag label={`Low stock · min ${fmtQty(item.minimum_quantity)} ${item.unit}`} tone="soon" />
            ) : null}
          </View>

          <View style={{
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
            borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
          }}>
            <Row label="Category" value={item.category} />
            <Row label="Purchased" value={fmtDate(item.purchase_date)} />
            <Row label="Expires" value={fmtDate(item.expiry_date)} />
            {item.estimated_cost != null ? <Row label="Estimated value" value={fmtMoney(item.estimated_cost)} /> : null}
            {item.notes ? <Row label="Notes" value={item.notes} /> : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton testID="inventory-use" label="Use item" icon="remove-circle-outline"
              onPress={() => { setUseQty(Math.min(step, Number(item.quantity)) || step); setUseOpen(true); }}
              disabled={item.quantity <= 0} />
            <GhostButton testID="inventory-edit" label="Edit" icon="create-outline"
              onPress={() => router.push({ pathname: "/inventory/new", params: { id: item.id } })} />
            <GhostButton testID="inventory-add-grocery" label="Add to grocery list" icon="cart-outline" onPress={handleAddToGrocery} />
          </View>
        </>
      )}

      <Sheet visible={useOpen} onClose={() => setUseOpen(false)} title={item ? `Use ${item.name}` : ""}>
        <View style={{ gap: spacing.lg, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>
            You have {fmtQty(Number(item?.quantity ?? 0))} {item?.unit}
          </Text>
          <QuantityStepper testID="use-qty" value={useQty} onChange={(v) => setUseQty(Math.min(v, Number(item?.quantity ?? 0)))} min={0} step={step} />
          <View style={{ alignSelf: "stretch" }}>
            <PrimaryButton testID="use-confirm" label={`Use ${fmtQty(useQty)} ${item?.unit ?? ""}`} onPress={handleUse} loading={working} />
          </View>
        </View>
      </Sheet>

      <ConfirmSheet
        visible={finishedOpen}
        onClose={() => setFinishedOpen(false)}
        onConfirm={handleAddToGrocery}
        title={`${item?.name ?? "Item"} finished`}
        message="Add it to the grocery list so it's not forgotten?"
        confirmLabel="Yes, add"
        confirmTestID="inventory-finished-add"
      />

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Remove ${item?.name}?`}
        message="This removes it from your shared inventory."
        confirmLabel="Remove"
        destructive
        confirmTestID="inventory-delete-confirm"
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface, textTransform: "capitalize" }}>{value}</Text>
    </View>
  );
}
