import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Post-unlock portal walkthrough videos, per pathway. One video for everyone
 * (founder-decided 2026-07-25); the per-pathway split stays so a group-only
 * recording can slot in later without touching the gate.
 */
const WALKTHROUGH = {
  share: "https://www.loom.com/share/4c9761b6b75449a5aba126dcd6398f24",
  embed: "https://www.loom.com/embed/4c9761b6b75449a5aba126dcd6398f24",
};
export const WALKTHROUGH_VIDEOS: Record<"one_on_one" | "group", { share: string; embed: string } | null> = {
  one_on_one: WALKTHROUGH,
  group: WALKTHROUGH,
};

/** Stamp the moment the walkthrough first renders for this student. */
export const beginPortalWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, walkthrough_started_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!student) return { ok: false };
    if (!student.walkthrough_started_at) {
      await supabaseAdmin.from("students")
        .update({ walkthrough_started_at: new Date().toISOString() })
        .eq("id", student.id);
    }
    return { ok: true };
  });

/**
 * Mark the walkthrough watched. The old 90%-of-runtime dwell floor is GONE
 * (founder 2026-08-01): the Loom embed glitches for some students and the
 * timer punished honest watchers. Their word is enough; started_at stays
 * recorded for context.
 */
export const completePortalWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, walkthrough_done_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student) throw new Error("Your account isn't linked to a student profile.");
    if (student.walkthrough_done_at) return { ok: true, already: true };

    const { error: upErr } = await supabaseAdmin.from("students")
      .update({ walkthrough_done_at: new Date().toISOString() })
      .eq("id", student.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, already: false };
  });
