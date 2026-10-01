import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInventory, useInventoryUsage } from "@/src/lib/hooks";
import { computeWasteDigest, weekRange, RESCUE_WINDOW_DAYS } from "@/src/lib/waste";
import { expiryInfo, fmtMoney, fmtQty, timeAgo } from "@/src/lib/format";
import {
  EmptyState, GradientHero, IconCircle, PrimaryButton, SegmentedControl, SkeletonCard, StatusTag,
} from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

export default function WasteSaver() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const usage = useInventoryUsage();
  const inventory = useInventory();
  const [week, setWeek] = useState("This week");

  const range = weekRange(week === "This week" ? 0 : -1);
  const digest = useMemo(
    () => computeWasteDigest(usage.data ?? [], inventory.data ?? [], range),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usage.data, inventory.data, week],
  );
  const atRisk = useMemo(
    () => (inventory.data ?? []).filter((i) => {
      const e = expiryInfo(i);
      return i.quantity > 0 && e.days !== null && e.days >= 0 && e.days <= RESCUE_WINDOW_DAYS;
    }),
    [inventory.data],
  );

  const rangeLabel = `${range.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${new Date(range.end.getTime() - 86400000).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  const loading = usage.isLoading || inventory.isLoading;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable testID="waste-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Waste saver</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>{rangeLabel}</Text>
        </View>
      </View>

      <SegmentedControl testIDPrefix="waste-week" options={["This week", "Last week"]} value={week} onChange={setWeek} />

      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <GradientHero colors={[colors.gradInventoryA, colors.gradInventoryB, colors.gradInventoryC]}>
            <IconCircle icon="leaf" tone="frosted" size={48} />
            <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, marginTop: spacing.lg }}>Food rescued before expiry</Text>
            <Text testID="waste-rescued-value" style={{ fontSize: 56, fontWeight: "300", letterSpacing: -2, color: colors.onSurface }}>
              {fmtMoney(digest.rescuedValue)}
            </Text>
            <Text style={{ fontSize: 14, color: colors.onSurfaceTertiary }}>
              {digest.rescued.length} item{digest.rescued.length === 1 ? "" : "s"} used within {RESCUE_WINDOW_DAYS} days of expiring
            </Text>
          </GradientHero>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Stat testID="waste-rate" label="Rescue rate" value={digest.rescueRate === null ? "—" : `${Math.round(digest.rescueRate * 100)}%`} />
            <Stat testID="waste-wasted" label="Expired unused" value={String(digest.wasted.length)}
              sub={digest.wastedValue ? `${fmtMoney(digest.wastedValue)} lost` : undefined} />
            <Stat testID="waste-used" label="Times used" value={String(digest.usedCount)} />
          </View>

          {atRisk.length > 0 && week === "This week" ? (
            <View style={{
              backgroundColor: colors.surfaceInverse, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md,
            }}>
              <Text style={{ color: colors.onSurfaceInverse, fontSize: 17, fontWeight: "600" }}>
                {atRisk.length} item{atRisk.length === 1 ? "" : "s"} to rescue next
              </Text>
              <Text style={{ color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 13 }} numberOfLines={2}>
                {atRisk.map((i) => `${i.name} (${expiryInfo(i).label.toLowerCase()})`).join(" · ")}
              </Text>
              <Pressable testID="waste-cook-these" onPress={() => router.push("/ai")}
                style={{ backgroundColor: colors.onSurfaceInverse, borderRadius: radius.pill, height: 48, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.surfaceInverse, fontSize: 15, fontWeight: "600" }}>Ask Kitchen AI what to cook</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>Rescued</Text>
            {digest.rescued.length === 0 ? (
              <EmptyState icon="leaf-outline" title="Nothing rescued yet"
                subtitle="Cook with items that are close to expiry and they'll be counted here." />
            ) : (
              digest.rescued.map((u) => (
                <View key={u.id} style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                  padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
                }}>
                  <IconCircle icon={u.source === "cook" ? "restaurant-outline" : "nutrition-outline"} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{u.item_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {fmtQty(Number(u.quantity))} {u.unit} · {u.source === "cook" ? "cooked" : "used"} {timeAgo(u.created_at)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: colors.success }}>{fmtMoney(u.estimated_value)}</Text>
                    <StatusTag label={u.days_to_expiry === 0 ? "On expiry day" : `${u.days_to_expiry}d left`} tone="fresh" />
                  </View>
                </View>
              ))
            )}
          </View>

          {digest.wasted.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>Expired unused</Text>
              {digest.wasted.map((i) => (
                <Pressable key={i.id} testID={`waste-expired-${i.id}`}
                  onPress={() => router.push({ pathname: "/inventory/[id]", params: { id: i.id } })}
                  style={{
                    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
                  }}>
                  <IconCircle icon="trash-outline" size={40} badge />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{i.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{fmtQty(i.quantity)} {i.unit} left</Text>
                  </View>
                  <StatusTag label={expiryInfo(i).label} tone="expired" />
                </Pressable>
              ))}
            </View>
          ) : null}

          <PrimaryButton testID="waste-open-inventory" label="Open inventory" onPress={() => router.push("/(tabs)/inventory")} />
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, sub, testID }: { label: string; value: string; sub?: string; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.border, padding: spacing.md, gap: 2,
    }}>
      <Text testID={testID} style={{ fontSize: 24, fontWeight: "500", letterSpacing: -0.5, color: colors.onSurface }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 11, color: colors.error }}>{sub}</Text> : null}
    </View>
  );
}
