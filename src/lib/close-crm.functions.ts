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
        const value = opps.reduce((a, o) => a + Number(o.value ?? 0), 0);
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
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(input?.days ?? 7, 1), 30),
  }))
  .handler(async ({ context, data }): Promise<CloseCallStats> => {
    const empty: CloseCallStats = { configured: false, totalDials: 0, totalAnswered: 0, avgDurationSec: null, perUser: [] };
    const key = await readCloseKey(context);
    if (!key) return empty;
    const basic = Buffer.from(`${key}:`).toString("base64");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    type Call = { user_name?: string; duration?: number; disposition?: string; direction?: string };
    const calls: Call[] = [];
    try {
      // Page through up to 1000 recent calls — plenty for a 7–30 day window.
      // Activity endpoints cap _limit at 100 (leads allow 200).
      for (let skip = 0; skip < 1000; skip += 100) {
        const params = new URLSearchParams({
          date_created__gte: since,
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
