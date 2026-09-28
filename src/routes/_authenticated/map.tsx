import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { STATUS_META, type CouponStatus } from "@/lib/coupon";
import { useBusinesses } from "@/lib/data";

const BusinessMap = lazy(() => import("@/components/business-map"));

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Map — Coupon Tracker" },
      { name: "description", content: "See every business you serve, colour-coded by coupon status." },
      { property: "og:title", content: "Map — Coupon Tracker" },
      { property: "og:description", content: "See every business you serve, colour-coded by coupon status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MapPage,
});

const FILTERS: Array<{ key: CouponStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "healthy", label: STATUS_META.healthy.label },
  { key: "soon", label: STATUS_META.soon.label },
  { key: "attention", label: STATUS_META.attention.label },
  { key: "overdue", label: STATUS_META.overdue.label },
  { key: "never", label: STATUS_META.never.label },
];

function MapPage() {
  const { data: businesses, isPending } = useBusinesses();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CouponStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (businesses ?? []).filter((b) => {
      if (filter !== "all" && b.metrics.status !== filter) return false;
      if (!q) return true;
      return [b.name, b.address, b.contact_name, b.contact_phone, b.contact_email]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [businesses, query, filter]);

  const withoutPins = (businesses ?? []).filter((b) => b.latitude === null || b.longitude === null).length;

  return (
    <div>
      <PageHeader title="Map" subtitle="Pin colour shows coupon status." />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            placeholder="Search businesses"
            aria-label="Search businesses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
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
        <div className="h-[70vh] animate-pulse rounded-xl border border-border bg-muted/50" aria-busy="true" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No businesses to show."
          description="Add a business, or clear your search and filters."
        />
      ) : (
        <ClientOnly
          fallback={<div className="h-[70vh] animate-pulse rounded-xl border border-border bg-muted/50" />}
        >
          <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl border border-border bg-muted/50" />}>
            <BusinessMap businesses={filtered} />
          </Suspense>
        </ClientOnly>
      )}

      {withoutPins > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {withoutPins} business{withoutPins === 1 ? "" : "es"} have no map coordinates yet — open the
          business and use “Find from address”.
        </p>
      ) : null}
    </div>
  );
}
