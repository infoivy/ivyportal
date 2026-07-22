import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Keep students.timezone matched to the student's actual browser timezone.
 * Students can't update their own students row under RLS, so the portal
 * calls this on load; it only writes when the zone genuinely changed.
 */
export const syncStudentTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { timezone: string }) => {
    const timezone = String(input?.timezone ?? "").trim();
    if (!timezone || timezone.length > 64 || !/^[A-Za-z_+-]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(timezone)) {
      throw new Error("Invalid timezone");
    }
    return { timezone };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, timezone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student || student.timezone === data.timezone) return { ok: true, updated: false };
    const { error: upErr } = await supabaseAdmin
      .from("students")
      .update({ timezone: data.timezone })
      .eq("id", student.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, updated: true };
  });
