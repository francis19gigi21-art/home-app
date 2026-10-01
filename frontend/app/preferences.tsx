import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useApp } from "@/src/context/AppContext";
import { Field, IconCircle, PillRow, PrimaryButton, useToast } from "@/src/components/core";
import { useTheme, spacing } from "@/src/theme";
import { parseList } from "./onboarding/preferences";

const DIETS = ["No preference", "Vegetarian", "Vegan", "Eggetarian", "High protein", "Low carb"];
const DIET_KEYS: Record<string, string> = {
  "No preference": "none", Vegetarian: "vegetarian", Vegan: "vegan",
  Eggetarian: "eggetarian", "High protein": "high_protein", "Low carb": "low_carb",
};
const DIET_LABELS = Object.fromEntries(Object.entries(DIET_KEYS).map(([k, v]) => [v, k]));

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { preferences, updatePreferences } = useApp();
  const toast = useToast();

  const [diet, setDiet] = useState("No preference");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preferences) {
      setDiet(DIET_LABELS[preferences.diet_type] ?? "No preference");
      setAllergies((preferences.allergies ?? []).join(", "));
      setDislikes((preferences.disliked_foods ?? []).join(", "));
    }
  }, [preferences]);

  async function save() {
    setLoading(true);
    try {
      await updatePreferences({
        diet_type: DIET_KEYS[diet] ?? "none",
        allergies: parseList(allergies),
        disliked_foods: parseList(dislikes),
      });
      toast("Preferences saved", "success");
      router.back();
    } catch (e: any) {
      toast(e.message ?? "Could not save", "error");
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
        <Pressable testID="preferences-back" onPress={() => router.back()} hitSlop={12}>
          <IconCircle icon="chevron-back" />
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Dietary preferences</Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.muted }}>
        Kitchen AI respects these in every suggestion.
      </Text>

      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 4 }}>Diet</Text>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PillRow testIDPrefix="prefs-diet" options={DIETS} value={diet} onChange={setDiet} />
      </View>

      <Field label="Allergies (comma separated)" testID="prefs-allergies" value={allergies}
        onChangeText={setAllergies} placeholder="peanuts, shellfish" />
      <Field label="Disliked ingredients" testID="prefs-dislikes" value={dislikes}
        onChangeText={setDislikes} placeholder="coriander, mushrooms" />

      <PrimaryButton testID="prefs-save" label="Save preferences" onPress={save} loading={loading} />
    </KeyboardAwareScrollView>
  );
}
