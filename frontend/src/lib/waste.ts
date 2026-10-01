import type { InventoryItem, InventoryUsage } from "@/src/lib/types";

// "Rescued" = used while it had 3 days or fewer left before expiry.
export const RESCUE_WINDOW_DAYS = 3;

export function weekRange(offsetWeeks = 0): { start: Date; end: Date } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type WasteDigest = {
  rescued: InventoryUsage[];
  rescuedValue: number;
  usedCount: number;
  wasted: InventoryItem[];
  wastedValue: number;
  rescueRate: number | null; // 0..1, null when nothing to measure
};

export function computeWasteDigest(
  usage: InventoryUsage[],
  inventory: InventoryItem[],
  range: { start: Date; end: Date },
): WasteDigest {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const inWeek = usage.filter((u) => {
    const t = new Date(u.created_at).getTime();
    return t >= startMs && t < endMs;
  });
  const rescued = inWeek.filter(
    (u) => u.days_to_expiry !== null && u.days_to_expiry >= 0 && u.days_to_expiry <= RESCUE_WINDOW_DAYS,
  );
  // Wasted = still had stock when it expired during this week (expired before today).
  const todayIso = iso(new Date());
  const startIso = iso(range.start);
  const endIso = iso(range.end);
  const wasted = inventory.filter(
    (i) => i.expiry_date && i.quantity > 0 && i.expiry_date >= startIso && i.expiry_date < endIso && i.expiry_date < todayIso,
  );
  const rescuedValue = rescued.reduce((s, u) => s + Number(u.estimated_value || 0), 0);
  const wastedValue = wasted.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
  const denom = rescued.length + wasted.length;
  return {
    rescued,
    rescuedValue,
    usedCount: inWeek.length,
    wasted,
    wastedValue,
    rescueRate: denom ? rescued.length / denom : null,
  };
}
