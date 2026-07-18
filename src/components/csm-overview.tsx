import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Target, Trophy, HeartPulse, AlertTriangle, Video, Users } from "lucide-react";
import { BreakdownBar } from "@/components/ui/breakdown-bar";
import { useStudentHealth } from "@/lib/use-student-health";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip } from "recharts";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const PHASE_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  coaching_1on1: "1-on-1 coaching",
  applying: "Applying",
  offer_won: "Offer won",
  graduated: "Graduated",
};

const SUCCESS_TARGET = 95;

/**
 * Fulfillment at a glance — the department view (Faizan runs this):
 * where every student stands, how far we are from the 95% success target,
 * and how much CSM work is actually happening week to week.
 */
export function CsmOverview() {
  const { data: healthMap } = useStudentHealth();
  const q = useQuery({
    queryKey: ["csm-overview"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 86400000).toISOString();
      const twoWeeksAgo = iso(subDays(new Date(), 13));
      const [studentsRes, tallyRes, callsRes, eodsRes, placementsRes] = await Promise.all([
        supabase.from("students").select("id, phase, status, offer_landed_at, first_win_at"),
        supabase.from("csm_tally").select("kind, created_at").gte("created_at", eightWeeksAgo),
        supabase.from("student_calls").select("id, call_date, status").gte("call_date", iso(subDays(new Date(), 8 * 7))),
        supabase.from("student_eods").select("student_id, report_date").gte("report_date", twoWeeksAgo),
        supabase.from("student_placements").select("stage"),
      ]);
      return {
        students: studentsRes.data ?? [],
        tally: tallyRes.data ?? [],
        calls: callsRes.data ?? [],
        eods: eodsRes.data ?? [],
        placements: placementsRes.data ?? [],
      };
    },
  });

  const d = q.data;

  const stats = useMemo(() => {
    if (!d) return null;
    const total = d.students.length;
    const active = d.students.filter((s: any) => s.status === "active").length;
    const landed = d.students.filter((s: any) => s.offer_landed_at).length;
    const firstWins = d.students.filter((s: any) => s.first_win_at).length;
    const successRate = total > 0 ? Math.round((landed / total) * 100) : 0;

    const phases = new Map<string, number>();
    for (const s of d.students as any[]) phases.set(s.phase, (phases.get(s.phase) ?? 0) + 1);

    // Students with a recent student-EOD = engaged; the rest are the follow-up list
    const recentEod = new Set((d.eods as any[]).map((e) => e.student_id));
    const engaged = (d.students as any[]).filter((s) => s.status === "active" && recentEod.has(s.id)).length;
    const quiet = active - engaged;

    // Weekly activity: tallies + completed calls per ISO week
    const weeks = new Map<string, { calls: number; looms: number; roleplays: number; checkins: number }>();
    for (let i = 7; i >= 0; i--) {
      const wk = iso(subDays(new Date(), i * 7)).slice(0, 10);
      weeks.set(format(subDays(new Date(), i * 7), "MMM d"), { calls: 0, looms: 0, roleplays: 0, checkins: 0 });
    }
    const weekKey = (dateIso: string) => {
      const dt = new Date(dateIso);
      const diffW = Math.floor((Date.now() - dt.getTime()) / (7 * 86400000));
      if (diffW < 0 || diffW > 7) return null;
      return format(subDays(new Date(), diffW * 7), "MMM d");
    };
    for (const t of d.tally as any[]) {
      const k = weekKey(t.created_at);
      if (!k) continue;
      const row = weeks.get(k);
      if (!row) continue;
      if (t.kind === "loom") row.looms += 1;
      else if (t.kind === "roleplay") row.roleplays += 1;
      else row.checkins += 1;
    }
    for (const c of d.calls as any[]) {
      if (c.status !== "completed") continue;
      const k = weekKey(c.call_date);
      const row = k ? weeks.get(k) : null;
      if (row) row.calls += 1;
    }
    const weekly = [...weeks.entries()].reverse().map(([week, v]) => ({ week, ...v })).reverse();

    return { total, active, landed, firstWins, successRate, phases, engaged, quiet, weekly };
  }, [d]);

  if (!stats) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading fulfillment overview…</div>;

  const phaseSegments = [...stats.phases.entries()].map(([phase, count], i) => ({
    label: PHASE_LABEL[phase] ?? phase,
    value: count,
    color: ["#60A5FA", "#A78BFA", "#FBBF24", "#4ADE80", "#22D3EE"][i % 5],
  }));

  return (
    <div className="space-y-4">
      {/* Headline: the number that matters */}
      <div className="card-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Students" value={stats.total} />
          <Stat icon={<HeartPulse className="h-3.5 w-3.5" />} label="Active" value={stats.active} />
          <Stat icon={<Trophy className="h-3.5 w-3.5" />} label="Landed roles" value={stats.landed} />
          <Stat icon={<Target className="h-3.5 w-3.5" />} label="Success rate" value={`${stats.successRate}%`} sub={`target ${SUCCESS_TARGET}%`} tone={stats.successRate >= SUCCESS_TARGET ? "ok" : "warn"} />
          <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Quiet 2 weeks" value={stats.quiet} sub="no student EOD" tone={stats.quiet > 0 ? "warn" : "ok"} />
          <Stat icon={<Video className="h-3.5 w-3.5" />} label="First wins" value={stats.firstWins} />
        </div>
        {/* Progress toward the 95% target */}
        <div className="mt-3 h-2.5 rounded-full bg-muted overflow-hidden relative">
          <div
            className="h-full rounded-full bg-success motion-safe:transition-[width] duration-500 ease-(--ease-out)"
            style={{ width: `${Math.min(100, (stats.successRate / SUCCESS_TARGET) * 100)}%` }}
          />
          <div className="absolute inset-y-0 right-0 w-px bg-foreground/40" title={`${SUCCESS_TARGET}% target`} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {stats.successRate >= SUCCESS_TARGET
            ? "At target — keep every student moving."
            : `${SUCCESS_TARGET}% target · every landed role moves this ${stats.total > 0 ? Math.round(100 / stats.total) : 0} points.`}
        </p>
      </div>

      {/* Health + placement pulse */}
      <div className="card-surface px-5 py-4 flex flex-wrap items-center gap-x-10 gap-y-3">
        {(() => {
          const bands = { green: 0, amber: 0, red: 0 };
          // Locked Start Here students aren't in the coached population yet.
          for (const h of healthMap?.values() ?? []) { if (!h.locked) bands[h.band] += 1; }
          const total = bands.green + bands.amber + bands.red || 1;
          return (
            <>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1.5">Student health</div>
                <div className="flex items-center gap-3 text-[13px] tabular-nums">
                  <span className="text-success-fg font-medium">{bands.green} healthy</span>
                  <span className="text-warning-fg font-medium">{bands.amber} watch</span>
                  <span className="text-danger-fg font-medium">{bands.red} at risk</span>
                </div>
              </div>
              <div className="flex-1 min-w-[160px] h-2 rounded-full overflow-hidden flex">
                <div className="h-full bg-success" style={{ width: `${(bands.green / total) * 100}%` }} />
                <div className="h-full bg-warning" style={{ width: `${(bands.amber / total) * 100}%` }} />
                <div className="h-full bg-danger" style={{ width: `${(bands.red / total) * 100}%` }} />
              </div>
            </>
          );
        })()}
        {(() => {
          const counts = { lead: 0, interviewing: 0, trial: 0, placed: 0 };
          for (const p of (d?.placements ?? []) as { stage: string }[]) {
            if (p.stage in counts) counts[p.stage as keyof typeof counts] += 1;
          }
          return (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Placement funnel</div>
              <div className="flex items-center gap-3 text-[13px] tabular-nums text-muted-foreground">
                <span><span className="text-foreground font-medium">{counts.lead}</span> leads</span>
                <span><span className="text-foreground font-medium">{counts.interviewing}</span> interviewing</span>
                <span><span className="text-foreground font-medium">{counts.trial}</span> trial</span>
                <span><span className="text-success-fg font-medium">{counts.placed}</span> placed</span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Where students stand */}
        <div className="card-surface p-4">
          <div className="text-[13px] font-medium text-foreground mb-1">Where students stand</div>
          <div className="text-[11px] text-muted-foreground mb-3">by phase</div>
          {phaseSegments.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
              No students in the portal yet — add them on the Students page and this fills in.
            </p>
          ) : (
            <BreakdownBar segments={phaseSegments} />
          )}
        </div>

        {/* Fulfillment output per week */}
        <div className="card-surface p-4">
          <div className="text-[13px] font-medium text-foreground mb-1">Fulfillment output</div>
          <div className="text-[11px] text-muted-foreground mb-3">weekly · 1-on-1 calls, looms, roleplays, check-ins</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.weekly} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Bar dataKey="looms" name="Looms" stackId="a" fill="var(--chart-4)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="roleplays" name="Roleplays" stackId="a" fill="var(--chart-3)" />
                <Bar dataKey="checkins" name="Check-ins" stackId="a" fill="var(--chart-6)" radius={[3, 3, 0, 0]} />
                <Line dataKey="calls" name="1-on-1 calls" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className={`text-[22px] font-medium tabular-nums leading-tight ${tone === "warn" ? "text-warning-fg" : tone === "ok" ? "text-success-fg" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
