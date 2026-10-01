import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useInventory } from "@/src/lib/hooks";
import { suggestMeals } from "@/src/lib/api";
import { addToGrocery, matchInventory, useInventoryQuantity } from "@/src/lib/actions";
import { fmtMoney } from "@/src/lib/format";
import {
  EmptyState, GradientHero, IconCircle, PressableScale, PrimaryButton, GhostButton,
  Skeleton, Ionicons, useToast,
} from "@/src/components/core";
import { Sheet, ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { InventoryItem, MealSuggestion } from "@/src/lib/types";

const QUICK_ACTIONS: { label: string; prompt: string; maxSpend?: number }[] = [
  { label: "What can we cook?", prompt: "What can we cook tonight?" },
  { label: "No-Spend Meals", prompt: "Suggest meals using only what we already have. Nothing extra to buy.", maxSpend: 0 },
  { label: "Under ₹100", prompt: "Meals where extra ingredients cost under ₹100 total.", maxSpend: 100 },
  { label: "Under ₹200", prompt: "Meals where extra ingredients cost under ₹200 total.", maxSpend: 200 },
  { label: "Use Before Expiry", prompt: "Prioritise ingredients expiring soonest so nothing goes to waste." },
  { label: "Quick Meals", prompt: "Quick meals under 20 minutes." },
  { label: "Healthy", prompt: "Healthy, balanced meals." },
  { label: "High Protein", prompt: "High protein meals." },
  { label: "Vegetarian", prompt: "Vegetarian meals only." },
  { label: "Breakfast", prompt: "Breakfast ideas." },
  { label: "Lunch", prompt: "Lunch ideas." },
  { label: "Dinner", prompt: "Dinner ideas." },
  { label: "Snacks", prompt: "Snack ideas." },
];

const LOADING_LINES = [
  "Checking your inventory…",
  "Finding meals within your budget…",
  "Prioritising food that expires soon…",
];

export default function KitchenAi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { session, household } = useApp();
  const inventory = useInventory();
  const toast = useToast();

  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "results">("idle");
  const [meals, setMeals] = useState<MealSuggestion[]>([]);
  const [query, setQuery] = useState("");
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cookMeal, setCookMeal] = useState<MealSuggestion | null>(null);
  const [missingMeal, setMissingMeal] = useState<MealSuggestion | null>(null);
  const [finishedItems, setFinishedItems] = useState<InventoryItem[]>([]);
  const [working, setWorking] = useState(false);
  const lastRequest = useRef<{ prompt: string; maxSpend?: number } | null>(null);

  useEffect(() => {
    if (phase !== "loading") return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length;
      setLoadingLine(LOADING_LINES[i]);
    }, 1800);
    return () => clearInterval(t);
  }, [phase]);

  async function run(prompt: string, maxSpend?: number) {
    lastRequest.current = { prompt, maxSpend };
    setPhase("loading");
    setLoadingLine(LOADING_LINES[0]);
    try {
      const result = await suggestMeals(prompt, maxSpend ?? null);
      if (!result.length) throw new Error("empty");
      setMeals(result);
      setPhase("results");
    } catch (e: any) {
      setPhase("error");
    }
  }

  async function handleCookConfirm() {
    if (!cookMeal || !session?.user || !household) return;
    setWorking(true);
    const finished: InventoryItem[] = [];
    try {
      const uses = cookMeal.uses ?? [];
      for (const u of uses) {
        const match = matchInventory(inventory.data ?? [], u.name);
        if (!match) continue;
        const newQty = await useInventoryQuantity(match, Number(u.quantity) || 0, "cook");
        if (newQty <= 0) finished.push(match);
      }
      toast("Inventory updated — enjoy your meal!", "success");
      setCookMeal(null);
      if (finished.length) setFinishedItems(finished);
    } catch (e: any) {
      toast(e.message ?? "Could not update inventory", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddMissing() {
    if (!missingMeal || !session?.user || !household) return;
    setWorking(true);
    try {
      for (const m of missingMeal.missing_ingredients) {
        await addToGrocery(household.id, session.user.id, {
          name: m.name,
          quantity: (m as any).quantity ?? 1,
          unit: (m as any).unit ?? "pcs",
          estimated_price: m.estimated_price ?? null,
          source: "ai_meal",
          source_reference: missingMeal.name,
        });
      }
      toast(`Added ${missingMeal.missing_ingredients.length} item(s) to groceries`, "success");
      setMissingMeal(null);
    } catch (e: any) {
      toast(e.message ?? "Could not add to groceries", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleFinishedToGrocery() {
    if (!session?.user || !household) return;
    try {
      for (const f of finishedItems) {
        await addToGrocery(household.id, session.user.id, {
          name: f.name, quantity: 1, unit: f.unit, category: f.category, source: "low_stock",
        });
      }
      toast("Added to grocery list", "success");
    } catch {
      toast("Could not add to groceries", "error");
    }
    setFinishedItems([]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable testID="ai-back" onPress={() => router.back()} hitSlop={12}>
              <IconCircle icon="chevron-back" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Kitchen AI</Text>
            </View>
          </View>

          <GradientHero colors={[colors.gradAiA, colors.gradAiB, colors.gradAiC]}>
            <IconCircle icon="sparkles" tone="frosted" size={48} />
            <Text style={{ fontSize: 22, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginTop: spacing.md }}>
              Cook smarter with what you already have.
            </Text>
            <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 6, lineHeight: 19 }}>
              I can see your inventory, expiry dates, household size and food budget — I only suggest, you decide.
            </Text>
          </GradientHero>

          {/* Quick actions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                testID={`ai-quick-${a.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onPress={() => run(a.prompt, a.maxSpend)}
                style={{
                  flexShrink: 0, height: 40, paddingHorizontal: 16, borderRadius: radius.pill,
                  backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: colors.onSurface }}>{a.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Free text */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: spacing.sm,
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, borderWidth: 1,
            borderColor: colors.border, paddingLeft: 18, paddingRight: 6, height: 56,
          }}>
            <TextInput
              testID="ai-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Ask anything… e.g. something healthy with eggs"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, fontSize: 15, color: colors.onSurface, height: "100%" }}
              onSubmitEditing={() => { if (query.trim()) { run(query.trim()); setQuery(""); } }}
            />
            <PressableScale testID="ai-send"
              onPress={() => { if (query.trim()) { run(query.trim()); setQuery(""); } }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInverse,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="arrow-up" size={20} color={colors.onSurfaceInverse} />
              </View>
            </PressableScale>
          </View>

          {/* States */}
          {phase === "loading" ? (
            <View style={{ gap: spacing.md }}>
              <Text testID="ai-loading-line" style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>{loadingLine}</Text>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
                  borderColor: colors.border, padding: spacing.lg, gap: 10,
                }}>
                  <Skeleton width="50%" height={18} />
                  <Skeleton width="80%" height={12} />
                  <Skeleton width="65%" height={12} />
                </View>
              ))}
            </View>
          ) : phase === "error" ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="I couldn't generate meal ideas right now"
              subtitle="Your inventory is safe. Try again in a moment."
              actionLabel="Retry"
              actionTestID="ai-retry"
              onAction={() => lastRequest.current && run(lastRequest.current.prompt, lastRequest.current.maxSpend)}
            />
          ) : phase === "results" ? (
            <View style={{ gap: spacing.md }}>
              {meals.map((meal, idx) => (
                <MealCard
                  key={idx}
                  meal={meal}
                  expanded={expanded === idx}
                  onToggle={() => setExpanded(expanded === idx ? null : idx)}
                  onCook={() => setCookMeal(meal)}
                  onAddMissing={() => setMissingMeal(meal)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="restaurant-outline"
              title="Hungry for ideas?"
              subtitle="Pick a quick action or ask me anything — I'll work with what's actually in your kitchen."
            />
          )}
        </View>
      </ScrollView>

      {/* Cook This sheet */}
      <Sheet visible={!!cookMeal} onClose={() => setCookMeal(null)} title={cookMeal ? `Cook: ${cookMeal.name}` : ""}>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>
          Confirm what you'll use. Inventory updates only after you confirm.
        </Text>
        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          {(cookMeal?.uses ?? []).length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.onSurfaceTertiary }}>
              {(cookMeal?.available_ingredients ?? []).join(", ") || "Ingredients from your inventory"}
            </Text>
          ) : (
            (cookMeal?.uses ?? []).map((u, i) => {
              const match = matchInventory(inventory.data ?? [], u.name);
              return (
                <View key={i} style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md,
                }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{u.name}</Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    use {u.quantity} {u.unit}{match ? ` · have ${match.quantity} ${match.unit}` : " · not tracked"}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton testID="cook-confirm" label="Use these ingredients" onPress={handleCookConfirm} loading={working} />
          <GhostButton testID="cook-cancel" label="Not now" onPress={() => setCookMeal(null)} />
        </View>
      </Sheet>

      {/* Add missing sheet */}
      <Sheet visible={!!missingMeal} onClose={() => setMissingMeal(null)} title="Add missing ingredients">
        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          {(missingMeal?.missing_ingredients ?? []).map((m, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md,
            }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{m.name}</Text>
              {m.estimated_price ? <Text style={{ fontSize: 13, color: colors.muted }}>~{fmtMoney(m.estimated_price)}</Text> : null}
            </View>
          ))}
        </View>
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton testID="add-missing-confirm"
            label={`Add ${missingMeal?.missing_ingredients.length ?? 0} item(s)`}
            onPress={handleAddMissing} loading={working} />
          <GhostButton testID="add-missing-cancel" label="Cancel" onPress={() => setMissingMeal(null)} />
        </View>
      </Sheet>

      {/* Finished item prompt */}
      <ConfirmSheet
        visible={finishedItems.length > 0}
        onClose={() => setFinishedItems([])}
        onConfirm={handleFinishedToGrocery}
        title={finishedItems.length ? `${finishedItems.map((f) => f.name).join(", ")} finished` : ""}
        message="Add it to the grocery list so it's not forgotten?"
        confirmLabel="Yes, add"
        confirmTestID="finished-add-grocery"
      />
    </View>
  );
}

function MealCard({ meal, expanded, onToggle, onCook, onAddMissing }: {
  meal: MealSuggestion;
  expanded: boolean;
  onToggle: () => void;
  onCook: () => void;
  onAddMissing: () => void;
}) {
  const { colors } = useTheme();
  const free = meal.estimated_additional_cost <= 0;
  return (
    <View style={{
      backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
      borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text testID={`meal-name-${meal.name.replace(/\s+/g, "-").toLowerCase()}`}
            style={{ fontSize: 19, fontWeight: "600", letterSpacing: -0.3, color: colors.onSurface }}>
            {meal.name}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
            {meal.prep_time_minutes} min · {meal.difficulty} · Serves {meal.servings}
          </Text>
        </View>
        <View style={{
          backgroundColor: free ? "#E8EFE2" : colors.surfaceTertiary, borderRadius: radius.pill,
          paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: free ? colors.success : colors.onSurfaceTertiary }}>
            {free ? "No extra spend" : `+${fmtMoney(meal.estimated_additional_cost)}`}
          </Text>
        </View>
      </View>

      {meal.available_ingredients.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {meal.available_ingredients.map((a) => (
            <View key={a} style={{ backgroundColor: "#E8EFE2", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "500", color: colors.success }}>✓ {a}</Text>
            </View>
          ))}
          {meal.missing_ingredients.map((m) => (
            <View key={m.name} style={{ backgroundColor: "#F6EBD3", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "500", color: colors.warning }}>+ {m.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {meal.reason ? <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, lineHeight: 19 }}>{meal.reason}</Text> : null}

      {expanded && meal.instructions.length ? (
        <View style={{ gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }}>
          {meal.instructions.map((s, i) => (
            <Text key={i} style={{ fontSize: 13, color: colors.onSurfaceTertiary, lineHeight: 19 }}>
              {i + 1}. {s}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton testID={`meal-cook-${meal.name.replace(/\s+/g, "-").toLowerCase()}`} label="Cook This" onPress={onCook} />
        </View>
        {meal.missing_ingredients.length ? (
          <View style={{ flex: 1 }}>
            <GhostButton testID={`meal-add-missing-${meal.name.replace(/\s+/g, "-").toLowerCase()}`}
              label="Add missing" onPress={onAddMissing} />
          </View>
        ) : null}
      </View>
      {meal.instructions.length ? (
        <Pressable testID={`meal-recipe-${meal.name.replace(/\s+/g, "-").toLowerCase()}`} onPress={onToggle} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, textAlign: "center" }}>
            {expanded ? "Hide recipe" : "View recipe"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
