import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Instagram } from "lucide-react";
import { getMochiDashboard, type MochiPeriod } from "@/lib/mochi.functions";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

const PERIODS: { label: string; value: MochiPeriod }[] = [
  { label: "24H", value: "today" },
  { label: "7D", value: "last_7_days" },
  { label: "30D", value: "last_30_days" },
];

/** Instagram funnel numbers from Mochi CRM — admin/founder dashboard section. */
export function MochiIgSection() {
  const [period, setPeriod] = useState<MochiPeriod>("today");
  const q = useQuery({
    queryKey: ["mochi-dashboard", period],
    queryFn: () => getMochiDashboard({ data: { period } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000, // live-ish without hammering Mochi
    retry: 1,
  });

  const d = q.data;
  if (q.isError || (d && !d.connected)) return null; // not connected — stay out of the way

  const spark = d?.funnel.map((f) => f.new_leads) ?? [];

  return (
    <div className="card-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <Link
          to="/mochi"
          className="group flex items-center gap-2 text-[13px] font-medium text-foreground hover:text-primary motion-safe:transition-colors"
        >
          <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
          Instagram
          <span className="text-[11px] text-muted-foreground font-normal">via Mochi · live</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
        </Link>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-[11px] font-medium px-2 py-1 rounded-md motion-safe:transition-colors ${
                period === p.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        {/* Even 3-up grid on phones; inline row with room to breathe on desktop */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
          <IgStat label="New leads" value={d?.totals.newLeads} loading={q.isLoading} />
          <IgStat label="Conversations" value={d?.messages?.activeConversations} loading={q.isLoading} />
          <IgStat
            label="DMs"
            value={d?.messages?.total}
            sub={d?.messages ? `${d.messages.inbound} in · ${d.messages.outbound} out` : undefined}
            loading={q.isLoading}
          />
          <IgStat label="Comment leads" value={d?.totals.comments} loading={q.isLoading} />
          <IgStat label="Booked" value={d?.totals.booked} loading={q.isLoading} />
        </div>
        {spark.length > 1 && (
          <div className="h-10 w-full sm:w-36 shrink-0" title="New leads per day">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v) => ({ v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area dataKey="v" fill="var(--chart-2)" fillOpacity={0.3} stroke="var(--chart-2)" strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function IgStat({ label, value, sub, loading }: { label: string; value?: number; sub?: string; loading: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[20px] font-medium tabular-nums text-foreground leading-tight">
        {loading ? "…" : (value ?? 0).toLocaleString()}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}
