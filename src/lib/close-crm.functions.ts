import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLOSE_KEY_NAME = "close_api_key";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

async function readCloseKey(context: { supabase: any }): Promise<string | null> {
  const { data } = await context.supabase
    .from("service_credentials")
    .select("value")
    .eq("key", CLOSE_KEY_NAME)
    .maybeSingle();
  return data?.value ?? null;
}

/** Whether the Close key is configured. Any signed-in user can call this. */
export const getCloseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await readCloseKey(context);
    return { configured: !!key };
  });

/** Save the Close API key. Admin-only. */
export const saveCloseApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { apiKey: string }) => {
    if (!input?.apiKey || typeof input.apiKey !== "string" || input.apiKey.length < 10) {
      throw new Error("API key is required (min 10 chars)");
    }
    return { apiKey: input.apiKey.trim() };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("service_credentials")
      .upsert(
        { key: CLOSE_KEY_NAME, value: data.apiKey, label: "Close CRM API key", updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete the Close API key. Admin-only. */
export const deleteCloseApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("service_credentials").delete().eq("key", CLOSE_KEY_NAME);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Test connection by hitting Close's /me/ endpoint. Admin-only. */
export const testCloseConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const key = await readCloseKey(context);
    if (!key) return { ok: false, error: "No API key configured" };
    const basic = Buffer.from(`${key}:`).toString("base64");
    try {
      const res = await fetch("https://api.close.com/api/v1/me/", {
        headers: { Authorization: `Basic ${basic}` },
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `Close API ${res.status}: ${body.slice(0, 200)}` };
      }
      const json = (await res.json()) as { first_name?: string; last_name?: string; email?: string; organizations?: { name?: string }[] };
      return {
        ok: true,
        user: `${json.first_name ?? ""} ${json.last_name ?? ""}`.trim() || json.email || "Unknown",
        organization: json.organizations?.[0]?.name ?? null,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Network error" };
    }
  });

/** List leads from Close. Supports optional search query. Returns null when not configured (caller falls back to sample). */
export const listCloseLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; limit?: number } | undefined) => ({
    query: input?.query?.trim() || "",
    limit: Math.min(Math.max(input?.limit ?? 200, 1), 500),
  }))
  .handler(async ({ context, data }) => {
    const key = await readCloseKey(context);
    if (!key) return { configured: false, leads: [] };
    const basic = Buffer.from(`${key}:`).toString("base64");
    const params = new URLSearchParams();
    params.set("_limit", String(data.limit));
    if (data.query) params.set("query", data.query);
    try {
      const res = await fetch(`https://api.close.com/api/v1/lead/?${params.toString()}`, {
        headers: { Authorization: `Basic ${basic}` },
      });
      if (!res.ok) return { configured: true, error: `Close API ${res.status}`, leads: [] };
      const json = (await res.json()) as { data?: any[] };
      const leads = (json.data ?? []).map((l: any) => {
        const opps: any[] = Array.isArray(l.opportunities) ? l.opportunities : [];
        // Close stores opportunity values in cents — $5,000 arrives as 500000.
        const value = Math.round(opps.reduce((a, o) => a + Number(o.value ?? 0), 0)) / 100;
        const activeOpp = opps.find((o) => o.status_type === "active") ?? opps[0];
        return {
          id: String(l.id ?? ""),
          name: String(l.display_name ?? l.name ?? "Unnamed"),
          status: String(l.status_label ?? "Unknown"),
          status_type: String(activeOpp?.status_type ?? l.status_type ?? ""),
          value,
          updated_at: String(l.date_updated ?? ""),
        };
      });
      return { configured: true, leads };
    } catch (e: any) {
      return { configured: true, error: e?.message ?? "Network error", leads: [] };
    }
  });


/** Lead-creation counts for dashboards: total + per-day over the window. */
export const getCloseLeadStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(input?.days ?? 30, 1), 90),
  }))
  .handler(async ({ context, data }) => {
    const empty = { configured: false, total: 0, daily: [] as { date: string; count: number }[] };
    const key = await readCloseKey(context);
    if (!key) return empty;
    const basic = Buffer.from(`${key}:`).toString("base64");
    const since = new Date(Date.now() - data.days * 86400000).toISOString().slice(0, 10);
    const params = new URLSearchParams();
    params.set("_limit", "200");
    params.set("_fields", "id,date_created");
    params.set("query", `date_created >= "${since}"`);
    try {
      const res = await fetch(`https://api.close.com/api/v1/lead/?${params.toString()}`, {
        headers: { Authorization: `Basic ${basic}` },
      });
      if (!res.ok) return { ...empty, configured: true };
      const json = (await res.json()) as { data?: { date_created?: string }[] };
      const byDay = new Map<string, number>();
      for (const l of json.data ?? []) {
        const day = (l.date_created ?? "").slice(0, 10);
        if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      return {
        configured: true,
        total: (json.data ?? []).length,
        daily: [...byDay.entries()].map(([date, count]) => ({ date, count })),
      };
    } catch {
      return { ...empty, configured: true };
    }
  });

export type CloseCallStats = {
  configured: boolean;
  totalDials: number;
  totalAnswered: number;
  avgDurationSec: number | null;
  perUser: { name: string; dials: number; answered: number; avgDurationSec: number | null }[];
};

/** Dials + call durations per rep from Close call activities. */
export const getCloseCallStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number; date?: string } | undefined) => ({
    days: Math.min(Math.max(input?.days ?? 7, 1), 30),
    // A specific calendar day (YYYY-MM-DD) — overrides the rolling window.
    date: input?.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : undefined,
  }))
  .handler(async ({ context, data }): Promise<CloseCallStats> => {
    const empty: CloseCallStats = { configured: false, totalDials: 0, totalAnswered: 0, avgDurationSec: null, perUser: [] };
    const key = await readCloseKey(context);
    if (!key) return empty;
    const basic = Buffer.from(`${key}:`).toString("base64");
    const since = data.date ? `${data.date}T00:00:00Z` : new Date(Date.now() - data.days * 86400000).toISOString();
    const until = data.date ? `${data.date}T23:59:59Z` : null;

    type Call = { user_name?: string; duration?: number; disposition?: string; direction?: string };
    const calls: Call[] = [];
    try {
      // Page through up to 1000 recent calls — plenty for a 7–30 day window.
      // Activity endpoints cap _limit at 100 (leads allow 200).
      for (let skip = 0; skip < 1000; skip += 100) {
        const params = new URLSearchParams({
          date_created__gte: since,
          ...(until ? { date_created__lte: until } : {}),
          _limit: "100",
          _skip: String(skip),
          _fields: "id,user_name,duration,direction,disposition",
        });
        const res = await fetch(`https://api.close.com/api/v1/activity/call/?${params}`, {
          headers: { Authorization: `Basic ${basic}` },
        });
        if (!res.ok) break;
        const json = (await res.json()) as { data?: Call[]; has_more?: boolean };
        calls.push(...(json.data ?? []));
        if (!json.has_more) break;
      }
    } catch {
      return { ...empty, configured: true };
    }

    const byUser = new Map<string, { dials: number; answered: number; durationSum: number }>();
    for (const c of calls) {
      if (c.direction !== "outbound") continue;
      const name = c.user_name || "Unknown";
      const row = byUser.get(name) ?? { dials: 0, answered: 0, durationSum: 0 };
      row.dials += 1;
      if (c.disposition === "answered" || (c.duration ?? 0) > 0) {
        row.answered += 1;
        row.durationSum += c.duration ?? 0;
      }
      byUser.set(name, row);
    }

    const perUser = [...byUser.entries()]
      .map(([name, r]) => ({
        name,
        dials: r.dials,
        answered: r.answered,
        avgDurationSec: r.answered > 0 ? Math.round(r.durationSum / r.answered) : null,
      }))
      .sort((a, b) => b.dials - a.dials);

    const totalDials = perUser.reduce((s, u) => s + u.dials, 0);
    const totalAnswered = perUser.reduce((s, u) => s + u.answered, 0);
    const durationSum = [...byUser.values()].reduce((s, r) => s + r.durationSum, 0);
    return {
      configured: true,
      totalDials,
      totalAnswered,
      avgDurationSec: totalAnswered > 0 ? Math.round(durationSum / totalAnswered) : null,
      perUser,
    };
  });

export type CloseLeadDetail = {
  notes: { note: string; user: string; date: string }[];
  calls: { user: string; duration: number; disposition: string; date: string }[];
};

/** Notes + call history for one Close lead — who called, what they wrote. */
export const getCloseLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!/^lead_[A-Za-z0-9]+$/.test(input?.leadId ?? "")) throw new Error("Invalid lead id");
    return { leadId: input.leadId };
  })
  .handler(async ({ context, data }): Promise<CloseLeadDetail> => {
    const key = await readCloseKey(context);
    if (!key) return { notes: [], calls: [] };
    const basic = Buffer.from(`${key}:`).toString("base64");
    const H = { headers: { Authorization: `Basic ${basic}` } };
    try {
      const [notesRes, callsRes] = await Promise.all([
        fetch(`https://api.close.com/api/v1/activity/note/?lead_id=${data.leadId}&_limit=20&_fields=note,user_name,date_created`, H),
        fetch(`https://api.close.com/api/v1/activity/call/?lead_id=${data.leadId}&_limit=20&_fields=user_name,duration,disposition,direction,date_created`, H),
      ]);
      const notes = notesRes.ok ? ((await notesRes.json()).data ?? []) : [];
      const calls = callsRes.ok ? ((await callsRes.json()).data ?? []) : [];
      return {
        notes: notes.map((n: any) => ({ note: n.note ?? "", user: n.user_name ?? "?", date: n.date_created ?? "" })),
        calls: calls
          .filter((c: any) => c.direction === "outbound")
          .map((c: any) => ({ user: c.user_name ?? "?", duration: c.duration ?? 0, disposition: c.disposition ?? "", date: c.date_created ?? "" })),
      };
    } catch {
      return { notes: [], calls: [] };
    }
  });

/** How many leads sit in BOOKED APPOINTMENT right now — a CRM-sourced count,
 *  shown alongside (never summed into) EOD-reported sets. */
export const getCloseBookedCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await readCloseKey(context);
    if (!key) return { configured: false, booked: 0 };
    const basic = Buffer.from(`${key}:`).toString("base64");
    try {
      const res = await fetch(
        `https://api.close.com/api/v1/lead/?query=${encodeURIComponent('status:"BOOKED APPOINTMENT"')}&_limit=1&_fields=id`,
        { headers: { Authorization: `Basic ${basic}` } },
      );
      if (!res.ok) return { configured: true, booked: 0 };
      const json = (await res.json()) as { total_results?: number };
      return { configured: true, booked: json.total_results ?? 0 };
    } catch {
      return { configured: true, booked: 0 };
    }
  });

// ── Contact compliance: is the outreach SOP actually being followed? ────────
// SOP: dial every lead; no pickup → double dial (second call same day);
// still no pickup → send an email. This sweeps the whole CRM and reports,
// per lead tier (Lead Score custom field) and overall, who's uncontacted,
// who was touched today, and where the double-dial/email chain broke.

const LEAD_SCORE_FIELD = "custom.cf_wYEMFv3XLO6cvMuykIgGzvpHFPUtSobVIdwiKF6gBQR";

export type ComplianceTier = {
  tier: string;
  total: number;
  uncontacted: number;
  contactedToday: number;
  calledOnce: number;
  doubleDialed: number;
  /** Dialed once, never answered, never re-dialed same day — SOP step 2 missed. */
  singleDialNoRetry: number;
  /** Double-dialed, still no answer, and no email followed — SOP step 3 missed. */
  doubleDialNoEmail: number;
};

export type ContactCompliance = {
  configured: boolean;
  error?: string;
  truncated: boolean;
  totalLeads: number;
  tiers: ComplianceTier[];
  overall: ComplianceTier;
};

export const getCloseContactCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContactCompliance> => {
    const emptyTier = (tier: string): ComplianceTier => ({
      tier, total: 0, uncontacted: 0, contactedToday: 0, calledOnce: 0,
      doubleDialed: 0, singleDialNoRetry: 0, doubleDialNoEmail: 0,
    });
    const empty: ContactCompliance = {
      configured: false, truncated: false, totalLeads: 0, tiers: [], overall: emptyTier("All"),
    };
    const key = await readCloseKey(context);
    if (!key) return empty;
    const basic = Buffer.from(`${key}:`).toString("base64");
    const H = { headers: { Authorization: `Basic ${basic}` } };
    let truncated = false;

    // 1. Every lead with its tier (Lead Score choices field)
    type Lead = { id: string; tier: string };
    const leads: Lead[] = [];
    try {
      for (let skip = 0; skip < 2000; skip += 200) {
        const params = new URLSearchParams({
          _limit: "200", _skip: String(skip), _fields: `id,${LEAD_SCORE_FIELD}`,
        });
        const res = await fetch(`https://api.close.com/api/v1/lead/?${params}`, H);
        if (!res.ok) return { ...empty, configured: true, error: `Close API ${res.status}` };
        const json = (await res.json()) as { data?: Record<string, unknown>[]; has_more?: boolean };
        for (const l of json.data ?? []) {
          const raw = l[LEAD_SCORE_FIELD];
          const label = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
          const tier = /^A/i.test(label) ? "A" : /^B/i.test(label) ? "B" : /^C/i.test(label) ? "C" : "Unscored";
          leads.push({ id: String(l.id), tier });
        }
        if (!json.has_more) break;
        if (skip + 200 >= 2000) truncated = true;
      }
    } catch (e) {
      return { ...empty, configured: true, error: (e as Error).message };
    }

    // 2. All outbound calls + sent emails (paged; the CRM is young enough to sweep)
    type Call = { lead_id?: string; direction?: string; disposition?: string; duration?: number; date_created?: string };
    type Email = { lead_id?: string; direction?: string; date_created?: string };
    const calls: Call[] = [];
    const emails: Email[] = [];
    const page = async <T,>(path: string, fields: string, cap: number, sink: T[]) => {
      for (let skip = 0; skip < cap; skip += 100) {
        const params = new URLSearchParams({ _limit: "100", _skip: String(skip), _fields: fields });
        const res = await fetch(`https://api.close.com/api/v1/activity/${path}/?${params}`, H);
        if (!res.ok) break;
        const json = (await res.json()) as { data?: T[]; has_more?: boolean };
        sink.push(...(json.data ?? []));
        if (!json.has_more) return;
      }
      truncated = true;
    };
    try {
      await Promise.all([
        page<Call>("call", "id,lead_id,direction,disposition,duration,date_created", 5000, calls),
        page<Email>("email", "id,lead_id,direction,date_created", 3000, emails),
      ]);
    } catch {
      // A mid-sweep network failure means partial data — say so
      truncated = true;
    }

    // "Today" is the business day (Asia/Dubai) — this report is the founder's morning scan
    const bizToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
    const bizDay = (iso?: string) => iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso)) : "";

    type LeadTouch = { dials: number; answered: boolean; emailsSent: number; touchedToday: boolean; maxDialsOneDay: number; lastEmailAt: string };
    const touch = new Map<string, LeadTouch>();
    const get = (id?: string) => {
      if (!id) return null;
      let t = touch.get(id);
      if (!t) { t = { dials: 0, answered: false, emailsSent: 0, touchedToday: false, maxDialsOneDay: 0, lastEmailAt: "" }; touch.set(id, t); }
      return t;
    };
    const dialsByLeadDay = new Map<string, number>();
    for (const c of calls) {
      if (c.direction !== "outbound") continue;
      const t = get(c.lead_id);
      if (!t) continue;
      t.dials += 1;
      if (c.disposition === "answered" || (c.duration ?? 0) > 0) t.answered = true;
      const day = bizDay(c.date_created);
      if (day === bizToday) t.touchedToday = true;
      const k = `${c.lead_id}::${day}`;
      const n = (dialsByLeadDay.get(k) ?? 0) + 1;
      dialsByLeadDay.set(k, n);
      if (n > t.maxDialsOneDay) t.maxDialsOneDay = n;
    }
    for (const e of emails) {
      if (e.direction !== "outgoing") continue;
      const t = get(e.lead_id);
      if (!t) continue;
      t.emailsSent += 1;
      if (bizDay(e.date_created) === bizToday) t.touchedToday = true;
    }

    const tiers = new Map<string, ComplianceTier>([["A", emptyTier("A")], ["B", emptyTier("B")], ["C", emptyTier("C")], ["Unscored", emptyTier("Unscored")]]);
    const overall = emptyTier("All");
    const bump = (row: ComplianceTier, t: LeadTouch | undefined) => {
      row.total += 1;
      if (!t || (t.dials === 0 && t.emailsSent === 0)) { row.uncontacted += 1; return; }
      if (t.touchedToday) row.contactedToday += 1;
      if (t.dials === 1) row.calledOnce += 1;
      if (t.maxDialsOneDay >= 2) row.doubleDialed += 1;
      if (!t.answered && t.dials === 1) row.singleDialNoRetry += 1;
      if (!t.answered && t.maxDialsOneDay >= 2 && t.emailsSent === 0) row.doubleDialNoEmail += 1;
    };
    for (const l of leads) {
      const t = touch.get(l.id);
      bump(tiers.get(l.tier)!, t);
      bump(overall, t);
    }

    return {
      configured: true,
      truncated,
      totalLeads: leads.length,
      tiers: [...tiers.values()].filter((t) => t.total > 0),
      overall,
    };
  });
