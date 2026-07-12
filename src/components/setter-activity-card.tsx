import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall } from "lucide-react";
import { getCloseBookedCount, getCloseCallStats } from "@/lib/close-crm.functions";
import { getMochiDashboard } from "@/lib/mochi.functions";

const PERIODS = [
  { label: "24H", days: 1 },
  { label: "3D", days: 3 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
] as const;

const fmtDur = (sec: number | null) =>
  sec == null ? "—" : sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;

/**
 * Per-rep activity across both CRMs: dials + call durations from Close,
 * outbound DMs from Mochi. Admin/founder dashboard section.
 */
export function SetterActivityCard() {
  const [days, setDays] = useState<1 | 3 | 7 | 30>(1);
  const [day, setDay] = useState<string>(""); // specific YYYY-MM-DD overrides the rolling window
  const mochiPeriod = days === 1 ? "today" : days <= 7 ? "last_7_days" : "last_30_days";

  const close = useQuery({
    queryKey: ["close-call-stats", day || days],
    queryFn: () => getCloseCallStats({ data: day ? { date: day } : { days } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const booked = useQuery({
    queryKey: ["close-booked-count"],
    queryFn: () => getCloseBookedCount(),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const mochi = useQuery({
    queryKey: ["mochi-dashboard", mochiPeriod],
    queryFn: () => getMochiDashboard({ data: { period: mochiPeriod } }),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-lite"],
    staleTime: 10 * 60_000,
    queryFn: async () => (await supabase.from("profiles").select("id, display_name")).data ?? [],
  });
  const idByName = new Map((profilesQ.data ?? []).filter((p: any) => p.display_name).map((p: any) => [String(p.display_name).toLowerCase(), p.id as string]));

  const c = close.data;
  const dmByName = day ? new Map<string, number>() : new Map((mochi.data?.members ?? []).map((m) => [m.name.toLowerCase(), m.outbound]));
  if (c && !c.configured && (mochi.data?.members ?? []).length === 0) return null;

  return (
    <div className="card-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
          Setter activity
          <span className="text-[11px] text-muted-foreground font-normal">Close dials · Mochi DMs · live</span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => { setDays(p.days as 1 | 3 | 7 | 30); setDay(""); }}
              className={`text-[11px] font-medium px-2 py-1 rounded-md motion-safe:transition-colors ${
                !day && days === p.days ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={day}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDay(e.target.value)}
            title="A specific day — dials from Close; Mochi DMs only support preset windows"
            className={`text-[11px] h-6 px-1.5 rounded-md border bg-transparent motion-safe:transition-colors ${
              day ? "border-primary/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          />
        </div>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3 mb-3">
        <Total label="Dials" value={c?.totalDials} loading={close.isLoading} />
        <Total label="Answered" value={c?.totalAnswered} loading={close.isLoading} />
        <Total label="Avg call" text={c ? fmtDur(c.avgDurationSec) : undefined} loading={close.isLoading} />
        <Total label="DMs out" value={day ? undefined : mochi.data?.messages?.outbound} loading={!day && mochi.isLoading} />
        {/* CRM census, not summed into EOD sets — same booking must never count twice */}
        <Total label="Booked · in CRM now" value={booked.data?.booked} loading={booked.isLoading} />
      </div>

      {/* Per-rep rows */}
      {(c?.perUser.length ?? 0) > 0 && (
        <div className="space-y-0.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 text-[10px] uppercase tracking-wide text-muted-foreground/70 px-2 pb-1">
            <span>Rep</span><span className="text-right w-12">Dials</span><span className="text-right w-14">Answered</span><span className="text-right w-16">Avg call</span><span className="text-right w-12">DMs</span>
          </div>
          {c!.perUser.map((u) => {
            const pid = idByName.get(u.name.toLowerCase());
            const rowClass = "grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-baseline rounded-md px-2 py-1.5 hover:bg-muted/60 motion-safe:transition-colors text-[13px]";
            const cells = (
              <>
                <span className={`truncate ${pid ? "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" : "text-foreground"}`}>{u.name}</span>
                <span className="text-right w-12 tabular-nums font-medium">{u.dials}</span>
                <span className="text-right w-14 tabular-nums text-muted-foreground">{u.answered}</span>
                <span className="text-right w-16 tabular-nums text-muted-foreground">{fmtDur(u.avgDurationSec)}</span>
                <span className="text-right w-12 tabular-nums text-muted-foreground">{dmByName.get(u.name.toLowerCase()) ?? "—"}</span>
              </>
            );
            return pid ? (
              <Link key={u.name} to="/team/$id" params={{ id: pid }} className={rowClass} title="Open performance page">{cells}</Link>
            ) : (
              <div key={u.name} className={rowClass}>{cells}</div>
            );
          })}
        </div>
      )}
      {c && c.configured && c.perUser.length === 0 && (
        <p className="text-[12px] text-muted-foreground">No calls logged in Close for this period.</p>
      )}
    </div>
  );
}

function Total({ label, value, text, loading }: { label: string; value?: number; text?: string; loading: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[20px] font-medium tabular-nums text-foreground leading-tight">
        {loading ? "…" : text ?? (value ?? 0).toLocaleString()}
      </div>
    </div>
  );
}
