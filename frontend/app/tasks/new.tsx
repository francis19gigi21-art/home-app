import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { supabase } from "@/src/lib/supabase";
import { notifyHousehold } from "@/src/lib/hooks";
import { Field, IconCircle, PillRow, PrimaryButton, SegmentedControl, useToast } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

const CATEGORIES = ["Cleaning", "Kitchen", "Laundry", "Shopping", "Bills", "Maintenance", "Other"];
const TIMES = [
  { label: "No time", value: null },
  { label: "9:00 AM", value: "09:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "9:00 PM", value: "21:00" },
];
const RECURRENCE = ["None", "Daily", "Weekly", "Monthly"];

export default function NewTask() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household, profile } = useApp();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [assignedTo, setAssignedTo] = useState<string>(session?.user.id ?? "");
  const [dueOffset, setDueOffset] = useState(0);
  const [timeLabel, setTimeLabel] = useState("No time");
  const [priority, setPriority] = useState("Medium");
  const [recurrence, setRecurrence] = useState("None");
  const [rotate, setRotate] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  async function save() {
    if (!title.trim()) return setError("Give the task a title");
    if (!household || !session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const due = days[dueOffset].toISOString().slice(0, 10);
      const time = TIMES.find((t) => t.label === timeLabel)?.value ?? null;
      const { error: dbErr } = await supabase.from("tasks").insert({
        household_id: household.id,
        title: title.trim(),
        description: notes.trim() || null,
        category: category.toLowerCase(),
        assigned_to: assignedTo || null,
        created_by: session.user.id,
        due_date: due,
        due_time: time,
        priority: priority.toLowerCase(),
        recurrence: recurrence.toLowerCase(),
        rotate,
      });
      if (dbErr) throw new Error(dbErr.message);
      const assignee = members.find((m) => m.user_id === assignedTo);
      if (assignee && assignedTo !== session.user.id) {
        await notifyHousehold(
          members.filter((m) => m.user_id === assignedTo), "__nobody__", household.id,
          "task", `${profile?.full_name?.split(" ")[0] ?? "Someone"} assigned you "${title.trim()}"`,
        );
      }
      toast("Task added", "success");
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Could not save task");
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
        <Pressable testID="task-new-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>New task</Text>
      </View>

      <Field label="Task" testID="task-title" value={title} onChangeText={setTitle} placeholder="Wash dishes" />

      <Text style={lbl(colors.muted)}>Category</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="task-category" options={CATEGORIES} value={category} onChange={setCategory} />
      </View>

      <Text style={lbl(colors.muted)}>Assign to</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow
          testIDPrefix="task-assignee"
          options={members.map((m) => displayNameOf(m))}
          value={displayNameOf(members.find((m) => m.user_id === assignedTo) ?? null)}
          onChange={(label) => {
            const m = members.find((mm) => displayNameOf(mm) === label);
            if (m) setAssignedTo(m.user_id);
          }}
        />
      </View>

      <Text style={lbl(colors.muted)}>Due</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
        {days.map((d, i) => {
          const active = dueOffset === i;
          return (
            <Pressable key={i} testID={`task-day-${i}`} onPress={() => setDueOffset(i)}
              style={{
                width: 56, height: 72, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
                backgroundColor: active ? colors.surfaceInverse : colors.surfaceSecondary,
                borderWidth: active ? 0 : 1, borderColor: colors.border, gap: 2,
              }}>
              <Text style={{ fontSize: 11, color: active ? colors.onSurfaceInverse : colors.muted }}>
                {i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
              </Text>
              <Text style={{
                fontSize: 20, fontWeight: "600",
                color: active ? colors.onSurfaceInverse : colors.onSurface,
              }}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={lbl(colors.muted)}>Time</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="task-time" options={TIMES.map((t) => t.label)} value={timeLabel} onChange={setTimeLabel} />
      </View>

      <Text style={lbl(colors.muted)}>Priority</Text>
      <SegmentedControl testIDPrefix="task-priority" options={["Low", "Medium", "High"]} value={priority} onChange={setPriority} />

      <Text style={lbl(colors.muted)}>Repeat</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="task-recurrence" options={RECURRENCE} value={recurrence} onChange={setRecurrence} />
      </View>

      {recurrence !== "None" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={{ fontSize: 14, color: colors.onSurface }}>Rotate automatically</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Passes to the next housemate each time</Text>
          </View>
          <Switch testID="task-rotate" value={rotate} onValueChange={setRotate} />
        </View>
      ) : null}

      <Field label="Notes (optional)" testID="task-notes" value={notes} onChangeText={setNotes} placeholder="Anything to know?" />

      {error ? <Text testID="task-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
      <PrimaryButton testID="task-save" label="Add task" onPress={save} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

function lbl(color: string) {
  return { fontSize: 13, fontWeight: "500" as const, color, marginLeft: 4 };
}
