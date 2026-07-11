import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMochiDashboard, getMochiDetail, type MochiPeriod } from "@/lib/mochi.functions";
import { Area, AreaChart, Bar, BarChart, Legend, Pie, PieChart, Tooltip, XAxis } from "@/components/dither-kit";
import { MochiFunnel } from "@/components/mochi-funnel";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/mochi")({
  head: () => ({ meta: [{ title: "Instagram CRM — ISA Portal" }] }),
  component: MochiPage,
});

const PERIODS: { label: string; value: MochiPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "7D", value: "last_7_days" },
  { label: "30D", value: "last_30_days" },
];

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  IN_CONTACT: "In contact",
  QUALIFIED: "Qualified",
  CALL_BOOKED: "Call booked",
  WON: "Won",
  LOST: "Lost",
};

function MochiPage() {
  const { roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("founder");
  const [period, setPeriod] = useState<MochiPeriod>("last_7_days");

  const detail = useQuery({
    queryKey: ["mochi-detail", period],
    queryFn: () => getMochiDetail({ data: { period } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: canView,
    retry: 1,
  });
  const dash = useQuery({
    queryKey: ["mochi-dashboard", period === "today" ? "last_7_days" : period],
    queryFn: () => getMochiDashboard({ data: { period: period === "today" ? "last_7_days" : period } }),
    staleTime: 2 * 60_000,
    enabled: canView,
    retry: 1,
  });

  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Instagram className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-title">Instagram CRM</div>
        <p className="text-caption text-muted-foreground">Admin or founder access required.</p>
      </div>
    );
  }

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

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground flex items-center gap-2.5">
            <Instagram className="h-6 w-6 text-muted-foreground" /> Instagram CRM
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
          <SectionTitle title="The funnel" sub="every lead's current stage" />
        </div>
        <MochiFunnel pipeline={d?.pipelineNow ?? []} />
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
            value={d?.medianResponseMinutes != null ? `${Math.round(d.medianResponseMinutes)}m` : "—"}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Leads & bookings" sub="daily">
          <AreaChart
            data={trend}
            config={{ leads: { label: "New leads", color: "green" }, booked: { label: "Booked", color: "blue" } }}
          >
            <XAxis dataKey="day" maxTicks={6} />
            <Legend />
            <Tooltip labelKey="day" />
            <Area dataKey="leads" variant="gradient" />
            <Area dataKey="booked" variant="dotted" />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Setter response time" sub="how fast DMs get answered">
          <BarChart data={d?.responseBuckets ?? []} config={{ count: { label: "Replies", color: "purple" } }}>
            <XAxis dataKey="label" maxTicks={8} />
            <Tooltip labelKey="label" />
            <Bar dataKey="count" variant="gradient" />
          </BarChart>
        </ChartCard>

        {sources.length > 0 && (
          <ChartCard title="Where leads come from" sub="by Instagram touchpoint">
            <PieChart
              data={sources}
              dataKey="leads"
              nameKey="name"
              innerRadius={0.55}
              config={{
                dm: { label: "DM", color: "green" },
                comment: { label: "Comment", color: "blue" },
                story: { label: "Story", color: "purple" },
                outbound: { label: "Outbound", color: "orange" },
              }}
            >
              <Legend align="center" />
              <Tooltip />
              <Pie variant="gradient" />
            </PieChart>
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

function Stat({ label, value, sub }: { label: string; value?: number | null; sub?: string }) {
  return (
    <div className="card-surface px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[22px] font-medium tabular-nums text-foreground leading-tight">
        {value != null ? value.toLocaleString() : "…"}
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
