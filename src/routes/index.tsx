import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, MapPin, Ticket, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coupon Tracker — know where to go next" },
      {
        name: "description",
        content:
          "A simple tool for coupon distribution teams: business database, live map, coupon history and turnover in one place.",
      },
      { property: "og:title", content: "Coupon Tracker — know where to go next" },
      {
        property: "og:description",
        content:
          "A simple tool for coupon distribution teams: business database, live map, coupon history and turnover in one place.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/home", replace: true });
      else setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!checked) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary">
            <Ticket className="size-4 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="font-semibold">Coupon Tracker</span>
        </div>
        <Button asChild variant="secondary">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            For coupon distribution teams
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Replace the spreadsheet. Know exactly where to go next.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            One shared database of the businesses you serve — contacts, coupon history, returns and
            turnover — with a live map so every rep knows which stops need a visit.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth" search={{ mode: "signin" } as never}>
                I already have an account
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Building2,
              title: "Shared contact database",
              body: "Businesses, contacts and notes stay with the company — never in one rep's head.",
            },
            {
              icon: MapPin,
              title: "Live status map",
              body: "Colour-coded pins show which businesses are healthy and which are overdue.",
            },
            {
              icon: TrendingUp,
              title: "Honest turnover",
              body: "Estimates come from real distribution and return history — never invented.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <f.icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
