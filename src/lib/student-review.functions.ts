import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REVIEW_TAG = "graduation-review";

/**
 * The casual "few words from you" ask on the graduation page. Written by the
 * student, stored as a normal testimonials row (type text) so it lands in the
 * team's existing Testimonials pipeline — separate from the Trustpilot ask.
 * One row per student; re-submitting updates their words.
 */
export const submitGraduationReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { text: string }) => {
    const text = String(input?.text ?? "").trim();
    if (text.length < 10) throw new Error("A sentence or two is plenty, but give us at least a few words.");
    if (text.length > 2000) throw new Error("Keep it under 2000 characters.");
    return { text };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student) throw new Error("Your account isn't linked to a student profile.");

    const { data: existing } = await supabaseAdmin
      .from("testimonials")
      .select("id")
      .eq("student_id", student.id)
      .contains("tags", [REVIEW_TAG])
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabaseAdmin
        .from("testimonials")
        .update({ content_text: data.text })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await supabaseAdmin.from("testimonials").insert({
        student_id: student.id,
        type: "text",
        status: "received",
        title: `${student.full_name.split(" ")[0]} · graduation review`,
        content_text: data.text,
        tags: [REVIEW_TAG],
        collected_by: context.userId,
        collected_at: new Date().toISOString().slice(0, 10),
      });
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

/** The student's own graduation review, for hydrating the form. */
export const getMyGraduationReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!student) return { text: null };
    const { data: row } = await supabaseAdmin
      .from("testimonials")
      .select("content_text")
      .eq("student_id", student.id)
      .contains("tags", [REVIEW_TAG])
      .maybeSingle();
    return { text: row?.content_text ?? null };
  });

const ROLE_TITLES: Record<string, string> = {
  closing: "Closer",
  dm_setting: "DM Setter",
  phone_setting: "Phone Setter",
};

/**
 * Student self-reports landing their first offer (founder-directed
 * 2026-07-25): company, role type, OTE. Creates a placed placement — the
 * existing sync trigger stamps offer_landed_at — and tells the team so a
 * CSM can verify and move them to Offer Won.
 */
export const reportOfferLanded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { company: string; roleType: string; ote: string }) => {
    const company = String(input?.company ?? "").trim();
    const roleType = String(input?.roleType ?? "");
    const ote = String(input?.ote ?? "").trim();
    if (company.length < 2 || company.length > 80) throw new Error("Company name looks off.");
    if (!(roleType in ROLE_TITLES)) throw new Error("Pick the role type.");
    if (ote.length < 1 || ote.length > 120) throw new Error("Add the OTE (rough is fine).");
    return { company, roleType, ote };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, first_win_at, offer_landed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student) throw new Error("Your account isn't linked to a student profile.");
    if (student.offer_landed_at) return { ok: true, already: true };

    const roleTitle = ROLE_TITLES[data.roleType];
    const { error: plErr } = await supabaseAdmin.from("student_placements").insert({
      student_id: student.id,
      business_name: data.company,
      role_title: roleTitle,
      source: "student",
      stage: "placed",
      pay_notes: `OTE: ${data.ote}`,
      notes: "Self-reported by the student from their portal · verify and move phase to Offer Won",
    });
    if (plErr) throw new Error(plErr.message);

    // The placement trigger stamps offer_landed_at; first_win_at rides along.
    await supabaseAdmin.from("students")
      .update({ first_win_at: student.first_win_at ?? new Date().toISOString().slice(0, 10) })
      .eq("id", student.id);

    await supabaseAdmin.from("team_chat").insert({
      body: `🎉 ${student.full_name} says they LANDED THEIR FIRST OFFER: ${roleTitle} at ${data.company} (OTE: ${data.ote}). Verify it and move them to Offer Won.`,
      kind: "general",
      created_by: context.userId,
      student_id: student.id,
    });

    return { ok: true, already: false };
  });
