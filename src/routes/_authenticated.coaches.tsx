import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { studentsQuery, coachesQuery } from "@/lib/queries";
import { Users, Phone, Star, AlertTriangle, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coaches")({
  head: () => ({ meta: [{ title: "Coach Capacity — ISA" }] }),
  component: CoachesPage,
});

type Student = { id: string; full_name: string; coach_id: string | null; status: string; calls_allotted: number; phase: string };
type CallRow = { student_id: string; coach_id: string | null; status: string; call_date: string; progress_rating: number | null };

function CoachesPage() {
  // Only coaches (not admins) for this roster view — filter from the shared coach roster.
  const { data: allCoachProfiles = [] } = useQuery(coachesQuery());
  const [coachIds, setCoachIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "coach");
      setCoachIds(new Set((data ?? []).map((r: any) => r.user_id)));
    })();
  }, []);
  const coaches = useMemo(() => allCoachProfiles.filter(c => coachIds.has(c.id)), [allCoachProfiles, coachIds]);

  const { data: students = [] } = useQuery(studentsQuery()) as { data: Student[] };

  const { data: calls = [] } = useQuery({
    queryKey: ["student_calls", "coaches_view"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_calls").select("student_id, coach_id, status, call_date, progress_rating").limit(5000);
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
    staleTime: 60_000,
  });


  const today = Date.now();
  const dayMs = 86400000;

  const rows = useMemo(() => coaches.map(c => {
    const roster = students.filter(s => s.coach_id === c.id);
    const active = roster.filter(s => s.status === "active");
    const totalAllotted = roster.reduce((n, s) => n + (s.calls_allotted ?? 0), 0);
    const completed = calls.filter(x => x.coach_id === c.id && x.status === "completed").length;
    const remaining = Math.max(0, totalAllotted - completed);
    const ratings = calls.filter(x => x.coach_id === c.id && x.progress_rating != null).map(x => x.progress_rating!) as number[];
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
    const lastCallByStudent = new Map<string, string>();
    calls.filter(x => x.coach_id === c.id && x.status === "completed").forEach(x => {
      const prev = lastCallByStudent.get(x.student_id);
      if (!prev || prev < x.call_date) lastCallByStudent.set(x.student_id, x.call_date);
    });
    const stale = active.filter(s => {
      if (s.phase !== "coaching_1on1") return false;
      const last = lastCallByStudent.get(s.id);
      if (!last) return true;
      return (today - new Date(last).getTime()) / dayMs > 14;
    });
    return { coach: c, roster, active, totalAllotted, completed, remaining, avgRating, ratings, stale };
  }).sort((a, b) => b.active.length - a.active.length), [coaches, students, calls]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-sky-400 mb-1">
            <Users className="h-3 w-3" /> Coach capacity
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Coaches</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use when assigning new students. Lower load + high rating = green light.
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">{coaches.length} coaches</div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ coach, roster, active, totalAllotted, completed, remaining, avgRating, ratings, stale }) => (
          <div key={coach.id} className="border border-[var(--border)] bg-[var(--card)] rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm shrink-0">
                  {(coach.display_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{coach.display_name ?? "Unnamed"}</div>
                  <div className="text-[10px] text-muted-foreground">{active.length} active · {roster.length} on roster</div>
                </div>
              </div>
              {stale.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded-sm">
                  <AlertTriangle className="h-2.5 w-2.5" /> {stale.length} stale
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Active" value={active.length} sub={`${roster.length} roster`} icon={<Phone className="h-3 w-3" />} tone={active.length > 15 ? "amber" : "emerald"} />
              <Stat label="Avg rating" value={avgRating ? avgRating.toFixed(1) : "—"} sub={`${ratings.length} rated`} icon={<Star className="h-3 w-3" />} tone="amber" />
              <Stat label="1:1s done" value={completed} sub="completed" icon={<Trophy className="h-3 w-3" />} tone="sky" />
            </div>

            {stale.length > 0 && (
              <div className="border-t border-[var(--border)] pt-2">
                <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">&gt;14 days since 1:1</div>
                <div className="flex flex-wrap gap-1">
                  {stale.slice(0, 6).map(s => (
                    <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="text-[10px] px-1.5 py-0.5 rounded-sm border border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10">
                      {s.full_name}
                    </Link>
                  ))}
                  {stale.length > 6 && <span className="text-[10px] text-muted-foreground">+{stale.length - 6}</span>}
                </div>
              </div>
            )}
          </div>
        ))}
        {coaches.length === 0 && (
          <div className="border border-dashed border-[var(--border)] rounded-md p-8 text-center text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
            No coaches yet. Grant the coach role from /team.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon, tone }: { label: string; value: number | string; sub?: string; icon: React.ReactNode; tone: "emerald" | "amber" | "rose" | "sky" }) {
  const colors = { emerald: "text-green-400", amber: "text-amber-400", rose: "text-red-400", sky: "text-sky-400" }[tone];
  return (
    <div className="border border-[var(--border)] bg-[var(--background)] rounded-sm p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{icon}{label}</div>
      <div className={`text-lg font-mono font-semibold ${colors}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
