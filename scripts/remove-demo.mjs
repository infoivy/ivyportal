#!/usr/bin/env node
/**
 * Tear down everything seed-demo.mjs created.
 * Cascades through demo students/users for tables without an is_demo flag.
 * Usage: node --env-file=.env scripts/remove-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);

const { data: demoStudents } = await sb.from("students").select("id").eq("is_demo", true);
const ids = (demoStudents ?? []).map((s) => s.id);
if (ids.length) {
  const { data: plans } = await sb.from("installments").select("id").in("student_id", ids);
  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length) await sb.from("installment_payments").delete().in("installment_id", planIds);
  await sb.from("installments").delete().in("student_id", ids);
  await sb.from("student_calls").delete().in("student_id", ids);
  await sb.from("student_eods").delete().in("student_id", ids);
  await sb.from("csm_student_notes").delete().in("student_id", ids);
  await sb.from("testimonials").delete().in("student_id", ids);
  console.log(`cascaded ${ids.length} demo students' dependents`);
}
for (const table of ["student_action_items", "deals", "eods", "ig_monthly_snapshots", "students"]) {
  const { count } = await sb.from(table).delete({ count: "exact" }).eq("is_demo", true);
  console.log(`${table}: removed ${count ?? 0}`);
}

const { data: list } = await sb.auth.admin.listUsers({ perPage: 500 });
for (const u of list.users) {
  if (u.email?.endsWith("@isa.demo")) {
    await sb.from("csm_tally").delete().eq("user_id", u.id);
    await sb.from("set_reminders").delete().eq("owner_id", u.id);
    await sb.from("team_chat").delete().eq("created_by", u.id);
    await sb.from("student_alerts").delete().eq("created_by", u.id);
    await sb.from("user_roles").delete().eq("user_id", u.id);
    await sb.from("profiles").delete().eq("id", u.id);
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) console.error("FAILED to remove user", u.email, "-", error.message);
    else console.log("removed user", u.email);
  }
}
console.log("✅ demo removed");
