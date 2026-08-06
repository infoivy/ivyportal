import { useMemo, useState } from "react";
import { friendlyPastDay } from "@/lib/dates";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { ArrowRight, Search } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

/**
 * All student EODs in one place (founder 2026-07-31): a weekly output chart
 * in the same language as the CSM fulfillment graph, and the raw feed of
 * every daily report so nobody has to open students one by one.
 */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

type EodRow = {
  id: string;
  student_id: string;
  report_date: string;
  roleplays: number | null;
  looms_sent: number | null;
  applications_submitted: number | null;
};

/** One fetch shared by the chart card and the feed (same query key dedupes
 *  when both are mounted). */
function useStudentEodPulse() {
  return useQuery({
    queryKey: ["page", "student", "eod-pulse"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // Six months back: enough for the monthly view; daily/weekly slice it.
      const sixMonthsAgo = iso(startOfMonth(subMonths(new Date(), 5)));
      const [eodsRes, studentsRes] = await Promise.all([
        supabase
          .from("student_eods")
          .select("id, student_id, report_date, roleplays, looms_sent, applications_submitted, students!inner(is_demo)")
          .eq("students.is_demo", false).is("students.archived_at" as never, null)
          .gte("report_date", sixMonthsAgo)
          .order("report_date", { ascending: false })
          .limit(5000),
        supabase.from("students").select("id, full_name").eq("is_demo", false).is("archived_at" as never, null),
      ]);
      const students = (studentsRes.data ?? []) as unknown as { id: string; full_name: string }[];
      return {
        eods: (eodsRes.data ?? []) as unknown as EodRow[],
        names: new Map(students.map((s) => [s.id, s.full_name])),
      };
    },
  });
}

type Granularity = "daily" | "weekly" | "monthly";
const GRANULARITIES = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
] as const;

/** The student output chart, shared by Student success and the CSM overview
 *  (founder 2026-07-31; 2026-08-06: daily by default with a daily / weekly /
 *  monthly switch). */
export function StudentOutputCard() {
  const pulseQ = useStudentEodPulse();
  const d = pulseQ.data;
  const [granularity, setGranularity] = useState<Granularity>(() => {
    try {
      const saved = localStorage.getItem("studentOutput.granularity");
      if (saved === "daily" || saved === "weekly" || saved === "monthly") return saved;
    } catch { /* default below */ }
    return "daily";
  });
  const pick = (g: Granularity) => {
    setGranularity(g);
    try { localStorage.setItem("studentOutput.granularity", g); } catch { /* non-fatal */ }
  };

  const series = useMemo(() => {
    if (!d) return [];
    type Bucket = { key: string; label: string; eods: number; roleplays: number; looms: number; applications: number };
    const buckets: Bucket[] = [];
    if (granularity === "daily") {
      for (let i = 13; i >= 0; i--) {
        const day = subDays(new Date(), i);
        buckets.push({ key: iso(day), label: format(day, "EEE d"), eods: 0, roleplays: 0, looms: 0, applications: 0 });
      }
    } else if (granularity === "weekly") {
      for (let i = 7; i >= 0; i--) {
        const start = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        buckets.push({ key: iso(start), label: format(start, "d MMM"), eods: 0, roleplays: 0, looms: 0, applications: 0 });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const start = startOfMonth(subMonths(new Date(), i));
        buckets.push({ key: iso(start).slice(0, 7), label: format(start, "MMM"), eods: 0, roleplays: 0, looms: 0, applications: 0 });
      }
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    const keyOf = (reportDate: string) =>
      granularity === "daily" ? reportDate
      : granularity === "weekly" ? iso(startOfWeek(new Date(reportDate + "T00:00:00"), { weekStartsOn: 1 }))
      : reportDate.slice(0, 7);
    for (const e of d.eods) {
      const bucket = byKey.get(keyOf(e.report_date));
      if (!bucket) continue;
      bucket.eods += 1;
      bucket.roleplays += Number(e.roleplays ?? 0);
      bucket.looms += Number(e.looms_sent ?? 0);
      bucket.applications += Number(e.applications_submitted ?? 0);
    }
    return buckets;
  }, [d, granularity]);

  const windowLabel = granularity === "daily" ? "last 14 days" : granularity === "weekly" ? "last 8 weeks" : "last 6 months";
  return (
    <div className="card-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <div className="text-[13px] font-medium text-foreground">Student output</div>
          <div className="text-[11px] text-muted-foreground">{windowLabel} · EODs filed, roleplays, looms, applications</div>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Chart granularity">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              role="tab"
              aria-selected={granularity === g.value}
              onClick={() => pick(g.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium motion-safe:transition-colors ${granularity === g.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="roleplays" name="Roleplays" stackId="a" fill="var(--chart-3)" />
            <Bar dataKey="looms" name="Looms" stackId="a" fill="var(--chart-4)" />
            <Bar dataKey="applications" name="Applications" stackId="a" fill="var(--chart-6)" radius={[3, 3, 0, 0]} />
            <Line dataKey="eods" name="EODs filed" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StudentEodPulse() {
  const [q, setQ] = useState("");
  const pulseQ = useStudentEodPulse();
  const d = pulseQ.data;

  const feed = useMemo(() => {
    if (!d) return [];
    const term = q.trim().toLowerCase();
    const rows = term
      ? d.eods.filter((e) => (d.names.get(e.student_id) ?? "").toLowerCase().includes(term))
      : d.eods;
    return rows.slice(0, 60);
  }, [d, q]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StudentOutputCard />

      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-[13px] font-medium text-foreground">Every student EOD</div>
            <div className="text-[11px] text-muted-foreground">latest first</div>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by student…" className="h-8 w-44 pl-8 text-[12px]" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto -mx-1 px-1">
          <table className="w-full text-caption">
            <thead className="sticky top-0 bg-card">
              <tr className="text-micro text-muted-foreground">
                <th className="text-left py-1.5 font-medium">Date</th>
                <th className="text-left py-1.5 font-medium">Student</th>
                <th className="text-right py-1.5 font-medium">Roleplays</th>
                <th className="text-right py-1.5 font-medium">Looms</th>
                <th className="text-right py-1.5 font-medium">Applications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {feed.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 text-muted-foreground whitespace-nowrap">{friendlyPastDay(e.report_date)}</td>
                  <td className="py-1.5">
                    <Link to="/students/$id" params={{ id: e.student_id }} className="font-medium text-foreground hover:underline inline-flex items-center gap-1">
                      {d?.names.get(e.student_id) ?? "Unknown"}
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    </Link>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{e.roleplays ?? 0}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.looms_sent ?? 0}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.applications_submitted ?? 0}</td>
                </tr>
              ))}
              {feed.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No student EODs {q ? "match that name" : "yet"}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
