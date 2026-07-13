import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RevenueTabBar } from "@/components/revenue-tab-bar";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { todayBiz } from "@/lib/dates";
import { format, subDays } from "date-fns";
import {
  CheckCircle2, XCircle, AlertTriangle, Copy, Check, ChevronDown, ChevronRight,
  Loader2, Download, TrendingUp, Users,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { BreakdownBar } from "@/components/ui/breakdown-bar";
import { VolumeAreaChart, VolumeLegend } from "@/components/ui/volume-area-chart";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { type DateRange, rangeFor, daysBetween } from "@/components/range-picker";
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — ISA Team" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) ?? "operations" }),
  component: Sales,
});

type SetterProfile = { id: string; display_name: string; setter_type: "phone" | "dm" | "full_cycle" | null };
type EODRow = { id: string; user_id: string; report_date: string; dials: number; leads_contacted: number; calls_booked: number };
type TrendsRow = {
  id: string; user_id: string; report_date: string;
  dms_sent: number; convos_started: number; calls_booked: number;
  calls_scheduled: number; shows: number; no_shows: number; closes: number;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function kpiHit(eod: EODRow, setterType: "phone" | "dm" | "full_cycle" | null) {
  if (setterType === "phone") return { primary: eod.dials >= 100, sets: eod.calls_booked >= 3 };
  if (setterType === "dm") return { primary: eod.leads_contacted >= 125, sets: eod.calls_booked >= 3 };
  if (setterType === "full_cycle") return { primary: eod.dials >= 100 && eod.leads_contacted >= 50, sets: eod.calls_booked >= 3 };
  return { primary: false, sets: false };
}

function Sales() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAllowed = roles.includes("admin") || roles.includes("closer");
  const canRevenue = roles.includes("coach") || roles.includes("founder");
  useEffect(() => {
    // The Sales section is one sidebar entry — coaches/founders own the
    // Revenue tab of it, not closer operations.
    if (!isAllowed && canRevenue) navigate({ to: "/revenue", replace: true });
  }, [isAllowed, canRevenue, navigate]);
  if (!isAllowed) {
    if (canRevenue) return null;
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">
          Admin or closer access required.
        </div>
      </div>
    );
  }
  return <SalesInner />;
}

function SalesInner() {
  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-5">
      <RevenueTabBar />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">Activity</h1>
          <p className="text-body text-muted-foreground mt-1">Today's compliance, full-funnel trends, and scorecards — one view.</p>
        </div>
      </div>

      <OperationsTab />
    </div>
  );
}

// ─── OPERATIONS TAB ─────────────────────────────────────────────────────────

function OperationsTab() {
  const today = todayBiz();
  const yesterday = isoDate(new Date(Date.now() - 86400000));
  const thirtyDaysAgo = isoDate(new Date(Date.now() - 30 * 86400000));

  const [setters, setSetters] = useState<SetterProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Record<string, string>>({});
  const [todayEods, setTodayEods] = useState<EODRow[]>([]);
  const [yesterdayEods, setYesterdayEods] = useState<EODRow[]>([]);
  const [recentEods, setRecentEods] = useState<EODRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedScorecard, setExpandedScorecard] = useState<string | null>(null);
  const { roles } = useAuth();
  const canEditSetterType = roles.includes("admin");

  const fetchPage = async () => {
    const [profsRes, rolesRes, todayRes, yestRes, recentRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, setter_type, active" as any),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").eq("report_date", today),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").eq("report_date", yesterday),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").gte("report_date", thirtyDaysAgo).order("report_date", { ascending: false }),
    ]);

    const profs: any[] = profsRes.data ?? [];
    const rolesData = rolesRes.data ?? [];
    const profileNames: Record<string, string> = {};
    profs.forEach((p: any) => { profileNames[p.id] = p.display_name ?? "Unnamed"; });

    const setterIds = new Set<string>(rolesData.filter(r => r.role === "setter").map(r => r.user_id));
    const setterList: SetterProfile[] = profs
      .filter((p: any) => setterIds.has(p.id) && p.active !== false)
      .map((p: any) => ({ id: p.id, display_name: p.display_name ?? "Unnamed", setter_type: p.setter_type ?? null }));

    return {
      profileNames, setterList,
      today: (todayRes.data ?? []) as EODRow[],
      yesterday: (yestRes.data ?? []) as EODRow[],
      recent: (recentRes.data ?? []) as EODRow[],
    };
  };

  const pageQ = useQuery({ queryKey: ["page", "sales", "ops", today], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setAllProfiles(pageQ.data.profileNames);
    setSetters(pageQ.data.setterList);
    setTodayEods(pageQ.data.today);
    setYesterdayEods(pageQ.data.yesterday);
    setRecentEods(pageQ.data.recent);
    setLoading(false);
  }, [pageQ.data]);

  const todayByUser = useMemo(() => { const m = new Map<string, EODRow>(); todayEods.forEach(e => m.set(e.user_id, e)); return m; }, [todayEods]);
  const yesterdayByUser = useMemo(() => { const m = new Map<string, EODRow>(); yesterdayEods.forEach(e => m.set(e.user_id, e)); return m; }, [yesterdayEods]);
  const missedYesterday = useMemo(() => setters.filter(s => !yesterdayByUser.has(s.id)), [setters, yesterdayByUser]);

  const updateSetterType = async (id: string, type: "phone" | "dm" | "full_cycle") => {
    const { error } = await (supabase as any).from("profiles").update({ setter_type: type }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSetters(prev => prev.map(s => s.id === id ? { ...s, setter_type: type } : s));
    toast.success("Setter type updated");
  };

  const copyNudge = (setter: SetterProfile) => {
    const msg = `Hey ${setter.display_name.split(" ")[0]}, no EOD logged yesterday. Please submit today's report before EOD. 🙏`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(setter.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Nudge copied to clipboard");
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const filedToday = setters.filter(s => todayByUser.has(s.id));
  const filedAndHit = filedToday.filter(s => { const h = kpiHit(todayByUser.get(s.id)!, s.setter_type); return h.primary && h.sets; });
  const filedOnly = filedToday.length - filedAndHit.length;
  const missing = setters.length - filedToday.length;

  const setsSparkData = (() => {
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      return recentEods.filter(e => e.report_date === key).reduce((s, e) => s + e.calls_booked, 0);
    });
  })();

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Active setters" value={setters.length} noData={setters.length === 0} />
        <StatCard label="Filed today" value={filedToday.length} accent noData={setters.length === 0} />
        <StatCard label="Missed yesterday" value={missedYesterday.length} hint={missedYesterday.length > 0 ? "needs nudge" : "all filed"} noData={setters.length === 0} />
        <StatCard label="7-day avg sets/day" value={sevenDayAvgSets(setters, recentEods)} sparkData={setsSparkData} noData={recentEods.length === 0} />
      </div>

      <div className="card-surface p-4">
        <BreakdownBar segments={[
          { label: "KPI hit", value: filedAndHit.length, color: "#22c55e" },
          { label: "Submitted", value: filedOnly, color: "#f59e0b" },
          { label: "Missing", value: missing, color: "#ef4444" },
        ]} title="Today's compliance" />
      </div>

      {/* Today */}
      <section className="space-y-3">
        <h2 className="text-title text-foreground">Today's submission status</h2>
        <div className="space-y-4">
          {setters.length === 0 ? (
            <EmptySales msg="No active setters yet." />
          ) : (
            <div className="card-surface overflow-hidden">
              {setters.map(s => {
                const eod = todayByUser.get(s.id);
                const submitted = !!eod;
                const hit = eod ? kpiHit(eod, s.setter_type) : null;
                const primaryLabel = s.setter_type === "phone" ? "dials" : s.setter_type === "dm" ? "leads" : "primary KPI";
                const primaryVal = eod ? (s.setter_type === "phone" ? eod.dials : eod.leads_contacted) : null;
                const primaryTarget = s.setter_type === "phone" ? 100 : s.setter_type === "dm" ? 125 : null;
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {s.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium">{s.display_name}</div>
                        {s.setter_type ? (
                          <div className="text-[12px] text-muted-foreground">
                            {s.setter_type === "phone" ? "Phone · 100 dials" : s.setter_type === "full_cycle" ? "Full cycle · 100 dials + 50 DMs" : "DM · 125 DMs"}
                          </div>
                        ) : canEditSetterType ? (
                          <span onClick={e => e.stopPropagation()}>
                            <SelectField
                              value=""
                              onChange={(v) => { if (v) updateSetterType(s.id, v as "phone" | "dm" | "full_cycle"); }}
                              placeholder="Set type…"
                              className="h-5 w-24 text-[11px] bg-warning-bg text-warning-fg border-warning/25"
                              options={[
                                { value: "phone", label: "Phone" },
                                { value: "dm", label: "DM" },
                                { value: "full_cycle", label: "Full cycle" },
                              ]}
                            />
                          </span>
                        ) : (
                          <div className="text-[12px] text-warning-fg">Type not set</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {submitted ? (
                        <>
                          {hit && primaryTarget !== null && primaryVal !== null && (
                            <span className={`text-[12px] px-2 py-0.5 rounded-full ${hit.primary ? "bg-primary/10 text-primary" : "bg-warning-bg text-warning-fg"}`}>
                              {primaryVal}/{primaryTarget} {primaryLabel}
                            </span>
                          )}
                          {hit && (
                            <span className={`text-[12px] px-2 py-0.5 rounded-full ${hit.sets ? "bg-primary/10 text-primary" : "bg-warning-bg text-warning-fg"}`}>
                              {eod?.calls_booked}/3 sets
                            </span>
                          )}
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-[12px] text-danger-fg dark:text-danger-fg bg-danger-bg px-2 py-0.5 rounded-full">
                          <XCircle className="h-3.5 w-3.5" /> Missing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {missedYesterday.length > 0 && (
            <div className="space-y-2">
              <div className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-fg" /> Missed yesterday — send nudge
              </div>
              <div className="card-surface overflow-hidden">
                {missedYesterday.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div className="text-[14px] font-medium">{s.display_name}</div>
                    <button
                      onClick={() => copyNudge(s)}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
                    >
                      {copiedId === s.id ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy nudge</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missedYesterday.length === 0 && setters.length > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-primary card-surface px-4 py-3">
              <CheckCircle2 className="h-4 w-4" /> All setters filed yesterday. No nudges needed.
            </div>
          )}
        </div>
      </section>

      {/* Trends — inline so the funnel is seen without a click */}
      <section className="space-y-3 pt-2 border-t border-border">
        <h2 className="text-title text-foreground">Trends</h2>
        <TrendsTab />
      </section>

      {/* Scorecards */}
      <section className="space-y-3 pt-2 border-t border-border">
        <h2 className="text-title text-foreground">Scorecards — last 30 days</h2>
        <div className="space-y-3">
          {setters.length === 0 ? (
            <EmptySales msg="No active setters." />
          ) : (
            <div className="space-y-2">
              {setters.map(s => (
                <ScorecardRow
                  key={s.id}
                  setter={s}
                  eods={recentEods.filter(e => e.user_id === s.id)}
                  expanded={expandedScorecard === s.id}
                  onToggle={() => setExpandedScorecard(prev => prev === s.id ? null : s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── TRENDS TAB ─────────────────────────────────────────────────────────────

function TrendsTab() {
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("24h"));
  const [compare, setCompare] = useState(false);
  const [rows, setRows] = useState<TrendsRow[]>([]);
  const [prevRows, setPrevRows] = useState<TrendsRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { id: string; display_name: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const days = daysBetween(dateRange);
  const fromISO = dateRange.from.toISOString().slice(0, 10);
  const toISO = dateRange.to.toISOString().slice(0, 10);

  const trendsQ = useQuery({
    queryKey: ["page", "sales", "trends", fromISO, toISO, compare],
    placeholderData: (prev) => prev, // keep numbers on screen while a new range loads
    queryFn: async () => {
      const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
      const pf = prevFrom.toISOString().slice(0, 10);
      const pt = prevTo.toISOString().slice(0, 10);
      const [r, prev, p] = await Promise.all([
        supabase.from("eods").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes").gte("report_date", fromISO).lte("report_date", toISO).order("report_date"),
        compare
          ? supabase.from("eods").select("*").gte("report_date", pf).lte("report_date", pt).order("report_date")
          : Promise.resolve({ data: [] as TrendsRow[] }),
        supabase.from("profiles").select("id, display_name"),
      ]);
      const map: Record<string, { id: string; display_name: string | null }> = {};
      ((p.data as any[]) ?? []).forEach((x: any) => { map[x.id] = x; });
      return { rows: (r.data as TrendsRow[]) ?? [], prevRows: (prev.data as TrendsRow[]) ?? [], map };
    },
  });
  useEffect(() => {
    if (!trendsQ.data) return;
    setRows(trendsQ.data.rows);
    setPrevRows(trendsQ.data.prevRows);
    setProfiles(trendsQ.data.map);
    setLoading(false);
  }, [trendsQ.data]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    dms: a.dms + r.dms_sent, convos: a.convos + r.convos_started,
    booked: a.booked + r.calls_booked, shows: a.shows + r.shows, noshows: a.noshows + r.no_shows, closes: a.closes + (r.closes ?? 0),
  }), { dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0, closes: 0 }), [rows]);

  const prevTotals = useMemo(() => prevRows.reduce((a, r) => ({
    dms: a.dms + r.dms_sent, convos: a.convos + r.convos_started,
    booked: a.booked + r.calls_booked, shows: a.shows + r.shows, noshows: a.noshows + r.no_shows, closes: a.closes + (r.closes ?? 0),
  }), { dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0, closes: 0 }), [prevRows]);

  const perSetter = useMemo(() => {
    const by: Record<string, { user_id: string; dms: number; convos: number; booked: number; shows: number; noshows: number; days: number }> = {};
    for (const r of rows) {
      const b = by[r.user_id] ?? (by[r.user_id] = { user_id: r.user_id, dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0, days: 0 });
      b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked;
      b.shows += r.shows; b.noshows += r.no_shows; b.days += 1;
    }
    return Object.values(by).sort((a, b) => b.booked - a.booked);
  }, [rows]);

  const trend = useMemo(() => {
    const map: Record<string, { dms: number; convos: number; booked: number; shows: number; closes: number }> = {};
    const out: { key: string; label: string; dms: number; convos: number; booked: number; shows: number; closes: number; prev_dms: number; prev_convos: number; prev_booked: number; prev_shows: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map[key] = { dms: 0, convos: 0, booked: 0, shows: 0, closes: 0 };
      out.push({ key, label: format(d, days <= 7 ? "EEE" : "MMM d"), dms: 0, convos: 0, booked: 0, shows: 0, closes: 0, prev_dms: 0, prev_convos: 0, prev_booked: 0, prev_shows: 0 });
    }
    for (const r of rows) { const b = map[r.report_date]; if (!b) continue; b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows; b.closes += r.closes ?? 0; }
    if (compare && prevRows.length > 0) {
      const prevFrom = new Date(dateRange.from); prevFrom.setDate(prevFrom.getDate() - days);
      const prevMap: Record<string, { dms: number; convos: number; booked: number; shows: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(prevFrom); d.setDate(d.getDate() + i);
        prevMap[d.toISOString().slice(0, 10)] = { dms: 0, convos: 0, booked: 0, shows: 0 };
      }
      for (const r of prevRows) { const b = prevMap[r.report_date]; if (!b) continue; b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows; }
      const prevVals = Object.values(prevMap);
      out.forEach((pt, i) => { const pv = prevVals[i]; if (pv) { pt.prev_dms = pv.dms; pt.prev_convos = pv.convos; pt.prev_booked = pv.booked; pt.prev_shows = pv.shows; } });
    }
    return out.map(o => ({ ...o, ...map[o.key] }));
  }, [rows, prevRows, days, compare, dateRange.from]);

  const dmToConvo = totals.dms > 0 ? (totals.convos / totals.dms) * 100 : 0;
  const convoToBook = totals.convos > 0 ? (totals.booked / totals.convos) * 100 : 0;
  const bookToShow = totals.booked > 0 ? (totals.shows / totals.booked) * 100 : 0;
  const closedRate = totals.shows > 0 ? (totals.closes / totals.shows) * 100 : 0;
  const prevDmToConvo = prevTotals.dms > 0 ? (prevTotals.convos / prevTotals.dms) * 100 : 0;
  const prevConvoToBook = prevTotals.convos > 0 ? (prevTotals.booked / prevTotals.convos) * 100 : 0;
  const prevBookToShow = prevTotals.booked > 0 ? (prevTotals.shows / prevTotals.booked) * 100 : 0;
  const prevClosedRate = prevTotals.shows > 0 ? (prevTotals.closes / prevTotals.shows) * 100 : 0;

  const exportCsv = () => {
    const header = ["Setter", "Days", "DMs", "Convos", "Booked", "Shows", "No-shows", "Show %"];
    const csvRows = perSetter.map(s => [
      profiles[s.user_id]?.display_name ?? "Unknown", s.days, s.dms, s.convos, s.booked, s.shows, s.noshows,
      s.shows + s.noshows > 0 ? Math.round((s.shows / (s.shows + s.noshows)) * 100) : 0,
    ].join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trends-${days}d-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const chartSeries = useMemo(() => [
    ...(compare ? [
      { key: "prev_dms",    label: "DMs (prev)",    color: "#9CA3AF", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
      { key: "prev_convos", label: "Convos (prev)",  color: "#6366F1", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
      { key: "prev_booked", label: "Booked (prev)",  color: "#22C55E", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
    ] : []),
    { key: "dms",    label: "DMs",    color: "#9CA3AF" },
    { key: "convos", label: "Convos", color: "#6366F1" },
    { key: "booked", label: "Booked", color: "#22C55E", strokeWidth: 2 },
    { key: "shows",  label: "Shows",  color: "#F59E0B" },
    { key: "closes", label: "Closes", color: "#A855F7" },
  ], [compare]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterToolbar value={dateRange} onChange={setDateRange} compare={compare} onCompareToggle={() => setCompare(c => !c)} />
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <StatCard label="DMs → Convos" value={`${dmToConvo.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} hint={`${totals.convos.toLocaleString()} / ${totals.dms.toLocaleString()}`} delta={compare ? { value: dmToConvo - prevDmToConvo, format: "pct" } : undefined} noData={rows.length === 0} />
        <StatCard label="Convos → Booked" value={`${convoToBook.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} hint={`${totals.booked.toLocaleString()} / ${totals.convos.toLocaleString()}`} delta={compare ? { value: convoToBook - prevConvoToBook, format: "pct" } : undefined} noData={rows.length === 0} />
        <StatCard label="Booked → Shows" value={`${bookToShow.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} hint={`${totals.shows.toLocaleString()} / ${totals.booked.toLocaleString()}`} delta={compare ? { value: bookToShow - prevBookToShow, format: "pct" } : undefined} noData={rows.length === 0} />
        <StatCard label="Closed Rate" value={`${closedRate.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} hint={`${totals.closes.toLocaleString()} closes / ${totals.shows.toLocaleString()} shows`} delta={compare ? { value: closedRate - prevClosedRate, format: "pct" } : undefined} noData={rows.length === 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <div className="mb-3">
            <div className="text-[15px] font-semibold">Volume trend</div>
            <div className="text-[13px] text-muted-foreground mt-0.5">DMs, convos, booked &amp; shows{compare ? " vs prev period" : ""}</div>
          </div>
          {loading ? <div className="h-60 w-full bg-muted rounded-xl animate-pulse" /> : (
            <>
              <VolumeAreaChart data={trend} height={240} series={chartSeries} />
              <VolumeLegend series={[
                { key: "dms", label: "DMs", color: "#9CA3AF" },
                { key: "convos", label: "Convos", color: "#6366F1" },
                { key: "booked", label: "Booked", color: "#22C55E" },
                { key: "shows", label: "Shows", color: "#F59E0B" },
              ]} />
            </>
          )}
        </div>

        <div className="card-surface p-5">
          <div className="text-[15px] font-semibold mb-3">Daily Booked Calls</div>
          <div className="h-64">
            {loading ? <div className="h-full w-full bg-muted rounded-xl animate-pulse" /> : (
              <ResponsiveContainer>
                <BarChart data={trend} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-overlay)" }} cursor={{ fill: "color-mix(in srgb, var(--color-foreground) 4%, transparent)" }} />
                  <Bar dataKey="booked" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  {compare && <Bar dataKey="prev_booked" fill="#22c55e" fillOpacity={0.3} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[15px] font-semibold">Per-Setter Breakdown</span>
            <span className="text-[13px] text-muted-foreground">· {perSetter.length} active</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-2 font-normal">Setter</th>
                <th className="text-right px-3 py-2 font-normal">Days</th>
                <th className="text-right px-3 py-2 font-normal">DMs</th>
                <th className="text-right px-3 py-2 font-normal">Convos</th>
                <th className="text-right px-3 py-2 font-normal">Booked</th>
                <th className="text-right px-3 py-2 font-normal">Shows</th>
                <th className="text-right px-3 py-2 font-normal">Show %</th>
                <th className="text-right px-3 py-2 font-normal">DM→Book %</th>
              </tr>
            </thead>
            <tbody>
              {perSetter.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-[13px]">No EODs in this range.</td></tr>
              )}
              {perSetter.map(s => {
                const showPct = s.shows + s.noshows > 0 ? Math.round((s.shows / (s.shows + s.noshows)) * 100) : 0;
                const dmBookPct = s.dms > 0 ? ((s.booked / s.dms) * 100).toFixed(2) : "0.00";
                return (
                  <tr key={s.user_id} className="border-b border-border/50 hover:bg-muted/30 tabular-nums motion-safe:transition-colors">
                    <td className="px-3 py-2 font-medium">{profiles[s.user_id]?.display_name ?? "Unknown"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{s.days}</td>
                    <td className="px-3 py-2 text-right">{s.dms.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{s.convos.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-primary">{s.booked.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{s.shows.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{showPct}%</td>
                    <td className="px-3 py-2 text-right">{dmBookPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PIPELINE ───────────────────────────────────────────────────────────────

const STAGES = ["Invited", "Signed up", "SOPs read", "First EOD", "First set", "Ramped"] as const;

// ─── SCORECARD ──────────────────────────────────────────────────────────────

function ScorecardRow({ setter, eods, expanded, onToggle }: { setter: SetterProfile; eods: EODRow[]; expanded: boolean; onToggle: () => void }) {
  const totalDays = eods.length;
  if (totalDays === 0) {
    return (
      <div className="card-surface px-4 py-3 flex items-center justify-between">
        <span className="text-[14px] font-medium">{setter.display_name}</span>
        <span className="text-[13px] text-muted-foreground">No EODs in last 30 days</span>
      </div>
    );
  }
  const primaryHits = eods.filter(e => kpiHit(e, setter.setter_type).primary).length;
  const setsHits = eods.filter(e => kpiHit(e, setter.setter_type).sets).length;
  const primaryRate = Math.round((primaryHits / totalDays) * 100);
  const setsRate = Math.round((setsHits / totalDays) * 100);
  const avgSets = (eods.reduce((s, e) => s + e.calls_booked, 0) / totalDays).toFixed(1);
  const primaryKey = setter.setter_type === "dm" ? "leads_contacted" : "dials";
  const avgPrimary = (eods.reduce((s, e) => s + (e as any)[primaryKey], 0) / totalDays).toFixed(0);

  return (
    <div className="card-surface overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 motion-safe:transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
            {setter.display_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[14px] font-medium">{setter.display_name}</div>
            <div className="text-[12px] text-muted-foreground">{totalDays} days tracked</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RatePill label={setter.setter_type === "phone" ? "Dials hit" : setter.setter_type === "full_cycle" ? "Cycle hit" : "Leads hit"} pct={primaryRate} />
          <RatePill label="Sets hit" pct={setsRate} />
          <span className="text-[12px] text-muted-foreground hidden sm:block w-52 text-right tabular-nums shrink-0">avg {avgSets} sets/day · {avgPrimary} {setter.setter_type === "dm" ? "leads" : "dials"}/day</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="text-[13px] text-muted-foreground">Last 7 days</div>
          <div className="flex gap-1.5 flex-wrap">
            {eods.slice(0, 7).map(e => {
              const hit = kpiHit(e, setter.setter_type);
              const bothHit = hit.primary && hit.sets;
              const oneHit = hit.primary || hit.sets;
              return (
                <div key={e.id} className={`rounded-lg px-2 py-1.5 text-[12px] ${bothHit ? "bg-primary/10 text-primary" : oneHit ? "bg-warning-bg text-warning-fg" : "bg-danger-bg text-danger-fg dark:text-danger-fg"}`}>
                  {e.report_date.slice(5)} · {setter.setter_type === "phone" ? e.dials : e.leads_contacted} {setter.setter_type === "phone" ? "dials" : "leads"} · {e.calls_booked} sets
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <MiniStat label="Primary KPI hit%" value={`${primaryRate}%`} />
            <MiniStat label="Sets KPI hit%" value={`${setsRate}%`} />
            <MiniStat label="Avg sets/day" value={avgSets} />
            <MiniStat label={`Avg ${setter.setter_type === "phone" ? "dials" : "leads"}/day`} value={avgPrimary} />
          </div>
        </div>
      )}
    </div>
  );
}

function RatePill({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? "bg-primary/10 text-primary" : pct >= 50 ? "bg-warning-bg text-warning-fg" : "bg-danger-bg text-danger-fg dark:text-danger-fg";
  return (
    <div className={`hidden sm:flex w-[74px] shrink-0 flex-col items-center text-[12px] rounded-lg px-2 py-1 ${color}`}>
      <span className="font-semibold tabular-nums">{pct}%</span>
      <span className="text-[11px] opacity-80">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted rounded-xl p-2">
      <div className="text-[12px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[14px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmptySales({ msg }: { msg: string }) {
  return <div className="card-surface border-dashed p-8 text-center text-[13px] text-muted-foreground">{msg}</div>;
}

function sevenDayAvgSets(setters: SetterProfile[], recentEods: EODRow[]): string {
  const sevenDaysAgo = isoDate(new Date(Date.now() - 7 * 86400000));
  const last7 = recentEods.filter(e => e.report_date >= sevenDaysAgo && setters.some(s => s.id === e.user_id));
  if (last7.length === 0) return "—";
  return (last7.reduce((s, e) => s + e.calls_booked, 0) / last7.length).toFixed(1);
}
