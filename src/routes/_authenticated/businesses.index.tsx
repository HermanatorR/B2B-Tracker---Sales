import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { BusinessFormDialog } from "@/components/business-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, SkeletonRows, StatusBadge } from "@/components/ui-bits";
import { estimatedRemainingLabel, formatDate } from "@/lib/coupon";
import { useBusinesses } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/businesses/")({
  head: () => ({
    meta: [
      { title: "Businesses — Coupon Tracker" },
      { name: "description", content: "Your company's shared database of businesses and contacts." },
      { property: "og:title", content: "Businesses — Coupon Tracker" },
      { property: "og:description", content: "Your company's shared database of businesses and contacts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessesPage,
});

type Filter = "all" | "active" | "needs_visit" | "high" | "medium" | "low" | "never";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "needs_visit", label: "Needs visit" },
  { key: "high", label: "High turnover" },
  { key: "medium", label: "Medium turnover" },
  { key: "low", label: "Low turnover" },
  { key: "never", label: "Never visited" },
];

function BusinessesPage() {
  const { data: businesses, isPending, error } = useBusinesses();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (businesses ?? []).filter((b) => {
      const { status, turnoverTier } = b.metrics;
      if (filter === "active" && !(status === "healthy" || status === "soon")) return false;
      if (filter === "needs_visit" && !(status === "soon" || status === "attention" || status === "overdue"))
        return false;
      if (filter === "never" && status !== "never") return false;
      if ((filter === "high" || filter === "medium" || filter === "low") && turnoverTier !== filter)
        return false;
      if (!q) return true;
      return [b.name, b.address, b.city, b.contact_name, b.contact_phone, b.contact_email]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [businesses, query, filter]);

  if (error) return <EmptyState title="We couldn't load your businesses" description={error.message} />;

  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Everything the company knows about each stop."
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

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            placeholder="Search name, address, contact, phone or email"
            aria-label="Search businesses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter businesses">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "secondary"}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? (
        <SkeletonRows count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={businesses?.length ? "Nothing matches those filters." : "No businesses yet."}
          description={
            businesses?.length
              ? "Try a different search or filter."
              : "Add your first business to start building your contact database."
          }
          action={
            businesses?.length ? undefined : (
              <BusinessFormDialog
                trigger={
                  <Button className="gap-1.5">
                    <Plus className="size-4" aria-hidden="true" /> Add business
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li key={b.id}>
              <Link
                to="/businesses/$businessId"
                params={{ businessId: b.id }}
                className="block rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{b.address}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.contact_name ? `${b.contact_name} · ` : ""}
                      {b.assignedName ? `${b.assignedName} · ` : ""}
                      Last visit {formatDate(b.metrics.lastVisit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={b.metrics.status} />
                    <span className="text-xs text-muted-foreground">{b.metrics.turnoverLabel}</span>
                    <span className="text-xs text-muted-foreground">{estimatedRemainingLabel(b.metrics)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
