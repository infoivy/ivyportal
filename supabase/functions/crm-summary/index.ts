// CRM summary for the Bun iOS app (founder-directed 2026-08-18: "i need the
// crm data, just like what we had in ivyportal ios app and in the web portal,
// like the mochi app").
//
// Why an edge function: Mochi's OAuth tokens and the Close API key live in
// `service_credentials`, which is admin-only by RLS and must never reach a
// device. The web reaches them through TanStack server functions; the phone
// has no equivalent, so this function is that server. It verifies the caller,
// reads the credentials with the service role, calls both providers, and
// returns DERIVED NUMBERS ONLY. No credential is ever in the response.
//
// Roles mirror the web exactly:
//   · Mochi analytics  → admin, founder, cofounder
//   · Close pipeline   → admin, founder, cofounder, closer

import { createClient } from "jsr:@supabase/supabase-js@2";

const MCP_URL = "https://mcp.themochi.app/mcp";
const TOKEN_URL = "https://api.themochi.app/api/zapier/oauth/token/";

const KEYS = {
  clientId: "mochi_client_id",
  access: "mochi_access_token",
  refresh: "mochi_refresh_token",
  expiresAt: "mochi_token_expires_at",
  closeKey: "close_api_key",
} as const;

type Period = "today" | "last_7_days" | "last_30_days";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Not signed in" }, 401);

  // The caller's own client: their JWT, their RLS, their roles.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  const hasRole = async (role: string) => {
    const { data } = await caller.rpc("has_role", { _user_id: userId, _role: role });
    return data === true;
  };
  const [admin, founder, cofounder, closer] = await Promise.all(
    ["admin", "founder", "cofounder", "closer"].map(hasRole),
  );
  const seesMochi = admin || founder || cofounder;
  const seesClose = seesMochi || closer;
  if (!seesClose) return json({ error: "Forbidden" }, 403);

  let period: Period = "last_7_days";
  try {
    const body = await req.json();
    if (["today", "last_7_days", "last_30_days"].includes(body?.period)) period = body.period;
  } catch {
    // No body is fine: the default window stands.
  }

  // Credentials are read with the service role and never leave this function.
  const admin_ = createClient(url, serviceKey);
  const { data: credRows } = await admin_
    .from("service_credentials")
    .select("key, value")
    .in("key", Object.values(KEYS));
  const creds = new Map<string, string>((credRows ?? []).map((r) => [r.key, r.value]));

  const out: Record<string, unknown> = {};

  // ---- Mochi ---------------------------------------------------------------

  async function freshToken(): Promise<string | null> {
    const access = creds.get(KEYS.access);
    const refresh = creds.get(KEYS.refresh);
    const clientId = creds.get(KEYS.clientId);
    const expiresAt = creds.get(KEYS.expiresAt);
    if (!access || !refresh || !clientId) return null;
    if (expiresAt && new Date(expiresAt) > new Date()) return access;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: clientId,
      }),
    });
    if (!res.ok) return null;
    const tokens = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    // Write the rotation back so the web and the app share one live token.
    const rows = [
      { key: KEYS.access, value: tokens.access_token, label: "Mochi access token", updated_by: userId },
      {
        key: KEYS.expiresAt,
        value: new Date(Date.now() + ((tokens.expires_in ?? 3600) - 300) * 1000).toISOString(),
        label: "Mochi access token expiry",
        updated_by: userId,
      },
      ...(tokens.refresh_token
        ? [{ key: KEYS.refresh, value: tokens.refresh_token, label: "Mochi refresh token", updated_by: userId }]
        : []),
    ];
    await admin_.from("service_credentials").upsert(rows, { onConflict: "key" });
    return tokens.access_token;
  }

  async function callTool<T>(token: string, name: string, args: Record<string, unknown>): Promise<T | null> {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    });
    if (!res.ok) return null;
    // The endpoint answers either plain JSON or a single SSE frame.
    const raw = await res.text();
    const payload = raw.startsWith("event:") || raw.includes("\ndata:")
      ? raw.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim() ?? "{}"
      : raw;
    try {
      const rpc = JSON.parse(payload) as {
        result?: { content?: { text?: string }[]; isError?: boolean };
        error?: unknown;
      };
      if (rpc.error || rpc.result?.isError) return null;
      return JSON.parse(rpc.result?.content?.[0]?.text ?? "{}") as T;
    } catch {
      return null;
    }
  }

  if (seesMochi) {
    const token = await freshToken();
    if (!token) {
      out.mochi = { connected: false, period };
    } else {
      type Counts = {
        inbound_messages?: number;
        outbound_messages?: number;
        total_messages?: number;
        active_conversations?: number;
        messages_by_member?: { member_name?: string; name?: string; outbound?: number; outbound_messages?: number; messages_sent?: number }[];
      };
      type Trend = { trend?: { day: string; new_leads?: number; qualified?: number; booked?: number; won?: number }[] };
      type Sources = { sources?: { source: string; label?: string; lead_count?: number; calls_booked?: number }[] };
      type Payments = { net_revenue?: string; you_keep?: string; gross_volume?: string; payments_count?: number };
      type Health = {
        status?: string;
        message?: string;
        connection?: { username?: string; is_connected?: boolean; send_paused?: boolean };
        recent_sends?: { total?: number; failed?: number; failure_rate?: number };
        instagram_protection?: { protection?: { status?: string; active_flag_count?: number } };
      };
      type Overview = {
        account?: { username?: string; is_connected?: boolean; is_send_paused?: boolean };
        growth?: { total_leads?: number; new_leads_last_30_days?: number };
      };
      type Funnel = {
        pipeline_now?: Record<string, number>;
        conversion?: {
          cohort_size?: number;
          rates?: Record<string, { value?: number | null }>;
        };
        total_revenue?: number;
      };
      type Replies = {
        total_outbound_messages?: number;
        messages_with_reply?: number;
        reply_rate?: number;
        members_breakdown?: { name?: string; total_messages?: number; replies_received?: number; reply_rate?: number }[];
      };
      type Setter = {
        new_leads?: number;
        calls_booked?: number;
        leads_qualified?: number;
        booking_rate?: number;
        avg_response_time_minutes?: number;
        median_response_time_minutes?: number;
      };
      type Hours = { distribution?: { hour: number; count: number }[]; peak_hour_utc?: number; total_messages?: number };
      type Weekday = { distribution?: { weekday: string; count: number }[]; peak_weekday_name?: string; total_messages?: number };
      type Windows = {
        members?: { name?: string; role?: string; total_active_minutes?: number; days_active?: number; avg_daily_active_minutes?: number }[];
      };

      const [counts, trend, sources, payments, health, overview, funnelMetrics, replies, setter, hours, weekday, windows] = await Promise.all([
        callTool<Counts>(token, "get_message_counts", { time_period: period }),
        callTool<Trend>(token, "get_funnel_trend", { time_period: period }),
        callTool<Sources>(token, "get_lead_source_breakdown", { time_period: period }),
        callTool<Payments>(token, "get_payment_overview", { time_period: period }),
        callTool<Health>(token, "get_account_health", {}),
        callTool<Overview>(token, "get_account_overview", {}),
        callTool<Funnel>(token, "get_funnel_metrics", { time_period: period }),
        callTool<Replies>(token, "get_lead_reply_rate", { time_period: period }),
        callTool<Setter>(token, "get_setter_metrics", { time_period: period }),
        callTool<Hours>(token, "get_message_time_distribution", { time_period: period }),
        callTool<Weekday>(token, "get_message_dayofweek_distribution", { time_period: period }),
        callTool<Windows>(token, "get_setter_active_windows", { time_period: period }),
      ]);

      const funnel = trend?.trend ?? [];
      const money = (value?: string) => {
        if (!value) return null;
        const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      };
      const pipeline = funnelMetrics?.pipeline_now ?? {};
      const rate = (key: string) => funnelMetrics?.conversion?.rates?.[key]?.value ?? null;
      const protection = health?.instagram_protection?.protection;

      // One row per setter: sends, replies and time online merged, because
      // Mochi answers those from three different tools.
      const setterRows = new Map<string, {
        name: string; messages: number; replies: number; rate: number | null;
        activeMinutes: number | null; daysActive: number | null; avgDailyMinutes: number | null;
      }>();
      const putSetter = (name: string) => {
        const key = (name ?? "").trim();
        if (!key) return null;
        if (!setterRows.has(key)) {
          setterRows.set(key, {
            name: key, messages: 0, replies: 0, rate: null,
            activeMinutes: null, daysActive: null, avgDailyMinutes: null,
          });
        }
        return setterRows.get(key)!;
      };
      for (const m of replies?.members_breakdown ?? []) {
        const row = putSetter(m.name ?? "");
        if (!row) continue;
        row.messages = m.total_messages ?? 0;
        row.replies = m.replies_received ?? 0;
        row.rate = m.reply_rate ?? null;
      }
      for (const m of counts?.messages_by_member ?? []) {
        const row = putSetter(m.member_name ?? m.name ?? "");
        if (!row) continue;
        const sent = m.messages_sent ?? m.outbound ?? m.outbound_messages ?? 0;
        if (sent > row.messages) row.messages = sent;
      }
      for (const m of windows?.members ?? []) {
        const row = putSetter(m.name ?? "");
        if (!row) continue;
        row.activeMinutes = m.total_active_minutes ?? null;
        row.daysActive = m.days_active ?? null;
        row.avgDailyMinutes = m.avg_daily_active_minutes ?? null;
      }

      out.mochi = { connected: false, period };
    } else {
      type Counts = {
        inbound_messages?: number;
        outbound_messages?: number;
        total_messages?: number;
        active_conversations?: number;
        messages_by_member?: { member_name?: string; name?: string; outbound?: number; outbound_messages?: number; messages_sent?: number }[];
      };
      type Trend = { trend?: { day: string; new_leads?: number; qualified?: number; booked?: number; won?: number }[] };
      type Sources = { sources?: { source: string; label?: string; lead_count?: number; calls_booked?: number }[] };
      type Payments = { net_revenue?: string; you_keep?: string; gross_volume?: string; payments_count?: number };
      type Health = {
        status?: string;
        message?: string;
        connection?: { username?: string; is_connected?: boolean; send_paused?: boolean };
        recent_sends?: { total?: number; failed?: number; failure_rate?: number };
        instagram_protection?: { protection?: { status?: string; active_flag_count?: number } };
      };
      type Overview = {
        account?: { username?: string; is_connected?: boolean; is_send_paused?: boolean };
        growth?: { total_leads?: number; new_leads_last_30_days?: number };
      };
      type Funnel = {
        pipeline_now?: Record<string, number>;
        conversion?: {
          cohort_size?: number;
          rates?: Record<string, { value?: number | null }>;
        };
        total_revenue?: number;
      };
      type Replies = {
        total_outbound_messages?: number;
        messages_with_reply?: number;
        reply_rate?: number;
        members_breakdown?: { name?: string; total_messages?: number; replies_received?: number; reply_rate?: number }[];
      };
      type Setter = {
        new_leads?: number;
        calls_booked?: number;
        leads_qualified?: number;
        booking_rate?: number;
        avg_response_time_minutes?: number;
        median_response_time_minutes?: number;
      };
      type Hours = { distribution?: { hour: number; count: number }[]; peak_hour_utc?: number; total_messages?: number };
      type Weekday = { distribution?: { weekday: string; count: number }[]; peak_weekday_name?: string; total_messages?: number };
      type Windows = {
        members?: { name?: string; role?: string; total_active_minutes?: number; days_active?: number; avg_daily_active_minutes?: number }[];
      };

      const [counts, trend, sources, payments, health, overview, funnelMetrics, replies, setter, hours, weekday, windows] = await Promise.all([
        callTool<Counts>(token, "get_message_counts", { time_period: period }),
        callTool<Trend>(token, "get_funnel_trend", { time_period: period }),
        callTool<Sources>(token, "get_lead_source_breakdown", { time_period: period }),
        callTool<Payments>(token, "get_payment_overview", { time_period: period }),
        callTool<Health>(token, "get_account_health", {}),
        callTool<Overview>(token, "get_account_overview", {}),
        callTool<Funnel>(token, "get_funnel_metrics", { time_period: period }),
        callTool<Replies>(token, "get_lead_reply_rate", { time_period: period }),
        callTool<Setter>(token, "get_setter_metrics", { time_period: period }),
        callTool<Hours>(token, "get_message_time_distribution", { time_period: period }),
        callTool<Weekday>(token, "get_message_dayofweek_distribution", { time_period: period }),
        callTool<Windows>(token, "get_setter_active_windows", { time_period: period }),
      ]);

      const funnel = trend?.trend ?? [];
      const money = (value?: string) => {
        if (!value) return null;
        const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      };
      const pipeline = funnelMetrics?.pipeline_now ?? {};
      const rate = (key: string) => funnelMetrics?.conversion?.rates?.[key]?.value ?? null;
      // Protection carries the canonical status; the v1 status is the fallback.
      const protection = health?.instagram_protection?.protection;

      out.mochi = {
        connected: true,
        period,
        health: {
          status: protection?.status ?? health?.status ?? null,
          message: health?.message ?? null,
          username: health?.connection?.username ?? overview?.account?.username ?? null,
          isConnected: health?.connection?.is_connected ?? overview?.account?.is_connected ?? null,
          sendPaused: health?.connection?.send_paused ?? overview?.account?.is_send_paused ?? null,
          activeFlags: protection?.active_flag_count ?? 0,
          sends24h: health?.recent_sends?.total ?? null,
          failed24h: health?.recent_sends?.failed ?? null,
          failureRate: health?.recent_sends?.failure_rate ?? null,
        },
        account: {
          totalLeads: overview?.growth?.total_leads ?? null,
          newLeads30: overview?.growth?.new_leads_last_30_days ?? null,
        },
        messages: {
          inbound: counts?.inbound_messages ?? 0,
          outbound: counts?.outbound_messages ?? 0,
          total: counts?.total_messages ?? 0,
          activeConversations: counts?.active_conversations ?? 0,
        },
        pipeline: {
          newLeads: pipeline.NEW ?? 0,
          inContact: pipeline.IN_CONTACT ?? 0,
          qualified: pipeline.QUALIFIED ?? 0,
          bookedCall: pipeline.BOOKED_CALL ?? 0,
          won: pipeline.WON ?? 0,
          unqualified: pipeline.UNQUALIFIED ?? 0,
        },
        conversion: {
          cohort: funnelMetrics?.conversion?.cohort_size ?? null,
          newToQualified: rate("new_to_qualified"),
          newToBooked: rate("new_to_booked"),
          newToWon: rate("new_to_won"),
        },
        replies: {
          rate: replies?.reply_rate ?? null,
          outbound: replies?.total_outbound_messages ?? null,
          withReply: replies?.messages_with_reply ?? null,
          members: (replies?.members_breakdown ?? [])
            .map((m) => ({
              name: (m.name ?? "").trim(),
              messages: m.total_messages ?? 0,
              replies: m.replies_received ?? 0,
              rate: m.reply_rate ?? null,
            }))
            .filter((m) => m.name),
        },
        response: {
          medianMinutes: setter?.median_response_time_minutes ?? null,
          avgMinutes: setter?.avg_response_time_minutes ?? null,
          newLeads: setter?.new_leads ?? null,
          callsBooked: setter?.calls_booked ?? null,
          qualified: setter?.leads_qualified ?? null,
          bookingRate: setter?.booking_rate ?? null,
        },
        hours: (hours?.distribution ?? []).map((h) => ({ hour: h.hour, count: h.count })),
        peakHourUTC: hours?.peak_hour_utc ?? null,
        revenue: {
          net: money(payments?.net_revenue ?? payments?.you_keep),
          gross: money(payments?.gross_volume),
          count: payments?.payments_count ?? null,
          crm: funnelMetrics?.total_revenue ?? null,
        },
        funnel: funnel.map((d) => ({
          day: d.day,
          newLeads: d.new_leads ?? 0,
          qualified: d.qualified ?? 0,
          booked: d.booked ?? 0,
          won: d.won ?? 0,
        })),
        sources: (sources?.sources ?? []).map((s) => ({
          source: s.source,
          label: s.label ?? s.source,
          leads: s.lead_count ?? 0,
          booked: s.calls_booked ?? 0,
        })),
        members: (counts?.messages_by_member ?? [])
          .map((m) => ({
            name: (m.member_name ?? m.name ?? "").trim(),
            outbound: m.messages_sent ?? m.outbound ?? m.outbound_messages ?? 0,
          }))
          .filter((m) => m.name),
        hourTotal: hours?.total_messages ?? null,
        weekdays: (weekday?.distribution ?? []).map((d) => ({ day: d.weekday, count: d.count })),
        peakWeekday: weekday?.peak_weekday_name ?? null,
        setters: [...setterRows.values()].sort((a, b) => b.messages - a.messages),
      };
    }
  }

  const closeKey = creds.get(KEYS.closeKey);
  if (!closeKey) {
    out.close = { configured: false };
  } else {
    try {
      const basic = btoa(`${closeKey}:`);
      const params = new URLSearchParams({ _limit: "200" });
      const res = await fetch(`https://api.close.com/api/v1/lead/?${params}`, {
        headers: { Authorization: `Basic ${basic}` },
      });
      if (!res.ok) {
        out.close = { configured: true, error: `Close API ${res.status}` };
      } else {
        const body = await res.json() as { data?: Record<string, unknown>[] };
        const leads = (body.data ?? []).map((l) => {
          const opps = Array.isArray(l.opportunities) ? l.opportunities as Record<string, unknown>[] : [];
          // Close stores opportunity values in cents.
          const value = Math.round(opps.reduce((a, o) => a + Number(o.value ?? 0), 0)) / 100;
          const activeOpp = opps.find((o) => o.status_type === "active") ?? opps[0];
          return {
            name: String(l.display_name ?? l.name ?? "Unnamed"),
            status: String(l.status_label ?? "Unknown"),
            statusType: String(activeOpp?.status_type ?? l.status_type ?? ""),
            value,
            updatedAt: String(l.date_updated ?? ""),
          };
        });
        const won = leads.filter((l) => l.statusType === "won").length;
        const active = leads.filter((l) => l.statusType === "active" || l.value > 0);
        const stages = new Map<string, { count: number; value: number }>();
        for (const lead of leads) {
          const row = stages.get(lead.status) ?? { count: 0, value: 0 };
          row.count += 1;
          row.value += lead.value;
          stages.set(lead.status, row);
        }
        // Dials, new leads and average call length for the same window the
        // Mochi side uses, so the two tabs are comparable.
        const days = period === "today" ? 1 : (period === "last_7_days" ? 7 : 30);
        const end = new Date();
        const start = new Date(end.getTime() - (days - 1) * 86400000);
        let activity: Record<string, unknown> | null = null;
        try {
          const report = await fetch("https://api.close.com/api/v1/report/activity/", {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              datetime_range: { start: start.toISOString(), end: end.toISOString() },
              metrics: ["calls.outbound.all.count", "calls.outbound.all.avg_duration", "leads.created.all.count"],
              type: "overview",
            }),
          });
          if (report.ok) {
            const body = await report.json() as {
              aggregations?: { totals?: Record<string, number | string | undefined> };
              data?: ({ datetime?: string } & Record<string, number | string | undefined>)[];
            };
            const totals = body.aggregations?.totals ?? {};
            const byDay = new Map<string, { dials: number; leads: number }>();
            for (const point of body.data ?? []) {
              if (!point.datetime) continue;
              const day = String(point.datetime).slice(0, 10);
              const row = byDay.get(day) ?? { dials: 0, leads: 0 };
              row.dials += Number(point["calls.outbound.all.count"]) || 0;
              row.leads += Number(point["leads.created.all.count"]) || 0;
              byDay.set(day, row);
            }
            const daily = [...byDay.entries()].map(([day, row]) => ({ day, ...row }))
              .sort((a, b) => a.day.localeCompare(b.day));
            activity = {
              dials: Number(totals["calls.outbound.all.count"]) || daily.reduce((s, d) => s + d.dials, 0),
              newLeads: Number(totals["leads.created.all.count"]) || daily.reduce((s, d) => s + d.leads, 0),
              avgCallSeconds: totals["calls.outbound.all.avg_duration"] == null
                ? null
                : Math.round(Number(totals["calls.outbound.all.avg_duration"]) || 0),
              daily,
            };
          }
        } catch {
          activity = null;
        }

        out.close = {
          configured: true,
          leads: leads.length,
          active: active.length,
          won,
          pipeline: active.reduce((s, l) => s + l.value, 0),
          closeRate: leads.length ? Math.round((won / leads.length) * 1000) / 10 : null,
          stages: [...stages.entries()]
            .map(([name, row]) => ({ name, count: row.count, value: row.value }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
          activity,
          // Newest touched first: that is the order a closer works them in.
          recent: leads
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 20)
            .map((l) => ({ name: l.name, status: l.status, value: l.value, updatedAt: l.updatedAt })),
        };
      }
    } catch (error) {
      out.close = { configured: true, error: String(error).slice(0, 160) };
    }
  }

  return json(out);
});
