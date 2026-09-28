import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, SkeletonRows } from "@/components/ui-bits";
import { createEmployee } from "@/lib/admin.functions";
import { formatDateTime, percent } from "@/lib/coupon";
import { useEmployees, useSession, useSetEmployeeRole, useUpdateProfile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({
    meta: [
      { title: "Employees — Coupon Tracker" },
      { name: "description", content: "Add reps, set roles and see each person's coupon activity." },
      { property: "og:title", content: "Employees — Coupon Tracker" },
      { property: "og:description", content: "Add reps, set roles and see each person's coupon activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const navigate = useNavigate();
  const { data: employees, isPending } = useEmployees();
  const setRole = useSetEmployeeRole();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (!sessionPending && session && session.role !== "admin") {
      navigate({ to: "/home", replace: true });
    }
  }, [sessionPending, session, navigate]);

  if (sessionPending) return <SkeletonRows count={4} />;
  if (session?.role !== "admin") return null;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Everyone who can record coupons for your company."
        actions={<AddEmployeeDialog />}
      />

      {isPending ? (
        <SkeletonRows count={4} />
      ) : !employees || employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet." description="Add your first sales rep." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Company employees and their activity</caption>
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Businesses visited</th>
                <th className="px-4 py-3 font-medium">Distributed</th>
                <th className="px-4 py-3 font-medium">Returned</th>
                <th className="px-4 py-3 font-medium">Return rate</th>
                <th className="px-4 py-3 font-medium">Avg turnover</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((e) => (
                <tr key={e.id} className={e.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <Link
                      to="/employees/$employeeId"
                      params={{ employeeId: e.id }}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {e.full_name || e.email}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {e.id === session.userId ? (
                      <span className="text-muted-foreground">Admin (you)</span>
                    ) : (
                      <Select
                        value={e.role ?? "sales_rep"}
                        onValueChange={(value) =>
                          setRole.mutate(
                            { userId: e.id, role: value as "admin" | "sales_rep" },
                            {
                              onSuccess: () => toast.success("Role updated."),
                              onError: (err) => toast.error(err.message),
                            },
                          )
                        }
                      >
                        <SelectTrigger className="w-[9.5rem]" aria-label={`Role for ${e.full_name || e.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_rep">Sales rep</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.businessCount}</td>
                  <td className="px-4 py-3 tabular-nums">{e.distributed}</td>
                  <td className="px-4 py-3 tabular-nums">{e.returned}</td>
                  <td className="px-4 py-3 tabular-nums">{percent(e.returnRate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{turnoverText(averageTurnover(businesses ?? [], e.visitedBusinessIds))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(e.lastActivity)}</td>
                  <td className="px-4 py-3">
                    {e.id === session.userId ? (
                      <span className="text-xs text-muted-foreground">Active</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={e.is_active ? "secondary" : "default"}
                        onClick={() =>
                          updateProfile.mutate(
                            { id: e.id, is_active: !e.is_active },
                            {
                              onSuccess: () =>
                                toast.success(e.is_active ? "Employee disabled." : "Employee reactivated."),
                              onError: (err) => toast.error(err.message),
                            },
                          )
                        }
                      >
                        {e.is_active ? "Disable" : "Reactivate"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function AddEmployeeDialog() {
  const add = useServerFn(createEmployee);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "sales_rep">("sales_rep");
  const [password, setPassword] = useState(randomPassword);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!fullName.trim()) {
      toast.error("Enter the employee's name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("The temporary password needs at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await add({ data: { full_name: fullName.trim(), email: email.trim(), role, password } });
      toast.success(`${fullName.trim()} can now sign in. Share the temporary password with them.`);
      setOpen(false);
      setFullName("");
      setEmail("");
      setRole("sales_rep");
      setPassword(randomPassword());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" /> Add employee
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            They'll sign in with this email and temporary password, then can change it in their profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="emp-name">Full name</Label>
            <Input id="emp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "sales_rep")}>
              <SelectTrigger id="emp-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales_rep">Sales rep</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="emp-password">Temporary password</Label>
            <div className="flex gap-2">
              <Input id="emp-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="secondary" onClick={() => setPassword(randomPassword())}>
                New
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Adding…" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
