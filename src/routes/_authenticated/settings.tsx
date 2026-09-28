import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SkeletonRows } from "@/components/ui-bits";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/coupon";
import { useSession, useUpdateCompany, useUpdateSettings } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Coupon Tracker" },
      { name: "description", content: "Company details and the thresholds that drive visit statuses." },
      { property: "og:title", content: "Settings — Coupon Tracker" },
      { property: "og:description", content: "Company details and the thresholds that drive visit statuses." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: Array<{ key: keyof Thresholds; label: string; hint: string; min: number; max: number }> = [
  {
    key: "high_turnover_days",
    label: "High turnover up to (days)",
    hint: "Businesses that go through their coupons this fast are “high turnover”.",
    min: 1,
    max: 120,
  },
  {
    key: "medium_turnover_days",
    label: "Medium turnover up to (days)",
    hint: "Anything slower than this counts as low turnover.",
    min: 2,
    max: 365,
  },
  {
    key: "visit_soon_percent",
    label: "“Visit soon” at (% used)",
    hint: "Once this share of coupons has come back, the business shows as Visit soon.",
    min: 10,
    max: 100,
  },
  {
    key: "overdue_percent",
    label: "“Due for visit” at (% used)",
    hint: "At this share the business shows as Due for visit.",
    min: 10,
    max: 100,
  },
  {
    key: "stale_visit_days",
    label: "Needs attention after (days without a visit)",
    hint: "Businesses not visited in this long show as Needs attention.",
    min: 7,
    max: 365,
  },
];

function SettingsPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const updateCompany = useUpdateCompany();
  const updateSettings = useUpdateSettings();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    if (!isPending && session && session.role !== "admin") {
      navigate({ to: "/home", replace: true });
    }
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (session?.company) {
      setName(session.company.name);
      setAddress(session.company.address ?? "");
      setPhone(session.company.phone ?? "");
      setEmail(session.company.email ?? "");
      setThresholds(session.settings);
    }
  }, [session?.company, session?.settings]);

  if (isPending) return <SkeletonRows count={4} />;
  if (!session?.company || session.role !== "admin") return null;
  const companyId = session.company.id;

  function saveThresholds() {
    if (thresholds.medium_turnover_days <= thresholds.high_turnover_days) {
      toast.error("Medium turnover days must be higher than high turnover days.");
      return;
    }
    if (thresholds.overdue_percent <= thresholds.visit_soon_percent) {
      toast.error("“Due for visit” must be a higher percentage than “Visit soon”.");
      return;
    }
    updateSettings.mutate(
      { ...thresholds, company_id: companyId },
      {
        onSuccess: () => toast.success("Thresholds saved."),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Company details and how visit statuses are calculated." />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-lg font-semibold">Company profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="company-name">Company name</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company-address">Address</Label>
            <Input id="company-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company-phone">Phone</Label>
            <Input id="company-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company-email">Email</Label>
            <Input id="company-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button
            disabled={updateCompany.isPending || !name.trim()}
            onClick={() =>
              updateCompany.mutate(
                {
                  id: companyId,
                  name: name.trim(),
                  address: address.trim(),
                  phone: phone.trim(),
                  email: email.trim(),
                },
                {
                  onSuccess: () => toast.success("Company details saved."),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            {updateCompany.isPending ? "Saving…" : "Save company"}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-lg font-semibold">Visit and turnover thresholds</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These numbers decide when a business shows as Visit soon, Due for visit or Needs attention.
        </p>
        <div className="mt-4 space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                min={f.min}
                max={f.max}
                value={thresholds[f.key]}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Button disabled={updateSettings.isPending} onClick={saveThresholds}>
              {updateSettings.isPending ? "Saving…" : "Save thresholds"}
            </Button>
            <Button variant="secondary" onClick={() => setThresholds(DEFAULT_THRESHOLDS)}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
