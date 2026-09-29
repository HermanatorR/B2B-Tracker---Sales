import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mail, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, SkeletonRows } from "@/components/ui-bits";
import { formatDate } from "@/lib/coupon";
import {
  useBusinesses,
  useCancelEnvelope,
  useDistributeEnvelope,
  useEmployees,
  useEnvelopes,
  usePrepareEnvelopes,
  useSession,
  useUpdateEnvelopeQuantity,
  type BusinessWithMetrics,
  type Envelope,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prepare")({
  validateSearch: z.object({ business: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Prepare envelopes — Coupon Tracker" },
      { name: "description", content: "Prepare coupon envelopes for today's visits and mark them distributed." },
      { property: "og:title", content: "Prepare envelopes — Coupon Tracker" },
      { property: "og:description", content: "Prepare coupon envelopes for today's visits and mark them distributed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreparePage,
});

type Draft = { business_id: string; quantity: string };

function toQty(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null;
}

function PreparePage() {
  const { business: preselect } = Route.useSearch();
  const { data: session } = useSession();
  const isAdmin = session?.role === "admin";
  const { data: businesses = [], isPending } = useBusinesses();
  const byId = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [query, setQuery] = useState("");
  const prepare = usePrepareEnvelopes();
  const lastInput = useRef<HTMLInputElement | null>(null);
  const [focusNext, setFocusNext] = useState(false);

  function add(id: string) {
    setQuery("");
    setDrafts((d) => (d.some((x) => x.business_id === id) ? d : [...d, { business_id: id, quantity: "100" }]));
    setFocusNext(true);
  }

  useEffect(() => {
    if (preselect && byId.has(preselect)) add(preselect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, byId.size]);

  useEffect(() => {
    if (focusNext && lastInput.current) {
      lastInput.current.focus();
      lastInput.current.select();
      setFocusNext(false);
    }
  }, [focusNext, drafts.length]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return businesses
      .filter((b) => !drafts.some((d) => d.business_id === b.id))
      .filter((b) => `${b.name} ${b.address} ${b.city ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, businesses, drafts]);

  const totalCoupons = drafts.reduce((s, d) => s + (toQty(d.quantity) ?? 0), 0);
  const allValid = drafts.length > 0 && drafts.every((d) => toQty(d.quantity) !== null);

  async function save() {
    if (!allValid) return;
    try {
      await prepare.mutateAsync(drafts.map((d) => ({ business_id: d.business_id, quantity: toQty(d.quantity)! })));
      toast.success(`${drafts.length} envelope${drafts.length === 1 ? "" : "s"} prepared`);
      setDrafts([]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Prepare envelopes" subtitle="Preparing doesn't count as handed out until you mark it distributed." />

      <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isPending ? "Loading businesses…" : "Search a business to add"}
            className="h-12 pl-9 text-base"
            aria-label="Search businesses"
          />
        </div>
        {matches.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {matches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => add(b.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.address}</span>
                  </span>
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() && !isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">No matching business.</p>
        ) : null}

        {drafts.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {drafts.map((d, i) => {
              const b = byId.get(d.business_id);
              const invalid = toQty(d.quantity) === null;
              return (
                <li key={d.business_id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b?.name ?? "Business"}</p>
                    <p className="truncate text-xs text-muted-foreground">{b?.address}</p>
                  </div>
                  <Input
                    ref={i === drafts.length - 1 ? lastInput : undefined}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={d.quantity}
                    onChange={(e) =>
                      setDrafts((all) => all.map((x) => (x.business_id === d.business_id ? { ...x, quantity: e.target.value } : x)))
                    }
                    className={cn("h-11 w-24 text-center text-base tabular-nums", invalid && "border-destructive")}
                    aria-label={`Coupons for ${b?.name ?? "business"}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDrafts((all) => all.filter((x) => x.business_id !== d.business_id))}
                    aria-label={`Remove ${b?.name ?? "business"}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Add the businesses you plan to visit.</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{drafts.length}</span> envelope{drafts.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold tabular-nums">{totalCoupons}</span> coupons
          </p>
          <Button className="h-12 gap-2 px-5 text-base" disabled={!allValid || prepare.isPending} onClick={save}>
            <Mail className="size-5" aria-hidden="true" /> {prepare.isPending ? "Saving…" : "Prepare"}
          </Button>
        </div>
      </section>

      <TodaysEnvelopes byId={byId} isAdmin={isAdmin} myId={session?.userId} />
    </div>
  );
}

function TodaysEnvelopes({
  byId,
  isAdmin,
  myId,
}: {
  byId: Map<string, BusinessWithMetrics>;
  isAdmin: boolean;
  myId: string | undefined;
}) {
  const { data: envelopes, isPending } = useEnvelopes();
  const { data: employees } = useEmployees();
  const nameOf = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.full_name])), [employees]);
  const [distributing, setDistributing] = useState<Envelope | null>(null);

  const open = (envelopes ?? []).filter((e) => e.status === "prepared");
  const done = (envelopes ?? []).filter((e) => e.status !== "prepared");

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{isAdmin ? "Team envelopes" : "Today's envelopes"}</h2>
      {isPending ? (
        <SkeletonRows count={3} />
      ) : open.length === 0 && done.length === 0 ? (
        <EmptyState icon={Mail} title="No envelopes prepared." description="Prepared envelopes show up here until you hand them out." />
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting to be handed out.</p>
          ) : (
            <ul className="space-y-3">
              {open.map((e) => (
                <EnvelopeCard
                  key={e.id}
                  envelope={e}
                  business={byId.get(e.business_id)}
                  preparer={isAdmin && e.prepared_by !== myId ? (nameOf.get(e.prepared_by) ?? "Team member") : null}
                  canEdit={e.prepared_by === myId}
                  onDistribute={() => setDistributing(e)}
                />
              ))}
            </ul>
          )}
          {done.length > 0 ? (
            <>
              <h3 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">Last 7 days</h3>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {done.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{byId.get(e.business_id)?.name ?? "Business"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.status === "distributed"
                          ? `${e.quantity_distributed} of ${e.quantity_prepared} distributed ${formatDate(e.distributed_at!)}`
                          : `${e.quantity_prepared} prepared · cancelled ${formatDate(e.cancelled_at!)}`}
                        {isAdmin && e.prepared_by !== myId ? ` · ${nameOf.get(e.prepared_by) ?? "Team member"}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium",
                        e.status === "distributed" ? "text-foreground" : "text-muted-foreground line-through",
                      )}
                    >
                      {e.status === "distributed" ? "Distributed" : "Cancelled"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
      <DistributeDialog
        envelope={distributing}
        business={distributing ? byId.get(distributing.business_id) : undefined}
        onClose={() => setDistributing(null)}
      />
    </section>
  );
}

function EnvelopeCard({
  envelope: e,
  business,
  preparer,
  canEdit,
  onDistribute,
}: {
  envelope: Envelope;
  business: BusinessWithMetrics | undefined;
  preparer: string | null;
  canEdit: boolean;
  onDistribute: () => void;
}) {
  const cancel = useCancelEnvelope();
  const updateQty = useUpdateEnvelopeQuantity();
  const today = new Date().toDateString() === new Date(e.prepared_at).toDateString();

  function bump(delta: number) {
    const q = e.quantity_prepared + delta;
    if (q < 1) return;
    updateQty.mutate({ id: e.id, quantity: q }, { onError: (err) => toast.error(err.message) });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {business ? (
            <Link to="/businesses/$businessId" params={{ businessId: business.id }} className="block truncate font-semibold hover:underline">
              {business.name}
            </Link>
          ) : (
            <p className="font-semibold">Business</p>
          )}
          <p className="truncate text-xs text-muted-foreground">{business?.address}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Prepared {today ? "today" : formatDate(e.prepared_at)}
            {preparer ? ` · ${preparer}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit ? (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => bump(-5)} aria-label="5 fewer coupons" disabled={updateQty.isPending}>
              <Minus className="size-4" />
            </Button>
          ) : null}
          <span className="min-w-12 text-center text-xl font-semibold tabular-nums">{e.quantity_prepared}</span>
          {canEdit ? (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => bump(5)} aria-label="5 more coupons" disabled={updateQty.isPending}>
              <Plus className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="h-12 flex-1 gap-2 text-base" onClick={onDistribute}>
          <Check className="size-5" aria-hidden="true" /> Mark distributed
        </Button>
        <Button
          variant="secondary"
          className="h-12 gap-1.5"
          disabled={cancel.isPending}
          onClick={() => {
            if (!window.confirm(`Cancel the envelope for ${business?.name ?? "this business"}? Nothing will be recorded as distributed.`)) return;
            cancel.mutate(e.id, {
              onSuccess: () => toast.success("Envelope cancelled"),
              onError: (err) => toast.error(err.message),
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" /> Cancel
        </Button>
      </div>
    </li>
  );
}

function DistributeDialog({
  envelope,
  business,
  onClose,
}: {
  envelope: Envelope | null;
  business: BusinessWithMetrics | undefined;
  onClose: () => void;
}) {
  const distribute = useDistributeEnvelope();
  const [qty, setQty] = useState("");
  useEffect(() => {
    if (envelope) setQty(String(envelope.quantity_prepared));
  }, [envelope]);
  const n = toQty(qty);

  function confirm() {
    if (!envelope || n === null || distribute.isPending) return;
    distribute.mutate(
      { id: envelope.id, quantity: n },
      {
        onSuccess: () => {
          toast.success(`${n} coupons distributed to ${business?.name ?? "business"}`);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={Boolean(envelope)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{business?.name ?? "Business"}</DialogTitle>
          <DialogDescription>Date: today. Prepared: {envelope?.quantity_prepared}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dist-qty">Coupons being distributed</Label>
          <Input
            id="dist-qty"
            type="number"
            inputMode="numeric"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-12 text-center text-xl tabular-nums"
          />
          {n === null ? <p className="text-xs text-destructive">Enter a whole number above 0.</p> : null}
        </div>
        <DialogFooter>
          <Button className="h-12 w-full text-base" disabled={n === null || distribute.isPending} onClick={confirm}>
            {distribute.isPending ? "Saving…" : "Confirm distribution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
