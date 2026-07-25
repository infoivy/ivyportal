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

// Video length via Loom's oEmbed, cached for the process lifetime. If Loom
// is unreachable we fall back to 0 — the gate then only requires the
// explicit mark-done, never bricking a student on a Loom outage.
const durationCache = new Map<string, number>();
async function videoDurationSeconds(shareUrl: string): Promise<number> {
  const hit = durationCache.get(shareUrl);
  if (hit != null) return hit;
  try {
    const res = await fetch(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(shareUrl)}`);
    if (!res.ok) return 0;
    const json = (await res.json()) as { duration?: number };
    const d = Math.max(0, Math.round(json.duration ?? 0));
    durationCache.set(shareUrl, d);
    return d;
  } catch {
    return 0;
  }
}

const pathwayOf = (s: { calls_allotted: number | null; calls_included: number | null }) =>
  ((s.calls_allotted ?? s.calls_included) ?? 0) > 0 ? ("one_on_one" as const) : ("group" as const);

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
 * Mark the walkthrough watched. Server-enforced honesty floor: at least 90%
 * of the video's runtime must have elapsed since it first rendered — an
 * iframe can't report real playback, but a 12-minute video cannot have been
 * "watched in full" 40 seconds after it appeared.
 */
export const completePortalWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, calls_allotted, calls_included, walkthrough_started_at, walkthrough_done_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student) throw new Error("Your account isn't linked to a student profile.");
    if (student.walkthrough_done_at) return { ok: true, already: true };

    const video = WALKTHROUGH_VIDEOS[pathwayOf(student)];
    if (video && student.walkthrough_started_at) {
      const duration = await videoDurationSeconds(video.share);
      const elapsed = (Date.now() - new Date(student.walkthrough_started_at).getTime()) / 1000;
      if (duration > 0 && elapsed < duration * 0.9) {
        const waitMin = Math.ceil((duration * 0.9 - elapsed) / 60);
        throw new Error(`Watch it through first · roughly ${waitMin} more minute${waitMin === 1 ? "" : "s"} of video left.`);
      }
    }

    const { error: upErr } = await supabaseAdmin.from("students")
      .update({ walkthrough_done_at: new Date().toISOString() })
      .eq("id", student.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, already: false };
  });
