import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Download, TrendingUp, Users, Target } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";

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

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

function Analytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const days = RANGES.find(r => r.key === range)!.days;

  useEffect(() => {
    setLoading(true);
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    (async () => {
      const [r, p] = await Promise.all([
        supabase.from("eods").select("*").gte("report_date", from).order("report_date"),
        supabase.from("profiles").select("id, display_name"),
      ]);
      setRows((r.data as Row[]) ?? []);
      const map: Record<string, Profile> = {};
      (p.data as Profile[] | null)?.forEach(x => { map[x.id] = x; });
      setProfiles(map);
      setLoading(false);
    })();
  }, [days]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    dms: a.dms + r.dms_sent, convos: a.convos + r.convos_started,
    booked: a.booked + r.calls_booked, shows: a.shows + r.shows, noshows: a.noshows + r.no_shows,
  }), { dms: 0, convos: 0, booked: 0, shows: 0, noshows: 0 }), [rows]);

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
    const map: Record<string, { dms: number; convos: number; booked: number; shows: number }> = {};
    const out: { key: string; label: string; dms: number; convos: number; booked: number; shows: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map[key] = { dms: 0, convos: 0, booked: 0, shows: 0 };
      out.push({ key, label: format(d, days <= 7 ? "EEE" : "MMM d"), dms: 0, convos: 0, booked: 0, shows: 0 });
    }
    for (const r of rows) {
      const b = map[r.report_date]; if (!b) continue;
      b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows;
    }
    return out.map(o => ({ ...o, ...map[o.key] }));
  }, [rows, days]);

  const dmToConvo = totals.dms > 0 ? ((totals.convos / totals.dms) * 100).toFixed(1) : "0";
  const convoToBook = totals.convos > 0 ? ((totals.booked / totals.convos) * 100).toFixed(1) : "0";
  const bookToShow = totals.booked > 0 ? ((totals.shows / totals.booked) * 100).toFixed(1) : "0";
  const showRate = totals.shows + totals.noshows > 0 ? Math.round((totals.shows / (totals.shows + totals.noshows)) * 100) : 0;

  const exportCsv = () => {
    const header = ["Setter", "Days", "DMs", "Convos", "Booked", "Shows", "No-shows", "Show %"];
    const rows = perSetter.map(s => [
      profiles[s.user_id]?.display_name ?? "Unknown", s.days, s.dms, s.convos, s.booked, s.shows, s.noshows,
      s.shows + s.noshows > 0 ? Math.round((s.shows / (s.shows + s.noshows)) * 100) : 0,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `analytics-${range}-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Full-funnel breakdown from DMs to closes</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] ${range === r.key ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground">
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          <FunnelCard label="DMs → Convos"   pct={dmToConvo}   detail={`${totals.convos.toLocaleString()} / ${totals.dms.toLocaleString()}`} color="#3b82f6" />
          <FunnelCard label="Convos → Booked" pct={convoToBook} detail={`${totals.booked.toLocaleString()} / ${totals.convos.toLocaleString()}`} color="#a855f7" />
          <FunnelCard label="Booked → Shows"  pct={bookToShow}  detail={`${totals.shows.toLocaleString()} / ${totals.booked.toLocaleString()}`} color="#22c55e" />
          <FunnelCard label="Show Rate"       pct={`${showRate}`} detail={`${totals.shows.toLocaleString()} shows`} color="#f59e0b" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-3.5">
            <h3 className="text-sm font-bold mb-2">Volume Trend</h3>
            <div className="h-64">
              {loading ? <div className="h-full w-full bg-white/5 rounded animate-pulse" /> : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }} />
                    <Line type="monotone" dataKey="dms"    stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="convos" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="booked" stroke="#22c55e" strokeWidth={2}   dot={false} />
                    <Line type="monotone" dataKey="shows"  stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
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
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">· {perSetter.length} active</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
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

function FunnelCard({ label, pct, detail, color }: { label: string; pct: string; detail: string; color: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="h-3 w-3" style={{ color }} />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{pct}%</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{detail}</div>
    </div>
  );
}
