import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { money, startOfWeekMon, isoDay } from "@/lib/revenue";
import { getMochiDashboard, getMochiPayments } from "@/lib/mochi.functions";
import { BlurMoney } from "@/components/blur-money";
import { DitherFireplace } from "@/components/founder/dither-fireplace";
import { Area, AreaChart, Bar, BarChart, Legend, Pie, PieChart, Tooltip, XAxis } from "@/components/dither-kit";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The Room — the founder's cozy all-company view. One glance, no drilling:
 * cash, Instagram leads, team output, content shipped. Dither charts + hearth.
 */
export function TheRoomInner() {
  const today = new Date();
  const monthStart = iso(today).slice(0, 8) + "01";
  const eightWeeksAgo = iso(startOfWeekMon(subDays(today, 7 * 7)));
  const fourteenDaysAgo = iso(subDays(today, 13));
  const sixWeeksAgo = iso(subDays(today, 41));

  const portal = useQuery({
    queryKey: ["the-room", iso(today)],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [deals, eods, content, students] = await Promise.all([
        supabase.from("deals").select("deal_date, cash_collected_upfront").gte("deal_date", eightWeeksAgo),
        supabase.from("eods").select("report_date, dials, dms_sent, calls_booked").gte("report_date", fourteenDaysAgo),
        supabase.from("content_items").select("posted_at, status").not("posted_at", "is", null).gte("posted_at", sixWeeksAgo),
        supabase.from("students").select("id", { count: "exact", head: true }),
      ]);
      return {
        deals: deals.data ?? [],
        eods: eods.data ?? [],
        content: content.data ?? [],
        studentCount: students.count ?? 0,
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
    queryFn: () => getMochiPayments({ data: { period: "last_30_days" } }),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  // ── Shape the series ──────────────────────────────────────────────────
  const cashWeekly = (() => {
    const weeks = new Map<string, number>();
    for (let i = 7; i >= 0; i--) weeks.set(iso(startOfWeekMon(subDays(today, i * 7))), 0);
    for (const d of portal.data?.deals ?? []) {
      const wk = isoDay(startOfWeekMon(new Date(d.deal_date)));
      if (weeks.has(wk)) weeks.set(wk, (weeks.get(wk) ?? 0) + Number(d.cash_collected_upfront || 0));
    }
    return [...weeks.entries()].map(([wk, cash]) => ({ week: format(new Date(wk), "MMM d"), cash }));
  })();

  const outputDaily = (() => {
    const days = new Map<string, { dials: number; dms: number }>();
    for (let i = 13; i >= 0; i--) days.set(iso(subDays(today, i)), { dials: 0, dms: 0 });
    for (const e of portal.data?.eods ?? []) {
      const row = days.get(e.report_date);
      if (row) { row.dials += e.dials ?? 0; row.dms += e.dms_sent ?? 0; }
    }
    return [...days.entries()].map(([d, v]) => ({ day: format(new Date(d), "d MMM"), ...v }));
  })();

  const contentWeekly = (() => {
    const weeks = new Map<string, number>();
    for (let i = 5; i >= 0; i--) weeks.set(iso(startOfWeekMon(subDays(today, i * 7))), 0);
    for (const c of portal.data?.content ?? []) {
      const wk = isoDay(startOfWeekMon(new Date(c.posted_at as string)));
      if (weeks.has(wk)) weeks.set(wk, (weeks.get(wk) ?? 0) + 1);
    }
    return [...weeks.entries()].map(([wk, posts]) => ({ week: format(new Date(wk), "MMM d"), posts }));
  })();

  // Mochi's trend only includes days with activity — pad the window with zeros
  const igDaily = (() => {
    const byDay = new Map((mochi.data?.funnel ?? []).map((f) => [f.day, f]));
    const days: { day: string; leads: number; booked: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = iso(subDays(today, i));
      const f = byDay.get(d);
      days.push({ day: format(new Date(d), "d MMM"), leads: f?.new_leads ?? 0, booked: f?.booked ?? 0 });
    }
    return days;
  })();

  const igSources = (mochi.data?.sources ?? [])
    .filter((s) => s.lead_count > 0)
    .map((s) => ({ name: s.source.toLowerCase(), leads: s.lead_count }));

  const cashMtd = (portal.data?.deals ?? [])
    .filter((d) => d.deal_date >= monthStart)
    .reduce((s, d) => s + Number(d.cash_collected_upfront || 0), 0);

  const contentThisCycle = contentWeekly.slice(-2).reduce((s, w) => s + w.posts, 0);

  return (
    <div className="space-y-4">
      {/* ── The hearth ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface overflow-hidden relative lg:col-span-2 min-h-[170px]">
          <DitherFireplace className="absolute inset-0" />
          <div className="relative p-5 flex flex-col justify-between h-full pointer-events-none">
            <div>
              <div className="text-[13px] font-medium text-foreground">The hearth</div>
              <div className="text-[11px] text-muted-foreground">Everything the company did, in one warm place.</div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {format(today, "EEEE, MMM d")} · {portal.data?.studentCount ?? "…"} students
            </div>
          </div>
        </div>

        <div className="card-surface p-5 space-y-4">
          <RoomStat label="Cash collected this month">
            <BlurMoney>{cashMtd > 0 ? money(cashMtd) : "—"}</BlurMoney>
          </RoomStat>
          <RoomStat label="IG leads · 30 days">{mochi.data ? mochi.data.totals.newLeads.toLocaleString() : "…"}</RoomStat>
          <RoomStat label="Content posted · this cycle">{portal.data ? contentThisCycle : "…"}</RoomStat>
          {payments.data?.netRevenue != null && (
            <RoomStat label="Whop net · 30 days">
              <BlurMoney>{money(payments.data.netRevenue)}</BlurMoney>
            </RoomStat>
          )}
        </div>
      </div>

      {/* ── The charts ──────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <RoomChart title="Cash collected" sub="weekly · last 8 weeks">
          <BarChart data={cashWeekly} config={{ cash: { label: "Cash", color: "green" } }}>
            <XAxis dataKey="week" maxTicks={4} />
            <Tooltip labelKey="week" />
            <Bar dataKey="cash" variant="gradient" />
          </BarChart>
        </RoomChart>

        <RoomChart title="Instagram leads" sub="daily · last 30 days · Mochi">
          <AreaChart
            data={igDaily.length ? igDaily : [{ day: "", leads: 0, booked: 0 }]}
            config={{ leads: { label: "New leads", color: "green" }, booked: { label: "Booked", color: "blue" } }}
          >
            <XAxis dataKey="day" maxTicks={5} />
            <Tooltip labelKey="day" />
            <Area dataKey="leads" variant="gradient" />
            <Area dataKey="booked" variant="dotted" />
          </AreaChart>
        </RoomChart>

        <RoomChart title="Team output" sub="daily dials & DMs · last 14 days">
          <AreaChart
            data={outputDaily}
            config={{ dials: { label: "Dials", color: "blue" }, dms: { label: "DMs", color: "purple" } }}
          >
            <XAxis dataKey="day" maxTicks={5} />
            <Legend />
            <Tooltip labelKey="day" />
            <Area dataKey="dials" variant="gradient" />
            <Area dataKey="dms" variant="hatched" />
          </AreaChart>
        </RoomChart>

        {igSources.length > 0 ? (
          <RoomChart title="Where leads come from" sub="last 30 days · Mochi">
            <PieChart
              data={igSources}
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
          </RoomChart>
        ) : (
          <RoomChart title="Content posted" sub="weekly · last 6 weeks">
            <BarChart data={contentWeekly} config={{ posts: { label: "Posts", color: "orange" } }}>
              <XAxis dataKey="week" maxTicks={6} />
              <Tooltip labelKey="week" />
              <Bar dataKey="posts" variant="gradient" />
            </BarChart>
          </RoomChart>
        )}
      </div>

      {/* Content chart still shows when the pie takes its slot */}
      {igSources.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <RoomChart title="Content posted" sub="weekly · last 6 weeks">
            <BarChart data={contentWeekly} config={{ posts: { label: "Posts", color: "orange" } }}>
              <XAxis dataKey="week" maxTicks={6} />
              <Tooltip labelKey="week" />
              <Bar dataKey="posts" variant="gradient" />
            </BarChart>
          </RoomChart>
        </div>
      )}
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

function RoomChart({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <div className="mb-3">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className="h-48">{children}</div>
    </div>
  );
}
