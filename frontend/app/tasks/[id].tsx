import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useTasks } from "@/src/lib/hooks";
import { completeTask } from "@/src/lib/actions";
import { supabase } from "@/src/lib/supabase";
import { fmtTime, relativeDay, timeAgo } from "@/src/lib/format";
import { Avatar, GhostButton, IconCircle, PrimaryButton, SkeletonCard, StatusTag, useToast } from "@/src/components/core";
import { ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, profile } = useApp();
  const tasks = useTasks();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const task = useMemo(() => (tasks.data ?? []).find((t) => t.id === id), [tasks.data, id]);
  const uid = session?.user.id ?? "";
  const memberById = (mid: string | null) => members.find((m) => m.user_id === mid);
  const isOwner = members.find((m) => m.user_id === uid)?.role === "owner";
  const canDelete = task && (task.created_by === uid || isOwner);

  async function toggleComplete() {
    if (!task) return;
    setWorking(true);
    try {
      if (task.status === "completed") {
        const { error } = await supabase
          .from("tasks")
          .update({ status: "pending", completed_by: null, completed_at: null })
          .eq("id", task.id);
        if (error) throw new Error(error.message);
        toast("Marked as pending", "info");
      } else {
        await completeTask(task, uid, members, profile?.full_name?.split(" ")[0] ?? "Someone");
        toast("Nice — task completed", "success");
      }
    } catch (e: any) {
      toast(e.message ?? "Something went wrong", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) toast(error.message, "error");
    else {
      toast("Task deleted", "info");
      router.back();
    }
    setDeleteOpen(false);
  }

  const overdue = task && task.status !== "completed" && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable testID="task-detail-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        {canDelete ? (
          <Pressable testID="task-detail-delete" onPress={() => setDeleteOpen(true)} hitSlop={12}>
            <IconCircle icon="trash-outline" />
          </Pressable>
        ) : <View />}
      </View>

      {tasks.isLoading || !task ? (
        <SkeletonCard />
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <StatusTag
              label={task.status === "completed" ? "Completed" : overdue ? "Overdue" : "Pending"}
              tone={task.status === "completed" ? "fresh" : overdue ? "expired" : "neutral"}
            />
            <Text testID="task-detail-title" style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>
              {task.title}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textTransform: "capitalize" }}>
              {task.category} · {task.priority} priority
            </Text>
          </View>

          <View style={{
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
            borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
          }}>
            <DetailRow label="Assigned to" value={displayNameOf(memberById(task.assigned_to))} />
            <DetailRow label="Due" value={`${relativeDay(task.due_date)}${task.due_time ? ` · ${fmtTime(task.due_time)}` : ""}`} />
            {task.recurrence !== "none" ? (
              <DetailRow label="Repeats" value={`${task.recurrence}${task.rotate ? " · rotates between housemates" : ""}`} />
            ) : null}
            {task.description ? <DetailRow label="Notes" value={task.description} /> : null}
            {task.status === "completed" ? (
              <DetailRow
                label="Completed"
                value={`by ${displayNameOf(memberById(task.completed_by))} · ${task.completed_at ? timeAgo(task.completed_at) : ""}`}
              />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs }}>
              <Avatar name={displayNameOf(memberById(task.assigned_to))} size={36} />
              <Text style={{ fontSize: 12, color: colors.muted }}>
                created by {displayNameOf(memberById(task.created_by))}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              testID="task-detail-toggle"
              label={task.status === "completed" ? "Mark as pending" : "Mark complete"}
              icon={task.status === "completed" ? "refresh" : "checkmark"}
              onPress={toggleComplete}
              loading={working}
            />
            <GhostButton testID="task-detail-back-btn" label="Back to tasks" onPress={() => router.back()} />
          </View>
        </>
      )}

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${task?.title}"?`}
        message="This removes it for everyone in the household."
        confirmLabel="Delete"
        destructive
        confirmTestID="task-delete-confirm"
      />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface, flexShrink: 1, textAlign: "right", textTransform: "capitalize" }}>
        {value}
      </Text>
    </View>
  );
}
