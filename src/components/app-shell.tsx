import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Mail,
  Map as MapIcon,
  Menu,
  Settings,
  Ticket,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync, useSession } from "@/lib/data";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon };

const REP_NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/businesses", label: "Businesses", icon: Building2 },
  { to: "/prepare", label: "Prepare", icon: Mail },
  { to: "/activity", label: "My Activity", icon: Activity },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/home", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/businesses", label: "Businesses", icon: Building2 },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

export function useNav() {
  const { data: session } = useSession();
  const isAdmin = session?.role === "admin";
  return { items: isAdmin ? ADMIN_NAV : REP_NAV, isAdmin };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { items } = useNav();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  useRealtimeSync();

  const primary = items.slice(0, 4);
  const overflow = items.slice(4);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const companyName = session?.company?.name ?? "Coupon Tracker";

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          {session?.company?.logo_url ? (
            <img
              src={session.company.logo_url}
              alt={`${companyName} logo`}
              className="size-8 rounded-md object-cover"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-md bg-primary">
              <Ticket className="size-4 text-primary-foreground" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-sm font-semibold">{companyName}</span>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
          {items.map((item) => (
            <SideLink key={item.to} item={item} active={pathname.startsWith(item.to)} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate px-2 pb-2 text-xs text-muted-foreground">
            {session?.profile?.full_name || session?.email}
            <br />
            <span className="capitalize">{session?.role === "admin" ? "Administrator" : "Sales rep"}</span>
          </p>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary">
            <Ticket className="size-3.5 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold">{companyName}</span>
        </div>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-2 space-y-1 px-2" aria-label="More navigation">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-border px-2 pt-4">
              <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="page-pad pb-24 md:ml-60 md:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden"
        aria-label="Primary navigation"
      >
        {primary.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  active ? "bg-primary" : "",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <span className={active ? "text-foreground" : undefined}>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
        >
          <span className="flex size-8 items-center justify-center rounded-lg">
            <Menu className="size-4" aria-hidden="true" />
          </span>
          More
          <span className="sr-only">
            {overflow.map((o) => o.label).join(", ")}
          </span>
        </button>
      </nav>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <item.icon className="size-4" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
