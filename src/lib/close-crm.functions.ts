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

