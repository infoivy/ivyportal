import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Printer } from "lucide-react";
import { money, type Deal, startOfWeekMon, isoDay } from "@/lib/revenue";

export const Route = createFileRoute("/_authenticated/weekly-review")({
  head: () => ({ meta: [{ title: "Weekly Review — ISA" }] }),
  component: WeeklyReview,
});

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function WeeklyReview() {
  const { roles } = useAuth();
  const canView = roles.includes("founder") || roles.includes("admin");

  if (!canView) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Founder or admin access required.
        </div>
      </div>
    );
  }

  return <WeeklyReviewInner />;
}

function WeeklyReviewInner() {
  const weekStart = isoDay(startOfWeekMon(new Date()));
  const weekEnd = isoDate(new Date(new Date(weekStart).getTime() + 6 * 86400000));

  const [deals, setDeals] = useState<Deal[]>([]);
  const [eods, setEods] = useState<{ user_id: string; calls_booked: number; shows: number; no_shows: number }[]>([]);
  const [expectedEods, setExpectedEods] = useState(0);
  const [eodCount, setEodCount] = useState(0);
  const [milestonesThisWeek, setMilestonesThisWeek] = useState(0);
  const [testimonials, setTestimonials] = useState(0);
  const [contentPosted, setContentPosted] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [dealsRes, eodsRes, setterRes, eodsCountRes, msRes, testRes, contentRes] = await Promise.all([
      supabase.from("deals").select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type").gte("deal_date", weekStart).lte("deal_date", weekEnd),
      supabase.from("eods").select("user_id, calls_booked, shows, no_shows").gte("report_date", weekStart).lte("report_date", weekEnd),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "setter"),
      supabase.from("eods").select("id", { count: "exact", head: true }).gte("report_date", weekStart).lte("report_date", weekEnd),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("student_milestone_progress").select("id", { count: "exact", head: true }).gte("achieved_at", weekStart + "T00:00:00"),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("testimonial_collected", true).gte("updated_at", weekStart + "T00:00:00"),
      supabase.from("content_items").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", weekStart + "T00:00:00"),
    ]);
    setDeals((dealsRes.data ?? []) as Deal[]);
    setEods((eodsRes.data ?? []) as any[]);
    const sc = setterRes.count ?? 0;
    const daysElapsed = Math.min(7, Math.floor((new Date().getTime() - new Date(weekStart).getTime()) / 86400000) + 1);
    setExpectedEods(sc * daysElapsed);
    setEodCount(eodsCountRes.count ?? 0);
    setMilestonesThisWeek(msRes.count ?? 0);
    setTestimonials(testRes.count ?? 0);
    setContentPosted(contentRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const weekCash = useMemo(() => deals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0), [deals]);
  const weekSets = useMemo(() => eods.reduce((s, e) => s + e.calls_booked, 0), [eods]);
  const weekShows = useMemo(() => eods.reduce((s, e) => s + e.shows, 0), [eods]);
  const weekCloses = deals.length;
  const showRate = weekSets > 0 ? Math.round((weekShows / weekSets) * 100) : 0;
  const closeRate = weekShows > 0 ? Math.round((weekCloses / weekShows) * 100) : 0;
  const complianceRate = expectedEods > 0 ? Math.round((eodCount / expectedEods) * 100) : 100;

  const today = isoDate(new Date());
  const weekLabel = `${weekStart} → ${weekEnd}`;

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[900px] mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-foreground leading-none">Week of {weekStart}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{weekLabel} · Prepared {today}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground print:hidden"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <BigStat label="Cash collected" value={money(weekCash)} color="text-green-400" />
          <BigStat label="Sets" value={weekSets} />
          <BigStat label="Shows" value={weekShows} />
          <BigStat label="Closes" value={weekCloses} />
        </div>

        {/* Rates */}
        <div className="grid grid-cols-3 gap-4">
          <RateStat label="Show rate" value={showRate} suffix="%" good={showRate >= 70} />
          <RateStat label="Close rate" value={closeRate} suffix="%" good={closeRate >= 25} />
          <RateStat label="EOD compliance" value={complianceRate} suffix="%" good={complianceRate >= 90} />
        </div>

        <hr className="border-border" />

        {/* Team & wins */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <BigStat label="EODs filed" value={`${eodCount}/${expectedEods}`} color={complianceRate >= 90 ? "text-green-400" : "text-amber-400"} />
          <BigStat label="Student wins" value={milestonesThisWeek} />
          <BigStat label="Testimonials" value={testimonials} />
          <BigStat label="Content posted" value={contentPosted} />
        </div>

        <hr className="border-border print:hidden" />

        {/* Notes section for the call */}
        <div className="space-y-3 print:block">
          <h2 className="text-[13px] font-medium text-muted-foreground">Notes for the review call</h2>
          <div className="space-y-2">
            {["What went well this week?", "What needs to improve?", "Focus for next week"].map(q => (
              <div key={q} className="rounded-sm border border-dashed border-border p-3 print:border-solid print:min-h-[80px]">
                <div className="text-xs font-medium text-muted-foreground mb-1">{q}</div>
                <div className="text-xs text-muted-foreground/50 print:hidden">Write here during the call…</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@media print { .{ background: white; color: black; } }`}</style>
    </div>
  );
}

function BigStat({ label, value, color = "text-foreground" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card-surface p-4 text-center print:border-gray-300">
      <div className={`text-[28px] font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function RateStat({ label, value, suffix, good }: { label: string; value: number; suffix: string; good: boolean }) {
  return (
    <div className={`rounded-sm border p-4 text-center ${good ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <div className={`text-[28px] font-bold tabular-nums ${good ? "text-green-400" : "text-amber-400"}`}>{value}{suffix}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
