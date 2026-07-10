/**
 * Seed demo data for portal preview/demo.
 * Generates a high-performing team: 4 setters, ~$100k/month, realistic KPIs.
 * All records flagged is_demo=true for safe teardown via remove-demo.mjs.
 *
 * Usage: node --env-file=.env scripts/seed-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_PASSWORD = "DemoPortal2026!";
const DEMO_SUFFIX = "@isa.demo";

const isoDay = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

// ── 1. Demo team ──────────────────────────────────────────────────────────
const TEAM = [
  { name: "Alex Rivera",  email: `demo-setter1${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "phone" },
  { name: "Bilal Hassan", email: `demo-setter2${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "phone" },
  { name: "Chloe Kim",    email: `demo-setter3${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "dm" },
  { name: "Dana Osei",    email: `demo-setter4${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "dm" },
  { name: "Evan Costa",   email: `demo-closer${DEMO_SUFFIX}`,  roles: ["closer"] },
  { name: "Fatima Nour",  email: `demo-coach${DEMO_SUFFIX}`,   roles: ["coach"] },
  { name: "Grace Liu",    email: `demo-csm${DEMO_SUFFIX}`,     roles: ["csm"] },
];

console.log("Creating demo users…");
const userMap = {};

for (const member of TEAM) {
  const { data: existing } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find(u => u.email === member.email);
  let uid;

  if (found) {
    uid = found.id;
    console.log(`  ↻ ${member.name} already exists`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: member.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: member.name },
    });
    if (error) { console.error(`  ✗ ${member.name}: ${error.message}`); continue; }
    uid = data.user.id;
    console.log(`  ✓ ${member.name}`);
  }
  userMap[member.name] = uid;

  await sb.from("profiles").upsert(
    { id: uid, display_name: member.name, setter_type: member.setter_type ?? null },
    { onConflict: "id" },
  );

  for (const role of member.roles) {
    await sb.from("user_roles").upsert({ user_id: uid, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  }
}

const setters = [
  { id: userMap["Alex Rivera"],  type: "phone" },
  { id: userMap["Bilal Hassan"], type: "phone" },
  { id: userMap["Chloe Kim"],    type: "dm" },
  { id: userMap["Dana Osei"],    type: "dm" },
].filter(s => s.id);

const closerId = userMap["Evan Costa"];
const csmId    = userMap["Grace Liu"];

// ── 2. EODs — 30 days, realistic high-performer numbers ──────────────────
console.log("Seeding EODs…");

// All eod columns with defaults so PostgREST never sends explicit null
const eodDefaults = {
  dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
  shows: 0, no_shows: 0,
  looms_reviewed: 0, roleplays_reviewed: 0, student_checkins: 0, escalations_resolved: 0,
  calls_taken: 0, closes: 0, deposits: 0, cash_collected: 0, deferred_cash: 0, follow_ups_done: 0,
  dials: 0, leads_contacted: 0,
};

const eodRows = [];

for (let day = 0; day < 30; day++) {
  const date = isoDay(day);

  for (const setter of setters) {
    if (setter.type === "phone") {
      const sets = rand(2, 5);
      const shows = rand(Math.max(0, sets - 2), sets);
      eodRows.push({
        ...eodDefaults,
        user_id: setter.id,
        report_date: date,
        dials: rand(95, 145),
        leads_contacted: 0,
        convos_started: rand(8, 18),
        calls_booked: sets,
        shows,
        no_shows: rand(0, 1),
        wins: `Booked ${sets} calls. ${sets >= 4 ? "On fire today." : "Solid day."}`,
        blockers: day % 8 === 0 ? "Leads going cold faster than usual." : null,
        is_demo: true,
      });
    } else {
      const sets = rand(2, 5);
      const shows = rand(Math.max(0, sets - 2), sets);
      eodRows.push({
        ...eodDefaults,
        user_id: setter.id,
        report_date: date,
        dials: 0,
        leads_contacted: rand(125, 200),
        convos_started: rand(12, 25),
        calls_booked: sets,
        dms_sent: rand(125, 200),
        shows,
        no_shows: rand(0, 1),
        wins: `${sets} sets from DMs. Response rate looking good.`,
        blockers: day % 10 === 0 ? "Some accounts restricted — switching to backup profiles." : null,
        is_demo: true,
      });
    }
  }

  if (closerId) {
    const closes = rand(1, 3);
    const cashPerClose = [2500, 5000, 7500, 10000][rand(0, 3)];
    eodRows.push({
      ...eodDefaults,
      user_id: closerId,
      report_date: date,
      calls_taken: rand(3, 7),
      closes,
      cash_collected: closes * cashPerClose,
      deposits: rand(0, 1) * 1000,
      deferred_cash: rand(0, 1) * 2500,
      follow_ups_done: rand(2, 6),
      wins: closes >= 2 ? `Closed ${closes} today. Cash in.` : "One close, follow-ups looking warm.",
      is_demo: true,
    });
  }

  if (csmId) {
    eodRows.push({
      ...eodDefaults,
      user_id: csmId,
      report_date: date,
      looms_reviewed: rand(2, 6),
      roleplays_reviewed: rand(1, 4),
      student_checkins: rand(2, 5),
      escalations_resolved: rand(0, 1),
      wins: "Students progressing. Marcus had a breakthrough on objection handling.",
      is_demo: true,
    });
  }
}

const { error: eodErr } = await sb.from("eods").upsert(eodRows, { onConflict: "user_id,report_date" });
if (eodErr) console.error("EOD error:", eodErr.message);
else console.log(`  ✓ ${eodRows.length} EOD rows`);

// ── 3. Students ───────────────────────────────────────────────────────────
console.log("Seeding students…");
const STUDENTS = [
  { full_name: "Marcus Chen",   email: "marcus.chen@demo.isa",   status: "active",   phase: "coaching_1on1" },
  { full_name: "Sofia Patel",   email: "sofia.patel@demo.isa",   status: "active",   phase: "coaching_1on1" },
  { full_name: "Jordan Miles",  email: "jordan.miles@demo.isa",  status: "active",   phase: "graduated" },
  { full_name: "Aya Nakamura",  email: "aya.nakamura@demo.isa",  status: "ghosting", phase: "coaching_1on1" },
  { full_name: "Leo Santos",    email: "leo.santos@demo.isa",    status: "active",   phase: "coaching_1on1" },
  { full_name: "Priya Sharma",  email: "priya.sharma@demo.isa",  status: "active",   phase: "coaching_1on1" },
  { full_name: "Omar Khalid",   email: "omar.khalid@demo.isa",   status: "active",   phase: "graduated" },
  { full_name: "Isabelle Tremblay", email: "isabelle.t@demo.isa", status: "active",  phase: "coaching_1on1" },
];

const studentIds = [];
for (const s of STUDENTS) {
  const { data, error } = await sb.from("students").upsert({
    ...s,
    join_date: isoDay(rand(20, 60)),
    is_demo: true,
    testimonial_collected: s.phase === "graduated",
    first_win_at: s.phase === "graduated" ? isoDay(rand(10, 30)) : null,
  }, { onConflict: "email" }).select("id").single();
  if (error) { console.error(`  ✗ ${s.full_name}: ${error.message}`); continue; }
  studentIds.push({ id: data.id, name: s.full_name });
  console.log(`  ✓ ${s.full_name}`);
}

// ── 4. Deals — ~$100k/month ───────────────────────────────────────────────
console.log("Seeding deals…");

// Delete existing demo deals first so we can re-insert cleanly
await sb.from("deals").delete().eq("is_demo", true);

const DEAL_TEMPLATES = [
  { total_value: 10000, cash_collected_upfront: 10000, payment_type: "pif" },
  { total_value: 7500,  cash_collected_upfront: 7500,  payment_type: "pif" },
  { total_value: 7500,  cash_collected_upfront: 3750,  payment_type: "split" },
  { total_value: 5000,  cash_collected_upfront: 5000,  payment_type: "pif" },
  { total_value: 5000,  cash_collected_upfront: 2500,  payment_type: "split" },
  { total_value: 10000, cash_collected_upfront: 5000,  payment_type: "split" },
  { total_value: 7500,  cash_collected_upfront: 7500,  payment_type: "pif" },
  { total_value: 5000,  cash_collected_upfront: 5000,  payment_type: "pif" },
  { total_value: 10000, cash_collected_upfront: 10000, payment_type: "pif" },
  { total_value: 7500,  cash_collected_upfront: 3750,  payment_type: "split" },
  { total_value: 5000,  cash_collected_upfront: 2500,  payment_type: "deposit" },
  { total_value: 10000, cash_collected_upfront: 10000, payment_type: "pif" },
];

const dealRows = DEAL_TEMPLATES.map((template, i) => ({
  ...template,
  student_id: studentIds[i % studentIds.length]?.id ?? studentIds[0]?.id,
  student_name: studentIds[i % studentIds.length]?.name ?? studentIds[0]?.name,
  closer_id: closerId ?? setters[0]?.id,
  setter_id: setters[i % setters.length]?.id ?? null,
  program_type: "ISA Accelerator",
  deal_date: isoDay(rand(0, 28)),
  is_demo: true,
}));

const { error: dealErr } = await sb.from("deals").insert(dealRows);
if (dealErr) console.error("Deal error:", dealErr.message);
else {
  const totalCash = dealRows.reduce((s, d) => s + d.cash_collected_upfront, 0);
  console.log(`  ✓ ${dealRows.length} deals · $${totalCash.toLocaleString()} cash collected`);
}

// ── 5. IG Snapshot ────────────────────────────────────────────────────────
console.log("Seeding IG snapshot…");
const now = new Date();
const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const { error: igErr } = await sb.from("ig_monthly_snapshots").upsert({
  month: monthStr,
  followers: 9240,
  new_followers: 820,
  views: 312000,
  reach: 481000,
  profile_visits: 6800,
  interactions: 4200,
  dms: 310,
  link_clicks: 540,
  posts: 18,
  notes: "Best month ever — the setter income breakdown reel hit 180k views. DMs spiking.",
  is_demo: true,
}, { onConflict: "month" });
if (igErr) console.error("IG error:", igErr.message);
else console.log("  ✓ IG snapshot");

// ── 6. Action Items ───────────────────────────────────────────────────────
console.log("Seeding action items…");

// Delete existing demo action items first
await sb.from("student_action_items").delete().eq("is_demo", true);

const actionItems = [
  { text: "Follow up with Aya — no response in 5 days", due_date: isoDay(1) },
  { text: "Request testimonial from Jordan", due_date: isoDay(3) },
  { text: "Review Leo's first roleplay loom", due_date: isoDay(2) },
  { text: "Send payment reminder — Marcus installment due", due_date: isoDay(0) },
  { text: "Schedule graduation call with Omar", due_date: isoDay(4) },
];

const { error: aiErr } = await sb.from("student_action_items").insert(
  actionItems.map((item, i) => ({
    ...item,
    student_id: studentIds[i % studentIds.length]?.id ?? studentIds[0]?.id,
    assignee_id: csmId ?? closerId ?? setters[0]?.id,
    created_by: csmId ?? closerId ?? setters[0]?.id,
    done: false,
    is_demo: true,
  }))
);
if (aiErr) console.error("Action items error:", aiErr.message);
else console.log(`  ✓ ${actionItems.length} action items`);

console.log("\n✅ Demo seed complete.");
const totalRevenue = dealRows.reduce((s, d) => s + d.total_value, 0);
const totalCash = dealRows.reduce((s, d) => s + d.cash_collected_upfront, 0);
console.log(`   Revenue: $${totalRevenue.toLocaleString()} | Cash collected: $${totalCash.toLocaleString()}`);
console.log("   Run remove-demo.mjs to tear down.");
