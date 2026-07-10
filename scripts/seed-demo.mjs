/**
 * Seed demo data for portal preview/demo.
 * Creates users, EODs, students, deals, IG snapshot, and action items.
 * All records are flagged is_demo=true for safe teardown via remove-demo.mjs.
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

// ── 1. Create demo users ──────────────────────────────────────────────────
const TEAM = [
  { name: "Alex Rivera", email: `demo-setter1${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "phone" },
  { name: "Bilal Hassan", email: `demo-setter2${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "phone" },
  { name: "Chloe Kim",   email: `demo-setter3${DEMO_SUFFIX}`, roles: ["setter"], setter_type: "dm" },
  { name: "Dana Osei",   email: `demo-closer${DEMO_SUFFIX}`,  roles: ["closer"] },
  { name: "Evan Costa",  email: `demo-coach${DEMO_SUFFIX}`,   roles: ["coach"] },
  { name: "Fatima Nour", email: `demo-csm${DEMO_SUFFIX}`,     roles: ["csm"] },
];

console.log("Creating demo users…");
const userMap = {}; // name → auth user id

for (const member of TEAM) {
  // Check if already exists
  const { data: existing } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find(u => u.email === member.email);
  let uid;

  if (found) {
    uid = found.id;
    console.log(`  ↻ ${member.name} (${member.email}) already exists`);
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

  // Upsert profile
  await sb.from("profiles").upsert(
    { id: uid, display_name: member.name, setter_type: member.setter_type ?? null },
    { onConflict: "id" },
  );

  // Assign roles
  for (const role of member.roles) {
    await sb.from("user_roles").upsert({ user_id: uid, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  }
}

const setterIds = [
  userMap["Alex Rivera"],
  userMap["Bilal Hassan"],
  userMap["Chloe Kim"],
].filter(Boolean);

const closerId = userMap["Dana Osei"];
const csmId = userMap["Fatima Nour"];

// ── 2. EODs — 30 days ────────────────────────────────────────────────────
console.log("Seeding EODs…");
const eodRows = [];

for (let day = 0; day < 30; day++) {
  const date = isoDay(day);

  for (const uid of setterIds) {
    const member = TEAM.find(m => userMap[m.name] === uid);
    const isPhone = member?.setter_type === "phone";
    eodRows.push({
      user_id: uid,
      report_date: date,
      dials: isPhone ? rand(80, 130) : 0,
      leads_contacted: isPhone ? 0 : rand(100, 150),
      convos_started: rand(5, 20),
      calls_booked: rand(1, 5),
      shows: rand(1, 4),
      no_shows: rand(0, 2),
      wins: `Good energy today. Booked ${rand(1,5)} calls.`,
      blockers: day % 7 === 0 ? "Leads going cold faster than usual." : null,
      is_demo: true,
    });
  }

  if (closerId) {
    eodRows.push({
      user_id: closerId,
      report_date: date,
      calls_taken: rand(2, 6),
      closes: rand(0, 2),
      cash_collected: rand(0, 2) * 2500,
      deposits: rand(0, 1) * 500,
      follow_ups_done: rand(2, 8),
      wins: "Solid close rate this week.",
      is_demo: true,
    });
  }

  if (csmId) {
    eodRows.push({
      user_id: csmId,
      report_date: date,
      looms_reviewed: rand(1, 5),
      roleplays_reviewed: rand(0, 3),
      student_checkins: rand(1, 4),
      escalations_resolved: rand(0, 2),
      wins: "Students progressing well.",
      is_demo: true,
    });
  }
}

const { error: eodErr } = await sb.from("eods").upsert(eodRows, { onConflict: "user_id,report_date" });
if (eodErr) console.error("EOD error:", eodErr.message);
else console.log(`  ✓ ${eodRows.length} EOD rows`);

// ── 3. Students ──────────────────────────────────────────────────────────
console.log("Seeding students…");
const STUDENTS = [
  { full_name: "Marcus Chen",    email: "marcus.chen@demo.isa",    status: "active", phase: "coaching_1on1" },
  { full_name: "Sofia Patel",    email: "sofia.patel@demo.isa",    status: "active", phase: "coaching_1on1" },
  { full_name: "Jordan Miles",   email: "jordan.miles@demo.isa",   status: "active", phase: "graduated" },
  { full_name: "Aya Nakamura",   email: "aya.nakamura@demo.isa",   status: "ghosting", phase: "coaching_1on1" },
  { full_name: "Leo Santos",     email: "leo.santos@demo.isa",     status: "active", phase: "coaching_1on1" },
];

const studentIds = [];
for (const s of STUDENTS) {
  const { data, error } = await sb.from("students").insert({
    ...s,
    join_date: isoDay(rand(20, 60)),
    is_demo: true,
    testimonial_collected: s.phase === "graduated",
    first_win_at: s.phase === "graduated" ? isoDay(rand(10, 30)) : null,
  }).select("id").single();
  if (error) { console.error(`  ✗ ${s.full_name}: ${error.message}`); continue; }
  studentIds.push({ id: data.id, name: s.full_name });
  console.log(`  ✓ ${s.full_name}`);
}

// ── 4. Deals ─────────────────────────────────────────────────────────────
console.log("Seeding deals…");
const dealRows = studentIds.map((s, i) => ({
  student_id: s.id,
  student_name: s.name,
  closer_id: closerId ?? setterIds[0],
  setter_id: i % 2 === 0 ? setterIds[i % setterIds.length] : null,
  program_type: "ISA Accelerator",
  total_value: [5000, 7500, 5000, 7500, 5000][i] ?? 5000,
  cash_collected_upfront: [2500, 5000, 5000, 2500, 2500][i] ?? 2500,
  payment_type: i % 2 === 0 ? "installment" : "full",
  deal_date: isoDay(rand(5, 25)),
  is_demo: true,
}));

const { error: dealErr } = await sb.from("deals").insert(dealRows);
if (dealErr) console.error("Deal error:", dealErr.message);
else console.log(`  ✓ ${dealRows.length} deals`);

// ── 5. IG Snapshot ───────────────────────────────────────────────────────
console.log("Seeding IG snapshot…");
const now = new Date();
const { error: igErr } = await sb.from("ig_monthly_snapshots").upsert({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  followers: 4820,
  avg_views: 12400,
  avg_reach: 18700,
  avg_likes: 310,
  avg_comments: 28,
  profile_visits: 2100,
  link_clicks: 185,
  top_performing_hook: "I made $0 in my first 30 days of appointment setting. Here's what changed.",
  notes: "Best month yet — the objection-handling reel went viral-ish (44k views).",
  is_demo: true,
}, { onConflict: "year,month" });
if (igErr) console.error("IG error:", igErr.message);
else console.log("  ✓ IG snapshot");

// ── 6. Action Items ──────────────────────────────────────────────────────
console.log("Seeding action items…");
const actionItems = [
  { title: "Follow up with Aya — no response in 5 days", priority: "high", due_date: isoDay(1) },
  { title: "Request testimonial from Jordan", priority: "medium", due_date: isoDay(3) },
  { title: "Review Leo's first roleplay loom", priority: "medium", due_date: isoDay(2) },
  { title: "Send payment reminder — Marcus installment due", priority: "high", due_date: isoDay(0) },
];

const { error: aiErr } = await sb.from("student_action_items").insert(
  actionItems.map(item => ({
    ...item,
    student_id: studentIds[0]?.id ?? null,
    assigned_to: csmId ?? closerId ?? setterIds[0],
    created_by: csmId ?? closerId ?? setterIds[0],
    done: false,
    is_demo: true,
  }))
);
if (aiErr) console.error("Action items error:", aiErr.message);
else console.log(`  ✓ ${actionItems.length} action items`);

console.log("\n✅ Demo seed complete. Run remove-demo.mjs to tear down.");
