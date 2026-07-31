import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { invalidateForTables } from "@/lib/query-keys";

type CheckinRow = { student_id: string; csm_id: string | null; checked_at: string };
type StudentRow = { id: string; full_name: string; phase: string; status: string };

const COVERED_PHASES = ["onboarding", "training", "coaching_1on1", "applying"];

/**
 * Who has been checked in on and who is going cold (founder 2026-07-29):
 * every active student sorted coldest-first, one tap to log a check-in, so
 * two CSMs never hit the same student while another sits 3 days quiet.
 * Capacity math: combined CSM daily targets vs roster size.
 */
export function CheckinCoverage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const canLog = roles.some(r => ["admin", "coach", "csm"].includes(r));
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["page", "csm", "checkin-coverage"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const [studentsRes, checkinsRes, csmsRes, profilesRes] = await Promise.all([
        supabase.from("students").select("id, full_name, phase, status").eq("is_demo", false).is("archived_at" as never, null).eq("status", "active"),
        (supabase.from("student_checkins" as never).select("student_id, csm_id, checked_at").gte("checked_at", since) as unknown as Promise<{ data: CheckinRow[] | null; error: { message: string } | null }>),
        supabase.from("user_roles").select("user_id").eq("role", "csm"),
        supabase.from("profiles").select("id, display_name, csm_daily_target, active, eod_exempt" as never).eq("is_demo", false),
      ]);
      if (checkinsRes.error) throw new Error(checkinsRes.error.message);
      const profiles = (profilesRes.data ?? []) as unknown as { id: string; display_name: string | null; csm_daily_target: number | null; active: boolean | null }[];
      const profMap = new Map(profiles.map(p => [p.id, p]));
      const csmIds = ((csmsRes.data ?? []) as { user_id: string }[]).map(r => r.user_id).filter(id => profMap.get(id)?.active !== false);
      const capacity = csmIds.reduce((s, id) => s + Math.max(1, Number(profMap.get(id)?.csm_daily_target) || 10), 0);
      return {
        students: ((studentsRes.data ?? []) as StudentRow[]).filter(s => COVERED_PHASES.includes(s.phase)),
        checkins: checkinsRes.data ?? [],
        names: new Map(profiles.map(p => [p.id, p.display_name ?? "Unnamed"])),
        capacity,
      };
    },
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const lastBy = new Map<string, CheckinRow>();
    for (const c of q.data.checkins) {
      const cur = lastBy.get(c.student_id);
      if (!cur || c.checked_at > cur.checked_at) lastBy.set(c.student_id, c);
    }
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return q.data.students
      .map(s => {
        const last = lastBy.get(s.id) ?? null;
        const ageDays = last ? Math.floor((Date.now() - new Date(last.checked_at).getTime()) / 86400000) : null;
        const today = last != null && new Date(last.checked_at) >= startOfToday;
        return { s, last, ageDays, today };
      })
      .sort((a, b) => {
        if (a.today !== b.today) return a.today ? 1 : -1; // done today sinks
        const av = a.last ? new Date(a.last.checked_at).getTime() : 0;
        const bv = b.last ? new Date(b.last.checked_at).getTime() : 0;
        return av - bv; // never / coldest first
      });
  }, [q.data]);

  const coveredToday = rows.filter(r => r.today).length;
  const due = rows.filter(r => !r.today && (r.ageDays === null || r.ageDays >= 2)).length;
  const cycleDays = q.data && q.data.capacity > 0 ? Math.ceil(rows.length / q.data.capacity) : null;

  const checkIn = async (studentId: string, name: string) => {
    if (!user) return;
    setBusy(studentId);
    const { error } = await (supabase.from("student_checkins" as never) as unknown as { insert: (v: object) => Promise<{ error: { message: string } | null }> })
      .insert({ student_id: studentId, csm_id: user.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Checked in with ${name}`);
    invalidateForTables(qc, ["student_checkins"]);
    void qc.invalidateQueries({ queryKey: ["page", "csm", "checkin-coverage"] });
  };

  return (
    <section className="card-surface overflow-hidden">
      <header className="px-4 py-3 sm:px-5 border-b border-border flex flex-wrap items-center gap-x-3 gap-y-1">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Check-in coverage</h2>
        <span className="text-xs text-muted-foreground">
          {coveredToday} of {rows.length} today
          {due > 0 && <> · <span className="text-warning-fg font-medium">{due} due (2d+ or never)</span></>}
          {cycleDays != null && <> · full roster every ~{cycleDays} {cycleDays === 1 ? "day" : "days"} at current targets</>}
        </span>
      </header>
      <div className="divide-y divide-border">
        {q.isLoading && <div className="p-5 text-xs text-muted-foreground">Loading coverage…</div>}
        {q.isError && <div className="p-5 text-xs text-danger-fg">Could not load: {q.error instanceof Error ? q.error.message : "unknown"}</div>}
        {rows.map(({ s, last, ageDays, today }) => {
          const tone = today ? "text-success-fg" : ageDays === null || ageDays >= 3 ? "text-danger-fg" : ageDays >= 2 ? "text-warning-fg" : "text-muted-foreground";
          const label = today
            ? `today${last?.csm_id ? ` · ${q.data?.names.get(last.csm_id) ?? ""}` : ""}`
            : last
              ? `${formatDistanceToNowStrict(new Date(last.checked_at))} ago${last.csm_id ? ` · ${q.data?.names.get(last.csm_id) ?? ""}` : ""}`
              : "never checked in";
          return (
            <div key={s.id} className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body font-medium text-foreground min-w-0 truncate">{s.full_name}</span>
              <span className="text-micro text-muted-foreground capitalize">{s.phase.replace("_", " ")}</span>
              <span className={`text-caption ${tone}`}>{label}</span>
              <div className="ml-auto">
                {today ? (
                  <span className="inline-flex items-center gap-1 text-caption text-success-fg"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>
                ) : canLog ? (
                  <button
                    onClick={() => void checkIn(s.id, s.full_name)}
                    disabled={busy === s.id}
                    className="text-caption font-medium px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring/50 motion-safe:transition-colors disabled:opacity-50"
                  >
                    {busy === s.id ? "Logging…" : "Check in"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {!q.isLoading && rows.length === 0 && <div className="p-5 text-xs text-muted-foreground">No active students in coached phases.</div>}
      </div>
    </section>
  );
}
