import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp } from "@/src/context/AppContext";
import { Field, PrimaryButton, GhostButton, PillRow, useToast } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";

const DIETS = ["No preference", "Vegetarian", "Vegan", "Eggetarian", "High protein", "Low carb"];
const DIET_KEYS: Record<string, string> = {
  "No preference": "none", Vegetarian: "vegetarian", Vegan: "vegan",
  Eggetarian: "eggetarian", "High protein": "high_protein", "Low carb": "low_carb",
};

export function parseList(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function PreferencesOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { updatePreferences } = useApp();
  const toast = useToast();
  const [diet, setDiet] = useState("No preference");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await updatePreferences({
        diet_type: DIET_KEYS[diet] ?? "none",
        allergies: parseList(allergies),
        disliked_foods: parseList(dislikes),
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      toast(e.message ?? "Could not save preferences", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + 64, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface, marginBottom: 8 }}>
        How do you eat?
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: spacing.lg }}>
        Kitchen AI respects these in every suggestion.
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 4, marginBottom: 4 }}>Diet</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="diet-pill" options={DIETS} value={diet} onChange={setDiet} />
      </View>
      <View style={{ gap: spacing.md, marginTop: spacing.md, flex: 1 }}>
        <Field label="Allergies (comma separated)" testID="prefs-allergies" value={allergies}
          onChangeText={setAllergies} placeholder="peanuts, shellfish" />
        <Field label="Disliked ingredients" testID="prefs-dislikes" value={dislikes}
          onChangeText={setDislikes} placeholder="coriander, mushrooms" />
      </View>
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton testID="prefs-save" label="Done" onPress={save} loading={loading} />
        <GhostButton testID="prefs-skip" label="Skip for now" onPress={() => router.replace("/(tabs)")} />
      </View>
    </KeyboardAwareScrollView>
  );
}
