import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { money, startOfWeekMon, isoDay } from "@/lib/revenue";
import { getMochiDashboard, getMochiPayments } from "@/lib/mochi.functions";
import { getCloseLeadStats } from "@/lib/close-crm.functions";
import { BlurMoney } from "@/components/blur-money";
import { DitherFireplace } from "@/components/founder/dither-fireplace";
import { MochiFunnelPanel } from "@/components/mochi-funnel";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The Room — the founder's cozy all-company view. One glance, no drilling:
 * cash (Whop), Instagram + Close leads, students landed, team output,
 * content shipped. Dither charts + hearth.
 */
export function TheRoomInner() {
  const today = new Date();
  const monthStart = iso(today).slice(0, 8) + "01";
  const fourteenDaysAgo = iso(subDays(today, 13));
  const sixWeeksAgo = iso(subDays(today, 41));

  const portal = useQuery({
    queryKey: ["the-room", iso(today)],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [eods, content, students, landed] = await Promise.all([
        supabase.from("eods").select("report_date, dials, dms_sent").gte("report_date", fourteenDaysAgo),
        supabase.from("content_items").select("posted_at, status").not("posted_at", "is", null).gte("posted_at", sixWeeksAgo),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }).not("offer_landed_at", "is", null),
      ]);
      return {
        eods: eods.data ?? [],
        content: content.data ?? [],
        studentCount: students.count ?? 0,
        landedCount: landed.count ?? 0,
      };
    },
  });

  const mochi = useQuery({
    queryKey: ["the-room-mochi"],
    queryFn: () => getMochiDashboard({ data: { period: "last_30_days" } }),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const payments = useQuery({
    queryKey: ["the-room-payments"],
    queryFn: () => getMochiPayments(),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const closeLeads = useQuery({
    queryKey: ["the-room-close-leads"],
    queryFn: () => getCloseLeadStats({ data: { days: 30 } }),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  // ── Shape the series ──────────────────────────────────────────────────
  // Cash: purely Whop (via Mochi's provider-synced payments)
  const whopByDay = new Map((payments.data?.series ?? []).map((s) => [s.date, s.volume]));


  const whopMtd = [...whopByDay.entries()]
    .filter(([date]) => date >= monthStart)
    .reduce((s, [, v]) => s + v, 0);



  const contentWeekly = (() => {
    const weeks = new Map<string, number>();
    for (let i = 5; i >= 0; i--) weeks.set(iso(startOfWeekMon(subDays(today, i * 7))), 0);
    for (const c of portal.data?.content ?? []) {
      const wk = isoDay(startOfWeekMon(new Date(c.posted_at as string)));
      if (weeks.has(wk)) weeks.set(wk, (weeks.get(wk) ?? 0) + 1);
    }
    return [...weeks.entries()].map(([wk, posts]) => ({ week: format(new Date(wk), "MMM d"), posts }));
  })();



  const contentThisCycle = contentWeekly.slice(-2).reduce((s, w) => s + w.posts, 0);
  const totalLeads30 = (mochi.data?.totals.newLeads ?? 0) + (closeLeads.data?.total ?? 0);
  const successRate = portal.data && portal.data.studentCount > 0
    ? Math.round((portal.data.landedCount / portal.data.studentCount) * 100)
    : null;

  return (
    <div className="space-y-4">
      {/* ── The hearth ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface overflow-hidden relative lg:col-span-2 min-h-[190px]">
          {/* Fire stays in the lower half so the copy never sits in the flames */}
          <DitherFireplace className="absolute inset-x-0 bottom-0 h-[55%]" />
          <div className="relative p-5 flex items-start justify-between pointer-events-none">
            <div>
              <div className="text-[13px] font-medium text-foreground">Hearth</div>
              <div className="text-[11px] text-muted-foreground">Everything the company did, in one warm place.</div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono text-right">
              {format(today, "EEEE, MMM d")}
            </div>
          </div>
        </div>

        <div className="card-surface p-5 space-y-4">
          <RoomStat label="Cash collected this month · Whop">
            <BlurMoney>{payments.data?.connected ? money(Math.round(whopMtd)) : "…"}</BlurMoney>
          </RoomStat>
          <RoomStat label="Whop net · 30 days">
            <BlurMoney>{payments.data?.net30 != null ? money(Math.round(payments.data.net30)) : "—"}</BlurMoney>
          </RoomStat>
          <RoomStat label="Leads · 30 days · IG + Close">
            {mochi.data || closeLeads.data ? totalLeads30.toLocaleString() : "…"}
          </RoomStat>
          <RoomStat label="Content posted · this cycle">{portal.data ? contentThisCycle : "…"}</RoomStat>
        </div>
      </div>

      {/* ── The funnel — Mochi pipeline, their dashboard's look ───────── */}
      <MochiFunnelPanel />

      {/* ── Students ────────────────────────────────────────────────── */}
      <div className="card-surface px-5 py-4 flex flex-wrap items-center gap-x-10 gap-y-3">
        <RoomStat label="Students">{portal.data?.studentCount ?? "…"}</RoomStat>
        <RoomStat label="Landed roles">{portal.data?.landedCount ?? "…"}</RoomStat>
        <RoomStat label="Success rate">{successRate != null ? `${successRate}%` : "—"}</RoomStat>
        <div className="flex-1 min-w-[140px] h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-success motion-safe:transition-[width] duration-500 ease-(--ease-out)"
            style={{ width: `${successRate ?? 0}%` }}
          />
        </div>
      </div>

    </div>
  );
}

function RoomStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[22px] font-medium tabular-nums text-foreground leading-tight">{children}</div>
    </div>
  );
}

