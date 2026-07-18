import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardRow = {
  rank: number;
  name: string;        // first name + last initial — enough to recognize, not doxx
  apps7: number;
  looms7: number;
  interviews7: number;
  isYou: boolean;
};

/**
 * Student leaderboard: last-7-day activity across ALL active students,
 * aggregated server-side because RLS (correctly) blocks students from
 * reading each other's EODs. Returns only first name + last initial.
 */
export const getStudentLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const [{ data: students }, { data: eods }] = await Promise.all([
      // Locked students can't log EODs — an all-zero "board of 19" where 18
      // can't compete is meaningless. They join at unlock.
      supabaseAdmin.from("students").select("id, full_name, user_id, status")
        .eq("status", "active").not("onboarding_completed_at", "is", null),
      supabaseAdmin.from("student_eods")
        .select("student_id, applications_submitted, looms_sent, interviews")
        .gte("report_date", since),
    ]);

    const byStudent = new Map<string, { apps7: number; looms7: number; interviews7: number }>();
    for (const e of (eods ?? []) as { student_id: string; applications_submitted: number; looms_sent: number | null; interviews: number }[]) {
      const agg = byStudent.get(e.student_id) ?? { apps7: 0, looms7: 0, interviews7: 0 };
      agg.apps7 += e.applications_submitted || 0;
      agg.looms7 += e.looms_sent || 0;
      agg.interviews7 += e.interviews || 0;
      byStudent.set(e.student_id, agg);
    }

    const shortName = (full: string) => {
      const parts = full.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    };

    const rows = ((students ?? []) as { id: string; full_name: string; user_id: string | null }[])
      .map((s) => ({
        name: shortName(s.full_name),
        isYou: s.user_id === context.userId,
        ...(byStudent.get(s.id) ?? { apps7: 0, looms7: 0, interviews7: 0 }),
      }))
      // Score: applications are the goal; looms keep pre-approval students on the board
      .sort((a, b) => (b.apps7 * 3 + b.looms7 + b.interviews7 * 5) - (a.apps7 * 3 + a.looms7 + a.interviews7 * 5))
      .map((r, i) => ({ ...r, rank: i + 1 }) as LeaderboardRow);

    const you = rows.find((r) => r.isYou) ?? null;
    return { rows: rows.slice(0, 15), you, totalStudents: rows.length };
  });
