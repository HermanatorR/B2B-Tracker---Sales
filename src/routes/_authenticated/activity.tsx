import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity as ActivityIcon } from "lucide-react";

import { EmptyState, PageHeader, SkeletonRows } from "@/components/ui-bits";
import { activityLabel, formatDateTime } from "@/lib/coupon";
import { useActivity, useSession } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "My activity — Coupon Tracker" },
      { name: "description", content: "Everything you've recorded, newest first." },
      { property: "og:title", content: "My activity — Coupon Tracker" },
      { property: "og:description", content: "Everything you've recorded, newest first." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: session } = useSession();
  const { data: activity, isPending } = useActivity({
    userId: session?.userId,
    limit: 100,
  });

  return (
    <div>
      <PageHeader title="My activity" subtitle="Your recent coupon records and businesses added." />
      {isPending ? (
        <SkeletonRows count={5} />
      ) : !activity || activity.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet."
          description="Record a distribution or return and it will show up here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {activity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
              <p className="text-sm">
                {a.business_id ? (
                  <Link
                    to="/businesses/$businessId"
                    params={{ businessId: a.business_id }}
                    className="underline-offset-2 hover:underline"
                  >
                    {activityLabel(a.action, a.quantity, a.business_name)}
                  </Link>
                ) : (
                  activityLabel(a.action, a.quantity, a.business_name)
                )}
              </p>
              <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
