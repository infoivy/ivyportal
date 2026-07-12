import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Mochi (themochi.app) Instagram CRM integration.
 *
 * Auth: OAuth tokens live in service_credentials (admin-only RLS), seeded by a
 * one-time PKCE flow. The access token is refreshed here server-side when it
 * nears expiry. Data is fetched through Mochi's MCP endpoint (JSON-RPC
 * tools/call) — Mochi has no separate public REST API.
 */

const MCP_URL = "https://mcp.themochi.app/mcp";
const TOKEN_URL = "https://api.themochi.app/api/zapier/oauth/token/";

const KEYS = {
  clientId: "mochi_client_id",
  access: "mochi_access_token",
  refresh: "mochi_refresh_token",
  expiresAt: "mochi_token_expires_at",
} as const;

type Ctx = { supabase: any; userId: string };

async function requireFounderOrAdmin(context: Ctx) {
  const [{ data: admin }, { data: founder }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "founder" }),
  ]);
  if (!admin && !founder) throw new Error("Forbidden: admin or founder only");
}

/* Tokens are read/written with the service-role client: callers (setters
   included) never see the credentials, only derived numbers — and the RLS
   admin-only policy on service_credentials stays intact for direct access. */
async function readCreds(_context: Ctx) {
  const { data } = await supabaseAdmin
    .from("service_credentials")
    .select("key, value")
    .in("key", Object.values(KEYS));
  const map = new Map<string, string>((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    clientId: map.get(KEYS.clientId) ?? null,
    access: map.get(KEYS.access) ?? null,
    refresh: map.get(KEYS.refresh) ?? null,
    expiresAt: map.get(KEYS.expiresAt) ?? null,
  };
}

async function saveTokens(context: Ctx, tokens: { access_token: string; refresh_token?: string; expires_in?: number }) {
  const rows = [
    { key: KEYS.access, value: tokens.access_token, label: "Mochi access token", updated_by: context.userId },
    {
      key: KEYS.expiresAt,
      value: new Date(Date.now() + ((tokens.expires_in ?? 3600) - 300) * 1000).toISOString(),
      label: "Mochi access token expiry",
      updated_by: context.userId,
    },
    ...(tokens.refresh_token
      ? [{ key: KEYS.refresh, value: tokens.refresh_token, label: "Mochi refresh token", updated_by: context.userId }]
      : []),
  ];
  const { error } = await supabaseAdmin.from("service_credentials").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(`Failed to persist Mochi tokens: ${error.message}`);
}

async function freshAccessToken(context: Ctx): Promise<string | null> {
  const creds = await readCreds(context);
  if (!creds.access || !creds.refresh || !creds.clientId) return null;
  if (creds.expiresAt && new Date(creds.expiresAt) > new Date()) return creds.access;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refresh,
    client_id: creds.clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Mochi token refresh failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  await saveTokens(context, json);
  return json.access_token;
}

/** Call one Mochi MCP tool and return its parsed JSON payload. */
async function callTool<T = unknown>(context: Ctx, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = await freshAccessToken(context);
  if (!token) throw new Error("Mochi is not connected");

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  if (!res.ok) throw new Error(`Mochi MCP ${name} failed (${res.status})`);

  // The endpoint answers either plain JSON or a single SSE frame.
  const raw = await res.text();
  const payload = raw.startsWith("event:") || raw.includes("\ndata:")
    ? raw.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim() ?? "{}"
    : raw;
  const rpc = JSON.parse(payload) as { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } };
  if (rpc.error) throw new Error(`Mochi ${name}: ${rpc.error.message ?? "unknown error"}`);
  const text = rpc.result?.content?.[0]?.text ?? "{}";
  if (rpc.result?.isError) throw new Error(`Mochi ${name}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export type MochiPeriod = "today" | "last_7_days" | "last_30_days";

export type MochiDashboard = {
  connected: boolean;
  period: MochiPeriod;
  messages: {
    inbound: number;
    outbound: number;
    total: number;
    activeConversations: number;
  } | null;
  funnel: { day: string; new_leads: number; qualified: number; booked: number; won: number }[];
  sources: { source: string; label: string; lead_count: number; calls_booked: number }[];
  totals: { newLeads: number; booked: number; won: number; comments: number };
  /** Per-member outbound DMs — empty until setters exist in Mochi. */
  members: { name: string; outbound: number }[];
};

/** Whether Mochi is connected. Founder/admin only (matches credential RLS). */
export const getMochiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await readCreds(context as Ctx);
    return { configured: !!(creds.access && creds.refresh) };
  });

/** Instagram funnel + message metrics for dashboard/hub. Founder/admin only. */
export const getMochiDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { period?: MochiPeriod }) => ({
    period: (["today", "last_7_days", "last_30_days"].includes(input?.period ?? "") ? input.period : "last_7_days") as MochiPeriod,
  }))
  .handler(async ({ context, data }): Promise<MochiDashboard> => {
    const ctx = context as Ctx;
    await requireFounderOrAdmin(ctx);
    const empty: MochiDashboard = {
      connected: false,
      period: data.period,
      messages: null,
      funnel: [],
      sources: [],
      totals: { newLeads: 0, booked: 0, won: 0, comments: 0 },
      members: [],
    };
    const creds = await readCreds(ctx);
    if (!creds.access) return empty;

    const [msg, trend, src] = await Promise.all([
      callTool<{ inbound_messages: number; outbound_messages: number; total_messages: number; active_conversations: number; messages_by_member?: { member_name?: string; name?: string; outbound?: number; outbound_messages?: number }[] }>(
        ctx, "get_message_counts", { time_period: data.period },
      ),
      callTool<{ trend: MochiDashboard["funnel"] }>(ctx, "get_funnel_trend", { time_period: data.period }),
      callTool<{ sources: MochiDashboard["sources"] }>(ctx, "get_lead_source_breakdown", { time_period: data.period }),
    ]);

    const funnel = trend.trend ?? [];
    const sources = src.sources ?? [];
    return {
      connected: true,
      period: data.period,
      messages: {
        inbound: msg.inbound_messages ?? 0,
        outbound: msg.outbound_messages ?? 0,
        total: msg.total_messages ?? 0,
        activeConversations: msg.active_conversations ?? 0,
      },
      funnel,
      sources,
      totals: {
        newLeads: funnel.reduce((s, d) => s + (d.new_leads ?? 0), 0),
        booked: funnel.reduce((s, d) => s + (d.booked ?? 0), 0),
        won: funnel.reduce((s, d) => s + (d.won ?? 0), 0),
        comments: sources.find((s) => s.source === "COMMENT")?.lead_count ?? 0,
      },
      members: (msg.messages_by_member ?? [])
        .map((m: any) => ({ name: (m.member_name ?? m.name ?? "").trim(), outbound: m.messages_sent ?? m.outbound ?? m.outbound_messages ?? 0 }))
        .filter((m: { name: string }) => m.name),
    };
  });

export type MochiPayments = {
  connected: boolean;
  /** Net revenue ("you keep") over the last 30 days. */
  net30: number | null;
  /** Gross volume over the last 30 days. */
  gross30: number | null;
  paymentsCount30: number | null;
  /** Daily gross volume over the last 90 days — feeds the weekly cash bars. */
  series: { date: string; volume: number; count: number }[];
};

type PaymentOverview = {
  net_revenue?: string;
  you_keep?: string;
  gross_volume?: string;
  payments_count?: number;
  gross_volume_series?: { date: string; volume: string; count: number }[];
};

/** Provider-synced payment data (Whop, Stripe, …) via Mochi. Founder/admin only. */
export const getMochiPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MochiPayments> => {
    const ctx = context as Ctx;
    await requireFounderOrAdmin(ctx);
    const empty: MochiPayments = { connected: false, net30: null, gross30: null, paymentsCount30: null, series: [] };
    const creds = await readCreds(ctx);
    if (!creds.access) return empty;
    try {
      const [p30, p90] = await Promise.all([
        callTool<PaymentOverview>(ctx, "get_payment_overview", { time_period: "last_30_days" }),
        callTool<PaymentOverview>(ctx, "get_payment_overview", { time_period: "last_90_days" }),
      ]);
      return {
        connected: true,
        net30: p30.you_keep != null ? Number(p30.you_keep) : p30.net_revenue != null ? Number(p30.net_revenue) : null,
        gross30: p30.gross_volume != null ? Number(p30.gross_volume) : null,
        paymentsCount30: p30.payments_count ?? null,
        series: (p90.gross_volume_series ?? []).map((s) => ({ date: s.date, volume: Number(s.volume), count: s.count })),
      };
    } catch {
      // Payment provider not linked inside Mochi yet — not an error state.
      return { ...empty, connected: true };
    }
  });

export type MochiEodReference = {
  available: boolean;
  /** "personal" when the signed-in user matched a Mochi member, else "team". */
  scope: "personal" | "team";
  memberName: string | null;
  dmsOut: number | null;
  newLeads: number | null;
  callsBooked: number | null;
  activeConvos: number | null;
};

/**
 * Today's Mochi numbers for the EOD form — reference only, never auto-writes.
 * Matches the signed-in user to a Mochi member by email; when unmatched,
 * returns team-wide numbers so the setter still gets context.
 */
export const getMochiEodReference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MochiEodReference> => {
    const ctx = context as Ctx;
    const none: MochiEodReference = {
      available: false, scope: "team", memberName: null,
      dmsOut: null, newLeads: null, callsBooked: null, activeConvos: null,
    };
    const creds = await readCreds(ctx);
    if (!creds.access) return none;

    const { data: userRes } = await ctx.supabase.auth.getUser();
    const email = userRes?.user?.email?.toLowerCase() ?? null;

    try {
      const team = await callTool<{ members: { email: string; first_name: string; last_name: string; is_active: boolean }[] }>(
        ctx, "get_team_members",
      );
      const member = email
        ? (team.members ?? []).find((m) => m.is_active && m.email?.toLowerCase() === email)
        : undefined;
      const memberName = member ? `${member.first_name} ${member.last_name}`.trim() : null;

      const [metrics, msgs] = await Promise.all([
        callTool<{ new_leads?: number; calls_booked?: number }>(
          ctx, "get_setter_metrics", memberName ? { time_period: "today", member_name: memberName } : { time_period: "today" },
        ),
        callTool<{ outbound_messages?: number; active_conversations?: number; messages_by_member?: { member_name?: string; name?: string; outbound?: number; outbound_messages?: number }[] }>(
          ctx, "get_message_counts", { time_period: "today" },
        ),
      ]);

      const memberMsgs = memberName
        ? (msgs.messages_by_member ?? []).find((m: any) => (m.member_name ?? m.name ?? "").trim() === memberName)
        : undefined;

      return {
        available: true,
        scope: memberName ? "personal" : "team",
        memberName,
        dmsOut: memberName
          ? ((memberMsgs as any)?.messages_sent ?? memberMsgs?.outbound ?? memberMsgs?.outbound_messages ?? 0)
          : (msgs.outbound_messages ?? null),
        newLeads: metrics.new_leads ?? null,
        callsBooked: metrics.calls_booked ?? null,
        activeConvos: msgs.active_conversations ?? null,
      };
    } catch {
      return none;
    }
  });

export type MochiDetail = {
  connected: boolean;
  period: MochiPeriod;
  pipelineNow: { stage: string; count: number }[];
  conversion: {
    cohortSize: number;
    reachedQualified: number;
    reachedBooked: number;
    reachedWon: number;
    newToQualified: number | null;
    qualifiedToBooked: number | null;
    bookedToWon: number | null;
  } | null;
  messages: { inbound: number; outbound: number; ai: number; total: number; activeConversations: number } | null;
  responseBuckets: { label: string; count: number }[];
  medianResponseMinutes: number | null;
  replyRate: number | null;
};

type FunnelMetrics = {
  pipeline_now?: Record<string, number>;
  conversion?: {
    cohort_size?: number;
    reached_qualified?: number;
    reached_booked?: number;
    reached_won?: number;
    rates?: Record<string, { value: number | null }>;
  };
};

const RESPONSE_BUCKET_LABELS: [string, string][] = [
  ["under_5_min", "<5m"], ["min_5_to_15", "5–15m"], ["min_15_to_30", "15–30m"],
  ["min_30_to_60", "30–60m"], ["hr_1_to_3", "1–3h"], ["hr_3_to_12", "3–12h"],
  ["hr_12_to_24", "12–24h"], ["over_24_hr", ">24h"],
];

/** Full Instagram CRM detail for the /mochi page. Founder/admin only. */
export const getMochiDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { period?: MochiPeriod }) => ({
    period: (["today", "last_7_days", "last_30_days"].includes(input?.period ?? "") ? input.period : "last_7_days") as MochiPeriod,
  }))
  .handler(async ({ context, data }): Promise<MochiDetail> => {
    const ctx = context as Ctx;
    await requireFounderOrAdmin(ctx);
    const empty: MochiDetail = {
      connected: false, period: data.period, pipelineNow: [], conversion: null,
      messages: null, responseBuckets: [], medianResponseMinutes: null, replyRate: null,
    };
    const creds = await readCreds(ctx);
    if (!creds.access) return empty;

    const [funnel, msgs, resp, reply] = await Promise.all([
      callTool<FunnelMetrics>(ctx, "get_funnel_metrics", { time_period: data.period }),
      callTool<{ inbound_messages?: number; outbound_messages?: number; ai_messages?: number; total_messages?: number; active_conversations?: number }>(
        ctx, "get_message_counts", { time_period: data.period },
      ),
      callTool<{ buckets?: Record<string, number>; median_minutes?: number }>(
        ctx, "get_response_time_distribution", { time_period: data.period },
      ),
      callTool<{ reply_rate?: number }>(ctx, "get_lead_reply_rate", { time_period: data.period }),
    ]);

    const rates = funnel.conversion?.rates ?? {};
    return {
      connected: true,
      period: data.period,
      pipelineNow: Object.entries(funnel.pipeline_now ?? {}).map(([stage, count]) => ({ stage, count })),
      conversion: funnel.conversion
        ? {
            cohortSize: funnel.conversion.cohort_size ?? 0,
            reachedQualified: funnel.conversion.reached_qualified ?? 0,
            reachedBooked: funnel.conversion.reached_booked ?? 0,
            reachedWon: funnel.conversion.reached_won ?? 0,
            newToQualified: rates.new_to_qualified?.value ?? null,
            qualifiedToBooked: rates.qualified_to_booked?.value ?? null,
            bookedToWon: rates.booked_to_won?.value ?? null,
          }
        : null,
      messages: {
        inbound: msgs.inbound_messages ?? 0,
        outbound: msgs.outbound_messages ?? 0,
        ai: msgs.ai_messages ?? 0,
        total: msgs.total_messages ?? 0,
        activeConversations: msgs.active_conversations ?? 0,
      },
      responseBuckets: RESPONSE_BUCKET_LABELS.map(([key, label]) => ({ label, count: resp.buckets?.[key] ?? 0 })),
      medianResponseMinutes: resp.median_minutes ?? null,
      replyRate: reply.reply_rate ?? null,
    };
  });

export type TeamGoal = {
  active: boolean;
  amount: number | null;
  deadline: string | null;
  started: string | null;
  note: string | null;
  /** Whop gross collected since `started` — the collective progress number. */
  progress: number;
};

const TEAM_ROLES = ["admin", "founder", "closer", "setter", "coach", "csm"];

/** The collective goal — visible to the whole team (aggregate progress only). */
export const getTeamGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamGoal> => {
    const ctx = context as Ctx;
    const none: TeamGoal = { active: false, amount: null, deadline: null, started: null, note: null, progress: 0 };

    // Any team role may see the goal; student-only accounts don't.
    const { data: myRoles } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    if (!(myRoles ?? []).some((r: { role: string }) => TEAM_ROLES.includes(r.role))) return none;

    const { data: settings } = await supabaseAdmin
      .from("founder_settings")
      .select("team_goal_amount, team_goal_deadline, team_goal_started, team_goal_note")
      .limit(1)
      .maybeSingle();
    if (!settings?.team_goal_amount || !settings.team_goal_deadline) return none;

    let progress = 0;
    try {
      const creds = await readCreds(ctx);
      if (creds.access) {
        const pay = await callTool<PaymentOverview>(ctx, "get_payment_overview", { time_period: "last_90_days" });
        const started = settings.team_goal_started ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        progress = (pay.gross_volume_series ?? [])
          .filter((s) => s.date >= started)
          .reduce((sum, s) => sum + Number(s.volume), 0);
      }
    } catch { /* goal still shows without progress */ }

    return {
      active: true,
      amount: Number(settings.team_goal_amount),
      deadline: settings.team_goal_deadline,
      started: settings.team_goal_started,
      note: settings.team_goal_note,
      progress: Math.round(progress),
    };
  });

/** Set or clear the collective goal. Admin/founder only. */
export const setTeamGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number | null; deadline: string | null; note?: string | null }) => ({
    amount: input.amount != null && input.amount > 0 ? input.amount : null,
    deadline: input.deadline || null,
    note: input.note?.trim() || null,
  }))
  .handler(async ({ context, data }) => {
    const ctx = context as Ctx;
    await requireFounderOrAdmin(ctx);
    const { data: existing } = await supabaseAdmin.from("founder_settings").select("id").limit(1).maybeSingle();
    const row = {
      team_goal_amount: data.amount,
      team_goal_deadline: data.deadline,
      team_goal_started: data.amount ? new Date().toISOString().slice(0, 10) : null,
      team_goal_note: data.note,
      updated_by: ctx.userId,
    };
    const { error } = existing
      ? await supabaseAdmin.from("founder_settings").update(row).eq("id", existing.id)
      : await supabaseAdmin.from("founder_settings").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function requireFinanceAccess(context: Ctx) {
  const checks = await Promise.all(
    ["founder", "admin", "cofounder"].map((r) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: r }),
    ),
  );
  if (!checks.some((c: { data: boolean }) => c.data)) throw new Error("Forbidden: finance access only");
}

export type FinanceRevenue = {
  connected: boolean;
  from: string;
  to: string;
  whopGross: number;
  whopNet: number;
  whopCount: number;
  loggedTotal: number;
  matchedTotal: number;
  /** Whop cash the portal has no logged close/installment for (and vice versa). */
  gap: number;
  unmatchedWhop: { date: string; amount: number; customer: string; product: string }[];
  unmatchedLogged: { date: string; amount: number; student: string; kind: "deal" | "installment" }[];
};

type WhopTxn = { occurred_at: string; amount: string; net: string; status: string; kind: string; customer_name?: string; customer_email?: string; product_name?: string };

/**
 * Whop is the source of truth for cash in. This reconciles the window's Whop
 * charges against logged deals + paid installments: same amount within ±3
 * days = the same money (never double-counted). What's left on either side
 * is the gap to investigate (e.g. Wise money forwarded into Whop manually,
 * or a close nobody logged).
 */
export const getFinanceRevenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(input?.to ?? "")) {
      throw new Error("from/to must be YYYY-MM-DD");
    }
    return { from: input.from, to: input.to };
  })
  .handler(async ({ context, data }): Promise<FinanceRevenue> => {
    const ctx = context as Ctx;
    await requireFinanceAccess(ctx);
    const empty: FinanceRevenue = {
      connected: false, from: data.from, to: data.to,
      whopGross: 0, whopNet: 0, whopCount: 0, loggedTotal: 0, matchedTotal: 0, gap: 0,
      unmatchedWhop: [], unmatchedLogged: [],
    };

    const [dealsRes, paysRes] = await Promise.all([
      supabaseAdmin.from("deals")
        .select("deal_date, cash_collected_upfront, student_name")
        .gte("deal_date", data.from).lte("deal_date", data.to)
        .gt("cash_collected_upfront", 0),
      supabaseAdmin.from("installment_payments")
        .select("due_date, amount, status, installments(students(full_name))")
        .eq("status", "paid")
        .gte("due_date", data.from).lte("due_date", data.to),
    ]);
    const logged = [
      ...(dealsRes.data ?? []).map((d: any) => ({
        date: d.deal_date as string, amount: Number(d.cash_collected_upfront),
        student: (d.student_name as string) ?? "Unknown", kind: "deal" as const, matched: false,
      })),
      ...(paysRes.data ?? []).map((p: any) => ({
        date: p.due_date as string, amount: Number(p.amount),
        student: p.installments?.students?.full_name ?? "Unknown", kind: "installment" as const, matched: false,
      })),
    ];
    const loggedTotal = logged.reduce((s, l) => s + l.amount, 0);

    const creds = await readCreds(ctx);
    if (!creds.access) return { ...empty, loggedTotal, gap: -loggedTotal, unmatchedLogged: logged };

    let txns: WhopTxn[] = [];
    try {
      const res = await callTool<{ results?: WhopTxn[] }>(ctx, "get_payment_transactions", {
        time_period: "last_90_days", kind: "CHARGE", status: "SUCCEEDED", limit: 200,
      });
      txns = (res.results ?? []).filter((t) => {
        const d = t.occurred_at.slice(0, 10);
        return d >= data.from && d <= data.to;
      });
    } catch { /* provider not synced — logged side still returns */ }

    const dayDiff = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
    const unmatchedWhop: FinanceRevenue["unmatchedWhop"] = [];
    let matchedTotal = 0;
    for (const t of txns) {
      const amount = Number(t.amount);
      const date = t.occurred_at.slice(0, 10);
      const hit = logged.find((l) => !l.matched && Math.abs(l.amount - amount) <= 1 && dayDiff(l.date, date) <= 3);
      if (hit) { hit.matched = true; matchedTotal += amount; }
      else unmatchedWhop.push({ date, amount, customer: t.customer_name || t.customer_email || "Unknown", product: t.product_name ?? "" });
    }

    const whopGross = txns.reduce((s, t) => s + Number(t.amount), 0);
    const whopNet = txns.reduce((s, t) => s + Number(t.net || t.amount), 0);
    return {
      connected: true, from: data.from, to: data.to,
      whopGross: Math.round(whopGross), whopNet: Math.round(whopNet), whopCount: txns.length,
      loggedTotal: Math.round(loggedTotal), matchedTotal: Math.round(matchedTotal),
      gap: Math.round(whopGross - loggedTotal),
      unmatchedWhop,
      unmatchedLogged: logged.filter((l) => !l.matched).map(({ matched: _m, ...rest }) => rest),
    };
  });

export type MochiHomePeriod = "today" | "this_week" | "last_30_days";

export type MochiHome = {
  connected: boolean;
  period: MochiHomePeriod;
  totalRevenue: number | null;
  cashCollected: number | null;
  cashPending: number | null;
  /** MTD vs previous month same-day, from the Whop series. */
  prevMonthPct: number | null;
  recent: { customer: string; product: string; amount: number; date: string }[];
  upcoming: { customer: string; product: string; amount: number; date: string }[];
};

/** The Mochi-dashboard replica data: revenue KPIs + collections. Founder/admin/cofounder. */
export const getMochiHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { period?: MochiHomePeriod }) => ({
    period: (["today", "this_week", "last_30_days"].includes(input?.period ?? "") ? input.period : "this_week") as MochiHomePeriod,
  }))
  .handler(async ({ context, data }): Promise<MochiHome> => {
    const ctx = context as Ctx;
    await requireFinanceAccess(ctx).catch(async () => { await requireFounderOrAdmin(ctx); });
    const empty: MochiHome = {
      connected: false, period: data.period,
      totalRevenue: null, cashCollected: null, cashPending: null, prevMonthPct: null,
      recent: [], upcoming: [],
    };
    const creds = await readCreds(ctx);
    if (!creds.access) return empty;

    const txnMap = (t: WhopTxn & { customer_name?: string; product_name?: string }) => ({
      customer: t.customer_name || "Unknown",
      product: t.product_name ?? "",
      amount: Number(t.amount),
      date: t.occurred_at.slice(0, 10),
    });

    const [overview, series90, recentRes, pendingRes] = await Promise.all([
      callTool<PaymentOverview>(ctx, "get_payment_overview", { time_period: data.period }),
      callTool<PaymentOverview>(ctx, "get_payment_overview", { time_period: "last_90_days" }),
      callTool<{ results?: WhopTxn[] }>(ctx, "get_payment_transactions", { time_period: "last_30_days", status: "SUCCEEDED", kind: "CHARGE", limit: 6 }),
      callTool<{ results?: WhopTxn[] }>(ctx, "get_payment_transactions", { time_period: "last_30_days", status: "PENDING", limit: 6 }),
    ]);

    // Prev-month compare from the daily series (Mochi's "+82.75%" style)
    const series = series90.gross_volume_series ?? [];
    const now = new Date();
    const monthStart = now.toISOString().slice(0, 8) + "01";
    const dayOfMonth = now.getDate();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth).toISOString().slice(0, 10);
    const sum = (from: string, to: string) => series.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + Number(s.volume), 0);
    const mtd = sum(monthStart, now.toISOString().slice(0, 10));
    const prevMtd = sum(prevStart, prevSameDay);
    const prevMonthPct = prevMtd > 0 ? Math.round(((mtd - prevMtd) / prevMtd) * 10000) / 100 : null;

    const pending = (pendingRes.results ?? []).map(txnMap);
    return {
      connected: true,
      period: data.period,
      totalRevenue: overview.gross_volume != null ? Math.round(Number(overview.gross_volume)) : null,
      cashCollected: overview.you_keep != null ? Math.round(Number(overview.you_keep)) : overview.net_revenue != null ? Math.round(Number(overview.net_revenue)) : null,
      cashPending: pending.reduce((a, t) => a + t.amount, 0),
      prevMonthPct,
      recent: (recentRes.results ?? []).map(txnMap),
      upcoming: pending,
    };
  });
