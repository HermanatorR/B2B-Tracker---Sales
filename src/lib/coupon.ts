export type CouponStatus = "never" | "healthy" | "soon" | "attention" | "overdue";

export type Thresholds = {
  high_turnover_days: number;
  medium_turnover_days: number;
  visit_soon_percent: number;
  overdue_percent: number;
  stale_visit_days: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  high_turnover_days: 10,
  medium_turnover_days: 21,
  visit_soon_percent: 70,
  overdue_percent: 90,
  stale_visit_days: 45,
};

export type RawStats = {
  total_distributed: number;
  total_returned: number;
  first_distribution: string | null;
  last_distribution: string | null;
  last_return: string | null;
};

export type BusinessMetrics = {
  totalDistributed: number;
  totalReturned: number;
  remaining: number;
  percentUsed: number | null;
  returnRate: number | null;
  usagePerDay: number | null;
  turnoverDays: number | null;
  estimatedDaysRemaining: number | null;
  turnoverLabel: string;
  turnoverTier: "high" | "medium" | "low" | "unknown";
  status: CouponStatus;
  statusLabel: string;
  lastVisit: string | null;
  lastDistribution: string | null;
  lastReturn: string | null;
  daysSinceVisit: number | null;
  hasEnoughData: boolean;
};

const DAY = 86_400_000;

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export const STATUS_META: Record<CouponStatus, { label: string; color: string; dot: string }> = {
  healthy: { label: "Healthy", color: "text-status-healthy", dot: "bg-status-healthy" },
  soon: { label: "Visit soon", color: "text-status-soon", dot: "bg-status-soon" },
  attention: { label: "Needs attention", color: "text-status-attention", dot: "bg-status-attention" },
  overdue: { label: "Due for visit", color: "text-status-overdue", dot: "bg-status-overdue" },
  never: { label: "Never visited", color: "text-status-never", dot: "bg-status-never" },
};

export function computeMetrics(stats: RawStats | undefined, t: Thresholds): BusinessMetrics {
  const totalDistributed = stats?.total_distributed ?? 0;
  const totalReturned = stats?.total_returned ?? 0;
  const first = toDate(stats?.first_distribution ?? null);
  const lastDist = toDate(stats?.last_distribution ?? null);
  const lastRet = toDate(stats?.last_return ?? null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastVisitDate =
    lastDist && lastRet ? (lastDist > lastRet ? lastDist : lastRet) : (lastDist ?? lastRet);
  const daysSinceVisit = lastVisitDate ? Math.max(0, daysBetween(lastVisitDate, today)) : null;

  const remaining = Math.max(0, totalDistributed - totalReturned);
  const percentUsed = totalDistributed > 0 ? (totalReturned / totalDistributed) * 100 : null;
  const returnRate = percentUsed;

  // Usage rate: coupons returned per day over the observed period.
  const spanEnd = lastRet ?? today;
  const spanDays = first ? Math.max(1, daysBetween(first, spanEnd)) : null;
  const hasEnoughData = totalDistributed > 0 && totalReturned > 0 && spanDays !== null && spanDays >= 1;
  const usagePerDay = hasEnoughData && spanDays ? totalReturned / spanDays : null;
  const turnoverDays = usagePerDay && usagePerDay > 0 ? totalDistributed / usagePerDay : null;
  const estimatedDaysRemaining = usagePerDay && usagePerDay > 0 ? remaining / usagePerDay : null;

  let turnoverTier: BusinessMetrics["turnoverTier"] = "unknown";
  let turnoverLabel = "Not enough data";
  if (turnoverDays !== null) {
    const rounded = Math.max(1, Math.round(turnoverDays));
    if (turnoverDays <= t.high_turnover_days) turnoverTier = "high";
    else if (turnoverDays <= t.medium_turnover_days) turnoverTier = "medium";
    else turnoverTier = "low";
    const word = turnoverTier === "high" ? "High" : turnoverTier === "medium" ? "Medium" : "Low";
    turnoverLabel = `${word} turnover — ~${rounded} days`;
  }

  let status: CouponStatus;
  if (totalDistributed === 0) {
    status = "never";
  } else if (percentUsed !== null && percentUsed >= t.overdue_percent) {
    status = "overdue";
  } else if (daysSinceVisit !== null && daysSinceVisit > t.stale_visit_days) {
    status = "attention";
  } else if (percentUsed !== null && percentUsed >= t.visit_soon_percent) {
    status = "soon";
  } else {
    status = "healthy";
  }

  return {
    totalDistributed,
    totalReturned,
    remaining,
    percentUsed,
    returnRate,
    usagePerDay,
    turnoverDays,
    estimatedDaysRemaining,
    turnoverLabel,
    turnoverTier,
    status,
    statusLabel: STATUS_META[status].label,
    lastVisit: lastVisitDate ? lastVisitDate.toISOString().slice(0, 10) : null,
    lastDistribution: stats?.last_distribution ?? null,
    lastReturn: stats?.last_return ?? null,
    daysSinceVisit,
    hasEnoughData,
  };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function estimatedRemainingLabel(m: BusinessMetrics): string {
  if (m.totalDistributed === 0) return "No coupons yet";
  if (m.estimatedDaysRemaining === null) return "Not enough data";
  const days = Math.round(m.estimatedDaysRemaining);
  if (days <= 0) return "Likely out of coupons";
  return `~${days} day${days === 1 ? "" : "s"} of coupons left`;
}

export function activityLabel(action: string, quantity: number | null, business: string | null): string {
  const name = business ?? "a business";
  switch (action) {
    case "distribution":
      return `Distributed ${quantity ?? 0} coupons to ${name}`;
    case "return":
      return `Recorded ${quantity ?? 0} returned coupons from ${name}`;
    case "business_added":
      return `Added ${name}`;
    default:
      return `${action} — ${name}`;
  }
}
