export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Household = {
  id: string;
  name: string;
  icon: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profiles?: Profile;
};

export type TaskStatus = "pending" | "in_progress" | "completed";

export type Task = {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  category: string;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high";
  status: TaskStatus;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  rotate: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchase_date: string | null;
  expiry_date: string | null;
  estimated_cost: number | null;
  minimum_quantity: number | null;
  added_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GroceryItem = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_price: number | null;
  actual_price: number | null;
  source: "manual" | "low_stock" | "ai_meal" | "recurring";
  source_reference: string | null;
  added_by: string | null;
  purchased: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  settled: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  household_id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  expense_date: string;
  notes: string | null;
  from_budget: boolean;
  created_at: string;
  expense_splits?: ExpenseSplit[];
};

export type Settlement = {
  id: string;
  household_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  settled_at: string;
};

export type WalletTransaction = {
  id: string;
  household_id: string;
  user_id: string | null;
  type: "contribution" | "expense" | "refund" | "adjustment";
  amount: number; // signed: contribution positive, expense negative
  description: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  household_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
};

export type UserPreferences = {
  id: string;
  user_id: string;
  diet_type: string;
  allergies: string[];
  disliked_foods: string[];
  notification_settings: Record<string, unknown>;
};

export type MissingIngredient = {
  name: string;
  estimated_price?: number | null;
};

export type MealSuggestion = {
  name: string;
  category: string;
  prep_time_minutes: number;
  difficulty: string;
  servings: number;
  available_ingredients: string[];
  missing_ingredients: MissingIngredient[];
  estimated_additional_cost: number;
  reason: string;
  instructions: string[];
  uses?: { name: string; quantity: number; unit: string }[];
};
