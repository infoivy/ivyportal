import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram, ArrowUpRight, RefreshCw } from "lucide-react";
import { getMochiDashboard, getMochiDetail, getMochiHome, type MochiHomePeriod, type MochiPeriod } from "@/lib/mochi.functions";
import { ResponsiveContainer, ComposedChart, Area, Bar, BarChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { MochiFunnel } from "@/components/mochi-funnel";
import { format, subDays } from "date-fns";

const PERIODS: { label: string; value: MochiPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "7D", value: "last_7_days" },
  { label: "30D", value: "last_30_days" },
];

/** The full Instagram CRM view — used by the /mochi route and the CRM page's Instagram tab. */
export function MochiCrmInner({ embedded = false }: { embedded?: boolean }) {
  const [period, setPeriod] = useState<MochiPeriod>("today");

  const detail = useQuery({
    queryKey: ["mochi-detail", period],
    queryFn: () => getMochiDetail({ data: { period } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const homePeriod: MochiHomePeriod = period === "today" ? "today" : period === "last_30_days" ? "last_30_days" : "this_week";
  const home = useQuery({
    queryKey: ["mochi-home", homePeriod],
    queryFn: () => getMochiHome({ data: { period: homePeriod } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const h = home.data;

  const dash = useQuery({
    queryKey: ["mochi-dashboard", period === "today" ? "last_7_days" : period],
    queryFn: () => getMochiDashboard({ data: { period: period === "today" ? "last_7_days" : period } }),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const d = detail.data;
  const days = period === "last_30_days" ? 30 : period === "last_7_days" ? 7 : 1;
  const today = new Date();

  // Zero-pad the trend to the full window
  const trendByDay = new Map((dash.data?.funnel ?? []).map((f) => [f.day, f]));
  const trend = Array.from({ length: Math.max(days, 7) }, (_, i) => {
    const dt = new Date(today.getTime() - (Math.max(days, 7) - 1 - i) * 86400000);
    const key = dt.toISOString().slice(0, 10);
    const f = trendByDay.get(key);
    return { day: format(subDays(today, Math.max(days, 7) - 1 - i), "d MMM"), leads: f?.new_leads ?? 0, booked: f?.booked ?? 0 };
  });

  const sources = (dash.data?.sources ?? [])
    .filter((s) => s.lead_count > 0)
    .map((s) => ({ name: s.source.toLowerCase(), leads: s.lead_count }));

  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className={embedded ? "space-y-5" : "w-full max-w-none p-4 sm:p-6 space-y-5"}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground flex items-center gap-2.5">
            <Instagram className="h-6 w-6 text-muted-foreground" /> Mochi
          </h1>
          <p className="text-body text-muted-foreground mt-0.5">
            Live from Mochi ·{" "}
            <a
              href="https://use.themochi.app"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5"
            >
              open Mochi <ArrowUpRight className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-[12px] font-medium px-2.5 py-1.5 rounded-md motion-safe:transition-colors ${
                period === p.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {d && !d.connected && (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">
          Mochi isn't connected. Ask Claude to re-run the Mochi authorization.
        </div>
      )}

      {(detail.isError || home.isError || dash.isError) && (
        <div className="rounded-lg border border-warning/25 bg-warning-bg px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-warning-fg flex-1 min-w-[200px]">
            Some Mochi data failed to load, so tiles below may be incomplete or stale.
          </p>
          <button
            onClick={() => { void detail.refetch(); void home.refetch(); void dash.refetch(); }}
            disabled={detail.isFetching || home.isFetching || dash.isFetching}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border border-warning/25 text-warning-fg hover:bg-warning-bg/60 motion-safe:transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${detail.isFetching || home.isFetching || dash.isFetching ? "animate-spin" : ""}`} /> Retry
          </button>
        </div>
      )}

      {/* ── Mochi dashboard replica: revenue KPIs ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total revenue" money value={h?.totalRevenue ?? undefined} />
        <Stat label="Cash collected" money value={h?.cashCollected ?? undefined} />
        <Stat label="Cash to be collected" money value={h?.cashPending ?? undefined} />
        <div className="card-surface px-4 py-3">
          <div className="text-[11px] text-muted-foreground">Compared to prev month</div>
          <div className={`text-[22px] font-medium tabular-nums leading-tight ${h?.prevMonthPct != null && h.prevMonthPct >= 0 ? "text-success-fg" : "text-danger-fg"}`}>
            {h?.prevMonthPct != null ? `${h.prevMonthPct >= 0 ? "+" : ""}${h.prevMonthPct}%` : "–"}
          </div>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="New leads" value={dash.data?.totals.newLeads} />
        <Stat label="Active convos" value={d?.messages?.activeConversations} />
        <Stat label="DMs in" value={d?.messages?.inbound} />
        <Stat label="DMs out" value={d?.messages?.outbound} sub={d?.messages?.ai ? `${d.messages.ai} AI-assisted` : undefined} />
        <Stat label="Qualified" value={d?.conversion?.reachedQualified} />
        <Stat label="Booked" value={d?.conversion?.reachedBooked} />
      </div>

      {/* Pipeline funnel — Mochi's dashboard look */}
      <div className="card-surface p-1">
        <div className="px-3 pt-3 pb-1">
          <SectionTitle title="Default Funnel" sub="every lead's current stage" />
        </div>
        <MochiFunnel pipeline={d?.pipelineNow ?? []} />
      </div>

      {/* Upcoming payments / recent collections — the Mochi pair */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-surface p-4">
          <SectionTitle title="Upcoming Payments" sub={`total pending · $${(h?.cashPending ?? 0).toLocaleString()}`} />
          {(h?.upcoming.length ?? 0) === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">Nothing pending.</p>
          ) : (
            <div className="space-y-1">
              {h!.upcoming.map((t, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                  <span className="truncate">{t.customer}{t.product && <span className="text-muted-foreground"> · {t.product}</span>}</span>
                  <span className="tabular-nums shrink-0">${t.amount.toLocaleString()} <span className="text-muted-foreground">{t.date.slice(5)}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card-surface p-4">
          <SectionTitle title="Recent Collections" sub="latest successful charges" />
          {(h?.recent.length ?? 0) === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">No collections yet.</p>
          ) : (
            <div className="space-y-1">
              {h!.recent.map((t, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                  <span className="truncate">{t.customer}{t.product && <span className="text-muted-foreground"> · {t.product}</span>}</span>
                  <span className="tabular-nums shrink-0 text-success-fg">${t.amount.toLocaleString()} <span className="text-muted-foreground">{t.date.slice(5)}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversion rates */}
      <div className="card-surface p-4">
        <SectionTitle title="Conversion" sub={`cohort of ${d?.conversion?.cohortSize ?? 0} leads created in period`} />
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <RateStat label="New → Qualified" value={pct(d?.conversion?.newToQualified ?? null)} />
          <RateStat label="Qualified → Booked" value={pct(d?.conversion?.qualifiedToBooked ?? null)} />
          <RateStat label="Booked → Won" value={pct(d?.conversion?.bookedToWon ?? null)} />
          <RateStat label="Lead reply rate" value={pct(d?.replyRate ?? null)} />
          <RateStat
            label="Median response"
            value={d?.medianResponseMinutes != null ? `${Math.round(d.medianResponseMinutes)}m` : "–"}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Leads & bookings" sub="daily">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--foreground)" }} />
              <Area dataKey="leads" name="New leads" fill="var(--chart-2)" fillOpacity={0.25} stroke="var(--chart-2)" strokeWidth={1.5} />
              <Line dataKey="booked" name="Booked" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Setter response time" sub="how fast DMs get answered">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d?.responseBuckets ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--foreground)" }} />
              <Bar dataKey="count" name="Replies" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {sources.length > 0 && (
          <ChartCard title="Where leads come from" sub="by Instagram touchpoint">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie data={sources} dataKey="leads" nameKey="name" innerRadius="55%" outerRadius="80%" strokeWidth={0} paddingAngle={2}>
                  {sources.map((entry, i) => (
                    <Cell key={entry.name} fill={["var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-3)"][i % 4]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Numbers refresh every 5 minutes. Full lead management lives in{" "}
        <a href="https://use.themochi.app" target="_blank" rel="noreferrer" className="text-primary hover:underline">Mochi</a>
        {" "}· Close CRM view is on <Link to="/crm" className="text-primary hover:underline">/crm</Link>.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, money }: { label: string; value?: number | null; sub?: string; money?: boolean }) {
  return (
    <div className="card-surface px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[22px] font-medium tabular-nums text-foreground leading-tight">
        {value != null ? `${money ? "$" : ""}${value.toLocaleString()}` : "…"}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RateStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[18px] font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <SectionTitle title={title} sub={sub} />
      <div className="h-48">{children}</div>
    </div>
  );
}
