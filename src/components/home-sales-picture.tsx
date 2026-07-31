import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, CalendarCheck2, Eye, HandCoins, PhoneCall, Target, UserRound, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, startOfWeek, subDays } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/revenue";
import { getPeriod } from "@/lib/payout-period";
import { kpiTargetsFor, outreachOf, type SetterType, type EodKpiRow } from "@/lib/eod-kpi";
import { listCloseLeads } from "@/lib/close-crm.functions";
import { BlurMoney } from "@/components/blur-money";

/**
 * Abu Bilal's home picture (founder 2026-07-31, expanded same day): he runs
 * sales, so his overview opens on the day's load-bearing numbers — sets,
 * show rate, yesterday's volume vs target (dials, DMs AND sets), cash, and
 * pipeline — plus a per-setter week table for the "why is this not working"
 * conversation. Deliberately LARGE and calm: full words, no dense grids.
 */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

type SetterWeekRow = {
  id: string;
  name: string;
  sets: number;
  showed: number;
  noShows: number;
  showRate: number | null;
  yesterday: string;
  short: boolean;
};

export function HomeSalesPicture() {
  const closeLeadsFn = useServerFn(listCloseLeads);

  const q = useQuery({
    queryKey: ["page", "home", "sales"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const today = iso(new Date());
      const yesterday = iso(subDays(new Date(), 1));
      const weekStart = iso(startOfWeek(new Date(), { weekStartsOn: 1 }));
      const period = getPeriod(0);
      const dealsFrom = weekStart < period.start ? weekStart : period.start;
      const [setsRes, eodsRes, profilesRes, setterRolesRes, dealsRes, weekPaysRes] = await Promise.all([
        (supabase.from("set_reminders" as never)
          .select("id, owner_id, status, attendance_status, event_start")
          .gte("event_start", weekStart + "T00:00:00") as any),
        supabase.from("eods")
          .select("user_id, report_date, dials, dms_sent, leads_contacted, calls_booked")
          .eq("report_date", yesterday),
        supabase.from("profiles").select("id, display_name, setter_type, active").eq("is_demo", false),
        supabase.from("user_roles").select("user_id").eq("role", "setter"),
        supabase.from("deals")
          .select("id, cash_collected_upfront, deal_date")
          .eq("is_demo", false)
          .is("voided_at", null)
          .gte("deal_date", dealsFrom)
          .lte("deal_date", period.end),
        supabase.from("installment_payments")
          .select("amount, paid_at, installments!inner(students!inner(is_demo))")
          .eq("installments.students.is_demo", false)
          .eq("status", "paid")
          .gte("paid_at", weekStart + "T00:00:00"),
      ]);

      const sets = ((setsRes.data ?? []) as { id: string; owner_id: string | null; status: string; attendance_status: string; event_start: string }[]);
      const liveSets = sets.filter((s) => s.status !== "cancelled");
      const setsToday = liveSets.filter((s) => s.event_start.slice(0, 10) === today).length;
      const showed = liveSets.filter((s) => s.attendance_status === "showed").length;
      const noShows = liveSets.filter((s) => s.attendance_status === "no_show").length;
      const showDen = showed + noShows;
      const unclaimed = liveSets.filter((s) => !s.owner_id).length;

      // Yesterday's setter volume vs the targets that applied yesterday —
      // dials/DMs AND booked sets, judged per setter type like Performance.
      const setterIds = new Set(((setterRolesRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
      const profiles = ((profilesRes.data ?? []) as { id: string; display_name: string | null; setter_type: string | null; active: boolean | null }[]);
      const setters = profiles.filter((p) => setterIds.has(p.id) && p.active !== false && p.setter_type);
      const eods = ((eodsRes.data ?? []) as (EodKpiRow & { user_id?: string })[]);
      let dials = 0, dms = 0, setsBookedYest = 0, dialTarget = 0, dmTarget = 0, setsTarget = 0;
      const missed: string[] = [];
      const setterRows: SetterWeekRow[] = [];
      for (const p of setters) {
        const st = p.setter_type as Exclude<SetterType, null>;
        const t = kpiTargetsFor(st, yesterday);
        const mine = eods.filter((e) => e.user_id === p.id);
        const myDials = mine.reduce((s, e) => s + (e.dials ?? 0), 0);
        const myDms = mine.reduce((s, e) => s + outreachOf(e), 0);
        const mySets = mine.reduce((s, e) => s + (e.calls_booked ?? 0), 0);
        dials += myDials;
        dms += myDms;
        setsBookedYest += mySets;
        setsTarget += t.sets;
        if (st === "dm") dmTarget += t.primaryTarget;
        else if (st === "phone") dialTarget += t.primaryTarget;
        else { dialTarget += t.primaryTarget; dmTarget += t.secondaryTarget ?? 0; }
        const hitPrimary = st === "dm" ? myDms >= t.primaryTarget : myDials >= t.primaryTarget;
        const hitSecondary = st === "full_cycle" ? myDms >= (t.secondaryTarget ?? 0) : true;
        const hitSets = mySets >= t.sets;
        const short = mine.length === 0 || !hitPrimary || !hitSecondary || !hitSets;
        if (short) missed.push(p.display_name ?? "Unknown");

        const mySetRows = liveSets.filter((s) => s.owner_id === p.id);
        const myShowed = mySetRows.filter((s) => s.attendance_status === "showed").length;
        const myNoShow = mySetRows.filter((s) => s.attendance_status === "no_show").length;
        const den = myShowed + myNoShow;
        const primaryLabel = st === "dm" ? `${myDms} DMs` : `${myDials} dials`;
        setterRows.push({
          id: p.id,
          name: p.display_name ?? "Unknown",
          sets: mySetRows.length,
          showed: myShowed,
          noShows: myNoShow,
          showRate: den > 0 ? Math.round((myShowed / den) * 100) : null,
          yesterday: mine.length === 0 ? "no report" : `${primaryLabel} · ${mySets} sets`,
          short,
        });
      }
      setterRows.sort((a, b) => b.sets - a.sets);

      const deals = ((dealsRes.data ?? []) as { id: string; cash_collected_upfront: number | null; deal_date: string }[]);
      const periodDeals = deals.filter((d) => d.deal_date >= period.start);
      const periodCash = periodDeals.reduce((s, d) => s + Number(d.cash_collected_upfront ?? 0), 0);
      const weekUpfront = deals.filter((d) => d.deal_date >= weekStart).reduce((s, d) => s + Number(d.cash_collected_upfront ?? 0), 0);
      const weekInstall = ((weekPaysRes.data ?? []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);

      let pipeline: { configured: boolean; active: number; value: number } = { configured: false, active: 0, value: 0 };
      try {
        const close = await closeLeadsFn();
        if (close?.configured) {
          const leads = (close.leads ?? []) as { status_type?: string | null; value?: number | null }[];
          const active = leads.filter((l) => l.status_type === "active");
          pipeline = {
            configured: true,
            active: active.length,
            value: active.reduce((s, l) => s + Number(l.value ?? 0), 0),
          };
        }
      } catch { /* Close not reachable · tile shows not connected */ }

      return {
        setsWeek: liveSets.length,
        setsToday,
        showRate: showDen > 0 ? Math.round((showed / showDen) * 100) : null,
        showed,
        noShows,
        unclaimed,
        dials,
        dms,
        setsBookedYest,
        dialTarget,
        dmTarget,
        setsTarget,
        missed,
        closes: periodDeals.length,
        periodCash,
        periodLabel: period.label,
        weekCash: weekUpfront + weekInstall,
        weekUpfront,
        weekInstall,
        pipeline,
        setterRows,
      };
    },
  });

  const d = q.data;

  return (
    <section className="card-surface overflow-hidden" aria-labelledby="sales-picture-title">
      <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sales</p>
        <h2 id="sales-picture-title" className="mt-1 text-title font-semibold text-foreground">Today's picture</h2>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        <BigTile
          icon={CalendarCheck2}
          label="Sets this week"
          detail={`${d?.setsToday ?? 0} booked for today`}
          value={d ? String(d.setsWeek) : "…"}
          to="/calendar"
        />
        <BigTile
          icon={Eye}
          label="Show rate this week"
          detail={d ? `${d.showed} showed · ${d.noShows} did not show` : "…"}
          value={d ? (d.showRate != null ? `${d.showRate}%` : "–") : "…"}
          to="/calendar"
          tone={d?.showRate != null && d.showRate < 50 ? "danger" : undefined}
        />
        <BigTile
          icon={PhoneCall}
          label="Volume yesterday"
          detail={d ? `${d.dials} dials of ${d.dialTarget} · ${d.dms} DMs of ${d.dmTarget} · ${d.setsBookedYest} sets of ${d.setsTarget}` : "…"}
          value={d ? (d.missed.length === 0 ? "On target" : `${d.missed.length} short`) : "…"}
          to="/performance"
          tone={d && d.missed.length > 0 ? "warning" : undefined}
          small
        />
        <BigTile
          icon={Wallet}
          label="Cash collected this week"
          detail={d ? `${money(d.weekUpfront)} upfront · ${money(d.weekInstall)} installments` : "…"}
          value={d ? "" : "…"}
          valueSub={d ? <span className="text-xl font-medium text-foreground"><BlurMoney>{money(d.weekCash)}</BlurMoney></span> : undefined}
          to="/revenue"
        />
        <BigTile
          icon={HandCoins}
          label="Closes this period"
          detail={d ? d.periodLabel : "…"}
          value={d ? String(d.closes) : "…"}
          valueSub={d ? <BlurMoney>{money(d.periodCash)}</BlurMoney> : undefined}
          to="/revenue"
        />
        <BigTile
          icon={Target}
          label="Pipeline in Close"
          detail={d?.pipeline.configured ? "Active leads being worked" : "Close is not connected"}
          value={d ? (d.pipeline.configured ? String(d.pipeline.active) : "–") : "…"}
          valueSub={d?.pipeline.configured ? <BlurMoney>{money(d.pipeline.value)}</BlurMoney> : undefined}
          to="/crm"
        />
        <BigTile
          icon={UserRound}
          label="Unclaimed sets"
          detail="Booked calls waiting for an owner"
          value={d ? String(d.unclaimed) : "…"}
          to="/calendar"
          tone={d && d.unclaimed > 0 ? "warning" : undefined}
        />
      </div>
      {d && d.setterRows.length > 0 && (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-caption font-medium text-foreground">Setters this week</p>
            <Link to={"/performance" as string} className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open Performance <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-caption">
              <thead>
                <tr className="text-micro text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Setter</th>
                  <th className="text-right py-1.5 font-medium">Sets</th>
                  <th className="text-right py-1.5 font-medium">Showed</th>
                  <th className="text-right py-1.5 font-medium">No-show</th>
                  <th className="text-right py-1.5 font-medium">Show rate</th>
                  <th className="text-right py-1.5 font-medium">Yesterday</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.setterRows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium text-foreground">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">{r.sets}</td>
                    <td className="py-2 text-right tabular-nums">{r.showed}</td>
                    <td className="py-2 text-right tabular-nums">{r.noShows}</td>
                    <td className="py-2 text-right tabular-nums">{r.showRate != null ? `${r.showRate}%` : "–"}</td>
                    <td className={`py-2 text-right tabular-nums ${r.short ? "text-warning-fg" : "text-muted-foreground"}`}>{r.yesterday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {d && d.missed.length > 0 && (
        <div className="border-t border-border px-5 py-3 sm:px-6 text-caption text-muted-foreground">
          Short on volume yesterday: <span className="text-foreground font-medium">{d.missed.join(", ")}</span>
          <Link to={"/performance" as string} className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            See their days <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  );
}

function BigTile({ icon: Icon, label, detail, value, valueSub, to, tone, small }: {
  icon: LucideIcon;
  label: string;
  detail: string;
  value: string;
  valueSub?: React.ReactNode;
  to: string;
  tone?: "danger" | "warning";
  small?: boolean;
}) {
  return (
    <Link
      to={to as string}
      className="group grid min-h-20 grid-cols-[32px_minmax(0,1fr)_auto_18px] items-center gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted/40 motion-safe:transition-colors sm:odd:border-r xl:[&:nth-child(3n)]:border-r-0 xl:[&:not(:nth-child(3n))]:border-r sm:px-6"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-foreground">{label}</span>
        <span className="block truncate text-caption text-muted-foreground">{detail}</span>
      </span>
      <span className="text-right">
        <span className={`block ${small ? "text-[15px]" : "text-2xl"} font-medium tabular-nums leading-tight ${tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : "text-foreground"}`}>
          {value}
        </span>
        {valueSub && <span className="block text-caption text-muted-foreground tabular-nums">{valueSub}</span>}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground motion-safe:transition-colors" />
    </Link>
  );
}
