import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IVY_SEED_WEEK } from "@/data/growth-operator";

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

const autoPattern = /^(TOF|MOF) · \d of \d$/;

/**
 * Fill the 7 reel slots for a week with Ivy doctrine seed content.
 * Only overwrites placeholder hooks (TOF/MOF · n of n) or empty ideas.
 * Set force=true to overwrite all idea-status slots for that week.
 */
export const seedIvyDoctrineWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { weekStart: string; force?: boolean }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.weekStart ?? "")) {
      throw new Error("weekStart must be YYYY-MM-DD");
    }
    return { weekStart: input.weekStart, force: !!input.force };
  })
  .handler(async ({ context, data }) => {
    await requireFounderOrAdmin(context);
    const week = data.weekStart;
    const monday = new Date(`${week}T00:00:00Z`);

    // Ensure plan row exists
    const { data: existingPlan } = await context.supabase
      .from("content_week_plans")
      .select("week_start")
      .eq("week_start", week)
      .maybeSingle();
    if (!existingPlan) {
      await context.supabase.from("content_week_plans").insert({
        week_start: week,
        created_by: context.userId,
        auto_provisioned: true,
      });
    }

    const { data: items, error: loadErr } = await context.supabase
      .from("content_items")
      .select("id, scheduled_date, hook, status, funnel_stage, script")
      .eq("week_start", week);
    if (loadErr) throw new Error(loadErr.message);

    type ItemRow = {
      id: string;
      scheduled_date: string | null;
      hook: string | null;
      status: string | null;
      funnel_stage: string | null;
      script: string | null;
      created_at?: string;
    };

    const byDate = new Map<string, ItemRow[]>();
    for (const row of (items ?? []) as ItemRow[]) {
      if (!row.scheduled_date) continue;
      const list = byDate.get(row.scheduled_date) ?? [];
      list.push(row);
      byDate.set(row.scheduled_date, list);
    }

    let updated = 0;
    let inserted = 0;
    const ideaTexts: { position: number; stage: string; text: string }[] = [];

    for (const seed of IVY_SEED_WEEK) {
      const date = ymdUTC(
        new Date(
          Date.UTC(
            monday.getUTCFullYear(),
            monday.getUTCMonth(),
            monday.getUTCDate() + seed.dayOffset,
          ),
        ),
      );
      const existing = (byDate.get(date) ?? []).sort((a, b) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      );
      const placeholder = existing.find(
        (r) =>
          autoPattern.test(r.hook ?? "") ||
          (r.status === "idea" && (!r.script || !String(r.script).trim())),
      );
      const target = data.force
        ? (existing.find((r) => r.status === "idea" || autoPattern.test(r.hook ?? "")) ??
          existing[0])
        : placeholder;

      const payload = {
        hook: seed.hook,
        title: seed.title,
        script: seed.script,
        format: seed.format,
        funnel_stage: seed.stage,
        status: "scripted" as const,
        tags: seed.tags,
        source: "ivy-doctrine-seed",
        platform: "instagram" as const,
        week_start: week,
        scheduled_date: date,
      };

      if (target?.id) {
        const { error } = await context.supabase
          .from("content_items")
          .update(payload)
          .eq("id", target.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await context.supabase.from("content_items").insert({
          ...payload,
          created_by: context.userId,
        });
        if (error) throw new Error(error.message);
        inserted += 1;
      }

      // Ideation pad: positions 6-10 TOF, 1-5 MOF — map seeds into pad text
      if (seed.stage === "tof") {
        ideaTexts.push({
          position: 6 + Math.min(seed.dayOffset, 4),
          stage: "tof",
          text: seed.hook,
        });
      } else {
        ideaTexts.push({
          position: 1 + Math.min(seed.dayOffset - 4, 4),
          stage: "mof",
          text: seed.hook,
        });
      }
    }

    // Upsert idea pad rows lightly
    for (const idea of ideaTexts) {
      const { data: row } = await context.supabase
        .from("content_week_ideas")
        .select("id, text")
        .eq("week_start", week)
        .eq("position", idea.position)
        .maybeSingle();
      if (row?.id) {
        if (!row.text || data.force) {
          await context.supabase
            .from("content_week_ideas")
            .update({ text: idea.text, stage: idea.stage })
            .eq("id", row.id);
        }
      } else {
        await context.supabase.from("content_week_ideas").insert({
          week_start: week,
          position: idea.position,
          stage: idea.stage,
          text: idea.text,
          created_by: context.userId,
        });
      }
    }

    return { ok: true, weekStart: week, updated, inserted };
  });
