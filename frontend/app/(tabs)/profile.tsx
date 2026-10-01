import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useExpenses, useInventory, useTasks, useWallet } from "@/src/lib/hooks";
import { fmtMoney } from "@/src/lib/format";
import { APP_NAME } from "@/src/config";
import { Avatar, IconCircle, useToast } from "@/src/components/core";
import { ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { profile, household, session, signOut } = useApp();
  const tasks = useTasks();
  const expenses = useExpenses();
  const inventory = useInventory();
  const wallet = useWallet();
  const toast = useToast();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const uid = session?.user.id ?? "";
  const stats = useMemo(() => ({
    done: (tasks.data ?? []).filter((t) => t.completed_by === uid).length,
    paid: (expenses.data ?? []).filter((e) => e.paid_by === uid).reduce((s, e) => s + Number(e.amount), 0),
    added: (inventory.data ?? []).filter((i) => i.added_by === uid).length,
    contributed: wallet.contributions[uid] ?? 0,
  }), [tasks.data, expenses.data, inventory.data, wallet.contributions, uid]);

  const menu = [
    { icon: "home-outline", label: "Household", sub: household?.name ?? "", route: "/household", testID: "profile-household" },
    { icon: "nutrition-outline", label: "Dietary preferences", sub: "Diet, allergies, dislikes", route: "/preferences", testID: "profile-preferences" },
    { icon: "notifications-outline", label: "Notifications", sub: "Household activity", route: "/notifications", testID: "profile-notifications" },
    { icon: "wallet-outline", label: "Expenses & budget", sub: "Spending, settle up", route: "/expenses", testID: "profile-expenses" },
    { icon: "information-circle-outline", label: "About", sub: `${APP_NAME} 1.0`, route: null, testID: "profile-about" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl }}>
        <Avatar name={profile?.full_name ?? "?"} uri={profile?.avatar_url} size={88} />
        <Text testID="profile-name" style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>
          {profile?.full_name ?? "Member"}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>{profile?.email}</Text>
        <View style={{ backgroundColor: colors.surfaceTertiary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill }}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.onSurfaceTertiary }}>{household?.name ?? "No household"}</Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <StatCard label="Tasks completed" value={String(stats.done)} />
          <StatCard label="Expenses paid" value={fmtMoney(stats.paid)} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <StatCard label="Items added" value={String(stats.added)} />
          <StatCard label="Contributed" value={fmtMoney(stats.contributed)} />
        </View>
      </View>

      {/* Menu */}
      <View style={{
        backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
        borderColor: colors.border, overflow: "hidden",
      }}>
        {menu.map((m, i) => (
          <Pressable
            key={m.label}
            testID={m.testID}
            onPress={() => (m.route ? router.push(m.route as any) : setAboutOpen(true))}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 60,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider,
            }}
          >
            <IconCircle icon={m.icon} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{m.label}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{m.sub}</Text>
            </View>
            <IconCircle icon="chevron-forward" size={32} />
          </Pressable>
        ))}
        <Pressable
          testID="profile-logout"
          onPress={() => setLogoutOpen(true)}
          style={{
            flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 60,
            borderTopWidth: 1, borderTopColor: colors.divider,
          }}
        >
          <IconCircle icon="log-out-outline" size={40} />
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.error }}>Log out</Text>
        </Pressable>
      </View>

      <ConfirmSheet
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          setLogoutOpen(false);
          await signOut();
          router.replace("/(auth)/welcome");
          toast("Logged out", "info");
        }}
        title="Log out?"
        message="You can sign back in anytime. Your household data stays put."
        confirmLabel="Log out"
        confirmTestID="logout-confirm"
      />

      <ConfirmSheet
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onConfirm={() => setAboutOpen(false)}
        title={`${APP_NAME} 1.0`}
        message="One calm home for chores, groceries, expenses and dinner. Built for people who live together."
        confirmLabel="Close"
        confirmTestID="about-close"
      />
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
      borderColor: colors.border, padding: spacing.md, minHeight: 96, justifyContent: "space-between",
    }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: "500", letterSpacing: -1, color: colors.onSurface }}>{value}</Text>
    </View>
  );
}
