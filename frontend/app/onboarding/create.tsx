import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { APP_NAME } from "@/src/config";
import { Field, PrimaryButton, GhostButton, IconCircle, useToast } from "@/src/components/core";
import { useTheme, spacing, radius } from "@/src/theme";
import type { Household } from "@/src/lib/types";

export default function CreateHouse() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { createHousehold } = useApp();
  const toast = useToast();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Household | null>(null);

  async function handleCreate() {
    if (!name.trim()) return setError("Give your home a name");
    setLoading(true);
    setError(null);
    try {
      const house = await createHousehold(name);
      setCreated(house);
    } catch (e: any) {
      setError(e.message ?? "Could not create household");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!created) return;
    await Clipboard.setStringAsync(created.invite_code);
    toast("Invite code copied", "success");
  }

  async function shareCode() {
    if (!created) return;
    try {
      await Share.share({
        message: `Join our home "${created.name}" on ${APP_NAME}! Use invite code: ${created.invite_code}`,
      });
    } catch {
      /* dismissed */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
      <Pressable testID="create-house-back" onPress={() => router.back()} hitSlop={12}>
        <IconCircle icon="chevron-back" />
      </Pressable>
      {!created ? (
        <View style={{ flex: 1, marginTop: spacing.xl }}>
          <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginBottom: 8 }}>
            Name your home
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, marginBottom: spacing.xl }}>
            e.g. "Marine Drive Apartment"
          </Text>
          <View style={{ gap: spacing.md, flex: 1 }}>
            <Field label="Household name" testID="create-house-name" value={name} onChangeText={setName}
              placeholder="Marine Drive Apartment" />
            {error ? <Text testID="create-house-error" style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
          </View>
          <PrimaryButton testID="create-house-submit" label="Create house" onPress={handleCreate} loading={loading} />
        </View>
      ) : (
        <View style={{ flex: 1, marginTop: spacing.xl }}>
          <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginBottom: 8 }}>
            {created.name} is ready
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, marginBottom: spacing.xl }}>
            Share this code with your housemates.
          </Text>
          <View style={{
            backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
            padding: spacing.xl, alignItems: "center", gap: spacing.md,
          }}>
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "500" }}>INVITE CODE</Text>
            <Text testID="invite-code" style={{ fontSize: 44, fontWeight: "700", letterSpacing: 6, color: colors.onSurface }}>
              {created.invite_code}
            </Text>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg, flex: 1 }}>
            <GhostButton testID="copy-invite" label="Copy invite code" icon="copy" onPress={copyCode} />
            <GhostButton testID="share-invite" label="Share invite" icon="share-social" onPress={shareCode} />
          </View>
          <PrimaryButton testID="create-house-continue" label="Continue" onPress={() => router.replace("/onboarding/preferences")} />
        </View>
      )}
    </View>
  );
}
