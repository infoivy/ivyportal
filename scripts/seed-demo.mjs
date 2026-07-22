#!/usr/bin/env node
/**
 * Demo seed v3 · a fresh, ultra-realistic showcase cast (founder-requested
 * 2026-07-22; replaces the v2 cast entirely).
 *
 * Team (@isa.demo, password IvyDemo2026!):
 *   Setters: Tariq Mahmood (phone, top), Nasser Adeyemi (phone, struggling),
 *            Idris Bakari (DM), Suleiman Khattab (full cycle)
 *   Closers: Uthman Diallo, Harun Chowdhury (sometimes self-set)
 *   CSMs:    Yahya Suleiman, Dawud Mensah ($500 base)
 *   Coach:   Khalid Rahmani
 *   Pending signups (no role · show in Requests): Mikail Diop, Ayman Farsi, Burhan Kaya
 *   Student login: ayaan.malik@isa.demo (unlocked 1:1 student, full history)
 *
 * 14 students across the real lifecycle: locked in Start Here (one stuck),
 * loom-review grinders, applying-phase (5/day), an interview inside 48h, a
 * ghosting payment-behind case, offer_won + testimonial grads. Weekly EODs
 * with per-call attendance, current-week live ticks, 1:1 self-reports
 * (including a lazy booker), CSM notes/tallies, placements, installments with
 * a late payment, deals across two payout periods with self-set closes, and
 * ~7 weeks of team EODs with realistic missed KPIs and skipped days.
 *
 * Deterministic RNG · re-seeding reproduces the same story.
 * Usage: npm run demo:seed   ·   teardown: npm run demo:remove
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);

// ── deterministic rng ────────────────────────────────────────────────────────
let _s = 20260722;
const rnd = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

// Business days run on Riyadh time; anchor "today" there so report_date
// matches what the team sees regardless of the machine's timezone.
const riyadh = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" });
const TODAY = riyadh.format(new Date());
const DAY = 86400000;
const at = (isoDate, h = 12, min = 0) => new Date(`${isoDate}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+03:00`);
const shift = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dayAgo = (n) => shift(TODAY, -n);
const weekday = (isoDate) => new Date(`${isoDate}T12:00:00Z`).getUTCDay(); // 0=Sun
const mondayOf = (isoDate) => shift(isoDate, -((weekday(isoDate) + 6) % 7));
const CUR_WEEK = mondayOf(TODAY);
const LAST_WEEK = shift(CUR_WEEK, -7);
const HISTORY_DAYS = 50;

// The real weekly call schedule (mirrors org_settings.group_call_schedule).
const CALLS = [
  { day: "Mon", name: "🧠 Off Call Discipline w/ Abu Bilal" },
  { day: "Tue", name: "💼 Role Finding Masterclass w/ Faizan" },
  { day: "Wed", name: "📞 Roleplays w/ Abdulrahman" },
  { day: "Thu", name: "📝 Script Breakdown w/ Faizan" },
  { day: "Fri", name: "⚔️ Setting Mastery w/ Abdulrahman" },
  { day: "Sat", name: "🎬 Call Review Thursdays w/ Abu Bilal" },
  { day: "Sun", name: "📞 Roleplays w/ Abdulrahman" },
];
const attended = (days) => CALLS.filter((c) => days.includes(c.day));

// ── cast ─────────────────────────────────────────────────────────────────────
const PASSWORD = "IvyDemo2026!";
const TEAM = [
  { email: "tariq.mahmood@isa.demo",    name: "Tariq Mahmood",    roles: ["setter"], setter_type: "phone",      quality: 0.94 },
  { email: "nasser.adeyemi@isa.demo",   name: "Nasser Adeyemi",   roles: ["setter"], setter_type: "phone",      quality: 0.58 },
  { email: "idris.bakari@isa.demo",     name: "Idris Bakari",     roles: ["setter"], setter_type: "dm",         quality: 0.85 },
  { email: "suleiman.khattab@isa.demo", name: "Suleiman Khattab", roles: ["setter"], setter_type: "full_cycle", quality: 0.8 },
  { email: "uthman.diallo@isa.demo",    name: "Uthman Diallo",    roles: ["closer"], setter_type: null,         quality: 0.92 },
  { email: "harun.chowdhury@isa.demo",  name: "Harun Chowdhury",  roles: ["closer"], setter_type: null,         quality: 0.83 },
  { email: "yahya.suleiman@isa.demo",   name: "Yahya Suleiman",   roles: ["csm"],    setter_type: null,         quality: 0.9,  base_pay: 500 },
  { email: "dawud.mensah@isa.demo",     name: "Dawud Mensah",     roles: ["csm"],    setter_type: null,         quality: 0.86, base_pay: 500 },
  { email: "khalid.rahmani@isa.demo",   name: "Khalid Rahmani",   roles: ["coach"],  setter_type: null,         quality: 0.88 },
];
// Signed up through the portal link, waiting in Students → Requests.
const PENDING = [
  { email: "mikail.diop@isa.demo", name: "Mikail Diop",  daysAgo: 0 },
  { email: "ayman.farsi@isa.demo", name: "Ayman Farsi",  daysAgo: 1 },
  { email: "burhan.kaya@isa.demo", name: "Burhan Kaya",  daysAgo: 3 },
];
const STUDENT_LOGIN = { email: "ayaan.malik@isa.demo", name: "Ayaan Malik" };

console.log(`Demo seed v3 · today=${TODAY} (Riyadh) · week=${CUR_WEEK} · last week=${LAST_WEEK}`);

// ── provision auth users ─────────────────────────────────────────────────────
console.log("Provisioning accounts…");
const { data: userList } = await sb.auth.admin.listUsers({ perPage: 500 });
const ensureUser = async (email, name) => {
  let u = userList.users.find((x) => x.email === email);
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
    });
    if (error) throw error;
    u = data.user;
    console.log("  ✓", name);
  } else {
    await sb.auth.admin.updateUserById(u.id, { password: PASSWORD });
    console.log("  ↻", name, "exists");
  }
  return u.id;
};

const idByEmail = new Map();
for (const m of TEAM) {
  const uid = await ensureUser(m.email, m.name);
  idByEmail.set(m.email, uid);
  await sb.from("profiles").upsert({
    id: uid, display_name: m.name, setter_type: m.setter_type, active: true,
    base_pay_monthly: m.base_pay ?? null,
  });
  await sb.from("user_roles").delete().eq("user_id", uid);
  for (const r of m.roles) await sb.from("user_roles").upsert({ user_id: uid, role: r }, { onConflict: "user_id,role" });
}
const ID = Object.fromEntries(TEAM.map((m) => [m.email.split("@")[0].split(".")[0], idByEmail.get(m.email)]));
const setters = TEAM.filter((m) => m.roles.includes("setter"));
const csmIds = [ID.yahya, ID.dawud];

for (const p of PENDING) {
  const uid = await ensureUser(p.email, p.name);
  await sb.from("profiles").upsert({ id: uid, display_name: p.name, active: true, created_at: at(dayAgo(p.daysAgo), 20).toISOString() });
  await sb.from("user_roles").delete().eq("user_id", uid); // must stay role-less
}
const studentUid = await ensureUser(STUDENT_LOGIN.email, STUDENT_LOGIN.name);
await sb.from("profiles").upsert({ id: studentUid, display_name: STUDENT_LOGIN.name, active: true });

// ── wipe previous demo data (v2 and prior v3 runs) ───────────────────────────
console.log("Clearing previous demo data…");
const { data: oldStudents } = await sb.from("students").select("id").eq("is_demo", true);
const oldIds = (oldStudents ?? []).map((s) => s.id);
if (oldIds.length) {
  const { data: oldPlans } = await sb.from("installments").select("id").in("student_id", oldIds);
  const planIds = (oldPlans ?? []).map((p) => p.id);
  if (planIds.length) await sb.from("installment_payments").delete().in("installment_id", planIds);
  await sb.from("installments").delete().in("student_id", oldIds);
  for (const t of ["student_weekly_eods", "student_call_attendance", "student_guide_steps", "student_placements", "student_calls", "student_eods", "csm_student_notes", "testimonials"]) {
    await sb.from(t).delete().in("student_id", oldIds);
  }
}
await sb.from("student_action_items").delete().eq("is_demo", true);
await sb.from("deals").delete().eq("is_demo", true);
await sb.from("eods").delete().eq("is_demo", true);
await sb.from("students").delete().eq("is_demo", true);
for (const uid of idByEmail.values()) await sb.from("csm_tally").delete().eq("user_id", uid);

// retire demo users that are not in the new cast
const KEEP = new Set([...TEAM.map((m) => m.email), ...PENDING.map((p) => p.email), STUDENT_LOGIN.email]);
for (const u of userList.users) {
  if (u.email?.endsWith("@isa.demo") && !KEEP.has(u.email)) {
    for (const [t, c] of [["eods", "user_id"], ["csm_tally", "user_id"], ["team_chat", "created_by"], ["user_roles", "user_id"], ["profiles", "id"]]) {
      await sb.from(t).delete().eq(c, u.id);
    }
    await sb.auth.admin.deleteUser(u.id);
    console.log("  ✗ removed old demo user", u.email);
  }
}

// ── students ─────────────────────────────────────────────────────────────────
console.log("Seeding students…");
// Ofcom/NANP reserved fictional phone ranges: safe AND realistic.
const ukPhone = () => `+44 7700 900${ri(100, 999)}`;
const usPhone = () => `+1 202 555 01${ri(10, 99)}`;
const S = (over) => ({
  email: null, status: "active", coach_id: null, calls_included: 0, calls_allotted: 0,
  payment_state: "paid_in_full", is_demo: true, eod_exempt: false, ...over,
});
const STUDENTS = [
  S({ full_name: "Ayaan Malik", email: STUDENT_LOGIN.email, phase: "applying", grade: "A",
      one: true, join: dayAgo(38), unlockedAfter: 6, whatsapp: ukPhone(),
      next_action: "Push Northpeak to a decision this week",
      weekly: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sun"], one: 2, impl: "Rebuilt my loom intro after Wednesday's roleplay call. Applied the tonality notes on every application since and replies picked up straight away.", win: "Northpeak Solar moved me to a second interview", blocker: "Two offers ghosted after intro looms", commit: "5 applications a day and close out Northpeak" },
      ticks: ["Mon", "Tue"], consistency: 0.93, appsPerDay: [4, 6] }),
  S({ full_name: "Musab Farouk", email: "musab.farouk@isa.demo", phase: "coaching_1on1", grade: "B",
      one: true, join: dayAgo(24), unlockedAfter: 5, whatsapp: ukPhone(),
      next_action: "Get looms to approval standard by Friday",
      weekly: { days: ["Mon", "Wed", "Thu", "Fri", "Sun"], one: 1, impl: "Slowed my talking pace like Yahya said. My last three looms got way better feedback, one more round and I think I'm approved.", win: "First loom with zero corrections", blocker: "Evenings are rough with my shift job", commit: "3 looms every single day, no zero days" },
      ticks: ["Mon"], consistency: 0.85, loomsPerDay: [2, 4] }),
  S({ full_name: "Hamdan Qureshi", email: "hamdan.qureshi@isa.demo", phase: "applying", grade: "B",
      join: dayAgo(31), unlockedAfter: 7, whatsapp: usPhone(),
      weekly: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], impl: "Attended everything this week and applied the role-finding filters. Cut my list to solar and roofing offers only, applications feel sharper.", win: "First interview booked", blocker: "", commit: "Keep 5/day and prep interview answers" },
      ticks: ["Mon", "Tue"], consistency: 0.88, appsPerDay: [3, 5] }),
  S({ full_name: "Layth Abdullah", email: "layth.abdullah@isa.demo", phase: "coaching_1on1", grade: "C",
      one: true, join: dayAgo(29), unlockedAfter: 8, whatsapp: ukPhone(),
      next_action: "Chase him to book 1:1 #3 · only 2 used",
      weekly: { days: ["Mon", "Thu", "Sun"], one: 0, impl: "Honestly a weak week. Missed most calls because of exams, only got looms out twice.", win: "", blocker: "University finals until Thursday", commit: "Back to 3 looms daily from Monday" },
      ticks: [], consistency: 0.5, loomsPerDay: [0, 3], lastEodDaysAgo: 4 }),
  S({ full_name: "Sami Haddad", email: "sami.haddad@isa.demo", phase: "coaching_1on1", grade: "B",
      join: dayAgo(21), unlockedAfter: 6, whatsapp: usPhone(),
      weekly: { days: ["Mon", "Tue", "Fri", "Sun"], impl: "The off-call discipline call fixed my mornings. Looms before work now instead of after, quality is up.", win: "Dawud said my objection loom was best of the batch", blocker: "Mic quality, ordered a new one", commit: "4 calls minimum and 3 looms daily" },
      ticks: ["Tue"], consistency: 0.82, loomsPerDay: [2, 3] }),
  S({ full_name: "Zubair Rammal", email: "zubair.rammal@isa.demo", phase: "applying", grade: "A",
      one: true, join: dayAgo(44), unlockedAfter: 5, whatsapp: ukPhone(),
      next_action: "Interview prep call before Thursday",
      weekly: { days: ["Mon", "Tue", "Wed", "Fri", "Sun"], one: 2, impl: "Used both 1:1s on interview prep. Mock interview with Khalid went long but I finally sound like myself instead of a script.", win: "BlueOak moved me to final round", blocker: "Nerves before live calls", commit: "Land the BlueOak offer" },
      ticks: ["Mon", "Tue", "Wed"], consistency: 0.9, appsPerDay: [4, 6] }),
  S({ full_name: "Ilyas Kone", email: "ilyas.kone@isa.demo", phase: "onboarding",
      join: dayAgo(9), locked: true, steps: ["typeform", "offer_board"], stepsDaysAgo: 4, whatsapp: usPhone(),
      next_action: "Stuck on Start Here 4 days · WhatsApp him today" }),
  S({ full_name: "Anas Toure", email: "anas.toure@isa.demo", phase: "onboarding",
      one: true, join: dayAgo(1), locked: true, steps: [], whatsapp: ukPhone() }),
  S({ full_name: "Rayan Sheikh", email: "rayan.sheikh@isa.demo", phase: "offer_won", grade: "A",
      one: true, join: dayAgo(49), unlockedAfter: 4, whatsapp: ukPhone(),
      first_win_daysAgo: 12, offer_daysAgo: 8, testimonial_requested: true,
      consistency: 0.7, appsPerDay: [2, 4] }),
  S({ full_name: "Kareem Nasser", email: "kareem.nasser@isa.demo", phase: "testimonial", grade: "A",
      join: dayAgo(50), unlockedAfter: 5, whatsapp: usPhone(),
      first_win_daysAgo: 24, offer_daysAgo: 16, testimonial_collected: true, trustpilot_collected: true }),
  S({ full_name: "Faris Al-Amin", email: "faris.alamin@isa.demo", phase: "coaching_1on1", grade: "At Risk",
      one: true, join: dayAgo(33), unlockedAfter: 9, status: "ghosting", payment_state: "behind", whatsapp: ukPhone(),
      next_action: "Final outreach before we involve Abu Bilal",
      consistency: 0.35, loomsPerDay: [0, 2], lastEodDaysAgo: 9 }),
  S({ full_name: "Tamim Baig", email: "tamim.baig@isa.demo", phase: "applying", grade: "C",
      join: dayAgo(40), unlockedAfter: 8, payment_state: "behind", whatsapp: usPhone(),
      weekly: { days: ["Tue", "Sun"], impl: "Only made two calls, work schedule flipped on me. Still got applications out most days.", win: "", blocker: "New job rota clashes with the 2pm calls", commit: "Catch the recordings same day when I miss live" },
      ticks: [], consistency: 0.65, appsPerDay: [2, 5] }),
  S({ full_name: "Nadir Hassan", email: "nadir.hassan@isa.demo", phase: "coaching_1on1", grade: "B",
      one: true, join: dayAgo(17), unlockedAfter: 6, whatsapp: ukPhone(),
      weekly: { days: ["Mon", "Wed", "Sat", "Sun"], one: 1, impl: "Script breakdown call showed me why my openers were getting skipped. Rewrote and resubmitted, waiting on review.", win: "Roleplay streak at 12 days", blocker: "", commit: "3 looms daily and book 1:1 #3" },
      ticks: ["Mon"], consistency: 0.8, loomsPerDay: [2, 4] }),
  S({ full_name: "Jibril Sow", email: "jibril.sow@isa.demo", phase: "coaching_1on1", grade: "A",
      join: dayAgo(26), unlockedAfter: 4, payment_state: "scholarship", whatsapp: usPhone(),
      weekly: { days: ["Mon", "Tue", "Wed", "Fri", "Sun"], impl: "Best week so far. Copied Abdulrahman's roleplay drill structure into my own practice and it shows on the looms.", win: "Told my looms are one round from approval", blocker: "", commit: "Get approved and switch to applications" },
      ticks: ["Mon"], consistency: 0.92, loomsPerDay: [3, 4] }),
];

const studentRows = STUDENTS.map((s) => ({
  full_name: s.full_name, email: s.email,
  phase: s.phase, status: s.status,
  coach_id: s.one ? ID.khalid : null,
  join_date: s.join,
  calls_included: s.one ? 10 : 0, calls_allotted: s.one ? 10 : 0,
  payment_state: s.payment_state,
  student_grade: s.grade ?? null,
  whatsapp: s.whatsapp ?? null,
  next_action: s.next_action ?? null,
  onboarding_completed_at: s.locked ? null : at(shift(s.join, s.unlockedAfter ?? 6), 19, ri(5, 55)).toISOString(),
  first_win_at: s.first_win_daysAgo ? dayAgo(s.first_win_daysAgo) : null,
  offer_landed_at: s.offer_daysAgo ? dayAgo(s.offer_daysAgo) : null,
  offers_landed_count: s.offer_daysAgo ? 1 : 0,
  testimonial_collected: !!s.testimonial_collected,
  testimonial_requested: !!s.testimonial_requested,
  trustpilot_collected: !!s.trustpilot_collected,
  eod_exempt: false, is_demo: true,
}));
const { data: inserted, error: stuErr } = await sb.from("students").insert(studentRows).select("id, full_name");
if (stuErr) throw stuErr;
const SID = Object.fromEntries(inserted.map((r) => [r.full_name, r.id]));
STUDENTS.forEach((s) => { s.id = SID[s.full_name]; });
console.log(`  ${inserted.length} students (Ayaan auto-linked to his login)`);

// ── Start Here progress ──────────────────────────────────────────────────────
const STEPS = ["typeform", "offer_board", "offer_board_loom", "skool_training", "offer_board_course"];
const guideRows = [];
for (const s of STUDENTS) {
  if (s.locked) {
    (s.steps ?? []).forEach((step, i) => guideRows.push({
      student_id: s.id, step_key: step,
      done_at: at(dayAgo((s.stepsDaysAgo ?? 2) + (s.steps.length - i)), 21).toISOString(),
    }));
  } else {
    STEPS.forEach((step, i) => guideRows.push({
      student_id: s.id, step_key: step,
      done_at: at(shift(s.join, Math.min(s.unlockedAfter ?? 6, 2 + i)), ri(10, 22)).toISOString(),
    }));
  }
}
if (guideRows.length) {
  const { error } = await sb.from("student_guide_steps").insert(guideRows);
  if (error) throw error;
}
console.log(`  ${guideRows.length} Start Here step ticks`);

// ── deals + installments ─────────────────────────────────────────────────────
console.log("Seeding deals + installments…");
const PRICES = { pif: [4800, 5400, 6000], dep: [6000, 6400] };
const dealPlan = [
  { s: "Kareem Nasser",  type: "pif",     total: 4800, closer: ID.uthman, setter: ID.tariq },
  { s: "Rayan Sheikh",   type: "pif",     total: 6000, closer: ID.uthman, setter: ID.idris },
  { s: "Zubair Rammal",  type: "deposit", total: 6400, cash: 1600, closer: ID.harun,  setter: ID.harun },  // self-set
  { s: "Tamim Baig",     type: "deposit", total: 6000, cash: 1500, closer: ID.uthman, setter: ID.suleiman },
  { s: "Ayaan Malik",    type: "pif",     total: 5400, closer: ID.harun,  setter: ID.tariq },
  { s: "Faris Al-Amin",  type: "deposit", total: 6000, cash: 1500, closer: ID.harun,  setter: ID.nasser },
  { s: "Hamdan Qureshi", type: "pif",     total: 4800, closer: ID.uthman, setter: ID.idris },
  { s: "Layth Abdullah", type: "pif",     total: 5400, closer: ID.harun,  setter: ID.harun },              // self-set
  { s: "Jibril Sow",     type: "pif",     total: 0,    closer: ID.uthman, setter: ID.tariq },              // scholarship
  { s: "Musab Farouk",   type: "pif",     total: 5400, closer: ID.uthman, setter: ID.suleiman },
  { s: "Sami Haddad",    type: "deposit", total: 6000, cash: 2000, closer: ID.harun,  setter: ID.idris },
  { s: "Nadir Hassan",   type: "pif",     total: 4800, closer: ID.uthman, setter: ID.tariq },
  { s: "Ilyas Kone",     type: "deposit", total: 6400, cash: 1600, closer: ID.harun,  setter: ID.idris },
  { s: "Anas Toure",     type: "pif",     total: 5400, closer: ID.uthman, setter: ID.tariq },
];
const dealRows = dealPlan.map((d) => {
  const stu = STUDENTS.find((x) => x.full_name === d.s);
  const cash = d.type === "pif" ? d.total : d.cash;
  return {
    student_id: stu.id, student_name: stu.full_name,
    closer_id: d.closer, setter_id: d.setter,
    program_type: stu.one ? "1:1 Pathway" : "Group Coaching",
    total_value: d.total, cash_collected_upfront: cash,
    payment_type: d.type === "pif" ? "pif" : "deposit",
    deal_date: stu.join, created_by: d.closer,
    source: pick(["instagram", "instagram", "referral", "youtube"]),
    notes: stu.payment_state === "scholarship" ? "Scholarship spot (community giveaway winner)" : null,
    is_demo: true,
  };
});
{
  const { error } = await sb.from("deals").insert(dealRows);
  if (error) throw error;
}

let paymentsCreated = 0;
for (const d of dealPlan.filter((x) => x.type === "deposit")) {
  const stu = STUDENTS.find((x) => x.full_name === d.s);
  const planTotal = d.total - d.cash;
  const { data: plan, error: planErr } = await sb.from("installments").insert({
    student_id: stu.id, student_name: stu.full_name,
    closer_id: d.closer, setter_id: d.setter, coach_id: stu.one ? ID.khalid : null,
    total_amount: planTotal, currency: "USD", created_by: d.closer,
  }).select("id").single();
  if (planErr) throw planErr;
  const nPay = 3;
  const per = Math.round(planTotal / nPay);
  const rows = Array.from({ length: nPay }, (_, i) => {
    const due = shift(stu.join, 30 * (i + 1));
    const past = due < TODAY;
    // Tamim's plan is the problem child: first paid, second missed (late).
    const late = stu.full_name === "Tamim Baig" ? i === 1 : stu.full_name === "Faris Al-Amin" ? i === 0 : false;
    const status = past ? (late ? "late" : "paid") : "upcoming";
    return {
      installment_id: plan.id, sequence: i + 1,
      amount: i === nPay - 1 ? planTotal - per * (nPay - 1) : per,
      currency: "USD", due_date: due, status,
      paid_at: status === "paid" ? at(shift(due, -ri(0, 2)), 17).toISOString() : null,
      payment_method: pick(["whop", "whop", "wise", "bank"]),
    };
  });
  // Tamim also has one due in 2 days → shows in the reminders bell.
  if (stu.full_name === "Tamim Baig") rows[2].due_date = shift(TODAY, 2);
  const { error: payErr } = await sb.from("installment_payments").insert(rows);
  if (payErr) throw payErr;
  paymentsCreated += rows.length;
}
console.log(`  ${dealRows.length} deals · ${paymentsCreated} scheduled payments`);

// ── team EODs (7 weeks, honest imperfection) ─────────────────────────────────
console.log("Seeding team EODs…");
const EOD_BASE = {
  dials: 0, leads_contacted: 0, dms_sent: 0, convos_started: 0,
  calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0,
  calls_taken: 0, closes: 0, cash_collected: 0, deferred_cash: 0, deposits: 0,
  follow_ups_done: 0, looms_reviewed: 0, roleplays_reviewed: 0,
  student_checkins: 0, escalations_resolved: 0,
};
const SETTER_WINS = [
  "4 sets today alhamdulillah, best day this month",
  "new opener is printing, reply rate doubled",
  "booked 2 off one referral thread",
  "prospect from last month came back and booked himself",
  "cleaned the pipeline, 6 follow ups locked for tomorrow",
  "hit target before maghrib for once",
  "quality day. fewer convos but all qualified",
  "3 sets and one guy asked if he could pay tonight lol",
];
const SETTER_BLOCKERS = [
  "", "", "", "",
  "ig action blocked me for 2 hours",
  "lead list going dry, need the new batch",
  "two no shows back to back, tightening confirmations",
  "wifi died mid block, made up dials after isha",
  "long team call ate my morning block",
  "voicemail rate brutal on the US list today",
];
const eodRows = [];
const cashByCloserDay = new Map();
for (const d of dealRows) {
  const k = `${d.closer_id}:${d.deal_date}`;
  const cur = cashByCloserDay.get(k) ?? { cash: 0, closes: 0 };
  cur.cash += d.cash_collected_upfront; cur.closes += 1;
  cashByCloserDay.set(k, cur);
}
for (const m of setters) {
  const uid = idByEmail.get(m.email);
  for (let n = HISTORY_DAYS; n >= 0; n--) {
    if (!chance(0.55 + m.quality * 0.42)) continue; // struggling setters skip whole days
    const date = dayAgo(n);
    const goodDay = chance(m.quality);
    const eff = (goodDay ? 0.95 : 0.55) + rnd() * 0.25;
    const type = m.setter_type;
    const dials = type === "dm" ? 0 : Math.round((type === "full_cycle" ? 100 : 112) * eff);
    const dms = type === "phone" ? ri(0, 10) : Math.round((type === "dm" ? 130 : 52) * eff);
    const convos = Math.round(dials * 0.14 + dms * 0.16 * (0.7 + rnd() * 0.5));
    const booked = Math.max(0, Math.min(5, Math.round(convos * (0.08 + m.quality * 0.08) + (goodDay ? 0.6 : -0.7))));
    const scheduled = booked + (chance(0.25) ? 1 : 0);
    const shows = Math.max(0, booked - (chance(0.3) ? 1 : 0));
    eodRows.push({
      ...EOD_BASE, user_id: uid, report_date: date,
      dials, dms_sent: dms, convos_started: convos,
      calls_booked: booked, calls_scheduled: scheduled, shows,
      no_shows: Math.max(0, scheduled - shows > 0 && chance(0.6) ? 1 : 0),
      follow_ups_done: ri(0, 7),
      wins: booked >= 3 ? pick(SETTER_WINS) : chance(0.6) ? pick(SETTER_WINS) : "",
      blockers: goodDay ? pick(SETTER_BLOCKERS) : pick(SETTER_BLOCKERS.slice(4)),
      tomorrow_focus: chance(0.5) ? pick(["front load dials before dhuhr", "hit the new roofing list", "confirmations for tomorrow's 3 sets", "batch follow ups at 6pm"]) : "",
      is_demo: true,
    });
  }
}
for (const closer of [ID.uthman, ID.harun]) {
  const q = closer === ID.uthman ? 0.93 : 0.85;
  for (let n = HISTORY_DAYS; n >= 0; n--) {
    if (!chance(q * 0.95)) continue;
    const date = dayAgo(n);
    const dayDeals = cashByCloserDay.get(`${closer}:${date}`) ?? { cash: 0, closes: 0 };
    const taken = Math.max(dayDeals.closes, ri(1, 5));
    eodRows.push({
      ...EOD_BASE, user_id: closer, report_date: date,
      calls_taken: taken, closes: dayDeals.closes, cash_collected: dayDeals.cash,
      deposits: dayDeals.closes > 0 && dayDeals.cash < 4000 ? 1 : 0,
      no_shows: chance(0.3) ? 1 : 0, follow_ups_done: ri(1, 6),
      wins: dayDeals.closes > 0
        ? `Closed ${dayDeals.closes} · $${dayDeals.cash.toLocaleString()} in`
        : pick(["2 solid calls, both need spouse convo, following up thursday", "no close but pipeline is warm", "objection call went 80 min, he's 90% there", ""]),
      blockers: chance(0.3) ? pick(["show rate dipped, syncing with setters on confirmations", "one prospect stuck on payment plan options", "calendar gap mid day"]) : "",
      is_demo: true,
    });
  }
}
for (const [uid, isCsm] of [[ID.yahya, true], [ID.dawud, true], [ID.khalid, false]]) {
  for (let n = HISTORY_DAYS; n >= 0; n--) {
    if (!chance(0.9)) continue;
    eodRows.push({
      ...EOD_BASE, user_id: uid, report_date: dayAgo(n),
      calls_taken: isCsm ? 0 : ri(2, 5),
      looms_reviewed: isCsm ? ri(6, 15) : 0,
      roleplays_reviewed: isCsm ? ri(2, 6) : 0,
      student_checkins: isCsm ? ri(3, 8) : ri(0, 2),
      escalations_resolved: isCsm && chance(0.2) ? 1 : 0,
      wins: isCsm
        ? pick(["loom queue cleared before maghrib", "musab and jibril both one round from approval", "pulled layth back on track, he recommitted", "14 looms reviewed, quality trending up"])
        : pick(["strong 1:1 block, zubair is interview ready", "mock interview with ayaan went 45 min, he's sharp", "two students ready to move phase"]),
      blockers: chance(0.2) ? pick(["faris not answering, third attempt this week", "review queue heavy after the weekend", ""]) : "",
      is_demo: true,
    });
  }
}
{
  const { error } = await sb.from("eods").upsert(eodRows, { onConflict: "user_id,report_date" });
  if (error) throw error;
}
console.log(`  ${eodRows.length} team EOD rows`);

// ── student daily EODs (two-mode) ────────────────────────────────────────────
console.log("Seeding student EODs…");
const S_WINS = [
  "first loom with no corrections!", "got a reply from a solar offer", "roleplay finally clicked",
  "3 quality applications out", "interview booked!!", "yahya approved my objection loom",
  "beat my streak", "applied the call notes and it shows",
];
const S_BLOCKERS = [
  "low energy day", "waiting on loom feedback", "struggled with the opener", "family stuff, short day", "mic issues",
];
const sEodRows = [];
for (const s of STUDENTS) {
  if (s.locked || !s.consistency && !s.weekly) continue;
  const applying = ["applying", "offer_won", "testimonial"].includes(s.phase);
  const consistency = s.consistency ?? 0.8;
  const firstDay = Math.min(HISTORY_DAYS, Math.floor((new Date(`${TODAY}T12:00:00Z`) - new Date(`${s.join}T12:00:00Z`)) / DAY) - (s.unlockedAfter ?? 6));
  const stopAt = s.lastEodDaysAgo ?? 0;
  for (let n = firstDay; n >= stopAt; n--) {
    if (!chance(consistency)) continue;
    const [lo, hi] = applying ? (s.appsPerDay ?? [3, 5]) : (s.loomsPerDay ?? [2, 3]);
    sEodRows.push({
      student_id: s.id, report_date: dayAgo(n),
      roleplays: Math.max(0, ri(1, 3) + (chance(0.2) ? -1 : 0)),
      looms_sent: applying ? 0 : ri(lo, hi),
      applications_submitted: applying ? ri(lo, hi) : 0,
      outreach_sent: 0, replies: 0,
      interviews: applying && chance(0.14) ? 1 : 0,
      wins: chance(0.45) ? pick(S_WINS) : null,
      blockers: chance(0.22) ? pick(S_BLOCKERS) : null,
      tomorrow_focus: chance(0.3) ? pick(["same again, no zero days", "get the loom rerecorded", "5 apps before the group call"]) : null,
    });
  }
}
{
  const { error } = await sb.from("student_eods").insert(sEodRows);
  if (error) throw error;
}
console.log(`  ${sEodRows.length} student EOD rows`);

// ── weekly EODs (last completed week) + live attendance ticks ────────────────
console.log("Seeding weekly EODs + attendance…");
const weeklyRows = [];
const attendanceRows = [];
for (const s of STUDENTS) {
  if (s.weekly) {
    const recs = attended(s.weekly.days);
    weeklyRows.push({
      student_id: s.id, week_start: LAST_WEEK,
      calls_attended: recs, group_calls_attended: recs.length,
      one_on_one_calls: s.one ? (s.weekly.one ?? 0) : null,
      implementation: s.weekly.impl,
      biggest_win: s.weekly.win || null,
      biggest_blocker: s.weekly.blocker || null,
      next_week_commitment: s.weekly.commit,
      submitted_at: at(shift(LAST_WEEK, 6), s.full_name === "Layth Abdullah" ? 23 : ri(18, 22), ri(0, 59)).toISOString(),
    });
    // they also ticked live during that week
    for (const r of recs) attendanceRows.push({ student_id: s.id, week_start: LAST_WEEK, day: r.day, name: r.name, ticked_at: at(shift(LAST_WEEK, CALLS.findIndex((c) => c.day === r.day)), 22).toISOString() });
  }
  for (const day of s.ticks ?? []) {
    const call = CALLS.find((c) => c.day === day);
    attendanceRows.push({ student_id: s.id, week_start: CUR_WEEK, day, name: call.name, ticked_at: at(shift(CUR_WEEK, CALLS.indexOf(call)), 22).toISOString() });
  }
}
if (weeklyRows.length) {
  const { error } = await sb.from("student_weekly_eods").insert(weeklyRows);
  if (error) throw error;
}
if (attendanceRows.length) {
  const { error } = await sb.from("student_call_attendance").insert(attendanceRows);
  if (error) throw error;
}
console.log(`  ${weeklyRows.length} weekly EODs · ${attendanceRows.length} attendance ticks`);

// ── 1:1 calls ────────────────────────────────────────────────────────────────
console.log("Seeding 1:1 calls…");
const callRows = [];
const OUTCOMES = [
  "Loom review together, rebuilt the intro", "Objection roleplay round 2", "Application strategy for the week",
  "Interview prep, mock ran long", "Offer-board targets narrowed to 2 niches", "Weekly plan reset after slow week",
];
const oneOnOnePlan = {
  "Ayaan Malik": { count: 4, lastDaysAgo: 3, ratings: [3, 4, 4, 5] },
  "Musab Farouk": { count: 3, lastDaysAgo: 5, ratings: [3, 3, 4] },
  "Layth Abdullah": { count: 2, lastDaysAgo: 17, ratings: [3, 2] },
  "Zubair Rammal": { count: 5, lastDaysAgo: 2, ratings: [3, 4, 4, 5, 5], next: 1 },
  "Rayan Sheikh": { count: 8, lastDaysAgo: 10, ratings: [3, 3, 4, 4, 4, 5, 5, 5] },
  "Faris Al-Amin": { count: 1, lastDaysAgo: 20, ratings: [2] },
  "Nadir Hassan": { count: 2, lastDaysAgo: 4, ratings: [3, 4], next: 4 },
  "Anas Toure": { count: 0 },
};
const AI_CALL_ITEMS = [
  "Rerecord the intro loom with the new hook", "Apply to the 3 flagged offers", "Send the objection loom before Friday",
  "Watch module 6 before next call", "Post the win in community", "Book next 1:1 within 5 days",
];
for (const [name, plan] of Object.entries(oneOnOnePlan)) {
  const s = STUDENTS.find((x) => x.full_name === name);
  if (!s || !plan.count) continue;
  for (let c = 0; c < plan.count; c++) {
    const daysAgoN = plan.lastDaysAgo + (plan.count - 1 - c) * ri(6, 8);
    const items = Array.from({ length: ri(1, 3) }, () => ({
      text: pick(AI_CALL_ITEMS),
      done: chance(0.6),
      due_date: chance(0.7) ? dayAgo(daysAgoN - ri(3, 6)) : null,
    }));
    callRows.push({
      student_id: s.id, coach_id: ID.khalid, call_date: dayAgo(daysAgoN),
      status: "completed", outcome: pick(OUTCOMES),
      progress_rating: plan.ratings[c] ?? ri(3, 5),
      duration_min: pick([25, 30, 30, 40, 45]),
      action_items_json: items,
      next_call_date: c === plan.count - 1 && plan.next ? shift(TODAY, plan.next) : null,
    });
  }
  if (plan.next) {
    callRows.push({ student_id: s.id, coach_id: ID.khalid, call_date: shift(TODAY, plan.next), status: "scheduled", action_items_json: [] });
  }
}
{
  const { error } = await sb.from("student_calls").insert(callRows);
  if (error) throw error;
}
console.log(`  ${callRows.length} calls`);

// ── adhoc action items ───────────────────────────────────────────────────────
console.log("Seeding action items…");
const aiRows = [];
const ADHOC = [
  ["Send 3 looms to the review chat today", 0.5],
  ["Update your placements tracker, two are stale", 0.4],
  ["Rewatch the role-finding call recording", 0.7],
  ["Confirm your installment payment method", 0.3],
  ["Book your next 1:1 · you are sitting on calls", 0.2],
  ["Reply to Yahya's loom feedback from Tuesday", 0.5],
];
for (const s of STUDENTS.filter((x) => !x.locked && !["offer_won", "testimonial"].includes(x.phase))) {
  const n = s.grade === "C" || s.grade === "At Risk" ? 3 : ri(1, 2);
  for (let i = 0; i < n; i++) {
    const [text, doneP] = pick(ADHOC);
    const createdAgo = ri(1, 12);
    const done = chance(doneP);
    const overdueCase = (s.full_name === "Layth Abdullah" || s.full_name === "Faris Al-Amin") && i === 0;
    aiRows.push({
      student_id: s.id, created_by: pick(csmIds),
      text: overdueCase ? "Send 3 looms to the review chat today" : text,
      due_date: overdueCase ? dayAgo(2) : chance(0.7) ? shift(TODAY, ri(-1, 5)) : null,
      done: overdueCase ? false : done,
      done_at: done && !overdueCase ? at(dayAgo(createdAgo - 1), 20).toISOString() : null,
      created_at: at(dayAgo(createdAgo), 15).toISOString(),
      is_demo: true,
    });
  }
}
for (const [assignee, text] of [
  [ID.tariq, "Pull 200 fresh leads from the roofing list"],
  [ID.nasser, "Shadow Tariq's call block Thursday · dials are slipping"],
  [ID.idris, "Test the new DM opener on 40 leads"],
]) {
  aiRows.push({
    student_id: null, assignee_id: assignee, created_by: ID.uthman,
    text, due_date: shift(TODAY, ri(1, 4)), done: false,
    created_at: at(dayAgo(ri(0, 2)), 11).toISOString(), is_demo: true,
  });
}
{
  const { error } = await sb.from("student_action_items").insert(aiRows);
  if (error) throw error;
}
console.log(`  ${aiRows.length} action items`);

// ── placements ───────────────────────────────────────────────────────────────
console.log("Seeding placements…");
const plRows = [];
const addPl = (name, business, role, stage, extra = {}) => {
  const s = STUDENTS.find((x) => x.full_name === name);
  plRows.push({
    student_id: s.id, business_name: business, role_title: role,
    source: pick(["student", "student", "ivy"]),
    stage, created_by: ID.yahya, ...extra,
  });
};
addPl("Ayaan Malik", "Northpeak Solar", "Appointment Setter", "interviewing", { interview_at: at(shift(TODAY, 3), 18).toISOString(), notes: "Second interview · owner liked his energy" });
addPl("Ayaan Malik", "Stride Media Co", "Setter (DM)", "lead");
addPl("Ayaan Malik", "BlueOak Roofing", "Appointment Setter", "lead", { notes: "Applied Tuesday, no reply yet" });
addPl("Zubair Rammal", "BlueOak Roofing", "Appointment Setter", "interviewing", { interview_at: at(shift(TODAY, 1), 21).toISOString(), notes: "FINAL ROUND tomorrow 9pm KSA · prep done with Khalid" });
addPl("Zubair Rammal", "Elevar Fitness Coaching", "Setter", "lead");
addPl("Hamdan Qureshi", "Summit Solar Group", "Appointment Setter", "interviewing", { interview_at: at(shift(TODAY, 5), 19).toISOString() });
addPl("Hamdan Qureshi", "Crescent Auto Protect", "Setter (phone)", "lead");
addPl("Tamim Baig", "Lumen Media Agency", "Setter (DM)", "lead");
addPl("Tamim Baig", "Driftwood Realty Leads", "Appointment Setter", "lost", { notes: "Went with an in-house hire" });
addPl("Rayan Sheikh", "Vertex Digital Group", "Appointment Setter", "placed", { started_at: dayAgo(8), pay_notes: "$800 base + $50/show", notes: "First week done · 6 sets" });
addPl("Kareem Nasser", "Atlas Growth Partners", "Setter → Junior Closer", "placed", { started_at: dayAgo(16), pay_notes: "$1k base + commission" });
{
  const { error } = await sb.from("student_placements").insert(plRows);
  if (error) throw error;
}
console.log(`  ${plRows.length} placements`);

// ── CSM notes + tallies ──────────────────────────────────────────────────────
console.log("Seeding CSM notes + tallies…");
const noteRows = [];
const NOTES = [
  ["Ayaan Malik", "Interview prep done. He is the most coachable student in the cohort right now.", ["checkin"]],
  ["Ayaan Malik", "Northpeak second round confirmed. Told him to keep applying regardless.", ["checkin"]],
  ["Musab Farouk", "Loom quality jumped after the pacing fix. One more clean round and I approve him.", ["loom-review"]],
  ["Layth Abdullah", "Exams excuse is real but he had gaps before them. Set a hard restart date for Monday.", ["escalation"]],
  ["Layth Abdullah", "Still only 2 of 10 calls used. Nudged him twice this week.", ["checkin"]],
  ["Sami Haddad", "New mic arrived, audio fixed. Objection loom was genuinely the best of the batch.", ["loom-review"]],
  ["Zubair Rammal", "BlueOak final round tomorrow. Ran a 30 min mock, he is ready.", ["checkin"]],
  ["Ilyas Kone", "4 days stuck on Start Here. WhatsApp sent, he promised to finish the walkthrough tonight.", ["escalation"]],
  ["Faris Al-Amin", "Third unanswered check-in. Payment also behind. Flagging to Abu Bilal end of week.", ["escalation"]],
  ["Tamim Baig", "Work rota clash is real. Agreed he catches recordings same-day and keeps apps at 5.", ["checkin"]],
  ["Jibril Sow", "Scholarship spot earning itself. Looms one round from approval.", ["loom-review"]],
  ["Nadir Hassan", "Steady. Rewrote openers after script breakdown call, resubmission queued.", ["loom-review"]],
  ["Rayan Sheikh", "First week at Vertex done, 6 sets. Testimonial video requested.", ["checkin"]],
];
for (const [name, note, tags] of NOTES) {
  const s = STUDENTS.find((x) => x.full_name === name);
  noteRows.push({
    student_id: s.id, user_id: pick(csmIds), note, tags,
    created_at: at(dayAgo(ri(0, 6)), ri(10, 22)).toISOString(),
  });
}
{
  const { error } = await sb.from("csm_student_notes").insert(noteRows);
  if (error) throw error;
}
const tallyRows = [];
for (const uid of csmIds) {
  for (let n = 21; n >= 0; n--) {
    if (chance(0.12)) continue;
    const counts = { loom: ri(4, 9), roleplay: ri(1, 4), checkin: ri(2, 5), escalation: chance(0.18) ? 1 : 0 };
    for (const [kind, count] of Object.entries(counts)) {
      for (let c = 0; c < count; c++) {
        tallyRows.push({
          user_id: uid, kind,
          student_id: chance(0.75) ? pick(STUDENTS.filter((s) => !s.locked)).id : null,
          created_at: at(dayAgo(n), ri(9, 22), ri(0, 59)).toISOString(),
        });
      }
    }
  }
}
{
  const { error } = await sb.from("csm_tally").insert(tallyRows);
  if (error) throw error;
}
console.log(`  ${noteRows.length} notes · ${tallyRows.length} tallies`);

// ── testimonials ─────────────────────────────────────────────────────────────
const testiRows = [
  {
    student_id: SID["Kareem Nasser"], type: "text", status: "published",
    title: "Kareem · placed at Atlas Growth Partners",
    content_text: "Came in stacking shelves, 10 weeks later I set for a 7-figure agency. The daily EODs and loom reviews are the whole difference. Nobody lets you hide here.",
    tags: ["win", "placement"], collected_by: ID.dawud, collected_at: dayAgo(14),
  },
  {
    student_id: SID["Kareem Nasser"], type: "trustpilot", status: "published",
    title: "Trustpilot · 5 stars",
    content_text: "Real coaching, real accountability, real placement. Worth every riyal.",
    tags: ["trustpilot"], collected_by: ID.dawud, collected_at: dayAgo(12),
  },
  {
    student_id: SID["Rayan Sheikh"], type: "video", status: "requested",
    title: "Rayan · Vertex Digital placement story",
    tags: ["placement"], collected_by: ID.yahya,
  },
];
{
  const { error } = await sb.from("testimonials").insert(testiRows);
  if (error) throw error;
}
console.log(`  ${testiRows.length} testimonials`);

// ── team chat ────────────────────────────────────────────────────────────────
const chatRows = [
  { body: `🎓 Ayaan Malik completed Start Here onboarding (1:1 Pathway). Portal unlocked, now in coaching.`, kind: "general", created_by: ID.yahya, student_id: SID["Ayaan Malik"], created_at: at(dayAgo(32), 19, 40).toISOString() },
  { body: "Zubair's FINAL round with BlueOak is tomorrow 9pm KSA. Mock went great today, make dua 🤲", kind: "general", created_by: ID.yahya, student_id: SID["Zubair Rammal"], created_at: at(dayAgo(0), 16, 5).toISOString() },
  { body: "cleared 14 looms today. musab and jibril are both one round from approval, expect two phase moves this week", kind: "general", created_by: ID.dawud, created_at: at(dayAgo(1), 21, 12).toISOString() },
  { body: "Faris still dark after 3 attempts. payment behind too. @AbuBilal want me to hand him over or give it one more week?", kind: "general", created_by: ID.yahya, student_id: SID["Faris Al-Amin"], created_at: at(dayAgo(1), 13, 45).toISOString() },
];
{
  const { error } = await sb.from("team_chat").insert(chatRows);
  if (error) throw error;
}
console.log(`  ${chatRows.length} team chat messages`);

// ── summary ──────────────────────────────────────────────────────────────────
const totalCash = dealRows.reduce((a, d) => a + d.cash_collected_upfront, 0);
console.log(`\n✅ Demo seed v3 complete.`);
console.log(`   ${STUDENTS.length} students · ${dealRows.length} deals · $${totalCash.toLocaleString()} cash upfront`);
console.log(`   ${eodRows.length} team EODs · ${sEodRows.length} student EODs · ${weeklyRows.length} weekly EODs`);
console.log(`   Pending signups in Requests: ${PENDING.map((p) => p.name).join(", ")}`);
console.log(`   Team logins: firstname.lastname@isa.demo / ${PASSWORD}`);
console.log(`   Student login: ${STUDENT_LOGIN.email} / ${PASSWORD}`);
