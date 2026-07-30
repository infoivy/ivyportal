import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, subDays } from "date-fns";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SelectField } from "@/components/ui/select-field";
import { money } from "@/lib/revenue";

/**
 * The setter tracker, mirrored 1:1 from the founder's Google Sheet
 * (2026-07-30): the Daily Setter Log (fill-in cells), the KPI dashboard with
 * benchmark bands, and the auto-generated weekly trends. Each setter sees
 * and edits ONLY their own tracker; leadership picks any setter (RLS
 * enforces both sides).
 */

type LogRow = {
  id?: string;
  user_id: string;
  log_date: string;
  inbounds: number; outbounds_sent: number; ib_replies: number; ob_replies: number;
  follow_ups_sent: number; calls_proposed: number; calendly_sent: number;
  calls_booked_inbound: number; calls_booked_outbound: number;
  qualified_bookings: number; unqualified_bookings: number;
  calls_on_calendar: number; calls_showed: number; sets_closed: number;
  cash_collected: number; notes: string | null;
};

const NUM_COLS: { key: keyof LogRow; label: string }[] = [
  { key: "inbounds", label: "Inbounds" },
  { key: "outbounds_sent", label: "Outbounds sent" },
  { key: "ib_replies", label: "IB replies" },
  { key: "ob_replies", label: "OB replies" },
  { key: "follow_ups_sent", label: "Follow-ups" },
  { key: "calls_proposed", label: "Calls proposed" },
  { key: "calendly_sent", label: "Calendly sent" },
  { key: "calls_booked_inbound", label: "Booked · IB" },
  { key: "calls_booked_outbound", label: "Booked · OB" },
  { key: "qualified_bookings", label: "Qualified" },
  { key: "unqualified_bookings", label: "Unqualified" },
  { key: "calls_on_calendar", label: "On calendar" },
  { key: "calls_showed", label: "Showed" },
  { key: "sets_closed", label: "Sets closed" },
  { key: "cash_collected", label: "Cash ($)" },
];

// Benchmark bands from the founder's sheet: [poor<, average<, good<] → elite.
const BENCHMARKS: { key: string; label: string; bands: [number, number, number]; poorNote: string }[] = [
  { key: "proposedToCalendly", label: "Calls proposed → Calendly sent", bands: [40, 60, 80], poorNote: "Openers are too generic, too salesy, or targeting wrong people. Tighten qualification before sending calendly links." },
  { key: "calendlyToBooked", label: "Calendly sent → Calls booked", bands: [30, 60, 70], poorNote: "Prospect wasn't properly qualified or offer clarity is missing. Improve qualification and positioning." },
  { key: "showRate", label: "Show rate", bands: [60, 75, 85], poorNote: "Pre-call nurture is missing. Add pre-call confirmation, prep videos, and better qualifying." },
  { key: "closeRate", label: "Close rate", bands: [15, 25, 40], poorNote: "Leads aren't sales-ready or handoff context is thin. Qualify harder and brief the closer." },
  { key: "qualificationRate", label: "Qualification rate", bands: [40, 60, 80], poorNote: "Too many unqualified bookings. Qualify before the calendly link, not on the call." },
];

const bandOf = (pct: number | null, bands: [number, number, number]) =>
  pct == null ? null : pct < bands[0] ? "Poor" : pct < bands[1] ? "Average" : pct < bands[2] ? "Good" : "Elite";
const BAND_CLS: Record<string, string> = {
  Poor: "text-danger-fg border-danger/25 bg-danger-bg",
  Average: "text-warning-fg border-warning/25 bg-warning-bg",
  Good: "text-foreground border-border bg-muted",
  Elite: "text-success-fg border-success/25 bg-success-bg",
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function SetterDailyTracker() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isLeader = roles.some(r => ["admin", "founder", "cofounder"].includes(r));
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [view, setView] = useState<"log" | "kpis" | "weekly">("log");
  const [rangeDays, setRangeDays] = useState(7);
  const targetId = (isLeader ? subjectId : null) ?? user?.id ?? "";

  const settersQ = useQuery({
    queryKey: ["tracker", "setters"],
    enabled: isLeader,
    queryFn: async () => {
      const [rolesRes, profRes] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "setter"),
        supabase.from("profiles").select("id, display_name, active").eq("is_demo", false),
      ]);
      const setterIds = new Set(((rolesRes.data ?? []) as { user_id: string }[]).map(r => r.user_id));
      return ((profRes.data ?? []) as { id: string; display_name: string | null; active: boolean | null }[])
        .filter(p => setterIds.has(p.id) && p.active !== false)
        .map(p => ({ id: p.id, name: p.display_name ?? "Unnamed" }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const logsQ = useQuery({
    queryKey: ["tracker", "logs", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("setter_daily_logs" as never)
        .select("*").eq("user_id", targetId)
        .gte("log_date", iso(subDays(new Date(), 45)))
        .order("log_date", { ascending: false }) as unknown as Promise<{ data: LogRow[] | null; error: { message: string } | null }>);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const byDate = useMemo(() => new Map((logsQ.data ?? []).map(r => [r.log_date, r])), [logsQ.data]);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => iso(subDays(new Date(), i))), []);
  const canEdit = targetId === user?.id || isLeader;

  const saveCell = async (date: string, patch: Partial<LogRow>) => {
    const existing = byDate.get(date);
    const payload = { user_id: targetId, log_date: date, ...patch };
    const { error } = existing?.id
      ? await (supabase.from("setter_daily_logs" as never) as never as { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update(patch).eq("id", existing.id)
      : await (supabase.from("setter_daily_logs" as never) as never as { upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }> }).upsert(payload, { onConflict: "user_id,log_date" });
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["tracker", "logs", targetId] });
  };

  // KPI math over the selected range — same formulas as the sheet.
  const kpis = useMemo(() => {
    const from = iso(subDays(new Date(), rangeDays - 1));
    const rows = (logsQ.data ?? []).filter(r => r.log_date >= from);
    const sum = (k: keyof LogRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const booked = sum("calls_booked_inbound") + sum("calls_booked_outbound");
    const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);
    return {
      totals: {
        inbounds: sum("inbounds"), outbounds: sum("outbounds_sent"),
        ibReplies: sum("ib_replies"), obReplies: sum("ob_replies"),
        followUps: sum("follow_ups_sent"), proposed: sum("calls_proposed"),
        calendly: sum("calendly_sent"), booked,
        qualified: sum("qualified_bookings"), unqualified: sum("unqualified_bookings"),
        showed: sum("calls_showed"), closed: sum("sets_closed"), cash: sum("cash_collected"),
      },
      rates: {
        proposedToCalendly: pct(sum("calendly_sent"), sum("calls_proposed")),
        calendlyToBooked: pct(booked, sum("calendly_sent")),
        showRate: pct(sum("calls_showed"), booked),
        closeRate: pct(sum("sets_closed"), sum("calls_showed")),
        qualificationRate: pct(sum("qualified_bookings"), sum("qualified_bookings") + sum("unqualified_bookings")),
      } as Record<string, number | null>,
    };
  }, [logsQ.data, rangeDays]);

  const weekly = useMemo(() => {
    const groups = new Map<string, LogRow[]>();
    for (const r of logsQ.data ?? []) {
      const wk = iso(startOfWeek(new Date(r.log_date + "T12:00:00"), { weekStartsOn: 1 }));
      groups.set(wk, [...(groups.get(wk) ?? []), r]);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([wk, rows]) => {
      const sum = (k: keyof LogRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
      return {
        week: wk,
        outbounds: sum("outbounds_sent"), inbounds: sum("inbounds"),
        ibReplies: sum("ib_replies"), obReplies: sum("ob_replies"),
        proposed: sum("calls_proposed"),
        booked: sum("calls_booked_inbound") + sum("calls_booked_outbound"),
        showed: sum("calls_showed"), closed: sum("sets_closed"), cash: sum("cash_collected"),
      };
    });
  }, [logsQ.data]);

  const subjectName = isLeader
    ? settersQ.data?.find(s => s.id === targetId)?.name ?? (targetId === user?.id ? "My tracker" : "")
    : "My tracker";

  return (
    <section className="card-surface overflow-hidden">
      <header className="px-4 py-3 sm:px-5 border-b border-border flex flex-wrap items-center gap-x-3 gap-y-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Setter tracker</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Daily log, KPIs against benchmarks, weekly trends · fill the blue row daily.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isLeader && (
            <SelectField
              value={targetId}
              onChange={v => setSubjectId(v || null)}
              options={[
                ...(user ? [{ value: user.id, label: "Me" }] : []),
                ...(settersQ.data ?? []).filter(s => s.id !== user?.id).map(s => ({ value: s.id, label: s.name })),
              ]}
              className="w-auto text-xs"
            />
          )}
          <div className="inline-flex rounded-lg bg-muted p-[3px]">
            {([["log", "Daily log"], ["kpis", "KPIs"], ["weekly", "Weekly"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} className={`text-caption font-medium px-2.5 py-1 rounded-[7px] motion-safe:transition-colors ${view === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === "log" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-caption">
            <thead>
              <tr className="text-left text-micro uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="sticky left-0 bg-card py-2 pl-4 pr-2 font-medium">Date</th>
                {NUM_COLS.map(c => <th key={c.key as string} className="px-1.5 py-2 font-medium whitespace-nowrap">{c.label}</th>)}
                <th className="px-2 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => {
                const row = byDate.get(d);
                const isToday = d === iso(new Date());
                return (
                  <tr key={d} className={`border-b border-border/50 ${isToday ? "bg-primary/5" : ""}`}>
                    <td className="sticky left-0 bg-card py-1 pl-4 pr-2 tabular-nums whitespace-nowrap text-muted-foreground">
                      {format(new Date(d + "T12:00:00"), "EEE d MMM")}
                    </td>
                    {NUM_COLS.map(c => (
                      <td key={c.key as string} className="px-0.5 py-1">
                        <input
                          type="number"
                          min={0}
                          defaultValue={row ? Number(row[c.key]) || 0 : 0}
                          disabled={!canEdit}
                          onBlur={e => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            if ((row ? Number(row[c.key]) || 0 : 0) !== v) void saveCell(d, { [c.key]: v } as Partial<LogRow>);
                          }}
                          className="h-8 w-[74px] rounded border border-border/60 bg-background px-1.5 text-right tabular-nums focus:outline-none focus:border-ring disabled:opacity-50"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        defaultValue={row?.notes ?? ""}
                        disabled={!canEdit}
                        onBlur={e => { if ((row?.notes ?? "") !== e.target.value) void saveCell(d, { notes: e.target.value || null }); }}
                        className="h-8 w-[180px] rounded border border-border/60 bg-background px-2 focus:outline-none focus:border-ring disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "kpis" && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            {[7, 14, 30].map(n => (
              <button key={n} onClick={() => setRangeDays(n)} className={`text-caption font-medium px-2.5 py-1 rounded-md motion-safe:transition-colors ${rangeDays === n ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {n}d
              </button>
            ))}
            <span className="text-micro text-muted-foreground">{subjectName}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-4">
            {([["Outbounds", kpis.totals.outbounds], ["Inbounds", kpis.totals.inbounds], ["Proposed", kpis.totals.proposed], ["Calendly", kpis.totals.calendly], ["Booked", kpis.totals.booked], ["Showed", kpis.totals.showed], ["Closed", kpis.totals.closed], ["Qualified", kpis.totals.qualified], ["Follow-ups", kpis.totals.followUps]] as const).map(([label, v]) => (
              <div key={label}>
                <div className="text-micro text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-body font-semibold tabular-nums">{v.toLocaleString()}</div>
              </div>
            ))}
            <div>
              <div className="text-micro text-muted-foreground">Cash</div>
              <div className="mt-0.5 text-body font-semibold tabular-nums">{money(kpis.totals.cash)}</div>
            </div>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {BENCHMARKS.map(b => {
              const pct = kpis.rates[b.key];
              const band = bandOf(pct, b.bands);
              return (
                <div key={b.key} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-body min-w-[220px]">{b.label}</span>
                  <span className="text-body font-semibold tabular-nums">{pct == null ? "–" : `${pct}%`}</span>
                  {band && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${BAND_CLS[band]}`}>{band}</span>}
                  <span className="text-micro text-muted-foreground">bands {b.bands[0]} · {b.bands[1]} · {b.bands[2]}%</span>
                  {band === "Poor" && <span className="basis-full text-micro text-warning-fg">{b.poorNote}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "weekly" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-caption">
            <thead>
              <tr className="text-left text-micro uppercase tracking-wide text-muted-foreground border-b border-border">
                {["Week", "Outbounds", "Inbounds", "IB replies", "OB replies", "Proposed", "Booked", "Showed", "Closed", "Cash"].map(h => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap first:pl-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekly.map(w => (
                <tr key={w.week} className="border-b border-border/50">
                  <td className="px-3 py-2 pl-4 tabular-nums text-muted-foreground whitespace-nowrap">wk of {format(new Date(w.week + "T12:00:00"), "d MMM")}</td>
                  {[w.outbounds, w.inbounds, w.ibReplies, w.obReplies, w.proposed, w.booked, w.showed, w.closed].map((v, i) => (
                    <td key={i} className="px-3 py-2 tabular-nums">{v.toLocaleString()}</td>
                  ))}
                  <td className="px-3 py-2 tabular-nums">{money(w.cash)}</td>
                </tr>
              ))}
              {weekly.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">No logged days yet · fill the daily log first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
