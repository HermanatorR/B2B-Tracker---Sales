import { useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { geocodeAddress } from "@/lib/admin.functions";
import {
  useAddBusiness,
  useBusinesses,
  useEmployees,
  useSession,
  useUpdateBusiness,
  type BusinessWithMetrics,
} from "@/lib/data";

type FormState = {
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  contact_name: string;
  contact_title: string;
  contact_phone: string;
  contact_email: string;
  notes: string;
  assigned_to: string;
  latitude: string;
  longitude: string;
};

function initial(business?: BusinessWithMetrics, fallbackUser = ""): FormState {
  return {
    name: business?.name ?? "",
    address: business?.address ?? "",
    city: business?.city ?? "",
    province: business?.province ?? "",
    postal_code: business?.postal_code ?? "",
    contact_name: business?.contact_name ?? "",
    contact_title: business?.contact_title ?? "",
    contact_phone: business?.contact_phone ?? "",
    contact_email: business?.contact_email ?? "",
    notes: business?.notes ?? "",
    assigned_to: business?.assigned_to ?? fallbackUser,
    latitude: business?.latitude != null ? String(business.latitude) : "",
    longitude: business?.longitude != null ? String(business.longitude) : "",
  };
}

const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BusinessFormDialog({
  business,
  trigger,
  onSaved,
}: {
  business?: BusinessWithMetrics;
  trigger: ReactNode;
  onSaved?: (id: string) => void;
}) {
  const { data: session } = useSession();
  const { data: employees } = useEmployees();
  const { data: businesses } = useBusinesses();
  const add = useAddBusiness();
  const update = useUpdateBusiness();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initial(business, session?.userId ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const editing = Boolean(business);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function lookupCoordinates() {
    const query = [form.address, form.city, form.province, form.postal_code].filter(Boolean).join(", ");
    if (query.trim().length < 3) {
      setGeoNote("Enter an address first.");
      return;
    }
    setGeoBusy(true);
    setGeoNote(null);
    try {
      const result = await geocodeAddress({ data: { address: query } });
      if (result.found) {
        set("latitude", String(result.latitude));
        set("longitude", String(result.longitude));
        setGeoNote(`Pin placed at ${result.label}`);
      } else {
        setGeoNote("We couldn't find that address. Enter the map coordinates manually if you have them.");
      }
    } catch {
      setGeoNote("Address lookup is unavailable right now. You can enter coordinates manually.");
    } finally {
      setGeoBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Business name is required.");
    if (!form.address.trim()) return setError("Address is required.");
    if (form.contact_phone && !PHONE_RE.test(form.contact_phone))
      return setError("That phone number doesn't look right.");
    if (form.contact_email && !EMAIL_RE.test(form.contact_email))
      return setError("That email address doesn't look right.");

    let lat = form.latitude ? Number(form.latitude) : null;
    let lng = form.longitude ? Number(form.longitude) : null;
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) return setError("Latitude must be between -90 and 90.");
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180))
      return setError("Longitude must be between -180 and 180.");

    // Place the map pin automatically from the address when none is set yet.
    if (lat === null || lng === null) {
      const query = [form.address, form.city, form.province, form.postal_code].filter(Boolean).join(", ");
      setGeoBusy(true);
      try {
        const result = await geocodeAddress({ data: { address: query } });
        if (result.found) {
          lat = result.latitude;
          lng = result.longitude;
          set("latitude", String(result.latitude));
          set("longitude", String(result.longitude));
        }
      } catch {
        // Saving without a pin is fine; the address can be looked up later.
      } finally {
        setGeoBusy(false);
      }
    }

    if (!editing) {
      const duplicate = (businesses ?? []).some(
        (b) =>
          b.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
          b.address.trim().toLowerCase() === form.address.trim().toLowerCase(),
      );
      if (duplicate) return setError("A business with that name and address already exists.");
    }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city || null,
      province: form.province || null,
      postal_code: form.postal_code || null,
      contact_name: form.contact_name || null,
      contact_title: form.contact_title || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
      assigned_to: form.assigned_to || null,
      latitude: lat,
      longitude: lng,
    };

    try {
      if (editing && business) {
        await update.mutateAsync({ id: business.id, ...payload });
        toast.success("Business updated");
        setOpen(false);
        onSaved?.(business.id);
      } else {
        const id = await add.mutateAsync(payload);
        toast.success("Business added");
        setOpen(false);
        setForm(initial(undefined, session?.userId ?? ""));
        onSaved?.(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this business.");
    }
  }

  const pending = add.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setForm(initial(business, session?.userId ?? ""));
          setError(null);
          setGeoNote(null);
        }
      }}
    >
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit business" : "Add business"}</DialogTitle>
            <DialogDescription>
              Only a name and address are required — everything else can be filled in later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field label="Business name" id="bf-name" required>
              <Input id="bf-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Address" id="bf-address" required>
              <Input id="bf-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" id="bf-city">
                <Input id="bf-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Province" id="bf-prov">
                <Input id="bf-prov" value={form.province} onChange={(e) => set("province", e.target.value)} />
              </Field>
            </div>
            <Field label="Postal code" id="bf-postal">
              <Input id="bf-postal" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
            </Field>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Map pin</p>
                <Button type="button" size="sm" variant="secondary" onClick={lookupCoordinates} disabled={geoBusy}>
                  {geoBusy ? "Looking up…" : "Find from address"}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Latitude" id="bf-lat">
                  <Input id="bf-lat" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="52.1332" />
                </Field>
                <Field label="Longitude" id="bf-lng">
                  <Input id="bf-lng" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="-106.6700" />
                </Field>
              </div>
              {geoNote ? <p className="mt-2 text-xs text-muted-foreground">{geoNote}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name" id="bf-cn">
                <Input id="bf-cn" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
              </Field>
              <Field label="Job title" id="bf-ct">
                <Input id="bf-ct" value={form.contact_title} onChange={(e) => set("contact_title", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" id="bf-cp">
                <Input id="bf-cp" type="tel" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
              </Field>
              <Field label="Email" id="bf-ce">
                <Input id="bf-ce" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
              </Field>
            </div>

            <Field label="Assigned representative" id="bf-assign">
              <Select value={form.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
                <SelectTrigger id="bf-assign">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Notes" id="bf-notes">
              <Textarea id="bf-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>

            {error ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "Saving…" : editing ? "Save changes" : "Add business"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
