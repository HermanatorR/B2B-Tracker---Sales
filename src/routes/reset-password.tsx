import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Coupon Tracker" },
      { name: "description", content: "Set a new password for your Coupon Tracker account." },
      { property: "og:title", content: "Choose a new password — Coupon Tracker" },
      { property: "og:description", content: "Set a new password for your Coupon Tracker account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Passwords need to be at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(
          err.message.toLowerCase().includes("session")
            ? "This reset link has expired. Request a new one from the sign-in page."
            : "We couldn't update your password. Please try again.",
        );
        return;
      }
      toast.success("Password updated");
      navigate({ to: "/home", replace: true });
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-pass">New password</Label>
            <Input id="rp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
