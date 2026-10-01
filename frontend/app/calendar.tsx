import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useCalendarEvents, notifyHousehold } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { fmtTime, localIso, relativeDay } from "@/src/lib/format";
import {
  EmptyState, Field, GhostButton, IconCircle, PillRow, PressableScale, PrimaryButton,
  SegmentedControl, SkeletonCard, Ionicons, useToast,
} from "@/src/components/core";
import { Sheet, ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { CalendarEvent } from "@/src/lib/types";

export const EVENT_CATEGORIES = ["Bill", "Rent", "Cleaning", "Shopping", "Guest", "Trip", "Personal", "Other"];
export const EVENT_ICON: Record<string, string> = {
  bill: "flash-outline", rent: "home-outline", cleaning: "sparkles-outline", shopping: "cart-outline",
  guest: "people-outline", trip: "airplane-outline", personal: "person-outline", other: "calendar-outline",
};
const TIMES = [
  { label: "All day", value: null },
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "9:00 PM", value: "21:00" },
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household, profile } = useApp();
  const events = useCalendarEvents();
  const toast = useToast();

  const today = localIso();
  const [view, setView] = useState("Month");
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);
  const [adding, setAdding] = useState(params.add === "1");
  const [viewing, setViewing] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

  const byDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events.data ?? []) (map[e.event_date] ??= []).push(e);
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
    return map;
  }, [events.data]);

  const upcoming = useMemo(() => (events.data ?? []).filter((e) => e.event_date >= today), [events.data, today]);
  const cells = monthGrid(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", deleting.id);
    if (error) toast(error.message, "error");
    else toast("Event removed", "info");
    setDeleting(null);
    setViewing(null);
  }

  const renderEvent = (e: CalendarEvent) => (
    <PressableScale key={e.id} testID={`event-card-${e.id}`} onPress={() => setViewing(e)}>
      <View style={{
        backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
      }}>
        <IconCircle icon={EVENT_ICON[e.category] ?? "calendar-outline"} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{e.title}</Text>
          <Text style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize" }}>
            {e.category} · {e.event_time ? fmtTime(e.event_time) : "All day"}
          </Text>
        </View>
      </View>
    </PressableScale>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable testID="calendar-back" onPress={() => router.back()} hitSlop={12}>
            <IconCircle icon="chevron-back" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Calendar</Text>
          <PressableScale testID="calendar-add" onPress={() => setAdding(true)}>
            <IconCircle icon="add" tone="dark" />
          </PressableScale>
        </View>

        <SegmentedControl testIDPrefix="calendar-view" options={["Month", "Agenda"]} value={view} onChange={setView} />

        {events.isLoading ? (
          <SkeletonCard />
        ) : view === "Month" ? (
          <>
            <View style={{
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, borderWidth: 1,
              borderColor: colors.border, padding: spacing.md,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
                <Pressable testID="calendar-prev-month" onPress={() => shiftMonth(-1)} hitSlop={8}>
                  <IconCircle icon="chevron-back" size={36} />
                </Pressable>
                <Text testID="calendar-month-label" style={{ fontSize: 17, fontWeight: "600", color: colors.onSurface }}>{monthLabel}</Text>
                <Pressable testID="calendar-next-month" onPress={() => shiftMonth(1)} hitSlop={8}>
                  <IconCircle icon="chevron-forward" size={36} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row" }}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "500", color: colors.muted }}>{w}</Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
                {cells.map((d, i) => {
                  if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
                  const key = localIso(d);
                  const isSel = key === selected;
                  const isToday = key === today;
                  const has = !!byDate[key]?.length;
                  return (
                    <Pressable key={i} testID={`calendar-day-${key}`} onPress={() => setSelected(key)}
                      style={{ width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center" }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                        backgroundColor: isSel ? colors.surfaceInverse : "transparent",
                        borderWidth: isToday && !isSel ? 1 : 0, borderColor: colors.borderStrong,
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: isSel ? "600" : "400", color: isSel ? colors.onSurfaceInverse : colors.onSurface }}>
                          {d.getDate()}
                        </Text>
                      </View>
                      {has ? (
                        <View style={{ position: "absolute", bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? colors.warning : colors.onSurface }} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.onSurface }}>{relativeDay(selected)}</Text>
              {(byDate[selected] ?? []).length === 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Text style={{ flex: 1, fontSize: 14, color: colors.muted }}>Nothing planned.</Text>
                  <Pressable testID="calendar-add-on-day" onPress={() => setAdding(true)} hitSlop={8}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface }}>+ Add event</Text>
                  </Pressable>
                </View>
              ) : (
                (byDate[selected] ?? []).map(renderEvent)
              )}
            </View>
          </>
        ) : upcoming.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing coming up"
            subtitle="Add rent day, bills, cleaning day or a guest visit so everyone knows."
            actionLabel="Add event" actionTestID="calendar-empty-add" onAction={() => setAdding(true)} />
        ) : (
          <View style={{ gap: spacing.lg }}>
            {Object.entries(
              upcoming.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
                (acc[e.event_date] ??= []).push(e);
                return acc;
              }, {}),
            ).map(([d, list]) => (
              <View key={d} style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>{relativeDay(d)}</Text>
                {list.map(renderEvent)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddEventSheet
        visible={adding}
        initialDate={selected < today ? today : selected}
        onClose={() => setAdding(false)}
        onSave={async (input) => {
          if (!household || !session?.user) return;
          const { error } = await supabase.from("calendar_events").insert({ ...input, household_id: household.id, created_by: session.user.id });
          if (error) {
            toast(error.message, "error");
            return;
          }
          await notifyHousehold(members, session.user.id, household.id, "general",
            `${profile?.full_name?.split(" ")[0] ?? "Someone"} added "${input.title}"`, relativeDay(input.event_date));
          toast("Event added", "success");
          setSelected(input.event_date);
          const d = new Date(`${input.event_date}T00:00:00`);
          setCursor({ y: d.getFullYear(), m: d.getMonth() });
          setAdding(false);
        }}
      />

      <Sheet visible={!!viewing} onClose={() => setViewing(null)} title={viewing?.title}>
        {viewing ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ fontSize: 14, color: colors.onSurfaceTertiary, textTransform: "capitalize" }}>
              {viewing.category} · {relativeDay(viewing.event_date)} · {viewing.event_time ? fmtTime(viewing.event_time) : "All day"}
            </Text>
            {viewing.description ? <Text style={{ fontSize: 15, color: colors.onSurface, lineHeight: 22 }}>{viewing.description}</Text> : null}
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Added by {displayNameOf(members.find((m) => m.user_id === viewing.created_by))}
            </Text>
            <GhostButton testID="event-delete" label="Delete event" icon="trash-outline" onPress={() => setDeleting(viewing)} />
          </View>
        ) : null}
      </Sheet>

      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleting?.title}"?`}
        confirmLabel="Delete"
        destructive
        confirmTestID="event-delete-confirm"
      />
    </View>
  );
}

function AddEventSheet({ visible, initialDate, onClose, onSave }: {
  visible: boolean;
  initialDate: string;
  onClose: () => void;
  onSave: (input: { title: string; category: string; event_date: string; event_time: string | null; description: string | null }) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Bill");
  const [date, setDate] = useState(initialDate);
  const [timeLabel, setTimeLabel] = useState("All day");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(false);

  if (visible && !wasVisible) {
    setWasVisible(true);
    setTitle("");
    setDescription("");
    setDate(initialDate);
    setError(null);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const days = [...Array(45)].map((_, i) => {
    const d = new Date(`${initialDate}T00:00:00`);
    d.setDate(d.getDate() + i);
    return d;
  });

  async function save() {
    if (!title.trim()) return setError("Give the event a title");
    setLoading(true);
    await onSave({
      title: title.trim(),
      category: category.toLowerCase(),
      event_date: date,
      event_time: TIMES.find((t) => t.label === timeLabel)?.value ?? null,
      description: description.trim() || null,
    });
    setLoading(false);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="New event">
      <View style={{ gap: spacing.md }}>
        <Field label="Title" testID="event-title" value={title} onChangeText={setTitle} placeholder="Electricity bill due" />
        <View style={{ marginHorizontal: -spacing.lg }}>
          <PillRow testIDPrefix="event-category" options={EVENT_CATEGORIES} value={category} onChange={setCategory} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {days.map((d) => {
            const key = localIso(d);
            const active = key === date;
            return (
              <Pressable key={key} testID={`event-day-${key}`} onPress={() => setDate(key)}
                style={{
                  width: 52, height: 64, borderRadius: radius.sm, alignItems: "center", justifyContent: "center",
                  backgroundColor: active ? colors.surfaceInverse : colors.surfaceTertiary,
                }}>
                <Text style={{ fontSize: 10, color: active ? colors.onSurfaceInverse : colors.muted }}>
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: active ? colors.onSurfaceInverse : colors.onSurface }}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <PillRow testIDPrefix="event-time" options={TIMES.map((t) => t.label)} value={timeLabel} onChange={setTimeLabel} />
        </View>
        <Field label="Details (optional)" testID="event-description" value={description} onChangeText={setDescription} placeholder="₹1,200 via app" />
        {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
        <PrimaryButton testID="event-save" label="Add event" onPress={save} loading={loading} />
      </View>
    </Sheet>
  );
}

void Ionicons;
