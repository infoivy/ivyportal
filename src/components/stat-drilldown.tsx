import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";

export type StatDrilldownRow = {
  id: string;
  user_id: string;
  report_date: string;
  dms_sent: number;
  convos_started: number;
  calls_booked: number;
  calls_scheduled: number;
  shows: number;
  no_shows: number;
};

type Profile = { id: string; display_name: string | null };

export type MetricKey = keyof Pick<
  StatDrilldownRow,
  "dms_sent" | "convos_started" | "calls_booked" | "calls_scheduled" | "shows" | "no_shows"
>;

const METRIC_LABELS: Record<string, string> = {
  dms_sent: "DMs sent",
  convos_started: "Convos started",
  calls_booked: "Calls booked",
  calls_scheduled: "Calls scheduled",
  shows: "Shows",
  no_shows: "No-shows",
  showRate: "Show rate",
};

const COLORS: Record<string, string> = {
  dms_sent: "var(--chart-1)",
  convos_started: "var(--chart-4)",
  calls_booked: "var(--chart-2)",
  calls_scheduled: "var(--chart-5)",
  shows: "var(--chart-3)",
  no_shows: "var(--danger)",
  showRate: "var(--chart-6)",
};

export function StatDrilldown({
  open, onOpenChange, metric, eods, profiles, rangeLabel, prevEods = [], prevLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metric: MetricKey | null;
  eods: StatDrilldownRow[];
  profiles: Record<string, Profile>;
  rangeLabel: string;
  /** Previous comparison window rows — when present, the drilldown overlays them. */
  prevEods?: StatDrilldownRow[];
  prevLabel?: string;
}) {
  const label = metric ? METRIC_LABELS[metric] : "";
  const color = metric ? COLORS[metric] : "var(--chart-1)";

  const perDay = useMemo(() => {
    if (!metric) return [];
    const daily = (rows: StatDrilldownRow[]) => {
      const map = new Map<string, number>();
      for (const e of rows) map.set(e.report_date, (map.get(e.report_date) ?? 0) + (Number(e[metric]) || 0));
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([d, v]) => ({ label: format(new Date(d + "T00:00:00"), "MMM d"), value: v, date: d }));
    };
    const curr = daily(eods);
    if (prevEods.length === 0) return curr;
    const prev = daily(prevEods);
    // align by day offset: first prev day shadows first current day
    return curr.map((row, i) => ({ ...row, prev: prev[i]?.value ?? 0 }));
  }, [eods, prevEods, metric]);

  const perSetter = useMemo(() => {
    if (!metric) return [];
    const map = new Map<string, { total: number; entries: StatDrilldownRow[] }>();
    for (const e of eods) {
      const cur = map.get(e.user_id) ?? { total: 0, entries: [] };
      cur.total += Number(e[metric]) || 0;
      cur.entries.push(e);
      map.set(e.user_id, cur);
    }
    return Array.from(map.entries())
      .map(([uid, v]) => ({
        user_id: uid,
        name: profiles[uid]?.display_name ?? "Unknown",
        total: v.total,
        entries: v.entries.sort((a, b) => b.report_date.localeCompare(a.report_date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [eods, metric, profiles]);

  const grandTotal = perSetter.reduce((a, b) => a + b.total, 0);
  const prevPerSetter = useMemo(() => {
    if (!metric || prevEods.length === 0) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of prevEods) m.set(e.user_id, (m.get(e.user_id) ?? 0) + (Number(e[metric]) || 0));
    return m;
  }, [prevEods, metric]);
  const prevTotal = Array.from(prevPerSetter.values()).reduce((a, b) => a + b, 0);
  const hasPrev = prevEods.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            {label} — drilldown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{rangeLabel}</span>
            <span className="tabular-nums">
              Total: <span className="text-foreground font-semibold">{grandTotal.toLocaleString()}</span>
              {hasPrev && (
                <>
                  {" "}· {prevLabel ?? "previous period"}: <span className="text-foreground">{prevTotal.toLocaleString()}</span>
                  {" "}<span className={grandTotal >= prevTotal ? "text-success-fg" : "text-danger-fg"}>
                    ({grandTotal >= prevTotal ? "+" : ""}{(grandTotal - prevTotal).toLocaleString()})
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="h-52 border border-border rounded-sm bg-card p-2">
            {perDay.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-muted-foreground">No data in this range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDay}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }} />
                  {hasPrev && <Bar dataKey="prev" name={prevLabel ?? "Previous"} fill={color} fillOpacity={0.25} radius={[2, 2, 0, 0]} isAnimationActive={false} />}
                  <Bar dataKey="value" name={label} fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Per setter</div>
            <div className="border border-border rounded-sm overflow-hidden">
              <div className={`grid ${hasPrev ? "grid-cols-[minmax(0,1fr)_80px_80px_80px]" : "grid-cols-[minmax(0,1fr)_80px_80px]"} text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-3 py-2 border-b border-border`}>
                <span>Setter</span>
                <span className="text-right">{label}</span>
                {hasPrev && <span className="text-right">Prev</span>}
                <span className="text-right">EODs</span>
              </div>
              {perSetter.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No entries.</div>
              ) : (
                perSetter.map((s) => (
                  <details key={s.user_id} className="border-b border-border/50 last:border-0">
                    <summary className={`grid ${hasPrev ? "grid-cols-[minmax(0,1fr)_80px_80px_80px]" : "grid-cols-[minmax(0,1fr)_80px_80px]"} px-3 py-2 text-xs cursor-pointer hover:bg-muted tabular-nums`}>
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-right" style={{ color }}>{s.total.toLocaleString()}</span>
                      {hasPrev && <span className="text-right text-muted-foreground">{(prevPerSetter.get(s.user_id) ?? 0).toLocaleString()}</span>}
                      <span className="text-right text-muted-foreground">{s.entries.length}</span>
                    </summary>
                    <div className="px-6 py-2 space-y-1 bg-black/20">
                      {s.entries.slice(0, 20).map((e) => (
                        <Link
                          key={e.id}
                          to="/eods"
                          className="flex items-center justify-between text-[11px] py-1 hover:text-primary"
                        >
                          <span className="text-muted-foreground">{e.report_date}</span>
                          <span className="tabular-nums">{Number(e[metric!]).toLocaleString()}</span>
                        </Link>
                      ))}
                      {s.entries.length > 20 && (
                        <div className="text-[10px] text-muted-foreground pt-1">+{s.entries.length - 20} more</div>
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
