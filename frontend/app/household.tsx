import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useTasks, useWallet } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { fmtDate, fmtMoney } from "@/src/lib/format";
import { APP_NAME } from "@/src/config";
import { Avatar, GhostButton, IconCircle, StatusTag, useToast } from "@/src/components/core";
import { ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { HouseholdMember } from "@/src/lib/types";

export default function HouseholdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { household, members, session, refreshHousehold } = useApp();
  const tasks = useTasks();
  const wallet = useWallet();
  const toast = useToast();
  const [removeTarget, setRemoveTarget] = useState<HouseholdMember | null>(null);

  const uid = session?.user.id ?? "";
  const isOwner = members.find((m) => m.user_id === uid)?.role === "owner";

  const taskCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks.data ?? []) {
      if (t.completed_by) map[t.completed_by] = (map[t.completed_by] ?? 0) + 1;
    }
    return map;
  }, [tasks.data]);

  async function copyCode() {
    if (!household) return;
    await Clipboard.setStringAsync(household.invite_code);
    toast("Invite code copied", "success");
  }

  async function shareCode() {
    if (!household) return;
    try {
      await Share.share({
        message: `Join our home "${household.name}" on ${APP_NAME}! Invite code: ${household.invite_code}`,
      });
    } catch {
      /* dismissed */
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    const { error } = await supabase.from("household_members").delete().eq("id", removeTarget.id);
    if (error) toast(error.message, "error");
    else {
      toast(`${displayNameOf(removeTarget)} removed`, "info");
      await refreshHousehold();
    }
    setRemoveTarget(null);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: 140, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable testID="household-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Household</Text>
      </View>

      {/* House card */}
      <View style={{
        backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, borderWidth: 1,
        borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{
            width: 56, height: 56, borderRadius: 20, backgroundColor: colors.surfaceInverse,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: colors.onSurfaceInverse, fontSize: 24, fontWeight: "700" }}>
              {(household?.name ?? "H").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text testID="household-name" style={{ fontSize: 22, fontWeight: "600", color: colors.onSurface }}>
              {household?.name ?? "Home"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Since {fmtDate(household?.created_at?.slice(0, 10))} · {members.length} member{members.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md,
        }}>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "500" }}>INVITE CODE</Text>
            <Text testID="household-invite-code" style={{ fontSize: 22, fontWeight: "700", letterSpacing: 3, color: colors.onSurface }}>
              {household?.invite_code}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable testID="household-copy" onPress={copyCode}><IconCircle icon="copy-outline" /></Pressable>
            <Pressable testID="household-share" onPress={shareCode}><IconCircle icon="share-social-outline" /></Pressable>
          </View>
        </View>
      </View>

      {/* Members */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>Members</Text>
        {members.map((m) => (
          <View key={m.id} style={{
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
            borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
          }}>
            <Avatar name={displayNameOf(m)} uri={m.profiles?.avatar_url} size={44} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{displayNameOf(m)}</Text>
                <StatusTag label={m.role === "owner" ? "Owner" : "Member"} tone="neutral" />
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {taskCounts[m.user_id] ?? 0} tasks done · contributed {fmtMoney(wallet.contributions[m.user_id] ?? 0)}
              </Text>
            </View>
            {isOwner && m.user_id !== uid ? (
              <Pressable testID={`remove-member-${m.user_id}`} onPress={() => setRemoveTarget(m)} hitSlop={8}>
                <IconCircle icon="person-remove-outline" size={36} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <GhostButton testID="household-back-btn" label="Back" onPress={() => router.back()} />

      <ConfirmSheet
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title={`Remove ${removeTarget ? displayNameOf(removeTarget) : ""}?`}
        message="They'll lose access to this household's shared data."
        confirmLabel="Remove"
        destructive
        confirmTestID="remove-member-confirm"
      />
    </ScrollView>
  );
}
