import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { invalidateForTables } from "@/lib/query-keys";
import { todayLocal } from "@/lib/dates";
import { SelectField } from "@/components/ui/select-field";
import {
  KPI, kpiTargetsFor, outreachOf, didHitKpi, didHitCsmKpi, dayStatus, owesEods, type SetterType, type EodKpiRow,
} from "@/lib/eod-kpi";
import { useKpiRules } from "@/lib/use-kpi-rules";

/**
 * The founder's per-member week view, rebuilt for the Performance workspace
 * (it was lost in the command-center rebuild): a Today ops strip, then one
 * card per team member with seven colored day chips (green = KPI hit,
 * amber = submitted but missed, red = missing) and role-specific weekly
 * footers. KPI rules live in src/lib/eod-kpi.ts, shared with Home.
 */

type EOD = EodKpiRow & {
  id: string;
  user_id: string;
  calls_taken?: number | null;
  closes?: number | null;
  cash_collected?: number | null;
  looms_reviewed?: number | null;
  wins?: string | null;
  blockers?: string | null;
};

type RosterEntry = {
  user_id: string;
  display_name: string;
  primary_role: string;
  setter_type: SetterType;
  csm_target: number | null;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtLong = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`; };
const ROLE_LABEL: Record<string, string> = { setter: "Setter", closer: "Closer", coach: "Coach", csm: "CSM", admin: "Admin" };

export function TeamWeekSection() {
  const { roles } = useAuth();
  const kpiRules = useKpiRules();
  const qc = useQueryClient();
  const canEditSetterType = roles.includes("admin");
  const today = todayLocal();

  const q = useQuery({
    queryKey: ["page", "performance", "team-week"],
    staleTime: 60_000,
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 6);
      const fromIso = new Intl.DateTimeFormat("en-CA").format(from);
      const [eodsRes, profsRes, rolesRes] = await Promise.all([
        supabase
          .from("eods")
          .select("id, user_id, report_date, dials, leads_contacted, dms_sent, calls_booked, calls_taken, closes, cash_collected, student_checkins, looms_reviewed, wins, blockers")
          .eq("is_demo", false)
          .gte("report_date", fromIso),
        supabase.from("profiles").select("id, display_name, setter_type, csm_daily_target, active, eod_exempt" as never).eq("is_demo", false),
        supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer", "coach", "csm", "founder", "cofounder"]),
      ]);
      const roleMap = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach(r => {
        const arr = roleMap.get(r.user_id) ?? []; arr.push(r.role); roleMap.set(r.user_id, arr);
      });
      const priority = ["csm", "closer", "coach", "setter"];
      const profs = (profsRes.data ?? []) as unknown as { id: string; display_name: string | null; setter_type: SetterType; csm_daily_target: number | null; active: boolean | null; eod_exempt: boolean | null }[];
      const roster: RosterEntry[] = profs
        .filter(p => owesEods({ roles: roleMap.get(p.id) ?? [], active: p.active, eod_exempt: p.eod_exempt }))
        .map(p => {
          const rs = roleMap.get(p.id)!;
          const primary = priority.find(x => rs.includes(x)) ?? rs[0];
          return {
            user_id: p.id,
            display_name: p.display_name ?? "Unnamed",
            primary_role: primary,
            setter_type: primary === "setter" ? (p.setter_type ?? null) : null,
            csm_target: p.csm_daily_target ?? null,
          };
        });
      return { eods: (eodsRes.data ?? []) as EOD[], roster };
    },
  });

  const weekDays = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return new Intl.DateTimeFormat("en-CA").format(d);
    });
  }, []);

  const byUserDate = useMemo(() => {
    const m = new Map<string, EOD>();
    (q.data?.eods ?? []).forEach(e => m.set(`${e.user_id}::${e.report_date}`, e));
    return m;
  }, [q.data]);

  const roster = useMemo(() => q.data?.roster ?? [], [q.data]);

  const cards = useMemo(() => {
    const list = roster.map(r => {
      const st = r.setter_type;
      const csmTarget = r.primary_role === "csm" ? (r.csm_target ?? 10) : null;
      const todayEod = byUserDate.get(`${r.user_id}::${today}`);
      const week = weekDays.map(d => {
        const e = byUserDate.get(`${r.user_id}::${d}`);
        return { d, status: !e ? ("red" as const) : dayStatus(e, st, csmTarget, kpiRules), e };
      });
      const status: "green" | "amber" | "red" = !todayEod
        ? "red"
        : dayStatus(todayEod, st, csmTarget, kpiRules) === "green" ? "green" : "amber";
      let todayLine = "No EOD submitted yet today";
      if (todayEod) {
        if (r.primary_role === "setter" && st) {
          const cfg = KPI[st];
          const t = kpiTargetsFor(st, today, kpiRules);
          const primary = st === "dm" ? outreachOf(todayEod) : (todayEod.dials ?? 0);
          todayLine = didHitKpi(todayEod, st, kpiRules)
            ? `Submitted · hit KPI (${primary} ${cfg.primary.label.toLowerCase()}, ${todayEod.calls_booked ?? 0} sets)`
            : `Submitted · missed KPI (${primary} of ${t.primaryTarget} ${cfg.primary.label.toLowerCase()}, ${todayEod.calls_booked ?? 0} of ${t.sets} sets)`;
        } else if (r.primary_role === "closer" || r.primary_role === "coach") {
          todayLine = `Submitted · ${todayEod.calls_taken ?? 0} calls, ${todayEod.closes ?? 0} closes, $${Math.round(Number(todayEod.cash_collected ?? 0)).toLocaleString()} cash`;
        } else if (r.primary_role === "csm") {
          const t = csmTarget ?? 10;
          todayLine = didHitCsmKpi(todayEod, t)
            ? `Submitted · hit KPI (${todayEod.student_checkins ?? 0} of ${t} check-ins, ${todayEod.looms_reviewed ?? 0} looms)`
            : `Submitted · missed KPI (${todayEod.student_checkins ?? 0} of ${t} check-ins, ${todayEod.looms_reviewed ?? 0} looms)`;
        } else todayLine = "Submitted";
      }
      let weeklyLabel = ""; let weeklyValue: string | number = "";
      if (r.primary_role === "setter") {
        weeklyLabel = "Sets this week";
        weeklyValue = week.reduce((a, x) => a + (x.e?.calls_booked ?? 0), 0);
      } else if (r.primary_role === "closer" || r.primary_role === "coach") {
        weeklyLabel = "Cash this week";
        weeklyValue = `$${Math.round(week.reduce((a, x) => a + Number(x.e?.cash_collected ?? 0), 0)).toLocaleString()}`;
      } else if (r.primary_role === "csm") {
        weeklyLabel = "Check-ins this week";
        weeklyValue = week.reduce((a, x) => a + (x.e?.student_checkins ?? 0), 0);
      }
      return { r, status, todayLine, week, weeklyLabel, weeklyValue };
    });
    const order = { red: 0, amber: 1, green: 2 } as const;
    return list.sort((a, b) => order[a.status] - order[b.status] || a.r.display_name.localeCompare(b.r.display_name));
  }, [roster, byUserDate, weekDays, today, kpiRules]);

  // Today ops strip (ported from the old Sales activity page)
  const setters = useMemo(() => roster.filter(r => r.primary_role === "setter"), [roster]);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat("en-CA").format(d);
  }, []);
  const filedToday = setters.filter(s => byUserDate.has(`${s.user_id}::${today}`));
  const missedYesterday = setters.filter(s => !byUserDate.has(`${s.user_id}::${yesterday}`));
  // Archive a trapped wrong-date report so the member can resubmit without
  // losing the original operational record.
  const unlockEod = async (eodId: string, name: string, day: string) => {
    const reason = prompt(`Why is ${day} being unlocked for ${name}?`, "Wrong report date");
    if (!reason?.trim()) return;
    const { error } = await (supabase.rpc as any)("archive_and_unlock_eod", {
      p_record_type: "staff",
      p_source_id: eodId,
      p_reason: reason.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Archived and unlocked · they can resubmit now");
    invalidateForTables(qc, ["eods"]);
    void qc.invalidateQueries({ queryKey: ["page", "performance", "team-week"] });
  };
  const updateSetterType = async (id: string, type: "phone" | "dm" | "full_cycle") => {
    const { error } = await (supabase.from("profiles") as never as { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update({ setter_type: type }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Setter type updated");
    invalidateForTables(qc, ["profiles"]);
    void qc.invalidateQueries({ queryKey: ["page", "performance", "team-week"] });
  };

  if (q.isPending) {
    return <div className="rounded-lg border border-border bg-card p-6 text-body text-muted-foreground">Loading team week…</div>;
  }

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="team-week-title">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">This week</p>
        <h2 id="team-week-title" className="mt-1 text-title font-semibold text-foreground">Team week</h2>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Today ops strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-background p-3 text-center">
            <div className="text-metric tabular-nums">{setters.length}</div>
            <div className="text-micro text-muted-foreground mt-0.5">Active setters</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-center">
            <div className="text-metric tabular-nums">{filedToday.length}<span className="text-muted-foreground text-body">/{setters.length}</span></div>
            <div className="text-micro text-muted-foreground mt-0.5">Filed today</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-center">
            <div className={`text-metric tabular-nums ${missedYesterday.length > 0 ? "text-danger-fg" : ""}`}>{missedYesterday.length}</div>
            <div className="text-micro text-muted-foreground mt-0.5">Missed yesterday</div>
          </div>
        </div>

        {missedYesterday.length > 0 && (
          <div className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5 text-body">
            <span className="text-caption font-semibold text-warning-fg">Missed yesterday</span>
            <span className="text-foreground ml-2">{missedYesterday.map(s => s.display_name).join(" · ")}</span>
          </div>
        )}

        {/* Member cards */}
        <div className="grid md:grid-cols-2 gap-3">
          {cards.map(c => (
            <MemberWeekCard
              key={c.r.user_id}
              card={c}
              onSetterType={canEditSetterType && c.r.primary_role === "setter" ? (t) => void updateSetterType(c.r.user_id, t) : undefined}
              onUnlock={canEditSetterType ? (eodId, day) => void unlockEod(eodId, c.r.display_name, day) : undefined}
            />
          ))}
          {cards.length === 0 && (
            <div className="text-body text-muted-foreground p-4">No team members yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function MemberWeekCard({ card, onSetterType, onUnlock }: { card: {
  r: RosterEntry; status: "green" | "amber" | "red"; todayLine: string;
  week: { d: string; status: "green" | "amber" | "red"; e: EOD | undefined }[];
  weeklyLabel: string; weeklyValue: string | number;
}; onSetterType?: (t: "phone" | "dm" | "full_cycle") => void; onUnlock?: (eodId: string, day: string) => void }) {
  const [open, setOpen] = useState(false);
  const dotColor = card.status === "green" ? "bg-success" : card.status === "amber" ? "bg-warning" : "bg-danger";
  const roleLabel = card.r.setter_type === "phone" ? "Phone Setter" : card.r.setter_type === "dm" ? "DM Setter" : card.r.setter_type === "full_cycle" ? "Full Cycle Setter" : ROLE_LABEL[card.r.primary_role] ?? card.r.primary_role;
  return (
    <div className="border border-border bg-background rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body font-semibold text-foreground">{card.r.display_name}</div>
          <div className="text-micro text-muted-foreground">{roleLabel}</div>
        </div>
        <span className="flex items-center gap-2">
          {onSetterType && (
            <SelectField
              value={card.r.setter_type ?? ""}
              onChange={(v) => { if (v) onSetterType(v as "phone" | "dm" | "full_cycle"); }}
              options={[{ value: "phone", label: "Phone" }, { value: "dm", label: "DM" }, { value: "full_cycle", label: "Full cycle" }]}
              allowEmpty
              emptyLabel="Type…"
              placeholder="Type…"
              className="h-7 text-caption"
            />
          )}
          <button onClick={() => setOpen(o => !o)} className="text-micro text-muted-foreground hover:text-foreground flex items-center gap-1">
            {open ? "Hide" : "Detail"}{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="text-body">{card.todayLine}</span>
      </div>
      <div>
        <div className="text-caption text-muted-foreground mb-1.5">This week</div>
        <div className="flex gap-1.5">
          {card.week.map(w => {
            const dt = new Date(w.d + "T00:00:00");
            const bg = w.status === "green" ? "bg-success-bg border-success/25" : w.status === "amber" ? "bg-warning-bg border-warning/25" : "bg-danger-bg border-danger/25";
            return (
              <div key={w.d} className={`flex-1 border rounded-md px-1 py-1 text-center ${bg}`} title={fmtLong(w.d)}>
                <div className="text-[9px] text-muted-foreground">{WEEKDAY[dt.getDay()]}</div>
                <div className="text-[10px] tabular-nums">{dt.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>
      {card.weeklyLabel && (
        <div className="text-body"><span className="text-muted-foreground">{card.weeklyLabel}:</span> <span className="font-semibold ml-1">{card.weeklyValue}</span></div>
      )}
      {open && (
        <div className="border-t border-border pt-3 space-y-2 text-caption">
          {card.week.map(w => (
            <div key={w.d} className="flex items-start gap-2">
              <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${w.status === "green" ? "bg-success" : w.status === "amber" ? "bg-warning" : "bg-danger"}`} />
              <div className="flex-1">
                <div className="text-muted-foreground">{fmtLong(w.d)}</div>
                {w.e ? (
                  <div>
                    {card.r.primary_role === "setter" && (
                      <span>{(card.r.setter_type === "dm" ? outreachOf(w.e) : w.e.dials ?? 0)} {card.r.setter_type === "dm" ? "DMs" : "dials"}, {w.e.calls_booked ?? 0} sets</span>
                    )}
                    {(card.r.primary_role === "closer" || card.r.primary_role === "coach") && (
                      <span>{w.e.calls_taken ?? 0} calls, {w.e.closes ?? 0} closes, ${Math.round(Number(w.e.cash_collected ?? 0)).toLocaleString()}</span>
                    )}
                    {card.r.primary_role === "csm" && (
                      <span>{w.e.student_checkins ?? 0} check-ins, {w.e.looms_reviewed ?? 0} looms</span>
                    )}
                    {w.status === "amber" && <span className="text-warning-fg"> · missed KPI</span>}
                    {w.e.wins && <div className="text-muted-foreground mt-0.5"><span className="text-success-fg">Wins:</span> {w.e.wins}</div>}
                    {w.e.blockers && <div className="text-muted-foreground"><span className="text-warning-fg">Blockers:</span> {w.e.blockers}</div>}
                    {onUnlock && (
                      <button
                        onClick={() => onUnlock(w.e!.id, fmtLong(w.d))}
                        className="mt-1 inline-flex items-center gap-1 text-micro text-muted-foreground hover:text-danger-fg"
                      >
                        <LockOpen className="h-3 w-3" /> Archive and unlock for resubmission
                      </button>
                    )}
                  </div>
                ) : <div className="text-danger-fg">No EOD</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
