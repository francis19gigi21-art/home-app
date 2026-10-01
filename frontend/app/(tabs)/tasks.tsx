import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence } from "react-native-reanimated";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useTasks } from "@/src/lib/hooks";
import { completeTask } from "@/src/lib/actions";
import { relativeDay, fmtTime, daysUntil } from "@/src/lib/format";
import { Avatar, EmptyState, IconCircle, PillRow, PressableScale, SegmentedControl, SkeletonCard, Ionicons, useToast } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";
import type { Task } from "@/src/lib/types";

const SEGMENTS = ["Today", "Upcoming", "Done"];
const SCOPES = ["All", "Mine"];

function CheckButton({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const done = task.status === "completed";
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      testID={`task-check-${task.id}`}
      disabled={done}
      onPress={() => {
        scale.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1, { damping: 10 }));
        onComplete();
      }}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={[{
        width: 28, height: 28, borderRadius: 14, borderWidth: 2,
        borderColor: done ? colors.success : colors.borderStrong,
        backgroundColor: done ? colors.success : "transparent",
        alignItems: "center", justifyContent: "center",
      }, anim]}>
        {done ? <Ionicons name="checkmark" size={16} color={colors.onSuccess} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export default function Tasks() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, profile } = useApp();
  const tasks = useTasks();
  const toast = useToast();
  const [segment, setSegment] = useState("Today");
  const [scope, setScope] = useState("All");

  const uid = session?.user.id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const memberById = (id: string | null) => members.find((m) => m.user_id === id);

  const stats = useMemo(() => {
    const all = tasks.data ?? [];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const completedWeek = all.filter((t) => t.status === "completed" && t.completed_at && t.completed_at >= weekAgo).length;
    const pending = all.filter((t) => t.status !== "completed").length;
    const days = new Set(
      all.filter((t) => t.completed_at).map((t) => t.completed_at!.slice(0, 10)),
    );
    let streak = 0;
    const d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return { completedWeek, pending, streak };
  }, [tasks.data]);

  const filtered = useMemo(() => {
    let list = tasks.data ?? [];
    if (scope === "Mine") list = list.filter((t) => t.assigned_to === uid);
    if (segment === "Today") return list.filter((t) => t.status !== "completed" && (!t.due_date || t.due_date <= today));
    if (segment === "Upcoming") return list.filter((t) => t.status !== "completed" && t.due_date && t.due_date > today);
    return list.filter((t) => t.status === "completed");
  }, [tasks.data, segment, scope, uid, today]);

  async function handleComplete(task: Task) {
    try {
      await completeTask(task, uid, members, firstNameOf());
      toast("Nice — task completed", "success");
    } catch (e: any) {
      toast(e.message ?? "Could not complete task", "error");
    }
  }

  function firstNameOf() {
    return profile?.full_name?.split(" ")[0] ?? "Someone";
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Tasks</Text>
          <PressableScale testID="tasks-add" onPress={() => router.push("/tasks/new")}>
            <IconCircle icon="add" tone="dark" />
          </PressableScale>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {[
            { label: "Done this week", value: stats.completedWeek },
            { label: "Pending", value: stats.pending },
            { label: "Streak", value: `${stats.streak}d` },
          ].map((s) => (
            <View key={s.label} style={{
              flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border, padding: spacing.md,
            }}>
              <Text style={{ fontSize: 22, fontWeight: "500", letterSpacing: -0.5, color: colors.onSurface }}>{s.value}</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        <SegmentedControl testIDPrefix="tasks-segment" options={SEGMENTS} value={segment} onChange={setSegment} />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <PillRow testIDPrefix="tasks-scope" options={SCOPES} value={scope} onChange={setScope} />
      </View>

      {tasks.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonCard /><SkeletonCard />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="checkbox-outline"
          title={segment === "Done" ? "Nothing completed yet" : "Nothing to do right now"}
          subtitle={segment === "Done" ? "Completed tasks will show up here." : "Add a task and share the load."}
          actionLabel={segment === "Done" ? undefined : "Add task"}
          actionTestID="tasks-empty-add"
          onAction={segment === "Done" ? undefined : () => router.push("/tasks/new")}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const overdue = item.status !== "completed" && item.due_date !== null && (daysUntil(item.due_date) ?? 0) < 0;
            return (
              <PressableScale testID={`task-card-${item.id}`}
                onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: item.id } })}>
                <View style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
                  borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
                  opacity: item.status === "completed" ? 0.6 : 1,
                }}>
                  <CheckButton task={item} onComplete={() => handleComplete(item)} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{
                      fontSize: 15, fontWeight: "500", color: colors.onSurface,
                      textDecorationLine: item.status === "completed" ? "line-through" : "none",
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: overdue ? colors.error : colors.muted }}>
                      {overdue ? "Overdue · " : ""}
                      {relativeDay(item.due_date)}{item.due_time ? ` · ${fmtTime(item.due_time)}` : ""}
                      {item.recurrence !== "none" ? ` · ${item.recurrence}${item.rotate ? " ↻" : ""}` : ""}
                    </Text>
                  </View>
                  {item.priority === "high" ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }} />
                  ) : null}
                  <Avatar name={displayNameOf(memberById(item.assigned_to))} size={32} />
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}
