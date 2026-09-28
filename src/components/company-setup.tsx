import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/data";

/** Shown once, when a signed-in user has no company yet. */
export function CompanySetup() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState(session?.profile?.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!companyName.trim()) return setError("Enter your company name.");
    setBusy(true);
    try {
      const { error: err } = await supabase.rpc("bootstrap_company", {
        _company_name: companyName.trim(),
        _full_name: fullName.trim(),
      });
      if (err) {
        setError("We couldn't create your company. Please try again.");
        return;
      }
      toast.success("Company created");
      await queryClient.invalidateQueries();
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-2xl font-semibold">Set up your company</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You'll be the administrator. Employees you add later join this company automatically.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="space-y-1.5">
          <Label htmlFor="cs-company">Company name</Label>
          <Input id="cs-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-name">Your name</Label>
          <Input id="cs-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create company"}
        </Button>
      </form>
    </div>
  );
}
