import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  Building2,
  Map as MapIcon,
  Plus,
  Ticket,
  TrendingUp,
  Undo2,
  X,
} from "lucide-react";

import { BusinessFormDialog } from "@/components/business-form";
import { CompanySetup } from "@/components/company-setup";
import { RecordCouponsDialog } from "@/components/record-coupons";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SkeletonRows, StatCard, StatusBadge } from "@/components/ui-bits";
import {
  activityLabel,
  estimatedRemainingLabel,
  formatDate,
  formatDateTime,
  percent,
} from "@/lib/coupon";
import {
  useActivity,
  useBusinesses,
  useEmployees,
  useSession,
  useUpdateProfile,
  type BusinessWithMetrics,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Coupon Tracker" },
      { name: "description", content: "Your businesses, coupons and what needs a visit next." },
      { property: "og:title", content: "Home — Coupon Tracker" },
      { property: "og:description", content: "Your businesses, coupons and what needs a visit next." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) return <SkeletonRows count={4} />;
  if (session && !session.company) return <CompanySetup />;
  if (session?.role === "admin") return <AdminDashboard />;
  return <RepHome />;
}

function Onboarding({ admin }: { admin: boolean }) {
  const { data: session } = useSession();
  const update = useUpdateProfile();
  if (!session?.profile || session.profile.onboarded) return null;

  const steps = admin
    ? [
        "Add your first businesses so the map has pins.",
        "Invite your sales reps from the Employees page.",
        "Adjust turnover thresholds in Settings if needed.",
      ]
    : [
        "Open the Map to see your businesses by status.",
        "Tap a business, then Record Distribution when you drop coupons off.",
        "Use Record Returns when coupons come back.",
      ];

  return (
    <div className="mb-5 rounded-xl border border-border bg-accent p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Welcome{session.profile.full_name ? `, ${session.profile.full_name}` : ""}</p>
          <ul className="mt-2 space-y-1 text-sm text-accent-foreground">
            {steps.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss welcome"
          onClick={() => update.mutate({ id: session.userId, onboarded: true })}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function needsAttention(businesses: BusinessWithMetrics[]) {
  const order = { overdue: 0, attention: 1, soon: 2, never: 3, healthy: 4 } as const;
  return businesses
    .filter((b) => b.metrics.status !== "healthy")
    .sort((a, b) => order[a.metrics.status] - order[b.metrics.status]);
}

/* ------------------------------ sales rep home ------------------------------ */

function RepHome() {
  const { data: session } = useSession();
  const { data: businesses, isPending, error } = useBusinesses();

  const mine = (businesses ?? []).filter(
    (b) => b.assigned_to === session?.userId || b.created_by === session?.userId,
  );
  const scope = mine.length > 0 ? mine : (businesses ?? []);
  const distributed = scope.reduce((s, b) => s + b.metrics.totalDistributed, 0);
  const returned = scope.reduce((s, b) => s + b.metrics.totalReturned, 0);
  const attention = needsAttention(scope);

  if (error) {
    return <EmptyState title="We couldn't load your businesses" description={error.message} />;
  }

  return (
    <div>
      <Onboarding admin={false} />
      <PageHeader
        title="Home"
        subtitle="Where to go and what to do next."
        actions={
          <>
            <RecordCouponsDialog
              mode="distribution"
              trigger={
                <Button className="gap-1.5">
                  <Ticket className="size-4" aria-hidden="true" /> Record distribution
                </Button>
              }
            />
            <RecordCouponsDialog
              mode="return"
              trigger={
                <Button variant="secondary" className="gap-1.5">
                  <Undo2 className="size-4" aria-hidden="true" /> Record returns
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Businesses" value={scope.length} icon={Building2} large />
        <StatCard label="Coupons distributed" value={distributed} icon={Ticket} large />
        <StatCard label="Coupons returned" value={returned} icon={Undo2} large />
        <StatCard
          label="Return rate"
          value={distributed > 0 ? percent((returned / distributed) * 100) : "—"}
          icon={TrendingUp}
          large
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
        {isPending ? (
          <SkeletonRows count={3} />
        ) : attention.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={scope.length === 0 ? "No businesses yet." : "Everything looks healthy."}
            description={
              scope.length === 0
                ? "Add your first business to start building your contact database."
                : "Nothing needs a visit right now."
            }
            action={
              scope.length === 0 ? (
                <BusinessFormDialog
                  trigger={
                    <Button className="gap-1.5">
                      <Plus className="size-4" aria-hidden="true" /> Add business
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {attention.slice(0, 8).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last distribution {formatDate(b.metrics.lastDistribution)} ·{" "}
                    {estimatedRemainingLabel(b.metrics)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={b.metrics.status} />
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/businesses/$businessId" params={{ businessId: b.id }}>
                      View
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <Button asChild size="lg" className="h-14 w-full gap-2 text-base">
          <Link to="/map">
            <MapIcon className="size-5" aria-hidden="true" /> View map
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- admin dashboard ----------------------------- */

function AdminDashboard() {
  const { data: businesses, isPending } = useBusinesses();
  const { data: activity } = useActivity({ limit: 12 });
  const { data: employees } = useEmployees();

  const list = businesses ?? [];
  const distributed = list.reduce((s, b) => s + b.metrics.totalDistributed, 0);
  const returned = list.reduce((s, b) => s + b.metrics.totalReturned, 0);
  const active = list.filter((b) => b.metrics.status === "healthy" || b.metrics.status === "soon").length;
  const attention = needsAttention(list);
  const turnovers = list.map((b) => b.metrics.turnoverDays).filter((v): v is number => v !== null);
  const avgTurnover = turnovers.length
    ? (() => {
        const d = Math.round(turnovers.reduce((s, v) => s + v, 0) / turnovers.length);
        return `~${d} ${d === 1 ? "day" : "days"}`;
      })()
    : "Not enough data";
  const nameFor = (id: string) => employees?.find((e) => e.id === id)?.full_name ?? "Someone";

  return (
    <div>
      <Onboarding admin />
      <PageHeader
        title="Dashboard"
        subtitle="What's happening across the company."
        actions={
          <BusinessFormDialog
            trigger={
              <Button className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" /> Add business
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total businesses" value={list.length} icon={Building2} />
        <StatCard label="Active" value={active} hint="Healthy or visiting soon" />
        <StatCard label="Needs attention" value={attention.length} />
        <StatCard label="Average turnover" value={avgTurnover} icon={TrendingUp} />
        <StatCard label="Coupons distributed" value={distributed} icon={Ticket} />
        <StatCard label="Coupons returned" value={returned} icon={Undo2} />
        <StatCard
          label="Overall return rate"
          value={distributed > 0 ? percent((returned / distributed) * 100) : "—"}
        />
        <StatCard label="Employees" value={employees?.length ?? 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
          {activity && activity.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 p-3.5">
                  <p className="text-sm">
                    <span className="font-medium">{nameFor(a.user_id)}</span>{" "}
                    {lowerFirst(activityLabel(a.action, a.quantity, a.business_name))}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ActivityIcon} title="No activity yet." description="Activity appears as your team records coupons." />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
          {isPending ? (
            <SkeletonRows count={3} />
          ) : attention.length === 0 ? (
            <EmptyState icon={Building2} title="Nothing needs attention." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {attention.slice(0, 8).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <Link
                      to="/businesses/$businessId"
                      params={{ businessId: b.id }}
                      className="truncate font-medium underline-offset-2 hover:underline"
                    >
                      {b.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {b.assignedName ? `${b.assignedName} · ` : ""}
                      {estimatedRemainingLabel(b.metrics)}
                    </p>
                  </div>
                  <StatusBadge status={b.metrics.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Employee activity</h2>
        {employees && employees.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Employee coupon activity summary</caption>
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Businesses</th>
                  <th className="px-4 py-3 font-medium">Distributed</th>
                  <th className="px-4 py-3 font-medium">Returned</th>
                  <th className="px-4 py-3 font-medium">Return rate</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <Link
                        to="/employees/$employeeId"
                        params={{ employeeId: e.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {e.full_name || e.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.businessCount}</td>
                    <td className="px-4 py-3 tabular-nums">{e.distributed}</td>
                    <td className="px-4 py-3 tabular-nums">{e.returned}</td>
                    <td className="px-4 py-3 tabular-nums">{percent(e.returnRate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(e.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No employees have been added." />
        )}
      </section>
    </div>
  );
}
