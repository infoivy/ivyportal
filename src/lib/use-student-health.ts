import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeStudentHealth, type StudentHealth } from "@/lib/student-health";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type HealthMap = Map<string, StudentHealth>;

/**
 * One fetch, health for every student — shared by the students list, the CSM
 * queue, the overview distribution, and the detail hero.
 */
export function useStudentHealth() {
  return useQuery({
    queryKey: ["student-health"],
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<HealthMap> => {
      const sixty = iso(new Date(Date.now() - 59 * 86400000));
      const fourteen = iso(new Date(Date.now() - 13 * 86400000));
      const [students, eods, items, calls, placements] = await Promise.all([
        supabase.from("students").select("id, status, phase, payment_state, eod_exempt"),
        supabase.from("student_eods").select("student_id, report_date, roleplays, looms_sent").gte("report_date", sixty),
        supabase.from("student_action_items").select("student_id, due_date, done").eq("done", false),
        supabase.from("student_calls").select("student_id, call_date, status").eq("status", "completed").gte("call_date", sixty),
        supabase.from("student_placements").select("student_id, stage, updated_at, interview_at"),
      ]);

      const today = iso(new Date());
      const map: HealthMap = new Map();

      const eodsBy = new Map<string, { report_date: string; roleplays: number | null; looms_sent: number | null }[]>();
      for (const e of (eods.data ?? []) as any[]) {
        const arr = eodsBy.get(e.student_id) ?? [];
        arr.push(e);
        eodsBy.set(e.student_id, arr);
      }
      const itemsBy = new Map<string, { overdue: number; open: number }>();
      for (const it of (items.data ?? []) as any[]) {
        if (!it.student_id) continue;
        const row = itemsBy.get(it.student_id) ?? { overdue: 0, open: 0 };
        row.open += 1;
        if (it.due_date && it.due_date < today) row.overdue += 1;
        itemsBy.set(it.student_id, row);
      }
      const lastCallBy = new Map<string, string>();
      for (const c of (calls.data ?? []) as any[]) {
        const prev = lastCallBy.get(c.student_id);
        if (!prev || c.call_date > prev) lastCallBy.set(c.student_id, c.call_date);
      }
      const placementsBy = new Map<string, { stage: string; updated_at: string; interview_at: string | null }[]>();
      for (const p of (placements.data ?? []) as any[]) {
        const arr = placementsBy.get(p.student_id) ?? [];
        arr.push(p);
        placementsBy.set(p.student_id, arr);
      }

      for (const s of (students.data ?? []) as any[]) {
        const es = eodsBy.get(s.id) ?? [];
        const recent14 = es.filter((e) => e.report_date >= fourteen);
        const pls = placementsBy.get(s.id) ?? [];
        const itemRow = itemsBy.get(s.id) ?? { overdue: 0, open: 0 };
        map.set(s.id, computeStudentHealth({
          status: s.status,
          phase: s.phase,
          paymentState: s.payment_state,
          eodDates: es.map((e) => e.report_date),
          roleplays14: recent14.reduce((a, e) => a + (e.roleplays ?? 0), 0),
          looms14: recent14.reduce((a, e) => a + (e.looms_sent ?? 0), 0),
          overdueItems: itemRow.overdue,
          openItems: itemRow.open,
          lastCallDate: lastCallBy.get(s.id) ?? null,
          placementStages: pls.map((p) => p.stage),
          placementActivity14: pls.some((p) => p.updated_at >= fourteen),
          interviewUpcoming: pls.some((p) => p.interview_at && p.interview_at > new Date().toISOString()),
          eodExempt: !!s.eod_exempt,
        }));
      }
      return map;
    },
  });
}
