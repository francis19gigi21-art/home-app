import { supabase } from "@/src/lib/supabase";
import type { MealSuggestion } from "@/src/lib/types";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

async function authedFetch(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again");
  const res = await fetch(`${BACKEND}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new Error(json?.detail || json?.message || "Something went wrong. Please try again.");
  }
  return json;
}

export async function suggestMeals(prompt: string, maxSpend?: number | null): Promise<MealSuggestion[]> {
  const json = await authedFetch("/ai/suggest-meals", { prompt, max_spend: maxSpend ?? null });
  return (json?.meals ?? []) as MealSuggestion[];
}

export type PlannedMeal = {
  meal_date: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  meal_name: string;
  recipe_data: MealSuggestion;
};

export async function generateMealPlan(days: number, startDate: string): Promise<PlannedMeal[]> {
  const json = await authedFetch("/ai/meal-plan", { days, start_date: startDate });
  return (json?.plan ?? []) as PlannedMeal[];
}
