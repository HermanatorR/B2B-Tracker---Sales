import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { STATUS_META, type CouponStatus } from "@/lib/coupon";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: CouponStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
      <span className={meta.color}>{meta.label}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  large,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      <p className={cn("mt-2 font-semibold tabular-nums", large ? "text-3xl sm:text-4xl" : "text-2xl")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent">
          <Icon className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/50" />
      ))}
    </div>
  );
}
