import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Geocode a free-form address with OpenStreetMap Nominatim (no API key). */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ address: z.string().min(3) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        data.address,
      )}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "b2b-coupon-tracker/1.0", Accept: "application/json" },
      });
      if (!res.ok) return { found: false as const };
      const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      const hit = json[0];
      if (!hit) return { found: false as const };
      return {
        found: true as const,
        latitude: Number(hit.lat),
        longitude: Number(hit.lon),
        label: hit.display_name,
      };
    } catch {
      return { found: false as const };
    }
  });

const employeeInput = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["admin", "sales_rep"]),
  password: z.string().min(8),
});

/** Admin-only: create a login for a new employee inside the caller's company. */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => employeeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!profile?.company_id || !isAdmin) {
      throw new Error("Only company administrators can add employees.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createError || !created.user) {
      const msg = createError?.message ?? "";
      if (msg.toLowerCase().includes("already")) {
        throw new Error("Someone already uses that email address.");
      }
      throw new Error("Could not create this employee account.");
    }

    const newId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newId,
      company_id: profile.company_id,
      full_name: data.full_name,
      email: data.email,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newId);
      throw new Error("Could not set up this employee's profile.");
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newId,
      company_id: profile.company_id,
      role: data.role,
    });
    if (roleError) throw new Error("Employee created, but their role could not be set.");

    return { id: newId };
  });
