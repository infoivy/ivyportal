import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { VolumeAreaChart, VolumeLegend } from "@/components/ui/volume-area-chart";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { type DateRange, rangeFor, daysBetween } from "@/components/range-picker";

type TrendsRow = {
  id: string;
  user_id: string;
  report_date: string;
  dms_sent: number;
  convos_started: number;
  calls_booked: number;
  calls_scheduled: number;
  shows: number;
  no_shows: number;
  closes: number | null;
};

/**
 * The Sales-page volume trend, copied 1:1 (founder-directed 2026-07-28:
 * "should be copied over 1:1 to overview and replace the volume trend in
 * there"). Pure EOD data, same buckets, series, colors, AND its own 7-day
 * default with its own range/compare controls — the dashboard's global 24H
 * picker collapsed it to one empty bucket. Shares the Sales trends query key
 * so both pages hit one cache.
 */
export function VolumeTrendPanel() {
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("7d"));
  const [compare, setCompare] = useState(false);
  const [rows, setRows] = useState<TrendsRow[]>([]);
  const [prevRows, setPrevRows] = useState<TrendsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const days = daysBetween(dateRange);
  const fromISO = dateRange.from.toISOString().slice(0, 10);
  const toISO = dateRange.to.toISOString().slice(0, 10);

  const trendsQ = useQuery({
    queryKey: ["page", "sales", "trends", fromISO, toISO, compare],
    placeholderData: (prev) => prev,
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
      ((p.data as { id: string; display_name: string | null }[]) ?? []).forEach((x) => { map[x.id] = x; });
      return { rows: (r.data as TrendsRow[]) ?? [], prevRows: (prev.data as TrendsRow[]) ?? [], map };
    },
  });
  useEffect(() => {
    if (!trendsQ.data) return;
    setRows(trendsQ.data.rows);
    setPrevRows(trendsQ.data.prevRows);
    setLoading(false);
  }, [trendsQ.data]);

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
    <div className="card-surface p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold">Volume trend</div>
          <div className="text-[13px] text-muted-foreground mt-0.5">DMs, convos, booked &amp; shows{compare ? " vs prev period" : ""}</div>
        </div>
        <FilterToolbar value={dateRange} onChange={setDateRange} compare={compare} onCompareToggle={() => setCompare(c => !c)} />
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
  );
}
