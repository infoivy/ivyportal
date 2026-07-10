import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Local YYYY-MM-DD from a UTC-midnight Date. Avoid toISOString() — for a Date
// built via Date.UTC() it returns the intended day, but we standardize here
// to prevent regressions.
function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function requireFounderOrAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isFounder }, { data: isAdmin }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "founder" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
  ]);
  if (!isFounder && !isAdmin) throw new Error("Forbidden: founder only");
}

/** Provision the 7 reel slots + 10 idea rows for a given week if not already done. Idempotent. */
export const ensureWeekProvisioned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weekStart: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.weekStart ?? "")) throw new Error("weekStart must be YYYY-MM-DD");
    return { weekStart: input.weekStart };
  })
  .handler(async ({ context, data }) => {
    await requireFounderOrAdmin(context);
    const week = data.weekStart;

    // Ensure week plan row
    const { data: existingPlan } = await context.supabase
      .from("content_week_plans")
      .select("week_start, auto_provisioned")
      .eq("week_start", week)
      .maybeSingle();

    if (!existingPlan) {
      await context.supabase.from("content_week_plans").insert({ week_start: week, created_by: context.userId });
    }

    // Dedupe idea rows: keep the oldest row per (week_start, position).
    const { data: allIdeas } = await context.supabase
      .from("content_week_ideas")
      .select("id, position, created_at")
      .eq("week_start", week)
      .order("created_at", { ascending: true });
    const seenPos = new Set<number>();
    const dupIdeaIds: string[] = [];
    for (const r of (allIdeas ?? []) as any[]) {
      if (seenPos.has(r.position)) dupIdeaIds.push(r.id);
      else seenPos.add(r.position);
    }
    if (dupIdeaIds.length) {
      await context.supabase.from("content_week_ideas").delete().in("id", dupIdeaIds);
    }

    // Ensure 10 idea rows (positions 1-10; 1-5 MOF, 6-10 TOF)
    const missing: any[] = [];
    for (let p = 1; p <= 10; p++) {
      if (!seenPos.has(p)) {
        missing.push({
          week_start: week,
          position: p,
          stage: p <= 5 ? "mof" : "tof",
          text: "",
          created_by: context.userId,
        });
      }
    }
    if (missing.length) {
      await context.supabase.from("content_week_ideas").insert(missing);
    }

    // Dedupe auto-provisioned reel slots. An auto slot is identified by
    // hook matching /^(TOF|MOF) · \d of \d$/ — user-authored slots are left
    // alone. Keep the earliest slot per (scheduled_date, hook).
    const { data: allItems } = await context.supabase
      .from("content_items")
      .select("id, scheduled_date, hook, created_at, status")
      .eq("week_start", week)
      .order("created_at", { ascending: true });
    const autoPattern = /^(TOF|MOF) · \d of \d$/;
    const seenAuto = new Map<string, string>(); // "date|hook" -> id
    const dupItemIds: string[] = [];
    for (const r of (allItems ?? []) as any[]) {
      if (!r.hook || !autoPattern.test(r.hook) || !r.scheduled_date) continue;
      // only dedupe untouched placeholders (status still 'idea')
      if (r.status && r.status !== "idea") continue;
      const key = `${r.scheduled_date}|${r.hook}`;
      if (seenAuto.has(key)) dupItemIds.push(r.id);
      else seenAuto.set(key, r.id);
    }
    if (dupItemIds.length) {
      await context.supabase.from("content_items").delete().in("id", dupItemIds);
    }

    // Compute the canonical 7 slots for this week.
    const monday = new Date(`${week}T00:00:00Z`);
    const canonical: { date: string; stage: "tof" | "mof"; label: string }[] = [
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 0))), stage: "tof", label: "TOF · 1 of 4" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 1))), stage: "tof", label: "TOF · 2 of 4" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 2))), stage: "tof", label: "TOF · 3 of 4" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 3))), stage: "tof", label: "TOF · 4 of 4" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 4))), stage: "mof", label: "MOF · 1 of 3" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 5))), stage: "mof", label: "MOF · 2 of 3" },
      { date: ymdUTC(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6))), stage: "mof", label: "MOF · 3 of 3" },
    ];

    // Insert only the canonical slots that don't already exist (idempotent).
    const rowsToInsert = canonical
      .filter((c) => !seenAuto.has(`${c.date}|${c.label}`))
      .map((c) => ({
        created_by: context.userId,
        scheduled_date: c.date,
        platform: "instagram" as const,
        format: "Reel",
        hook: c.label,
        status: "idea" as const,
        funnel_stage: c.stage,
        week_start: week,
        tags: [] as string[],
      }));
    if (rowsToInsert.length) {
      const { error } = await context.supabase.from("content_items").insert(rowsToInsert);
      if (error) throw new Error(error.message);
    }

    if (!existingPlan?.auto_provisioned) {
      await context.supabase
        .from("content_week_plans")
        .update({ auto_provisioned: true })
        .eq("week_start", week);
    }

    return { ok: true };
  });

/** Generate 10 content ideas through a configurable OpenAI-compatible API. Fills empty positions. */
export const generateWeekIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weekStart: string; brandContext?: string; overwrite?: boolean }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.weekStart ?? "")) throw new Error("weekStart must be YYYY-MM-DD");
    return {
      weekStart: input.weekStart,
      brandContext: (input.brandContext ?? "").slice(0, 2000),
      overwrite: !!input.overwrite,
    };
  })
  .handler(async ({ context, data }) => {
    await requireFounderOrAdmin(context);
    const apiBaseUrl = process.env.AI_API_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiBaseUrl || !apiKey || !model) {
      throw new Error("AI ideation is not configured. Set AI_API_BASE_URL, AI_API_KEY, and AI_MODEL in the server environment.");
    }

    const systemPrompt = `You are a content strategist generating a week's short-form video ideation pad.
Return exactly 10 ideas as a JSON array. Ideas 1-5 are Middle of Funnel (MOF): social proof, breakdowns, results, deeper value, CTAs — for warm followers who already know the creator.
Ideas 6-10 are Top of Funnel (TOF): hooks, entertainment, relatable moments, value drops, identity content — for strangers scrolling.
Each idea object has: {"stage":"mof"|"tof","text":"the hook/idea, one sentence","creative_type":"one of: Talking head, Pick up the phone angle, Side angle, Miro board walkthrough, Ceiling angle, Prestigious background, Vlog style"}
Return ONLY the JSON array, no markdown fences, no prose.`;

    const userPrompt = `Brand / niche context:\n${data.brandContext || "(no context provided — assume a business coach / info-product creator)"}\n\nGenerate 10 ideas for the week starting ${data.weekStart}.`;

    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a minute");
      if (res.status === 402) throw new Error("AI provider credits are exhausted");
      throw new Error(`AI provider ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    let ideas: { stage: "mof" | "tof"; text: string; creative_type?: string }[];
    try {
      ideas = JSON.parse(cleaned);
    } catch {
      // try to extract array
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("AI response was not valid JSON");
      ideas = JSON.parse(m[0]);
    }
    if (!Array.isArray(ideas) || ideas.length === 0) throw new Error("AI returned no ideas");

    // Split & pad to 5 MOF + 5 TOF
    const mof = ideas.filter((i) => i.stage === "mof").slice(0, 5);
    const tof = ideas.filter((i) => i.stage === "tof").slice(0, 5);
    while (mof.length < 5) mof.push({ stage: "mof", text: "", creative_type: "" });
    while (tof.length < 5) tof.push({ stage: "tof", text: "", creative_type: "" });

    // Load current rows to decide overwrite policy
    const { data: current } = await context.supabase
      .from("content_week_ideas")
      .select("id, position, text")
      .eq("week_start", data.weekStart);
    const byPos = new Map<number, { id: string; text: string }>();
    (current ?? []).forEach((r: any) => byPos.set(r.position, { id: r.id, text: r.text ?? "" }));

    const updates: { id: string; text: string; matched_creative_type: string | null }[] = [];
    for (let p = 1; p <= 10; p++) {
      const idea = p <= 5 ? mof[p - 1] : tof[p - 6];
      const existing = byPos.get(p);
      if (!existing) continue;
      if (!data.overwrite && existing.text.trim().length > 0) continue;
      updates.push({
        id: existing.id,
        text: idea.text ?? "",
        matched_creative_type: idea.creative_type ?? null,
      });
    }
    for (const u of updates) {
      await context.supabase
        .from("content_week_ideas")
        .update({ text: u.text, matched_creative_type: u.matched_creative_type })
        .eq("id", u.id);
    }
    return { ok: true, updated: updates.length };
  });

/** Promote a week idea into a content_items slot for that week. */
export const promoteIdeaToSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ideaId: string; contentItemId: string }) => {
    if (!input?.ideaId || !input?.contentItemId) throw new Error("ideaId and contentItemId required");
    return { ideaId: input.ideaId, contentItemId: input.contentItemId };
  })
  .handler(async ({ context, data }) => {
    await requireFounderOrAdmin(context);
    const { data: idea, error: e1 } = await context.supabase
      .from("content_week_ideas")
      .select("id, text, matched_creative_type, week_start, stage")
      .eq("id", data.ideaId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!idea) throw new Error("Idea not found");
    const text = (idea.text ?? "").trim();
    if (!text) throw new Error("Idea has no text yet");

    const { error: e2 } = await context.supabase
      .from("content_items")
      .update({
        hook: text,
        format: idea.matched_creative_type || "Reel",
        funnel_stage: idea.stage,
      })
      .eq("id", data.contentItemId);
    if (e2) throw new Error(e2.message);

    await context.supabase
      .from("content_week_ideas")
      .update({ promoted_item_id: data.contentItemId })
      .eq("id", data.ideaId);
    return { ok: true };
  });
