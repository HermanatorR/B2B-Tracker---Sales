import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  computeMetrics,
  DEFAULT_THRESHOLDS,
  type BusinessMetrics,
  type Thresholds,
} from "@/lib/coupon";

export type Business = {
  id: string;
  company_id: string;
  name: string;
  address: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
};

export type BusinessWithMetrics = Business & {
  metrics: BusinessMetrics;
  assignedName: string | null;
};

export type Profile = {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  onboarded: boolean;
  is_demo: boolean;
  created_at: string;
};

export type CouponRecord = {
  id: string;
  business_id: string;
  user_id: string;
  quantity: number;
  note: string | null;
  created_at: string;
  distributed_on?: string;
  returned_on?: string;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  business_id: string | null;
  business_name: string | null;
  action: string;
  quantity: number | null;
  created_at: string;
};

function friendly(error: { message?: string } | null, fallback: string): string {
  if (!error?.message) return fallback;
  const m = error.message.toLowerCase();
  if (m.includes("duplicate")) return "That record already exists.";
  if (m.includes("row-level security") || m.includes("permission"))
    return "You don't have permission to do that.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Network problem — check your connection and try again.";
  if (
    /cannot exceed|must be a positive|invalid date|invalid email|same company|belong to your company|required|cannot be changed|only admins/.test(m)
  )
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  return fallback;
}

/* ---------------------------------- session --------------------------------- */

export type SessionInfo = {
  userId: string;
  email: string;
  profile: Profile | null;
  role: "admin" | "sales_rep" | null;
  company: { id: string; name: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null; created_at: string } | null;
  settings: Thresholds;
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SessionInfo | null> => {
      // Local session read (no network hop). The route gate already verified the
      // user with the server, and every query below is enforced by RLS.
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      let company: SessionInfo["company"] = null;
      let settings: Thresholds = DEFAULT_THRESHOLDS;
      if (profile?.company_id) {
        const [{ data: c }, { data: s }] = await Promise.all([
          supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
          supabase.from("company_settings").select("*").eq("company_id", profile.company_id).maybeSingle(),
        ]);
        company = (c as SessionInfo["company"]) ?? null;
        if (s) {
          settings = {
            high_turnover_days: s.high_turnover_days,
            medium_turnover_days: s.medium_turnover_days,
            visit_soon_percent: s.visit_soon_percent,
            overdue_percent: s.overdue_percent,
            stale_visit_days: s.stale_visit_days,
          };
        }
      }

      const role = (roles?.[0]?.role as "admin" | "sales_rep" | undefined) ?? null;
      return {
        userId: user.id,
        email: user.email ?? "",
        profile: (profile as Profile) ?? null,
        role,
        company,
        settings,
      };
    },
  });
}

/* --------------------------------- businesses -------------------------------- */

export function useBusinesses() {
  const { data: session } = useSession();
  const settings = session?.settings ?? DEFAULT_THRESHOLDS;
  return useQuery({
    queryKey: ["businesses", session?.company?.id, settings],
    enabled: Boolean(session?.company?.id),
    queryFn: async (): Promise<BusinessWithMetrics[]> => {
      const [{ data: businesses, error }, { data: stats }, { data: profiles }] = await Promise.all([
        supabase.from("businesses").select("*").order("name"),
        supabase.rpc("company_business_stats"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (error) throw new Error(friendly(error, "Could not load businesses."));
      const statMap = new Map((stats ?? []).map((s) => [s.business_id as string, s]));
      const nameMap = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]));
      return (businesses ?? []).map((b) => ({
        ...(b as Business),
        assignedName: b.assigned_to ? (nameMap.get(b.assigned_to) ?? null) : null,
        metrics: computeMetrics(statMap.get(b.id) as never, settings),
      }));
    },
  });
}

export function useBusiness(id: string) {
  const list = useBusinesses();
  return {
    ...list,
    data: list.data?.find((b) => b.id === id),
  };
}

export type HistoryRow = {
  id: string;
  kind: "distribution" | "return";
  quantity: number;
  happened_on: string;
  note: string | null;
  created_at: string;
  user_id: string | null;
  recorded_by: string | null;
};

/** Shared coupon history for one business. Names are only shown for your own entries (or to admins). */
export function useCouponRecords(businessId: string) {
  return useQuery({
    queryKey: ["coupon-records", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("business_history", { _business_id: businessId });
      if (error) throw new Error(friendly(error, "Could not load coupon history."));
      const rows = (data ?? []) as HistoryRow[];
      return {
        distributions: rows.filter((r) => r.kind === "distribution"),
        returns: rows.filter((r) => r.kind === "return"),
      };
    },
  });
}

/* --------------------------------- activity --------------------------------- */

export function useActivity(opts: { userId?: string | undefined; limit?: number | undefined } = {}) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["activity", session?.company?.id, opts.userId ?? "all", opts.limit ?? 30],
    enabled: Boolean(session?.company?.id),
    queryFn: async () => {
      let q = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 30);
      if (opts.userId) q = q.eq("user_id", opts.userId);
      const { data, error } = await q;
      if (error) throw new Error(friendly(error, "Could not load activity."));
      return (data ?? []) as ActivityRow[];
    },
  });
}

/** All distributions and returns for the company, for reporting. */
export function useCompanyRecords() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["company-records", session?.company?.id],
    enabled: Boolean(session?.company?.id),
    queryFn: async () => {
      const [{ data: dist, error }, { data: rets }] = await Promise.all([
        supabase.from("coupon_distributions").select("id, business_id, user_id, quantity, distributed_on"),
        supabase.from("coupon_returns").select("id, business_id, user_id, quantity, returned_on"),
      ]);
      if (error) throw new Error(friendly(error, "Could not load coupon history."));
      return {
        distributions: (dist ?? []).map((d) => ({
          id: d.id as string,
          business_id: d.business_id as string,
          user_id: d.user_id as string,
          quantity: d.quantity as number,
          date: d.distributed_on as string,
        })),
        returns: (rets ?? []).map((r) => ({
          id: r.id as string,
          business_id: r.business_id as string,
          user_id: r.user_id as string,
          quantity: r.quantity as number,
          date: r.returned_on as string,
        })),
      };
    },
  });
}



/** Pre-aggregated daily totals (per business + employee) for a date range, computed in the database. */
export function useReportTotals(from: string, to: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["company-records", session?.company?.id, "report", from, to],
    enabled: Boolean(session?.company?.id) && Boolean(from) && Boolean(to),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_daily_totals", { _from: from, _to: to });
      if (error) throw new Error(friendly(error, "Could not load report."));
      type Row = { business_id: string; user_id: string; quantity: number; date: string };
      const distributions: Row[] = [];
      const returns: Row[] = [];
      for (const r of data ?? []) {
        const row = { business_id: r.business_id as string, user_id: r.user_id as string, quantity: Number(r.quantity), date: r.day as string };
        (r.kind === "distribution" ? distributions : returns).push(row);
      }
      return { distributions, returns };
    },
  });
}

/* --------------------------------- employees -------------------------------- */

export type Employee = Profile & {
  role: "admin" | "sales_rep" | null;
  businessCount: number;
  visitedBusinessIds: string[];
  distributed: number;
  returned: number;
  returnRate: number | null;
  lastActivity: string | null;
};

export function useEmployees() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["employees", session?.company?.id],
    enabled: Boolean(session?.company?.id),
    queryFn: async (): Promise<Employee[]> => {
      const [{ data: profiles, error }, { data: roles }, { data: dist }, { data: rets }, { data: acts }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("full_name"),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("coupon_distributions").select("user_id, quantity, business_id"),
          supabase.from("coupon_returns").select("user_id, quantity, business_id"),
          supabase.rpc("employee_last_activity"),
        ]);
      if (error) throw new Error(friendly(error, "Could not load employees."));

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id as string, r.role as "admin" | "sales_rep"]));
      const lastMap = new Map<string, string>();
      for (const a of acts ?? []) lastMap.set(a.user_id as string, a.last_activity as string);
      // Group once instead of filtering every record for every employee.
      type Rec = { user_id: string; quantity: number; business_id: string };
      const group = (rows: Rec[] | null) => {
        const m = new Map<string, Rec[]>();
        for (const r of rows ?? []) {
          const list = m.get(r.user_id);
          if (list) list.push(r);
          else m.set(r.user_id, [r]);
        }
        return m;
      };
      const distBy = group(dist as Rec[] | null);
      const retBy = group(rets as Rec[] | null);

      return (profiles ?? []).map((p) => {
        const userDist = distBy.get(p.id as string) ?? [];
        const distributed = userDist.reduce((s, d) => s + (d.quantity as number), 0);
        const userRets = retBy.get(p.id as string) ?? [];
        const returned = userRets.reduce((s, r) => s + (r.quantity as number), 0);
        const visited = new Set([
          ...userDist.map((d) => d.business_id as string),
          ...userRets.map((r) => r.business_id as string),
        ]);
        return {
          ...(p as Profile),
          role: roleMap.get(p.id as string) ?? null,
          businessCount: visited.size,
          visitedBusinessIds: [...visited],
          distributed,
          returned,
          returnRate: distributed > 0 ? (returned / distributed) * 100 : null,
          lastActivity: lastMap.get(p.id as string) ?? null,
        };
      });
    },
  });
}

/** Average turnover (days) across the given businesses that have enough data; null if none do. */
export function averageTurnover(businesses: BusinessWithMetrics[], ids: string[]): number | null {
  const set = new Set(ids);
  const days = businesses
    .filter((b) => set.has(b.id) && b.metrics.turnoverDays !== null)
    .map((b) => b.metrics.turnoverDays as number);
  return days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
}

export function turnoverText(days: number | null): string {
  if (days === null) return "Not enough data";
  const d = Math.max(1, Math.round(days));
  return `~${d} day${d === 1 ? "" : "s"}`;
}

/* --------------------------------- mutations -------------------------------- */

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["businesses"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["coupon-records"] });
    qc.invalidateQueries({ queryKey: ["company-records"] });
  };
}

export function useAddBusiness() {
  const { data: session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: Partial<Business> & { name: string; address: string }) => {
      if (!session?.company?.id) throw new Error("No company found for your account.");
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          ...input,
          company_id: session.company.id,
          created_by: session.userId,
          assigned_to: input.assigned_to ?? session.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(friendly(error, "Could not save this business."));
      return data.id as string;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateBusiness() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Business> & { id: string }) => {
      const { error } = await supabase.from("businesses").update(patch).eq("id", id);
      if (error) throw new Error(friendly(error, "Could not update this business."));
    },
    onSuccess: invalidate,
  });
}

export function useRecordDistribution() {
  const { data: session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { business_id: string; quantity: number; distributed_on: string; note?: string | undefined }) => {
      if (!session?.company?.id) throw new Error("No company found for your account.");
      const { error } = await supabase.from("coupon_distributions").insert({
        ...input,
        note: input.note ?? null,
        company_id: session.company.id,
        user_id: session.userId,
      });
      if (error) throw new Error(friendly(error, "Could not record this distribution."));
    },
    onSuccess: invalidate,
  });
}

export function useRecordReturn() {
  const { data: session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { business_id: string; quantity: number; returned_on: string; note?: string | undefined }) => {
      if (!session?.company?.id) throw new Error("No company found for your account.");
      const { error } = await supabase.from("coupon_returns").insert({
        ...input,
        note: input.note ?? null,
        company_id: session.company.id,
        user_id: session.userId,
      });
      if (error) throw new Error(friendly(error, "Could not record these returns."));
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { id: string; name?: string; address?: string; phone?: string; email?: string; logo_url?: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("companies").update(rest).eq("id", id);
      if (error) throw new Error(friendly(error, "Could not save company details."));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Thresholds & { company_id: string }) => {
      const { company_id, ...rest } = patch;
      const { error } = await supabase.from("company_settings").update(rest).eq("company_id", company_id);
      if (error) throw new Error(friendly(error, "Could not save thresholds."));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { id: string; full_name?: string; phone?: string; onboarded?: boolean; is_active?: boolean }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("profiles").update(rest).eq("id", id);
      if (error) throw new Error(friendly(error, "Could not save profile."));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useSetEmployeeRole() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "sales_rep" }) => {
      if (!session?.company?.id) throw new Error("No company found.");
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw new Error(friendly(delErr, "Could not change this role."));
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, company_id: session.company.id, role });
      if (error) throw new Error(friendly(error, "Could not change this role."));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

/* --------------------------------- envelopes -------------------------------- */

export type Envelope = {
  id: string;
  business_id: string;
  prepared_by: string;
  quantity_prepared: number;
  quantity_distributed: number | null;
  status: "prepared" | "distributed" | "cancelled";
  prepared_at: string;
  distributed_at: string | null;
  cancelled_at: string | null;
};

/** Open envelopes plus anything distributed/cancelled in the last 7 days. RLS limits reps to their own. */
export function useEnvelopes() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["envelopes", session?.company?.id],
    enabled: Boolean(session?.company?.id),
    queryFn: async (): Promise<Envelope[]> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("coupon_envelopes")
        .select("id, business_id, prepared_by, quantity_prepared, quantity_distributed, status, prepared_at, distributed_at, cancelled_at")
        .or(`status.eq.prepared,updated_at.gte.${since}`)
        .order("prepared_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(friendly(error, "Could not load envelopes."));
      return (data ?? []) as Envelope[];
    },
  });
}

export function usePrepareEnvelopes() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { business_id: string; quantity: number }[]) => {
      if (!session?.company?.id) throw new Error("No company found for your account.");
      const { error } = await supabase.from("coupon_envelopes").insert(
        items.map((i) => ({
          business_id: i.business_id,
          quantity_prepared: i.quantity,
          company_id: session.company!.id,
          prepared_by: session.userId,
        })),
      );
      if (error) throw new Error(friendly(error, "Could not save these envelopes."));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["envelopes"] }),
  });
}

export function useDistributeEnvelope() {
  const invalidate = useInvalidateAll();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.rpc("distribute_envelope", { _envelope_id: id, _quantity: quantity });
      if (error) throw new Error(friendly(error, "Could not record this distribution."));
    },
    onSettled: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["envelopes"] });
    },
  });
}

export function useCancelEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_envelope", { _envelope_id: id });
      if (error) throw new Error(friendly(error, "Could not cancel this envelope."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["envelopes"] }),
  });
}

export function useUpdateEnvelopeQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.rpc("update_envelope_quantity", { _envelope_id: id, _quantity: quantity });
      if (error) throw new Error(friendly(error, "Could not change this envelope."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["envelopes"] }),
  });
}

/* --------------------------------- realtime --------------------------------- */

export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    // Batch bursts of change events into one invalidation per query group.
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queue = (...keys: string[]) => {
      keys.forEach((k) => pending.add(k));
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const ks = [...pending];
        pending.clear();
        ks.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      }, 400);
    };
    const couponKeys = ["businesses", "coupon-records", "company-records", "employees"];
    const channel = supabase
      .channel("coupon-tracker-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => queue("businesses"))
      .on("postgres_changes", { event: "*", schema: "public", table: "coupon_distributions" }, () => queue(...couponKeys))
      .on("postgres_changes", { event: "*", schema: "public", table: "coupon_returns" }, () => queue(...couponKeys))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => queue("activity", "employees"))
      .on("postgres_changes", { event: "*", schema: "public", table: "coupon_envelopes" }, () => queue("envelopes"))
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
