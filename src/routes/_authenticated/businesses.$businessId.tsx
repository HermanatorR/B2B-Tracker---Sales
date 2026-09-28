import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Ticket, Undo2 } from "lucide-react";

import { BusinessFormDialog } from "@/components/business-form";
import { RecordCouponsDialog } from "@/components/record-coupons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SkeletonRows, StatCard, StatusBadge } from "@/components/ui-bits";
import { estimatedRemainingLabel, formatDate, percent } from "@/lib/coupon";
import { useBusiness, useCouponRecords } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/businesses/$businessId")({
  head: () => ({
    meta: [
      { title: "Business — Coupon Tracker" },
      { name: "description", content: "Contact details, coupon history and turnover for this business." },
      { property: "og:title", content: "Business — Coupon Tracker" },
      { property: "og:description", content: "Contact details, coupon history and turnover for this business." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessProfile,
});

function BusinessProfile() {
  const { businessId } = Route.useParams();
  const { data: business, isPending } = useBusiness(businessId);
  const { data: records } = useCouponRecords(businessId);

  if (isPending) return <SkeletonRows count={4} />;
  if (!business) {
    return (
      <EmptyState
        title="This business isn't available."
        description="It may have been removed, or it belongs to another company."
        action={
          <Button asChild variant="secondary">
            <Link to="/businesses">Back to businesses</Link>
          </Button>
        }
      />
    );
  }

  const m = business.metrics;

  return (
    <div>
      <Link
        to="/businesses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Businesses
      </Link>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{business.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {[business.address, business.city, business.province, business.postal_code]
                .filter(Boolean)
                .join(", ")}
            </p>
            {business.contact_name ? (
              <p className="mt-2 text-sm">
                <span className="font-medium">{business.contact_name}</span>
                {business.contact_title ? ` · ${business.contact_title}` : ""}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {business.contact_phone ? (
                <a href={`tel:${business.contact_phone}`} className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
                  <Phone className="size-4" aria-hidden="true" /> {business.contact_phone}
                </a>
              ) : null}
              {business.contact_email ? (
                <a href={`mailto:${business.contact_email}`} className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
                  <Mail className="size-4" aria-hidden="true" /> {business.contact_email}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={m.status} />
            <BusinessFormDialog
              business={business}
              trigger={
                <Button size="sm" variant="secondary" className="gap-1.5">
                  <Pencil className="size-4" aria-hidden="true" /> Edit
                </Button>
              }
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <RecordCouponsDialog
            mode="distribution"
            business={business}
            trigger={
              <Button className="h-14 w-full gap-2 text-base">
                <Ticket className="size-5" aria-hidden="true" /> Record distribution
              </Button>
            }
          />
          <RecordCouponsDialog
            mode="return"
            business={business}
            trigger={
              <Button variant="secondary" className="h-14 w-full gap-2 text-base">
                <Undo2 className="size-5" aria-hidden="true" /> Record returns
              </Button>
            }
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total distributed" value={m.totalDistributed} />
        <StatCard label="Total returned" value={m.totalReturned} />
        <StatCard label="Return rate" value={percent(m.returnRate)} />
        <StatCard label="Turnover" value={m.turnoverLabel.split(" — ")[1] ?? "—"} hint={m.turnoverLabel} />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="distributions">Distribution history</TabsTrigger>
          <TabsTrigger value="returns">Returns history</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <Row label="Current status" value={m.statusLabel} />
            <Row label="Estimated turnover" value={m.turnoverLabel} />
            <Row label="Coupons still out" value={String(m.remaining)} />
            <Row label="Estimated remaining" value={estimatedRemainingLabel(m)} />
            <Row label="Last visit" value={formatDate(m.lastVisit)} />
            <Row label="Last distribution" value={formatDate(m.lastDistribution)} />
            <Row label="Last return" value={formatDate(m.lastReturn)} />
            <Row label="Assigned representative" value={business.assignedName ?? "Unassigned"} />
            <Row label="Date added" value={formatDate(business.created_at)} />
            <Row
              label="Map coordinates"
              value={
                business.latitude !== null && business.longitude !== null
                  ? `${business.latitude.toFixed(4)}, ${business.longitude.toFixed(4)}`
                  : "Not set"
              }
            />
          </dl>
        </TabsContent>

        <TabsContent value="distributions" className="mt-4">
          {records && records.distributions.length > 0 ? (
            <HistoryList
              rows={records.distributions.map((d) => ({
                id: d.id,
                date: d.distributed_on ?? d.created_at,
                quantity: d.quantity,
                who: records.nameFor(d.user_id),
                note: d.note,
              }))}
              unit="coupons distributed"
            />
          ) : (
            <EmptyState title="No coupon history yet." description="Record a distribution to start the history." />
          )}
        </TabsContent>

        <TabsContent value="returns" className="mt-4">
          {records && records.returns.length > 0 ? (
            <HistoryList
              rows={records.returns.map((r) => ({
                id: r.id,
                date: r.returned_on ?? r.created_at,
                quantity: r.quantity,
                who: records.nameFor(r.user_id),
                note: r.note,
              }))}
              unit="coupons returned"
            />
          ) : (
            <EmptyState title="No returns recorded yet." />
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {business.notes ? (
            <p className="whitespace-pre-wrap rounded-xl border border-border bg-card p-5 text-sm">
              {business.notes}
            </p>
          ) : (
            <EmptyState
              title="No notes yet."
              description="Use Edit to add anything the next rep should know."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function HistoryList({
  rows,
  unit,
}: {
  rows: Array<{ id: string; date: string; quantity: number; who: string; note: string | null }>;
  unit: string;
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium tabular-nums">
              {r.quantity} {unit}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(r.date)} · {r.who}
            </p>
            {r.note ? <p className="mt-1 text-xs">{r.note}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
