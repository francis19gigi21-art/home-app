import { supabase } from "@/src/lib/supabase";
import { notifyHousehold } from "@/src/lib/hooks";
import type { GroceryItem, HouseholdMember, InventoryItem, Task } from "@/src/lib/types";

function nextOccurrence(due: string | null, recurrence: Task["recurrence"]): string | null {
  if (!due) return null;
  const d = new Date(`${due}T00:00:00`);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

export async function completeTask(
  task: Task,
  memberId: string,
  members: HouseholdMember[],
  actorName: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed", completed_by: memberId, completed_at: now })
    .eq("id", task.id);
  if (error) throw new Error(error.message);

  // Recurring chores spawn their next occurrence; rotation moves the assignee.
  const nextDue = nextOccurrence(task.due_date, task.recurrence);
  if (task.recurrence !== "none" && nextDue) {
    let assigned = task.assigned_to;
    if (task.rotate && members.length > 1) {
      const ordered = [...members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      const idx = ordered.findIndex((m) => m.user_id === task.assigned_to);
      assigned = ordered[(idx + 1 + ordered.length) % ordered.length].user_id;
    }
    await supabase.from("tasks").insert({
      household_id: task.household_id,
      title: task.title,
      description: task.description,
      category: task.category,
      assigned_to: assigned,
      created_by: task.created_by,
      due_date: nextDue,
      due_time: task.due_time,
      priority: task.priority,
      recurrence: task.recurrence,
      rotate: task.rotate,
    });
  }

  await notifyHousehold(members, memberId, task.household_id, "task", `${actorName} completed "${task.title}"`);
}

// Grocery purchase flow: mark purchased → add to inventory → record expense → budget deduction.
export async function purchaseGrocery(
  item: GroceryItem,
  actualCost: number,
  quantity: number,
  deductFromBudget: boolean,
  ctx: { householdId: string; userId: string; actorName: string; members: HouseholdMember[] },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { error: gErr } = await supabase
    .from("grocery_items")
    .update({
      purchased: true,
      actual_price: actualCost,
      quantity,
      purchased_by: ctx.userId,
      purchased_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  if (gErr) throw new Error(gErr.message);

  await supabase.from("inventory_items").insert({
    household_id: ctx.householdId,
    name: item.name,
    category: item.category,
    quantity,
    unit: item.unit,
    purchase_date: today,
    estimated_cost: actualCost,
    added_by: ctx.userId,
  });

  const splits = ctx.members.map((m) => ({
    user_id: m.user_id,
    share_amount: Math.round((actualCost / Math.max(ctx.members.length, 1)) * 100) / 100,
  }));
  const { data: expense, error: eErr } = await supabase
    .from("expenses")
    .insert({
      household_id: ctx.householdId,
      title: `Groceries — ${item.name}`,
      amount: actualCost,
      category: "groceries",
      paid_by: ctx.userId,
      expense_date: today,
      from_budget: deductFromBudget,
    })
    .select()
    .single();
  if (eErr) throw new Error(eErr.message);
  if (splits.length) {
    await supabase.from("expense_splits").insert(splits.map((s) => ({ ...s, expense_id: expense.id })));
  }

  if (deductFromBudget) {
    await supabase.from("wallet_transactions").insert({
      household_id: ctx.householdId,
      user_id: ctx.userId,
      type: "expense",
      amount: -Math.abs(actualCost),
      description: `Groceries — ${item.name}`,
    });
  }

  await notifyHousehold(
    ctx.members, ctx.userId, ctx.householdId, "grocery",
    `${ctx.actorName} bought ${item.name}`, `Added to inventory · ₹${actualCost}`,
  );
}

export async function addExpenseRecord(
  input: {
    title: string;
    amount: number;
    category: string;
    paidBy: string;
    date: string;
    notes?: string;
    fromBudget: boolean;
    splits: { user_id: string; share_amount: number }[];
  },
  ctx: { householdId: string; actorName: string; members: HouseholdMember[] },
): Promise<void> {
  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      household_id: ctx.householdId,
      title: input.title,
      amount: input.amount,
      category: input.category,
      paid_by: input.paidBy,
      expense_date: input.date,
      notes: input.notes || null,
      from_budget: input.fromBudget,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (input.splits.length) {
    const { error: sErr } = await supabase
      .from("expense_splits")
      .insert(input.splits.map((s) => ({ ...s, expense_id: expense.id })));
    if (sErr) throw new Error(sErr.message);
  }
  if (input.fromBudget) {
    await supabase.from("wallet_transactions").insert({
      household_id: ctx.householdId,
      user_id: input.paidBy,
      type: "expense",
      amount: -Math.abs(input.amount),
      description: input.title,
    });
  }
  await notifyHousehold(
    ctx.members, input.paidBy, ctx.householdId, "expense",
    `${ctx.actorName} added an expense`, `${input.title} · ₹${input.amount}`,
  );
}

// Deduct quantity from an inventory item. Returns the new quantity.
export async function useInventoryQuantity(item: InventoryItem, used: number): Promise<number> {
  const newQty = Math.max(0, Math.round((Number(item.quantity) - used) * 100) / 100);
  const { error } = await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", item.id);
  if (error) throw new Error(error.message);
  return newQty;
}

export async function addToGrocery(
  householdId: string,
  userId: string,
  item: { name: string; quantity?: number; unit?: string; category?: string; estimated_price?: number | null; source?: string; source_reference?: string | null },
): Promise<void> {
  const { error } = await supabase.from("grocery_items").insert({
    household_id: householdId,
    name: item.name,
    category: item.category ?? "other",
    quantity: item.quantity ?? 1,
    unit: item.unit ?? "pcs",
    estimated_price: item.estimated_price ?? null,
    source: item.source ?? "manual",
    source_reference: item.source_reference ?? null,
    added_by: userId,
  });
  if (error) throw new Error(error.message);
}

// Loose match between a recipe ingredient name and an inventory item.
export function matchInventory(inventory: InventoryItem[], ingredientName: string): InventoryItem | undefined {
  const needle = ingredientName.toLowerCase().trim();
  return inventory.find((i) => {
    const n = i.name.toLowerCase().trim();
    return n === needle || n.includes(needle) || needle.includes(n);
  });
}
