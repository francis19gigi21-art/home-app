import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCalendarEvents, useInventory, useInventoryUsage, useMealPlans, useNotes } from "@/src/lib/hooks";
import { computeWasteDigest, weekRange } from "@/src/lib/waste";
import { fmtMoney, fmtTime, localIso, relativeDay } from "@/src/lib/format";
import { Card, IconCircle, PressableScale, SectionHeader } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

const EVENT_ICON: Record<string, string> = {
  bill: "flash-outline", rent: "home-outline", cleaning: "sparkles-outline", shopping: "cart-outline",
  guest: "people-outline", trip: "airplane-outline", personal: "person-outline", other: "calendar-outline",
};

// Home dashboard: Explore tiles (calendar, meal plan, notes, waste saver) + Upcoming events.
export function HomeExplore() {
  const router = useRouter();
  const { colors } = useTheme();
  const events = useCalendarEvents();
  const plans = useMealPlans();
  const notes = useNotes();
  const usage = useInventoryUsage();
  const inventory = useInventory();

  const today = localIso();
  const upcoming = useMemo(() => (events.data ?? []).filter((e) => e.event_date >= today).slice(0, 3), [events.data, today]);
  const tonight = useMemo(() => {
    const todays = (plans.data ?? []).filter((p) => p.meal_date === today);
    return todays.find((p) => p.meal_type === "dinner") ?? todays[0];
  }, [plans.data, today]);
  const digest = useMemo(
    () => computeWasteDigest(usage.data ?? [], inventory.data ?? [], weekRange(0)),
    [usage.data, inventory.data],
  );

  const tiles = [
    {
      testID: "explore-calendar", icon: "calendar-outline", label: "Calendar", route: "/calendar",
      value: upcoming[0] ? relativeDay(upcoming[0].event_date) : "Clear",
      sub: upcoming[0]?.title ?? "No events coming up",
    },
    {
      testID: "explore-meal-plan", icon: "restaurant-outline", label: "Meal plan", route: "/meals/planner",
      value: tonight ? "Tonight" : "Plan",
      sub: tonight?.meal_name ?? "Let AI plan your week",
    },
    {
      testID: "explore-notes", icon: "document-text-outline", label: "Notes", route: "/notes",
      value: String(notes.data?.length ?? 0),
      // Previews show titles only; sensitive notes are never previewed.
      sub: notes.data?.find((n) => !n.sensitive)?.title ?? "Wi-Fi, landlord, contacts",
    },
    {
      testID: "explore-waste", icon: "leaf-outline", label: "Saved this week", route: "/waste",
      value: fmtMoney(digest.rescuedValue),
      sub: `${digest.rescued.length} item${digest.rescued.length === 1 ? "" : "s"} rescued`,
    },
  ];

  return (
    <>
      <View>
        <SectionHeader title="Explore" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {tiles.map((t) => (
            <PressableScale key={t.testID} testID={t.testID} onPress={() => router.push(t.route as any)}
              style={{ width: "47.5%", flexGrow: 1 }}>
              <Card style={{ minHeight: 140, justifyContent: "space-between", padding: spacing.md }}>
                <IconCircle icon={t.icon} size={40} />
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "500" }}>{t.label}</Text>
                  <Text style={{ fontSize: 24, fontWeight: "300", letterSpacing: -0.8, color: colors.onSurface }} numberOfLines={1}>
                    {t.value}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.onSurfaceTertiary }} numberOfLines={1}>{t.sub}</Text>
                </View>
              </Card>
            </PressableScale>
          ))}
        </View>
      </View>

      {upcoming.length > 0 ? (
        <View>
          <SectionHeader title="Upcoming" actionLabel="Calendar" testID="home-see-calendar" onAction={() => router.push("/calendar")} />
          <View style={{ gap: spacing.sm }}>
            {upcoming.map((e) => (
              <PressableScale key={e.id} testID={`home-event-${e.id}`} onPress={() => router.push("/calendar")}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
                  <IconCircle icon={EVENT_ICON[e.category] ?? "calendar-outline"} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{e.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {relativeDay(e.event_date)}{e.event_time ? ` · ${fmtTime(e.event_time)}` : ""}
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
