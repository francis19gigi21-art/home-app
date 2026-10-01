import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useApp } from "@/src/context/AppContext";
import { PrimaryButton, GhostButton, IconCircle, Avatar, useToast } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";

type Preview = {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  members: { name: string; role: string }[];
};

export default function JoinHouse() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { joinHousehold } = useApp();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function lookup() {
    if (code.trim().length !== 6) return setError("Invite codes are 6 characters");
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_household_by_invite", { code: code.trim() });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("Invalid invite code. Check the code and try again.");
        return;
      }
      setPreview(row as Preview);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    try {
      await joinHousehold(code);
      toast("Welcome home!", "success");
      router.replace("/onboarding/preferences");
    } catch (e: any) {
      setError(e.message ?? "Could not join household");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
      <Pressable testID="join-house-back" onPress={() => router.back()} hitSlop={12}>
        <IconCircle icon="chevron-back" />
      </Pressable>
      <View style={{ flex: 1, marginTop: spacing.xl }}>
        <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginBottom: 8 }}>
          Join a house
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, marginBottom: spacing.xl }}>
          Enter the 6-character code your housemate shared.
        </Text>
        <TextInput
          testID="join-code-input"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="RM82KF"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          style={{
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 18, height: 64, fontSize: 26, fontWeight: "700", letterSpacing: 6,
            color: colors.onSurface, textAlign: "center",
          }}
        />
        {error ? <Text testID="join-error" style={{ color: colors.error, fontSize: 13, marginTop: spacing.sm }}>{error}</Text> : null}

        {preview ? (
          <View style={{
            marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
          }}>
            <Text testID="join-household-name" style={{ fontSize: 22, fontWeight: "600", color: colors.onSurface }}>
              {preview.name}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{preview.member_count} member{preview.member_count === 1 ? "" : "s"}</Text>
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              {(preview.members ?? []).map((m, i) => (
                <View key={i} style={{ alignItems: "center", gap: 6 }}>
                  <Avatar name={m.name} size={44} />
                  <Text style={{ fontSize: 12, color: colors.onSurfaceTertiary }}>{m.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
      {preview ? (
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton testID="join-household-submit" label={`Join ${preview.name}`} onPress={handleJoin} loading={loading} />
          <GhostButton testID="join-try-different" label="Try a different code" onPress={() => { setPreview(null); setCode(""); }} />
        </View>
      ) : (
        <PrimaryButton testID="join-lookup" label="Find household" onPress={lookup} loading={loading} />
      )}
    </View>
  );
}
