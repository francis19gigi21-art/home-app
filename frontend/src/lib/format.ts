import { CURRENCY } from "@/src/config";
import type { InventoryItem } from "@/src/lib/types";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function fmtMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${CURRENCY}${inr.format(Math.round(v))}`;
}

export function fmtMoneyDecimals(n: number | null | undefined): { whole: string; decimals: string } {
  const v = Number(n ?? 0);
  const whole = inr.format(Math.floor(Math.abs(v)));
  const decimals = (Math.abs(v) % 1).toFixed(2).slice(1);
  return { whole: `${v < 0 ? "-" : ""}${CURRENCY}${whole}`, decimals };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(name?: string | null, email?: string | null): string {
  if (name && name.trim()) return name.trim().split(" ")[0];
  if (email) return email.split("@")[0];
  return "there";
}

function toDay(d: string | Date): Date {
  const dt = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = toDay(new Date());
  const target = toDay(date);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export type ExpiryTone = "fresh" | "soon" | "urgent" | "expired";

export function expiryInfo(item: Pick<InventoryItem, "expiry_date">): {
  label: string;
  tone: ExpiryTone;
  days: number | null;
} {
  const days = daysUntil(item.expiry_date);
  if (days === null) return { label: "No expiry", tone: "fresh", days: null };
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "expired", days };
  if (days === 0) return { label: "Expires today", tone: "urgent", days };
  if (days === 1) return { label: "Expires tomorrow", tone: "urgent", days };
  if (days <= 3) return { label: `Expires in ${days} days`, tone: "soon", days };
  if (days <= 7) return { label: `${days} days left`, tone: "soon", days };
  return { label: `Fresh · ${days}d`, tone: "fresh", days };
}

export function relativeDay(date: string | null | undefined): string {
  if (!date) return "No date";
  const days = daysUntil(date);
  if (days === null) return "No date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  const d = toDay(date);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function fmtDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function fmtTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(/\.0$/, "");
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
