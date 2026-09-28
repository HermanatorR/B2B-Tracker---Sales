import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { lazy, Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SkeletonRows, StatCard, StatusBadge } from "@/components/ui-bits";
import { activityLabel, formatDateTime, percent } from "@/lib/coupon";
import { useActivity, useBusinesses, useCompanyRecords, useEmployees, useSession } from "@/lib/data";

const BusinessMap = lazy(() => import("@/components/business-map"));

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({
    meta: [
      { title: "Employee — Coupon Tracker" },
      { name: "description", content: "One employee's businesses, coupon totals and recent activity." },
      { property: "og:title", content: "Employee — Coupon Tracker" },
      { property: "og:description", content: "One employee's businesses, coupon totals and recent activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { employeeId } = Route.useParams();
  const { data: session } = useSession();
  const { data: employees, isPending } = useEmployees();
  const { data: businesses } = useBusinesses();
  const { data: records } = useCompanyRecords();
  const { data: activity } = useActivity({ userId: employeeId, limit: 20 });

  if (session && session.role !== "admin") {
    return (
      <EmptyState
        title="Admins only"
        description="Employee details are available to company administrators."
        action={
          <Button asChild variant="secondary">
            <Link to="/home">Go home</Link>
          </Button>
        }
      />
    );
  }

  if (isPending) return <SkeletonRows count={4} />;
  const employee = employees?.find((e) => e.id === employeeId);
  if (!employee) {
    return (
      <EmptyState
        title="This employee isn't available."
        action={
          <Button asChild variant="secondary">
            <Link to="/employees">Back to employees</Link>
          </Button>
        }
      />
    );
  }

  const visitedIds = new Set((records?.distributions ?? []).filter((d) => d.user_id === employeeId).map((d) => d.business_id));
  const visited = (businesses ?? []).filter((b) => visitedIds.has(b.id));
  const managed = (businesses ?? []).filter((b) => b.assigned_to === employeeId);
  const mapped = visited.filter((b) => b.latitude !== null && b.longitude !== null);

  return (
    <div>
      <Link
        to="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Employees
      </Link>

      <PageHeader
        title={employee.full_name || employee.email}
        subtitle={`${employee.role === "admin" ? "Admin" : "Sales rep"} · ${employee.email}${
          employee.is_active ? "" : " · disabled"
        }`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Businesses visited" value={visited.length} />
        <StatCard label="Businesses managed" value={managed.length} />
        <StatCard label="Coupons distributed" value={employee.distributed} />
        <StatCard label="Coupons returned" value={employee.returned} />
        <StatCard label="Return rate" value={percent(employee.returnRate)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        {activity && activity.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
                <span>{activityLabel(a.action, a.quantity, a.business_name)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No activity recorded yet." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Businesses visited</h2>
        {visited.length === 0 ? (
          <EmptyState title="No visits recorded yet." />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {visited.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-3.5">
                  <Link
                    to="/businesses/$businessId"
                    params={{ businessId: b.id }}
                    className="truncate font-medium underline-offset-2 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <StatusBadge status={b.metrics.status} />
                </li>
              ))}
            </ul>
            {mapped.length > 0 ? (
              <div className="mt-4">
                <ClientOnly fallback={<div className="h-[50vh] animate-pulse rounded-xl bg-muted/50" />}>
                  <Suspense fallback={<div className="h-[50vh] animate-pulse rounded-xl bg-muted/50" />}>
                    <BusinessMap businesses={mapped} />
                  </Suspense>
                </ClientOnly>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
