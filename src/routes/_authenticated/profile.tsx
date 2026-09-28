import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SkeletonRows } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useUpdateProfile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Coupon Tracker" },
      { name: "description", content: "Your name, contact details and password." },
      { property: "og:title", content: "Profile — Coupon Tracker" },
      { property: "og:description", content: "Your name, contact details and password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: session, isPending } = useSession();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (session?.profile) {
      setFullName(session.profile.full_name);
      setPhone(session.profile.phone ?? "");
    }
  }, [session?.profile]);

  if (isPending) return <SkeletonRows count={3} />;
  if (!session) return null;

  async function changePassword() {
    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    } as { password: string; current_password: string });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message || "Could not change your password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password updated.");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" subtitle="Your details and sign-in password." />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-lg font-semibold">Your details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session.email} readOnly disabled />
            <p className="mt-1 text-xs text-muted-foreground">
              Email is used to sign in and can't be changed here.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{session.role === "admin" ? "Admin" : "Sales rep"}</span>
          </div>
          {session.company ? (
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium">{session.company.name}</span>
            </div>
          ) : null}
          <Button
            disabled={update.isPending || !fullName.trim()}
            onClick={() =>
              update.mutate(
                { id: session.userId, full_name: fullName.trim(), phone: phone.trim() },
                {
                  onSuccess: () => toast.success("Profile saved."),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button variant="secondary" disabled={savingPassword} onClick={changePassword}>
            {savingPassword ? "Updating…" : "Update password"}
          </Button>
        </div>
      </section>
    </div>
  );
}
