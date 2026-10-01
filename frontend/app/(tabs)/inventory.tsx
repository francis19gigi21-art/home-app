import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInventory } from "@/src/lib/hooks";
import { expiryInfo, fmtQty } from "@/src/lib/format";
import { EmptyState, GradientHero, IconCircle, PillRow, PressableScale, SearchBar, SkeletonCard, StatusTag, Ionicons } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

const CATEGORIES = ["All", "Vegetables", "Fruits", "Meat", "Dairy", "Grains", "Snacks", "Drinks", "Spices", "Frozen", "Other"];

export default function Inventory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const inventory = useInventory();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const expiringSoon = useMemo(
    () => (inventory.data ?? []).filter((i) => {
      const e = expiryInfo(i);
      return (e.tone === "soon" || e.tone === "urgent") && i.quantity > 0;
    }),
    [inventory.data],
  );

  const lowStock = useMemo(
    () => (inventory.data ?? []).filter((i) => i.minimum_quantity != null && i.quantity > 0 && i.quantity <= i.minimum_quantity),
    [inventory.data],
  );

  const filtered = useMemo(() => {
    let list = inventory.data ?? [];
    if (category === "Expiring") list = expiringSoon;
    else if (category !== "All") list = list.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    if (search.trim()) list = list.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));
    return list;
  }, [inventory.data, category, search, expiringSoon]);

  const categories = expiringSoon.length > 0 ? ["All", "Expiring", ...CATEGORIES.slice(1)] : CATEGORIES;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Inventory</Text>
          <PressableScale testID="inventory-add" onPress={() => router.push("/inventory/new")}>
            <IconCircle icon="add" tone="dark" />
          </PressableScale>
        </View>
        <SearchBar testID="inventory-search" value={search} onChangeText={setSearch} placeholder="Quick search" />
        <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
          <Text testID="inventory-count" style={{ fontSize: 56, fontWeight: "300", letterSpacing: -2, color: colors.onSurface }}>
            {inventory.data?.length ?? 0}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            items at home{expiringSoon.length ? ` · ${expiringSoon.length} expiring soon` : ""}
            {lowStock.length ? ` · ${lowStock.length} low stock` : ""}
          </Text>
        </View>
      </View>

      <PillRow testIDPrefix="inventory-cat" options={categories} value={category} onChange={setCategory} />

      {inventory.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><SkeletonCard /><SkeletonCard /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            expiringSoon.length > 0 && category === "All" && !search ? (
              <PressableScale testID="inventory-expiring-hero" onPress={() => setCategory("Expiring")}>
                <GradientHero colors={[colors.gradInventoryA, colors.gradInventoryB, colors.gradInventoryC]}
                  style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <IconCircle icon="leaf" tone="frosted" size={48} badge />
                    <View style={{
                      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceInverse,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons name="arrow-up" size={18} color={colors.onSurfaceInverse} style={{ transform: [{ rotate: "45deg" }] }} />
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, marginTop: spacing.md }}>Use before expiry</Text>
                  <Text style={{ fontSize: 34, fontWeight: "300", letterSpacing: -1, color: colors.onSurface }}>
                    {expiringSoon.length} <Text style={{ fontSize: 15, color: colors.onSurfaceTertiary }}>items</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary }} numberOfLines={1}>
                    {expiringSoon.map((i) => i.name).join(" · ")}
                  </Text>
                </GradientHero>
              </PressableScale>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="Your kitchen looks empty"
              subtitle="Add what you already have and I'll help you decide what to cook."
              actionLabel="Add first item"
              actionTestID="inventory-empty-add"
              onAction={() => router.push("/inventory/new")}
            />
          }
          renderItem={({ item }) => {
            const e = expiryInfo(item);
            const low = item.minimum_quantity != null && item.quantity > 0 && item.quantity <= item.minimum_quantity;
            return (
              <PressableScale testID={`inventory-item-${item.id}`}
                onPress={() => router.push({ pathname: "/inventory/[id]", params: { id: item.id } })}>
                <View style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
                  borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
                }}>
                  <IconCircle icon="nutrition-outline" size={40} badge={e.tone === "urgent" || e.tone === "expired"} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {fmtQty(item.quantity)} {item.unit} · {item.category}
                      {low ? " · Low stock" : ""}
                    </Text>
                  </View>
                  <StatusTag label={e.label} tone={e.tone} />
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}
