import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusinesses, useRecordDistribution, useRecordReturn, type BusinessWithMetrics } from "@/lib/data";

// Local calendar date (not UTC), so evening entries aren't dated tomorrow.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
}

export function RecordCouponsDialog({
  mode,
  business,
  trigger,
}: {
  mode: "distribution" | "return";
  business?: BusinessWithMetrics;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState(business?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | undefined>(undefined);
  const submitting = useRef(false);

  const { data: businesses } = useBusinesses();
  const distribute = useRecordDistribution();
  const recordReturn = useRecordReturn();
  const pending = distribute.isPending || recordReturn.isPending;

  const selected = business ?? businesses?.find((b) => b.id === businessId);
  const isReturn = mode === "return";

  function reset() {
    setQuantity("");
    setNote("");
    setDate(today());
    setError(null);
    requestId.current = undefined;
    if (!business) setBusinessId("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    const qty = Number(quantity);
    const targetId = business?.id ?? businessId;

    if (!targetId) return setError("Choose a business first.");
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number greater than zero.");
    if (!date) return setError("Choose a date.");
    if (new Date(date) > new Date(today())) return setError("The date cannot be in the future.");

    if (isReturn && selected) {
      const out = selected.metrics.totalDistributed - selected.metrics.totalReturned;
      if (out <= 0) return setError(`${selected.name} has no coupons out right now, so there is nothing to return.`);
      if (qty > out) return setError(`Only ${out} coupons are still out at ${selected.name}. Enter ${out} or fewer.`);
    }

    submitting.current = true;
    try {
      if (isReturn) {
        requestId.current ??= newRequestId();
        await recordReturn.mutateAsync({
          business_id: targetId,
          quantity: qty,
          returned_on: date,
          note: note || undefined,
          client_request_id: requestId.current,
        });
        toast.success(`Recorded ${qty} used / returned coupons for ${selected?.name ?? "the business"}`);
      } else {
        await distribute.mutateAsync({
          business_id: targetId,
          quantity: qty,
          distributed_on: date,
          note: note || undefined,
        });
        toast.success(`Recorded ${qty} coupons distributed`);
      }
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{isReturn ? "Record returns" : "Record distribution"}</DialogTitle>
            <DialogDescription>
              {isReturn
                ? "Enter how many coupons the business used and you collected back."
                : "Enter how many coupons you left with the business."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!business ? (
              <div className="space-y-1.5">
                <Label htmlFor="rc-business">Business</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger id="rc-business">
                    <SelectValue placeholder="Choose a business" />
                  </SelectTrigger>
                  <SelectContent>
                    {(businesses ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">{business.name}</p>
            )}

            {isReturn && selected ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border p-2">
                  <dt className="text-xs text-muted-foreground">Distributed</dt>
                  <dd className="text-lg font-semibold tabular-nums">{selected.metrics.totalDistributed}</dd>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <dt className="text-xs text-muted-foreground">Used so far</dt>
                  <dd className="text-lg font-semibold tabular-nums">{selected.metrics.totalReturned}</dd>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <dt className="text-xs text-muted-foreground">Still out</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {Math.max(0, selected.metrics.totalDistributed - selected.metrics.totalReturned)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="rc-qty">{isReturn ? "Used / Returned Coupons" : "Quantity distributed"}</Label>
              <Input
                id="rc-qty"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                autoFocus
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isReturn ? "25" : "100"}
                {...(isReturn && selected ? { max: Math.max(0, selected.metrics.totalDistributed - selected.metrics.totalReturned) } : {})}
                className="h-14 text-center text-2xl tabular-nums"
              />
              {isReturn && selected ? (
                <p className="text-xs text-muted-foreground">
                  Maximum {Math.max(0, selected.metrics.totalDistributed - selected.metrics.totalReturned)} (coupons still out).
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-date">Date</Label>
              <Input id="rc-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-note">Note (optional)</Label>
              <Textarea id="rc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-12 w-full text-base">
              {pending ? "Saving…" : isReturn ? "Confirm returns" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
