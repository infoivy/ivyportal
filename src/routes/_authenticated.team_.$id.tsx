import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCloseCallStats } from "@/lib/close-crm.functions";
import { getMochiDashboard } from "@/lib/mochi.functions";
import { computeStreak } from "@/lib/streak";
import { signAvatars } from "@/lib/avatars";
import { format, subDays } from "date-fns";
import { ArrowLeft, Flame, GraduationCap, PhoneCall, Sparkles, Target } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/team_/$id")({
  head: () => ({ meta: [{ title: "Team member · ISA Portal" }] }),
  component: MemberPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

type EodRow = {
  report_date: string; dials: number; leads_contacted: number; dms_sent: number;
  convos_started: number; calls_booked: number; shows: number; no_shows: number;
};

const outreach = (e: EodRow) => Math.max(e.dms_sent ?? 0, e.leads_contacted ?? 0);

const KPI_TARGETS: Record<string, { primary: (e: EodRow) => number; target: number; label: string; sets: number }> = {
  phone: { primary: (e) => e.dials ?? 0, target: 100, label: "dials", sets: 3 },
  dm: { primary: outreach, target: 125, label: "DMs", sets: 3 },
  full_cycle: { primary: (e) => e.dials ?? 0, target: 100, label: "dials", sets: 3 },
};

function MemberPage() {
  const { id } = Route.useParams();
  const { user, roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("founder") || user?.id === id;
  const isLeadership = roles.includes("admin") || roles.includes("founder");

  const q = useQuery({
    queryKey: ["member", id],
    enabled: canView,
    staleTime: 60_000,
    queryFn: async () => {
      const sixtyAgo = iso(subDays(new Date(), 59));
      const [profileRes, rolesRes, eodsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_path, setter_type, active, phone").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase.from("eods_activity").select("report_date, dials, leads_contacted, dms_sent, convos_started, calls_booked, shows, no_shows").eq("user_id", id).gte("report_date", sixtyAgo).order("report_date"),
      ]);
      const avatarPath = (profileRes.data as any)?.avatar_path ?? null;
      const avatars = avatarPath ? await signAvatars([avatarPath]) : {};
      return {
        profile: profileRes.data as { id: string; display_name: string | null; setter_type: string | null; active: boolean | null; phone: string | null } | null,
        memberRoles: (rolesRes.data ?? []).map((r: { role: string }) => r.role),
        eods: (eodsRes.data ?? []) as EodRow[],
        avatarUrl: avatarPath ? (avatars as Record<string, string>)[avatarPath] ?? null : null,
      };
    },
  });

  const closeQ = useQuery({
    queryKey: ["close-call-stats", 30],
    queryFn: () => getCloseCallStats({ data: { days: 30 } }),
    staleTime: 5 * 60_000,
    enabled: canView,
    retry: 1,
  });
  const mochiQ = useQuery({
    queryKey: ["mochi-dashboard", "last_7_days"],
    queryFn: () => getMochiDashboard({ data: { period: "last_7_days" } }),
    staleTime: 5 * 60_000,
    enabled: isLeadership,
    retry: 1,
  });

  const d = q.data;
  const name = d?.profile?.display_name ?? "Team member";
  const isCoach = (d?.memberRoles ?? []).includes("coach");

  // Coach capacity — was its own Coaches tab; lives on the profile now.
  const coachQ = useQuery({
    queryKey: ["member", id, "coaching"],
    enabled: canView && isCoach,
    staleTime: 60_000,
    queryFn: async () => {
      const [students, calls] = await Promise.all([
        supabase.from("students").select("id, status, phase").eq("coach_id", id),
        supabase.from("student_calls").select("student_id, status, call_date, progress_rating").eq("coach_id", id).limit(5000),
      ]);
      const roster = (students.data ?? []) as { id: string; status: string; phase: string }[];
      const rows = (calls.data ?? []) as { student_id: string; status: string; call_date: string; progress_rating: number | null }[];
      const completed = rows.filter((c) => c.status === "completed");
      const ratings = completed.filter((c) => c.progress_rating != null).map((c) => c.progress_rating!);
      const lastByStudent = new Map<string, string>();
      for (const c of completed) {
        const prev = lastByStudent.get(c.student_id);
        if (!prev || prev < c.call_date) lastByStudent.set(c.student_id, c.call_date);
      }
      const now = Date.now();
      const stale = roster.filter((st) => {
        if (st.status !== "active" || st.phase !== "coaching_1on1") return false;
        const last = lastByStudent.get(st.id);
        return !last || (now - new Date(last).getTime()) / 86400000 > 14;
      }).length;
      return {
        active: roster.filter((st) => st.status === "active").length,
        roster: roster.length,
        done: completed.length,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        rated: ratings.length,
        stale,
      };
    },
  });

  const analysis = useMemo(() => {
    if (!d) return null;
    const eods = d.eods;
    const today = new Date();
    const last14 = eods.filter((e) => e.report_date >= iso(subDays(today, 13)));
    const last7 = eods.filter((e) => e.report_date >= iso(subDays(today, 6)));
    const prev7 = eods.filter((e) => e.report_date >= iso(subDays(today, 13)) && e.report_date < iso(subDays(today, 6)));

    const sum = (rows: EodRow[], f: (e: EodRow) => number) => rows.reduce((a, e) => a + f(e), 0);
    const totals7 = {
      dials: sum(last7, (e) => e.dials ?? 0),
      dms: sum(last7, outreach),
      sets: sum(last7, (e) => e.calls_booked ?? 0),
      shows: sum(last7, (e) => e.shows ?? 0),
    };
    const prevVolume = sum(prev7, (e) => (e.dials ?? 0) + outreach(e));
    const thisVolume = totals7.dials + totals7.dms;
    const trendPct = prevVolume > 0 ? Math.round(((thisVolume - prevVolume) / prevVolume) * 100) : null;

    const streak = computeStreak(eods.map((e) => e.report_date));
    const submissionRate = Math.round((last14.length / 14) * 100);

    const st = d.profile?.setter_type ?? null;
    const kpiCfg = st ? KPI_TARGETS[st] : null;
    const kpiHits = kpiCfg
      ? last14.filter((e) => kpiCfg.primary(e) >= kpiCfg.target && (e.calls_booked ?? 0) >= kpiCfg.sets).length
      : null;
    const kpiRate = kpiHits != null && last14.length > 0 ? Math.round((kpiHits / last14.length) * 100) : null;

    // Hunger: consistency (40) + KPI quality (35) + momentum (25)
    let hunger = Math.round(
      (submissionRate / 100) * 40 +
      ((kpiRate ?? 50) / 100) * 35 +
      (trendPct == null ? 12 : Math.max(0, Math.min(25, 12 + trendPct / 8))),
    );
    hunger = Math.max(0, Math.min(100, hunger));

    const suggestions: string[] = [];
    if (submissionRate < 80) suggestions.push(`Submitted ${last14.length} of the last 14 EODs · consistency is the first conversation to have.`);
    if (kpiRate != null && kpiRate < 50 && kpiCfg) suggestions.push(`Hitting KPI ${kpiRate}% of days · drill the daily ${kpiCfg.target} ${kpiCfg.label} + ${kpiCfg.sets} sets in the next roleplay.`);
    if (trendPct != null && trendPct < -20) suggestions.push(`Volume is down ${Math.abs(trendPct)}% vs last week · check in before it becomes a pattern.`);
    if (trendPct != null && trendPct > 20) suggestions.push(`Volume is up ${trendPct}% week over week · recognize it publicly in Team Chat.`);
    if (totals7.sets > 0 && totals7.shows === 0) suggestions.push("Sets are booking but nothing is showing · review confirmation flow (72h window, reminders).");
    if (streak >= 7) suggestions.push(`${streak}-day streak · protect it; streaks are the habit engine.`);
    if (suggestions.length === 0) suggestions.push("Steady across the board. Raise targets slightly to keep the edge.");

    const daily = [...Array(30)].map((_, i) => {
      const day = iso(subDays(today, 29 - i));
      const e = eods.find((x) => x.report_date === day);
      return {
        day: format(subDays(today, 29 - i), "d MMM"),
        dials: e?.dials ?? 0,
        dms: e ? outreach(e) : 0,
        sets: e?.calls_booked ?? 0,
      };
    });

    return { totals7, trendPct, streak, submissionRate, kpiRate, hunger, suggestions, daily, kpiCfg };
  }, [d]);

  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center text-sm text-muted-foreground card-surface mt-8">
        You can only view your own performance page.
      </div>
    );
  }

  const closeRep = closeQ.data?.perUser.find((u) => u.name.toLowerCase() === name.toLowerCase());
  const mochiRep = mochiQ.data?.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
  const hungerTone = (analysis?.hunger ?? 0) >= 70 ? "text-success-fg" : (analysis?.hunger ?? 0) >= 40 ? "text-warning-fg" : "text-danger-fg";

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-5">
      <Link to="/team" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Team
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-semibold shrink-0">
          {d?.avatarUrl ? <img src={d.avatarUrl} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-display text-foreground truncate">{name}</h1>
          <p className="text-body text-muted-foreground">
            {(d?.memberRoles ?? []).join(" · ") || "no role"}
            {d?.profile?.setter_type && <> · {d.profile.setter_type.replace("_", " ")} setter</>}
          </p>
        </div>
        {analysis && (
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1.5 justify-end text-[11px] text-muted-foreground"><Flame className="h-3.5 w-3.5" /> Hunger</div>
            <div className={`text-[28px] font-medium tabular-nums leading-tight ${hungerTone}`}>{analysis.hunger}</div>
          </div>
        )}
      </header>

      {/* 7-day numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Dials · 7d" value={analysis?.totals7.dials} />
        <Stat label="DMs · 7d" value={analysis?.totals7.dms} />
        <Stat label="Sets · 7d" value={analysis?.totals7.sets} />
        <Stat label="Shows · 7d" value={analysis?.totals7.shows} />
        <Stat label="EOD streak" value={analysis?.streak ?? 0} suffix="d" />
        <Stat label="KPI hit · 14d" value={analysis?.kpiRate ?? undefined} suffix="%" placeholder="–" />
      </div>

      {/* Signals */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Signals
          <span className="text-[11px] text-muted-foreground font-normal">
            from EODs, streaks & momentum{analysis?.trendPct != null && <> · volume {analysis.trendPct >= 0 ? "+" : ""}{analysis.trendPct}% WoW</>}
          </span>
        </div>
        <ul className="space-y-1.5">
          {(analysis?.suggestions ?? []).map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
              <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" /> {s}
            </li>
          ))}
        </ul>
      </div>

      {/* CRM ground truth */}
      {(closeRep || mochiRep) && (
        <div className="card-surface px-4 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" /> CRM ground truth
            <span className="text-[11px] text-muted-foreground font-normal">Close 30d · Mochi 7d</span>
          </div>
          {closeRep && <Stat inline label="Dials (Close)" value={closeRep.dials} />}
          {closeRep && <Stat inline label="Answered" value={closeRep.answered} />}
          {mochiRep && <Stat inline label="DMs out (Mochi)" value={mochiRep.outbound} />}
        </div>
      )}

      {/* Coach capacity — roster load + 1:1 quality (coach role only) */}
      {isCoach && coachQ.data && (
        <div className="card-surface px-4 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" /> Coaching
            <span className="text-[11px] text-muted-foreground font-normal">roster load · lower + high rating = green light</span>
          </div>
          <Stat inline label="Active students" value={coachQ.data.active} />
          <Stat inline label="On roster" value={coachQ.data.roster} />
          <Stat inline label="1:1s done" value={coachQ.data.done} />
          <div>
            <div className="text-[11px] text-muted-foreground">Avg rating</div>
            <div className="text-[18px] font-medium tabular-nums text-foreground leading-tight">
              {coachQ.data.avgRating != null ? coachQ.data.avgRating.toFixed(1) : "–"}
              <span className="text-[11px] text-muted-foreground font-normal"> · {coachQ.data.rated} rated</span>
            </div>
          </div>
          {coachQ.data.stale > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground">No 1:1 in 14d</div>
              <div className="text-[18px] font-medium tabular-nums text-warning-fg leading-tight">{coachQ.data.stale}</div>
            </div>
          )}
        </div>
      )}

      {/* 30-day trend */}
      <div className="card-surface p-4">
        <div className="text-[13px] font-medium text-foreground mb-1">Output</div>
        <div className="text-[11px] text-muted-foreground mb-3">daily · last 30 days · from EODs</div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={analysis?.daily ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Area dataKey="dials" name="Dials" fill="var(--chart-1)" fillOpacity={0.25} stroke="var(--chart-1)" strokeWidth={1.5} />
              <Area dataKey="dms" name="DMs" fill="var(--chart-4)" fillOpacity={0.2} stroke="var(--chart-4)" strokeWidth={1.5} />
              <Line dataKey="sets" name="Sets" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, placeholder, inline }: { label: string; value?: number; suffix?: string; placeholder?: string; inline?: boolean }) {
  const body = (
    <>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`${inline ? "text-[18px]" : "text-[22px]"} font-medium tabular-nums text-foreground leading-tight`}>
        {value != null ? `${value.toLocaleString()}${suffix ?? ""}` : placeholder ?? "…"}
      </div>
    </>
  );
  return inline ? <div>{body}</div> : <div className="card-surface px-4 py-3">{body}</div>;
}
