import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, SkeletonRows, StatCard } from "@/components/ui-bits";
import { formatDate, percent } from "@/lib/coupon";
import { useBusinesses, useCompanyRecords, useEmployees, useSession } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Coupon Tracker" },
      { name: "description", content: "Company coupon totals, turnover and employee performance over time." },
      { property: "og:title", content: "Reports — Coupon Tracker" },
      { property: "og:description", content: "Company coupon totals, turnover and employee performance over time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Range = "7" | "30" | "90" | "year" | "custom";

const RANGES: Array<{ key: Range; label: string }> = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const navigate = useNavigate();
  const { data: businesses } = useBusinesses();
  const { data: records, isPending } = useCompanyRecords();
  const { data: employees } = useEmployees();

  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));

  useEffect(() => {
    if (!sessionPending && session && session.role !== "admin") {
      navigate({ to: "/home", replace: true });
    }
  }, [sessionPending, session, navigate]);

  const bounds = useMemo(() => {
    const today = new Date();
    if (range === "custom") return { from, to };
    if (range === "year") return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
    const days = Number(range);
    return { from: iso(new Date(today.getTime() - (days - 1) * 86_400_000)), to: iso(today) };
  }, [range, from, to]);

  const inRange = (date: string) => date >= bounds.from && date <= bounds.to;

  const dist = (records?.distributions ?? []).filter((d) => inRange(d.date));
  const rets = (records?.returns ?? []).filter((r) => inRange(r.date));
  const distributed = dist.reduce((s, d) => s + d.quantity, 0);
  const returned = rets.reduce((s, r) => s + r.quantity, 0);

  const turnovers = (businesses ?? []).map((b) => b.metrics.turnoverDays).filter((v): v is number => v !== null);
  const avgTurnover = turnovers.length
    ? (() => {
        const d = Math.round(turnovers.reduce((s, v) => s + v, 0) / turnovers.length);
        return `~${d} ${d === 1 ? "day" : "days"}`;
      })()
    : "Not enough data";

  const weeks = useMemo(() => {
    const buckets = new Map<string, { distributed: number; returned: number }>();
    const start = new Date(`${bounds.from}T00:00:00`);
    const end = new Date(`${bounds.to}T00:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      buckets.set(iso(d), { distributed: 0, returned: 0 });
    }
    const keys = [...buckets.keys()];
    const bucketFor = (date: string) => {
      let found = keys[0];
      for (const k of keys) if (date >= k) found = k;
      return found;
    };
    for (const d of dist) {
      const k = bucketFor(d.date);
      if (k) buckets.get(k)!.distributed += d.quantity;
    }
    for (const r of rets) {
      const k = bucketFor(r.date);
      if (k) buckets.get(k)!.returned += r.quantity;
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }, [bounds.from, bounds.to, dist, rets]);

  const maxWeek = Math.max(1, ...weeks.map((w) => Math.max(w.distributed, w.returned)));

  const byBusiness = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dist) map.set(d.business_id, (map.get(d.business_id) ?? 0) + d.quantity);
    return (businesses ?? [])
      .map((b) => ({ business: b, distributed: map.get(b.id) ?? 0 }))
      .filter((row) => row.distributed > 0)
      .sort((a, b) => b.distributed - a.distributed)
      .slice(0, 10);
  }, [businesses, dist]);

  const byEmployee = useMemo(() => {
    const d = new Map<string, number>();
    const r = new Map<string, number>();
    for (const row of dist) d.set(row.user_id, (d.get(row.user_id) ?? 0) + row.quantity);
    for (const row of rets) r.set(row.user_id, (r.get(row.user_id) ?? 0) + row.quantity);
    return (employees ?? []).map((e) => {
      const dd = d.get(e.id) ?? 0;
      const rr = r.get(e.id) ?? 0;
      return { employee: e, distributed: dd, returned: rr, rate: dd > 0 ? (rr / dd) * 100 : null };
    });
  }, [employees, dist, rets]);

  if (sessionPending) return <SkeletonRows count={4} />;
  if (session?.role !== "admin") return null;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${formatDate(bounds.from)} – ${formatDate(bounds.to)}`}
      />

      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "secondary"}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        ) : null}
      </div>

      {isPending ? (
        <SkeletonRows count={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Coupons distributed" value={distributed} />
            <StatCard label="Coupons returned" value={returned} />
            <StatCard
              label="Return rate"
              value={distributed > 0 ? percent((returned / distributed) * 100) : "—"}
            />
            <StatCard label="Average turnover" value={avgTurnover} hint="Across all businesses with history" />
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Distribution and returns over time</h2>
            {distributed === 0 && returned === 0 ? (
              <EmptyState title="No coupon activity in this period." />
            ) : (
              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Distributed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-status-healthy" aria-hidden="true" /> Returned
                  </span>
                </div>
                <ul className="space-y-3">
                  {weeks.map((w) => (
                    <li key={w.date}>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Week of {formatDate(w.date)}</span>
                        <span className="tabular-nums">
                          {w.distributed} out · {w.returned} back
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <div className="h-2.5 rounded-full bg-muted">
                          <div
                            className="h-2.5 rounded-full bg-primary"
                            style={{ width: `${(w.distributed / maxWeek) * 100}%` }}
                          />
                        </div>
                        <div className="h-2.5 rounded-full bg-muted">
                          <div
                            className="h-2.5 rounded-full bg-status-healthy"
                            style={{ width: `${(w.returned / maxWeek) * 100}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Turnover by business</h2>
            {byBusiness.length === 0 ? (
              <EmptyState title="No distributions in this period." />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {byBusiness.map(({ business, distributed: qty }) => (
                  <li key={business.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <Link
                        to="/businesses/$businessId"
                        params={{ businessId: business.id }}
                        className="truncate font-medium underline-offset-2 hover:underline"
                      >
                        {business.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{business.metrics.turnoverLabel}</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{qty} coupons</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Employee activity</h2>
            {byEmployee.length === 0 ? (
              <EmptyState title="No employees yet." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">Employee coupon activity for the selected period</caption>
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Distributed</th>
                      <th className="px-4 py-3 font-medium">Returned</th>
                      <th className="px-4 py-3 font-medium">Return rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {byEmployee.map(({ employee, distributed: dd, returned: rr, rate }) => (
                      <tr key={employee.id}>
                        <td className="px-4 py-3">
                          <Link
                            to="/employees/$employeeId"
                            params={{ employeeId: employee.id }}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {employee.full_name || employee.email}
                          </Link>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{dd}</td>
                        <td className="px-4 py-3 tabular-nums">{rr}</td>
                        <td className="px-4 py-3 tabular-nums">{percent(rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
