import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeadNote = {
  id: string;
  lead_id: string;
  lead_name: string | null;
  body: string;
  pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar: string | null;
};

export const listLeadNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("leadId required");
    return { leadId: input.leadId };
  })
  .handler(async ({ context, data }): Promise<LeadNote[]> => {
    const { data: rows, error } = await context.supabase
      .from("crm_lead_notes")
      .select("id, lead_id, lead_name, body, pinned, created_by, created_at, updated_at")
      .eq("lead_id", data.leadId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r: any) => r.created_by))];
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (ids.length) {
      const { data: pr } = await context.supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      profiles = Object.fromEntries((pr ?? []).map((p: any) => [p.id, p]));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      author_name: profiles[r.created_by]?.display_name ?? null,
      author_avatar: profiles[r.created_by]?.avatar_url ?? null,
    }));
  });

export const createLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leadId: string; leadName?: string | null; body: string; pinned?: boolean }) => {
    if (!input?.leadId) throw new Error("leadId required");
    const body = String(input.body ?? "").trim();
    if (!body) throw new Error("Note body required");
    return {
      leadId: input.leadId,
      leadName: input.leadName ?? null,
      body,
      pinned: !!input.pinned,
    };
  })
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("crm_lead_notes")
      .insert({
        lead_id: data.leadId,
        lead_name: data.leadName,
        body: data.body,
        pinned: data.pinned,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; body?: string; pinned?: boolean }) => {
    if (!input?.id) throw new Error("id required");
    const patch: { body?: string; pinned?: boolean } = {};
    if (typeof input.body === "string") patch.body = input.body.trim();
    if (typeof input.pinned === "boolean") patch.pinned = input.pinned;
    return { id: input.id, patch };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("crm_lead_notes")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return { id: input.id };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("crm_lead_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Count notes across many lead ids in one call, for badges on the list. */
// POST: the id list for a full lead book overflows a GET URL (431s at ~200 leads).
export const countLeadNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leadIds: string[] }) => ({
    leadIds: Array.isArray(input?.leadIds) ? input.leadIds.filter(Boolean).slice(0, 500) : [],
  }))
  .handler(async ({ context, data }): Promise<Record<string, number>> => {
    if (!data.leadIds.length) return {};
    const { data: rows, error } = await context.supabase
      .from("crm_lead_notes")
      .select("lead_id")
      .in("lead_id", data.leadIds);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) counts[(r as any).lead_id] = (counts[(r as any).lead_id] ?? 0) + 1;
    return counts;
  });
