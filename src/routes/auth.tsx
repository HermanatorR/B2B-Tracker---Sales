import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coupon Tracker" },
      { name: "description", content: "Sign in to your company's coupon tracking workspace." },
      { property: "og:title", content: "Sign in — Coupon Tracker" },
      { property: "og:description", content: "Sign in to your company's coupon tracking workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError("Enter your email address.");
    if (mode !== "forgot" && password.length < 8)
      return setError("Passwords need to be at least 8 characters.");
    if (mode === "signup" && !fullName.trim()) return setError("Enter your name.");

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) {
          setError(
            err.message.toLowerCase().includes("invalid")
              ? "That email and password don't match."
              : "We couldn't sign you in. Please try again.",
          );
          return;
        }
        navigate({ to: "/home", replace: true });
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (err) {
          setError(
            err.message.toLowerCase().includes("already")
              ? "There's already an account with that email. Try signing in."
              : "We couldn't create that account. Please try again.",
          );
          return;
        }
        if (data.session) {
          navigate({ to: "/home", replace: true });
        } else {
          setNotice("Check your email to confirm your address, then sign in to set up your company.");
          setMode("signin");
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) {
          setError("We couldn't send that reset email. Please try again.");
          return;
        }
        toast.success("Password reset email sent");
        setNotice("If that email has an account, a reset link is on its way.");
        setMode("signin");
      }
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary">
            <Ticket className="size-4 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="font-semibold">Coupon Tracker</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use the email your administrator set up for you."
              : mode === "signup"
                ? "You'll name your company right after signing in."
                : "We'll email you a link to choose a new password."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Your name</Label>
                <Input id="auth-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {mode !== "forgot" ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{notice}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            {mode === "signin" ? (
              <>
                <button type="button" className="text-muted-foreground underline" onClick={() => setMode("forgot")}>
                  Forgot your password?
                </button>
                <p className="text-muted-foreground">
                  Setting up a new company?{" "}
                  <button type="button" className="font-medium text-foreground underline" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </p>
              </>
            ) : (
              <button type="button" className="text-muted-foreground underline" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
