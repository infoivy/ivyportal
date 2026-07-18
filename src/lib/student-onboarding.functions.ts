import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { START_HERE_REQUIRED_KEYS } from "@/lib/student-guide-steps";

/**
 * Called by the student portal when the last Start Here step is ticked.
 * Students can't write students.phase or team_chat under RLS, so the
 * privileged side effects run here after re-verifying the checklist
 * server-side: stamp onboarding_completed_at, advance the phase, drop the
 * automatic "book your 1:1s" action item (1:1 pathway only), and tell the
 * fulfillment team in team chat.
 */
export const completeStudentOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, phase, onboarding_completed_at, calls_allotted, calls_included")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (studentErr) throw new Error(studentErr.message);
    if (!student) throw new Error("Your account isn't linked to a student profile.");
    if (student.onboarding_completed_at) return { ok: true, already: true, phase: student.phase };

    const { data: steps, error: stepsErr } = await supabaseAdmin
      .from("student_guide_steps")
      .select("step_key")
      .eq("student_id", student.id);
    if (stepsErr) throw new Error(stepsErr.message);
    const done = new Set((steps ?? []).map((s) => s.step_key));
    const missing = START_HERE_REQUIRED_KEYS.filter((k) => !done.has(k));
    if (missing.length > 0) throw new Error("Finish every Start Here step first.");

    const oneOnOne = (student.calls_allotted ?? student.calls_included ?? 0) > 0;
    // Only advance students still at the start; never regress a staff-set phase.
    const phase = ["uncategorized", "onboarding"].includes(student.phase) ? "coaching_1on1" : student.phase;

    const { error: updateErr } = await supabaseAdmin
      .from("students")
      .update({ onboarding_completed_at: new Date().toISOString(), phase })
      .eq("id", student.id);
    if (updateErr) throw new Error(updateErr.message);

    if (oneOnOne) {
      const allotted = student.calls_allotted ?? student.calls_included;
      // Idempotent: the auto task appears once even if completion re-runs.
      const { data: existing } = await supabaseAdmin
        .from("student_action_items")
        .select("id")
        .eq("student_id", student.id)
        .ilike("text", "Book your 1:1 coaching calls%")
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabaseAdmin.from("student_action_items").insert({
          student_id: student.id,
          created_by: context.userId,
          text: `Book your 1:1 coaching calls. You have ${allotted} with your coach. Book the first one now, don't sit on them.`,
        });
      }
    }

    // Best-effort: the unlock must not fail because the announcement did.
    const pathway = oneOnOne ? "1:1 Pathway" : "Group Expertise Pathway";
    await supabaseAdmin.from("team_chat").insert({
      body: `🎓 ${student.full_name} completed Start Here onboarding (${pathway}). Portal unlocked, now in ${phase === "coaching_1on1" ? "coaching" : phase.replace("_", " ")}.`,
      kind: "general",
      created_by: context.userId,
      student_id: student.id,
    });

    return { ok: true, already: false, phase };
  });
