import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useApp } from "@/src/context/AppContext";
import type {
  AppNotification, Expense, GroceryItem, HouseholdMember, InventoryItem,
  Settlement, Task, WalletTransaction, Note, CalendarEvent, MealPlan, InventoryUsage,
} from "@/src/lib/types";

type TableOpts = { select?: string; order?: string; ascending?: boolean };

// Shared household table hook: react-query + realtime invalidation.
export function useHouseholdTable<T>(table: string, opts?: TableOpts) {
  const { household } = useApp();
  const queryClient = useQueryClient();
  const hid = household?.id ?? null;

  const query = useQuery({
    queryKey: [table, hid, opts?.select ?? "*", opts?.order ?? "created_at"],
    enabled: !!hid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(opts?.select ?? "*")
        .eq("household_id", hid!)
        .order(opts?.order ?? "created_at", { ascending: opts?.ascending ?? false });
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
  });

  useEffect(() => {
    if (!hid) return;
    // Unique topic per hook instance: realtime-js reuses an existing channel for a
    // duplicate topic, and calling .on() on an already-subscribed channel throws.
    const channel = supabase
      .channel(`${table}:${hid}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${hid}` },
        () => queryClient.invalidateQueries({ queryKey: [table, hid] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hid, table, queryClient]);

  return query;
}

export function useTasks() {
  return useHouseholdTable<Task>("tasks", { order: "created_at" });
}

export function useInventory() {
  return useHouseholdTable<InventoryItem>("inventory_items", { order: "expiry_date", ascending: true });
}

export function useGroceries() {
  return useHouseholdTable<GroceryItem>("grocery_items", { order: "created_at" });
}

export function useExpenses() {
  return useHouseholdTable<Expense>("expenses", { select: "*, expense_splits(*)", order: "expense_date" });
}

export function useSettlements() {
  return useHouseholdTable<Settlement>("settlements", { order: "settled_at" });
}

export function useWallet() {
  const query = useHouseholdTable<WalletTransaction>("wallet_transactions", { order: "created_at", ascending: false });
  const derived = useMemo(() => {
    const tx = query.data ?? [];
    const balance = tx.reduce((s, t) => s + Number(t.amount), 0);
    const contributions: Record<string, number> = {};
    let spent = 0;
    for (const t of tx) {
      if (t.type === "contribution" && t.user_id) {
        contributions[t.user_id] = (contributions[t.user_id] ?? 0) + Number(t.amount);
      }
      if (Number(t.amount) < 0) spent += Math.abs(Number(t.amount));
    }
    return { balance, contributions, spent };
  }, [query.data]);
  return { ...query, ...derived };
}

export function useNotifications() {
  const { session, household } = useApp();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? null;
  const hid = household?.id ?? null;

  const query = useQuery({
    queryKey: ["notifications", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as AppNotification[];
    },
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications:${uid}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["notifications", uid] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, queryClient]);

  const unread = (query.data ?? []).filter((n) => !n.read).length;
  return { ...query, unread, hid };
}

// Notify all household members except the actor.
export async function notifyHousehold(
  members: HouseholdMember[],
  actorId: string | undefined,
  householdId: string,
  type: string,
  title: string,
  message?: string,
) {
  const rows = members
    .filter((m) => m.user_id !== actorId)
    .map((m) => ({ user_id: m.user_id, household_id: householdId, type, title, message: message ?? null }));
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(rows);
}

// Who owes whom. Positive net = should receive.
export function computeBalances(
  expenses: Expense[],
  settlements: Settlement[],
  memberIds: string[],
): { net: Record<string, number>; pairs: { from: string; to: string; amount: number }[] } {
  const net: Record<string, number> = {};
  for (const id of memberIds) net[id] = 0;
  for (const e of expenses) {
    if (!(e.paid_by in net)) net[e.paid_by] = 0;
    net[e.paid_by] += Number(e.amount);
    for (const s of e.expense_splits ?? []) {
      if (!(s.user_id in net)) net[s.user_id] = 0;
      net[s.user_id] -= Number(s.share_amount);
    }
  }
  for (const st of settlements) {
    if (st.from_user in net) net[st.from_user] += Number(st.amount);
    if (st.to_user in net) net[st.to_user] -= Number(st.amount);
  }
  const debtors = Object.entries(net).filter(([, v]) => v < -0.5).map(([id, v]) => ({ id, amt: -v }));
  const creditors = Object.entries(net).filter(([, v]) => v > 0.5).map(([id, v]) => ({ id, amt: v }));
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const pairs: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    pairs.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.5) i++;
    if (creditors[j].amt < 0.5) j++;
  }
  return { net, pairs };
}

export function useNotes() {
  return useHouseholdTable<Note>("notes", { order: "updated_at" });
}

export function useCalendarEvents() {
  return useHouseholdTable<CalendarEvent>("calendar_events", { order: "event_date", ascending: true });
}

export function useMealPlans() {
  return useHouseholdTable<MealPlan>("meal_plans", { order: "meal_date", ascending: true });
}

export function useInventoryUsage() {
  return useHouseholdTable<InventoryUsage>("inventory_usage", { order: "created_at" });
}
