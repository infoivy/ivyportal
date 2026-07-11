import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { getMochiDashboard, type MochiPeriod } from "@/lib/mochi.functions";
import { Sparkline } from "@/components/dither-kit";

const PERIODS: { label: string; value: MochiPeriod }[] = [
  { label: "7D", value: "last_7_days" },
  { label: "30D", value: "last_30_days" },
];

/** Instagram funnel numbers from Mochi CRM — admin/founder dashboard section. */
export function MochiIgSection() {
  const [period, setPeriod] = useState<MochiPeriod>("last_7_days");
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
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
          Instagram
          <span className="text-[11px] text-muted-foreground font-normal">via Mochi · live</span>
        </div>
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

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
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
          <div className="h-10 w-36 shrink-0" title="New leads per day">
            <Sparkline data={spark} color="green" />
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
