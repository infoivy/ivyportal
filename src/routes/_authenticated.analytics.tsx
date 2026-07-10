import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Download, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";
import { VolumeAreaChart, VolumeLegend } from "@/components/ui/volume-area-chart";
import { StatCard } from "@/components/ui/stat-card";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { type DateRange, rangeFor, daysBetween } from "@/components/range-picker";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ISA Team" }] }),
  component: Analytics,
});

type Row = {
  id: string; user_id: string; report_date: string;
  dms_sent: number; convos_started: number; calls_booked: number;
  calls_scheduled: number; shows: number; no_shows: number;
};
type Profile = { id: string; display_name: string | null };

function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("30d"));
  const [compare, setCompare] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [prevRows, setPrevRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const days = daysBetween(dateRange);
  const fromISO = dateRange.from.toISOString().slice(0, 10);
  const toISO = dateRange.to.toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
    const pf = prevFrom.toISOString().slice(0, 10);
    const pt = prevTo.toISOString().slice(0, 10);

    (async () => {
      const [r, prev, p] = await Promise.all([
        supabase.from("eods").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows").gte("report_date", fromISO).lte("report_date", toISO).order("report_date"),
        compare
          ? supabase.from("eods").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows").gte("report_date", pf).lte("report_date", pt).order("report_date")
          : Promise.resolve({ data: [] as Row[] }),
        supabase.from("profiles").select("id, display_name"),
      ]);
      setRows((r.data as Row[]) ?? []);
      setPrevRows((prev.data as Row[]) ?? []);
      const map: Record<string, Profile> = {};
      (p.data as Profile[] | null)?.forEach(x => { map[x.id] = x; });
      setProfiles(map);
      setLoading(false);
    })();
  }, [fromISO, toISO, compare]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    dms: a.dms + r.dms_sent, convos: a.convos + r.convos_started,
    booked: a.booked + r.calls_booked, shows: a.shows + r.shows, noshows: a.noshows + r.no_shows,
  }), { dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0 }), [rows]);

  const prevTotals = useMemo(() => prevRows.reduce((a, r) => ({
    dms: a.dms + r.dms_sent, convos: a.convos + r.convos_started,
    booked: a.booked + r.calls_booked, shows: a.shows + r.shows, noshows: a.noshows + r.no_shows,
  }), { dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0 }), [prevRows]);

  const perSetter = useMemo(() => {
    const by: Record<string, { user_id: string; dms: number; convos: number; booked: number; shows: number; noshows: number; days: number }> = {};
    for (const r of rows) {
      const b = by[r.user_id] ?? (by[r.user_id] = { user_id: r.user_id, dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0, days: 0 });
      b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked;
      b.shows += r.shows; b.noshows += r.no_shows; b.days += 1;
    }
    return Object.values(by).sort((a, b) => b.booked - a.booked);
  }, [rows]);

  // trend: current period daily totals
  const trend = useMemo(() => {
    const map: Record<string, { dms: number; convos: number; booked: number; shows: number }> = {};
    const out: { key: string; label: string; dms: number; convos: number; booked: number; shows: number; prev_dms: number; prev_convos: number; prev_booked: number; prev_shows: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map[key] = { dms: 0, convos: 0, booked: 0, shows: 0 };
      out.push({ key, label: format(d, days <= 7 ? "EEE" : "MMM d"), dms: 0, convos: 0, booked: 0, shows: 0, prev_dms: 0, prev_convos: 0, prev_booked: 0, prev_shows: 0 });
    }
    for (const r of rows) {
      const b = map[r.report_date]; if (!b) continue;
      b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows;
    }
    // Map prev period by day-index alignment
    if (compare && prevRows.length > 0) {
      const prevFrom = new Date(dateRange.from); prevFrom.setDate(prevFrom.getDate() - days);
      const prevMap: Record<string, { dms: number; convos: number; booked: number; shows: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(prevFrom); d.setDate(d.getDate() + i);
        prevMap[d.toISOString().slice(0, 10)] = { dms: 0, convos: 0, booked: 0, shows: 0 };
      }
      for (const r of prevRows) {
        const b = prevMap[r.report_date]; if (!b) continue;
        b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows;
      }
      const prevVals = Object.values(prevMap);
      out.forEach((pt, i) => {
        const pv = prevVals[i];
        if (pv) { pt.prev_dms = pv.dms; pt.prev_convos = pv.convos; pt.prev_booked = pv.booked; pt.prev_shows = pv.shows; }
      });
    }
    return out.map(o => ({ ...o, ...map[o.key] }));
  }, [rows, prevRows, days, compare, dateRange.from]);

  const dmToConvo = totals.dms > 0 ? ((totals.convos / totals.dms) * 100) : 0;
  const convoToBook = totals.convos > 0 ? ((totals.booked / totals.convos) * 100) : 0;
  const bookToShow = totals.booked > 0 ? ((totals.shows / totals.booked) * 100) : 0;
  const showRate = totals.shows + totals.noshows > 0 ? (totals.shows / (totals.shows + totals.noshows)) * 100 : 0;

  const prevDmToConvo = prevTotals.dms > 0 ? ((prevTotals.convos / prevTotals.dms) * 100) : 0;
  const prevConvoToBook = prevTotals.convos > 0 ? ((prevTotals.booked / prevTotals.convos) * 100) : 0;
  const prevBookToShow = prevTotals.booked > 0 ? ((prevTotals.shows / prevTotals.booked) * 100) : 0;
  const prevShowRate = prevTotals.shows + prevTotals.noshows > 0 ? (prevTotals.shows / (prevTotals.shows + prevTotals.noshows)) * 100 : 0;

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
    a.href = url; a.download = `analytics-${days}d-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const chartSeries = useMemo(() => [
    ...(compare ? [
      { key: "prev_dms",    label: "DMs (prev)",    color: "#9CA3AF", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
      { key: "prev_convos", label: "Convos (prev)",  color: "#3B82F6", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
      { key: "prev_booked", label: "Booked (prev)",  color: "#22C55E", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
    ] : []),
    { key: "dms",    label: "DMs",    color: "#9CA3AF" },
    { key: "convos", label: "Convos", color: "#3B82F6" },
    { key: "booked", label: "Booked", color: "#22C55E", strokeWidth: 2 },
    { key: "shows",  label: "Shows",  color: "#F59E0B" },
  ], [compare]);

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Full-funnel breakdown from DMs to closes</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <FilterToolbar value={dateRange} onChange={setDateRange} compare={compare} onCompareToggle={() => setCompare(c => !c)} />
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border border-white/[0.07] text-muted-foreground hover:text-foreground">
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="DMs → Convos"
            value={`${dmToConvo.toFixed(1)}%`}
            icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "#3b82f6" }} />}
            hint={`${totals.convos.toLocaleString()} / ${totals.dms.toLocaleString()}`}
            delta={compare ? { value: dmToConvo - prevDmToConvo, format: "pct" } : undefined}
            noData={rows.length === 0}
          />
          <StatCard
            label="Convos → Booked"
            value={`${convoToBook.toFixed(1)}%`}
            icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "#a855f7" }} />}
            hint={`${totals.booked.toLocaleString()} / ${totals.convos.toLocaleString()}`}
            delta={compare ? { value: convoToBook - prevConvoToBook, format: "pct" } : undefined}
            noData={rows.length === 0}
          />
          <StatCard
            label="Booked → Shows"
            value={`${bookToShow.toFixed(1)}%`}
            icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />}
            hint={`${totals.shows.toLocaleString()} / ${totals.booked.toLocaleString()}`}
            delta={compare ? { value: bookToShow - prevBookToShow, format: "pct" } : undefined}
            noData={rows.length === 0}
          />
          <StatCard
            label="Show Rate"
            value={`${showRate.toFixed(0)}%`}
            icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />}
            hint={`${totals.shows.toLocaleString()} shows`}
            delta={compare ? { value: showRate - prevShowRate, format: "pct" } : undefined}
            noData={rows.length === 0}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.07] bg-card p-5">
            <div className="mb-2">
              <div className="text-[15px] font-semibold text-foreground">Volume trend</div>
              <div className="text-xs text-muted-foreground mt-0.5">DMs, convos, booked &amp; shows{compare ? " vs prev period" : ""}</div>
            </div>
            {loading ? <div className="h-60 w-full bg-white/5 rounded animate-pulse" /> : (
              <>
                <VolumeAreaChart data={trend} height={240} series={chartSeries} />
                <VolumeLegend series={[
                  { key: "dms",    label: "DMs",    color: "#9CA3AF" },
                  { key: "convos", label: "Convos", color: "#3B82F6" },
                  { key: "booked", label: "Booked", color: "#22C55E" },
                  { key: "shows",  label: "Shows",  color: "#F59E0B" },
                ]} />
              </>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3.5">
            <h3 className="text-sm font-bold mb-2">Daily Booked Calls</h3>
            <div className="h-64">
              {loading ? <div className="h-full w-full bg-white/5 rounded animate-pulse" /> : (
                <ResponsiveContainer>
                  <BarChart data={trend} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="booked" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    {compare && <Bar dataKey="prev_booked" fill="#22c55e" fillOpacity={0.3} radius={[2, 2, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-bold">Per-Setter Breakdown</h3>
              <span className="text-[10px] text-muted-foreground">· {perSetter.length} active</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted-foreground border-b border-border">
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
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No EODs in this range.</td></tr>
                )}
                {perSetter.map(s => {
                  const showPct = s.shows + s.noshows > 0 ? Math.round((s.shows / (s.shows + s.noshows)) * 100) : 0;
                  const dmBookPct = s.dms > 0 ? ((s.booked / s.dms) * 100).toFixed(2) : "0.00";
                  return (
                    <tr key={s.user_id} className="border-b border-border/50 hover:bg-white/[0.02] tabular-nums">
                      <td className="px-3 py-2 font-medium">{profiles[s.user_id]?.display_name ?? "Unknown"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{s.days}</td>
                      <td className="px-3 py-2 text-right text-blue-400">{s.dms.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-blue-400">{s.convos.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-semibold">{s.booked.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{s.shows.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{showPct}%</td>
                      <td className="px-3 py-2 text-right text-blue-400">{dmBookPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
