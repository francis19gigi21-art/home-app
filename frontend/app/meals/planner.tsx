import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useMealPlans } from "@/src/lib/hooks";
import { generateMealPlan, type PlannedMeal } from "@/src/lib/api";
import { addToGrocery } from "@/src/lib/actions";
import { supabase } from "@/src/lib/supabase";
import { fmtMoney, localIso, relativeDay } from "@/src/lib/format";
import {
  EmptyState, GhostButton, GradientHero, IconCircle, PrimaryButton, SegmentedControl, Skeleton, useToast,
} from "@/src/components/core";
import { ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { MealSuggestion } from "@/src/lib/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const MEAL_ICON: Record<string, string> = { breakfast: "sunny-outline", lunch: "partly-sunny-outline", dinner: "moon-outline" };
const SPANS: Record<string, number> = { Today: 1, "3 days": 3, Week: 7 };
const LOADING = ["Checking your inventory…", "Spreading expiring food across the first days…", "Keeping it within budget…"];

export default function MealPlanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { session, household } = useApp();
  const plans = useMealPlans();
  const toast = useToast();

  const today = localIso();
  const days = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return localIso(d);
  }), []);

  const [selected, setSelected] = useState(today);
  const [span, setSpan] = useState("Week");
  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "preview">("idle");
  const [draft, setDraft] = useState<PlannedMeal[]>([]);
  const [saving, setSaving] = useState(false);
  const [missingFor, setMissingFor] = useState<{ name: string; estimated_price?: number | null; meal: string }[] | null>(null);

  const savedForDay = useMemo(
    () => (plans.data ?? []).filter((p) => p.meal_date === selected),
    [plans.data, selected],
  );
  const plannedDates = useMemo(() => new Set((plans.data ?? []).map((p) => p.meal_date)), [plans.data]);

  const showing: { meal_type: string; meal_name: string; recipe_data: MealSuggestion | null }[] =
    phase === "preview" ? draft.filter((d) => d.meal_date === selected) : savedForDay;

  async function generate() {
    setPhase("loading");
    try {
      const plan = await generateMealPlan(SPANS[span], today);
      if (!plan.length) throw new Error("empty");
      setDraft(plan);
      setSelected(today);
      setPhase("preview");
    } catch {
      setPhase("error");
    }
  }

  async function savePlan() {
    if (!household || !session?.user) return;
    setSaving(true);
    try {
      const dates = Array.from(new Set(draft.map((d) => d.meal_date)));
      const { error: delErr } = await supabase.from("meal_plans").delete().eq("household_id", household.id).in("meal_date", dates);
      if (delErr) throw new Error(delErr.message);
      const { error } = await supabase.from("meal_plans").insert(draft.map((d) => ({
        household_id: household.id, meal_date: d.meal_date, meal_type: d.meal_type,
        meal_name: d.meal_name, recipe_data: d.recipe_data, created_by: session.user.id,
      })));
      if (error) throw new Error(error.message);
      toast(`Plan saved for ${dates.length} day${dates.length === 1 ? "" : "s"}`, "success");
      setPhase("idle");
      setDraft([]);
    } catch (e: any) {
      toast(e.message ?? "Could not save plan", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addMissing() {
    if (!missingFor || !household || !session?.user) return;
    try {
      for (const m of missingFor) {
        await addToGrocery(household.id, session.user.id, {
          name: m.name, estimated_price: m.estimated_price ?? null, source: "ai_meal", source_reference: m.meal,
        });
      }
      toast(`Added ${missingFor.length} item(s) to groceries`, "success");
    } catch (e: any) {
      toast(e.message ?? "Could not add", "error");
    }
    setMissingFor(null);
  }

  const dayMissing = showing.flatMap((m) =>
    (m.recipe_data?.missing_ingredients ?? []).map((x) => ({ ...x, meal: m.meal_name })),
  );
  const dayCost = showing.reduce((s, m) => s + Number(m.recipe_data?.estimated_additional_cost ?? 0), 0);
  const draftCost = draft.reduce((s, m) => s + Number(m.recipe_data?.estimated_additional_cost ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable testID="planner-back" onPress={() => router.back()} hitSlop={12}>
            <IconCircle icon="chevron-back" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Meal plan</Text>
        </View>

        {/* Generator */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <GradientHero colors={[colors.gradAiA, colors.gradAiB, colors.gradAiC]}>
            <IconCircle icon="sparkles" tone="frosted" size={44} />
            <Text style={{ fontSize: 20, fontWeight: "600", letterSpacing: -0.3, color: colors.onSurface, marginTop: spacing.md }}>
              Plan around what's at home
            </Text>
            <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 4, marginBottom: spacing.md, lineHeight: 19 }}>
              Expiring food goes first, extra spend stays small. Nothing is saved until you say so.
            </Text>
            <SegmentedControl testIDPrefix="planner-span" options={Object.keys(SPANS)} value={span} onChange={setSpan} />
            <View style={{ marginTop: spacing.md }}>
              <PrimaryButton testID="planner-generate" label={phase === "preview" ? "Regenerate" : "Generate plan"}
                icon="sparkles" onPress={generate} loading={phase === "loading"} />
            </View>
          </GradientHero>
        </View>

        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {days.map((d) => {
            const active = d === selected;
            const dt = new Date(`${d}T00:00:00`);
            const hasPlan = phase === "preview" ? draft.some((x) => x.meal_date === d) : plannedDates.has(d);
            return (
              <Pressable key={d} testID={`planner-day-${d}`} onPress={() => setSelected(d)}
                style={{
                  width: active ? 64 : 54, height: active ? 82 : 72, borderRadius: radius.md,
                  alignItems: "center", justifyContent: "center", gap: 2, alignSelf: "center",
                  backgroundColor: active ? colors.surfaceInverse : colors.surfaceSecondary,
                  borderWidth: active ? 0 : 1, borderColor: colors.border,
                }}>
                <Text style={{ fontSize: 11, color: active ? colors.onSurfaceInverse : colors.muted }}>
                  {d === today ? "Today" : dt.toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={{ fontSize: active ? 24 : 20, fontWeight: "600", color: active ? colors.onSurfaceInverse : colors.onSurface }}>
                  {dt.getDate()}
                </Text>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasPlan ? (active ? colors.warning : colors.onSurface) : "transparent" }} />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {phase === "loading" ? (
            <>
              <Text testID="planner-loading" style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
                {LOADING[Math.floor(Date.now() / 2000) % LOADING.length]}
              </Text>
              {MEAL_TYPES.map((t) => (
                <View key={t} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Skeleton width="30%" height={12} />
                  <Skeleton width="65%" height={18} />
                </View>
              ))}
            </>
          ) : phase === "error" ? (
            <EmptyState icon="cloud-offline-outline" title="I couldn't plan meals right now"
              subtitle="Your inventory is safe. Try again in a moment."
              actionLabel="Retry" actionTestID="planner-retry" onAction={generate} />
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>
                  {relativeDay(selected)}{phase === "preview" ? " · draft" : ""}
                </Text>
                {showing.length ? (
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {dayCost > 0 ? `+${fmtMoney(dayCost)} extra` : "No extra spend"}
                  </Text>
                ) : null}
              </View>

              {MEAL_TYPES.map((t) => {
                const meal = showing.find((m) => m.meal_type === t);
                return (
                  <View key={t} testID={`planner-slot-${t}`} style={{
                    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
                    borderColor: colors.border, padding: spacing.lg, gap: 6,
                    opacity: meal ? 1 : 0.7,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <IconCircle icon={MEAL_ICON[t]} size={32} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 }}>{t}</Text>
                      {meal?.recipe_data ? (
                        <Text style={{ marginLeft: "auto", fontSize: 12, color: colors.muted }}>
                          {meal.recipe_data.prep_time_minutes} min
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "600", letterSpacing: -0.3, color: meal ? colors.onSurface : colors.muted }}>
                      {meal?.meal_name ?? "Not planned"}
                    </Text>
                    {meal?.recipe_data?.reason ? (
                      <Text style={{ fontSize: 13, color: colors.onSurfaceTertiary, lineHeight: 19 }}>{meal.recipe_data.reason}</Text>
                    ) : null}
                    {meal?.recipe_data?.missing_ingredients?.length ? (
                      <Text style={{ fontSize: 12, color: colors.warning }}>
                        Need: {meal.recipe_data.missing_ingredients.map((m) => m.name).join(", ")}
                      </Text>
                    ) : null}
                  </View>
                );
              })}

              {phase === "preview" ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    {draft.length} meals · estimated extra spend {fmtMoney(draftCost)}
                  </Text>
                  <PrimaryButton testID="planner-save" label="Save plan" icon="checkmark" onPress={savePlan} loading={saving} />
                  <GhostButton testID="planner-discard" label="Discard draft" onPress={() => { setPhase("idle"); setDraft([]); }} />
                </View>
              ) : dayMissing.length ? (
                <GhostButton testID="planner-add-missing" label={`Add ${dayMissing.length} missing to groceries`} icon="cart-outline"
                  onPress={() => setMissingFor(dayMissing)} />
              ) : !showing.length && plans.isFetched ? (
                <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                  Generate a plan above to fill this day.
                </Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={!!missingFor}
        onClose={() => setMissingFor(null)}
        onConfirm={addMissing}
        title="Add missing ingredients"
        message={missingFor?.map((m) => m.name).join(" · ")}
        confirmLabel={`Add ${missingFor?.length ?? 0} item(s)`}
        confirmTestID="planner-add-missing-confirm"
      />
    </View>
  );
}
