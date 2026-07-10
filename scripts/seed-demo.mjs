#!/usr/bin/env node
/**
 * Demo seed v2 — realistic 3-month showcase.
 *
 * Team (all @isa.demo, password DemoPortal2026!):
 *   Setters: Bilal Rahman (phone, top), Yusuf Khan (phone, average),
 *            Hamza Ali (DM), Ibrahim Saleh (full cycle)
 *   Closers: Omar Farouk, Zayd Hassan (full-time; occasional self-set)
 *   Coach:   Musa Abdullah    CSM: Adam Idris
 *
 * ~3 months of EODs with varied, ramping numbers; deals scaling month over
 * month toward a ~$100k run-rate; students/installments/1:1 calls/tallies/
 * testimonials/IG snapshots so every page looks lived-in.
 *
 * Deterministic RNG so re-seeding produces the same story.
 * Usage: node --env-file=.env scripts/seed-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);

// ── deterministic rng ────────────────────────────────────────────────────────
let _s = 1337;
const rnd = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

const DAYS = 92;
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const dayAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
const ramp = (n) => 0.72 + (1 - n / DAYS) * 0.48; // 0.72 → 1.2 toward today

// ── team ─────────────────────────────────────────────────────────────────────
const TEAM = [
  { email: "bilal@isa.demo",   name: "Bilal Rahman",  roles: ["setter"], setter_type: "phone",      quality: 0.95 },
  { email: "yusuf@isa.demo",   name: "Yusuf Khan",    roles: ["setter"], setter_type: "phone",      quality: 0.72 },
  { email: "hamza@isa.demo",   name: "Hamza Ali",     roles: ["setter"], setter_type: "dm",         quality: 0.85 },
  { email: "ibrahim@isa.demo", name: "Ibrahim Saleh", roles: ["setter"], setter_type: "full_cycle", quality: 0.82 },
  { email: "omar@isa.demo",    name: "Omar Farouk",   roles: ["closer"], setter_type: null,         quality: 0.9 },
  { email: "zayd@isa.demo",    name: "Zayd Hassan",   roles: ["closer"], setter_type: null,         quality: 0.8 },
  { email: "musa@isa.demo",    name: "Musa Abdullah", roles: ["coach"],  setter_type: null,         quality: 0.85 },
  { email: "adam@isa.demo",    name: "Adam Idris",    roles: ["csm"],    setter_type: null,         quality: 0.85 },
];

console.log("Provisioning team…");
const { data: userList } = await sb.auth.admin.listUsers({ perPage: 500 });
const idByEmail = new Map();
for (const m of TEAM) {
  let u = userList.users.find((x) => x.email === m.email);
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({
      email: m.email, password: "DemoPortal2026!", email_confirm: true,
      user_metadata: { full_name: m.name },
    });
    if (error) throw error;
    u = data.user;
    console.log("  ✓", m.name);
  } else console.log("  ↻", m.name, "exists");
  idByEmail.set(m.email, u.id);
  await sb.from("profiles").upsert({ id: u.id, display_name: m.name, setter_type: m.setter_type, active: true });
  await sb.from("user_roles").delete().eq("user_id", u.id);
  for (const r of m.roles) await sb.from("user_roles").upsert({ user_id: u.id, role: r }, { onConflict: "user_id,role" });
}
const ID = Object.fromEntries(TEAM.map((m) => [m.email.split("@")[0], idByEmail.get(m.email)]));
const setters = TEAM.filter((m) => m.roles.includes("setter"));

// ── wipe previous demo data ──────────────────────────────────────────────────
console.log("Clearing previous demo data…");
const { data: oldStudents } = await sb.from("students").select("id").eq("is_demo", true);
const oldIds = (oldStudents ?? []).map((s) => s.id);
if (oldIds.length) {
  const { data: oldPlans } = await sb.from("installments").select("id").in("student_id", oldIds);
  const planIds = (oldPlans ?? []).map((p) => p.id);
  if (planIds.length) await sb.from("installment_payments").delete().in("installment_id", planIds);
  await sb.from("installments").delete().in("student_id", oldIds);
  await sb.from("student_calls").delete().in("student_id", oldIds);
  await sb.from("student_eods").delete().in("student_id", oldIds);
  await sb.from("csm_student_notes").delete().in("student_id", oldIds);
  await sb.from("testimonials").delete().in("student_id", oldIds);
}
await sb.from("student_action_items").delete().eq("is_demo", true);
await sb.from("deals").delete().eq("is_demo", true);
await sb.from("eods").delete().eq("is_demo", true);
await sb.from("ig_monthly_snapshots").delete().eq("is_demo", true);
await sb.from("students").delete().eq("is_demo", true);
await sb.from("csm_tally").delete().in("user_id", [...idByEmail.values()]);

// remove any prior demo team not in the new cast
for (const u of userList.users) {
  if (u.email?.endsWith("@isa.demo") && !TEAM.some((m) => m.email === u.email)) {
    await sb.from("eods").delete().eq("user_id", u.id);
    await sb.from("csm_tally").delete().eq("user_id", u.id);
    await sb.from("user_roles").delete().eq("user_id", u.id);
    await sb.from("profiles").delete().eq("id", u.id);
    await sb.auth.admin.deleteUser(u.id);
    console.log("  ✗ removed old demo user", u.email);
  }
}

// ── deals + students (drive everything else) ─────────────────────────────────
console.log("Seeding deals + students…");
const STUDENT_NAMES = [
  "Ahmed Raza","Khalid Mansour","Tariq Aziz","Salman Iqbal","Idris Kane","Ismail Diallo","Ayoub Benali","Younes Amrani",
  "Sufyan Malik","Hassan Jabbar","Bassem Odeh","Rayan Cherif","Karim Haddad","Anas Belhaj","Zubair Sheikh","Ilyas Toure",
  "Hamid Nasser","Faris Qureshi","Adnan Yildiz","Mehdi Bouzid","Sami Farah","Nabil Karimi","Jawad Hosseini","Amir Solak",
  "Usman Bello","Dawud Sesay","Taha Elmasry","Yassin Berrada","Rachid Zeroual","Mounir Sassi","Ali Demir","Bilel Gharbi",
  "Omar Sy","Hakim Ziyad","Reda Alaoui","Marwan Fakih","Sofian Meziane","Elias Haddara","Zaid Rahmani","Ridwan Osei",
  "Imran Chaudhry","Musab Erdem","Kamal Bousaid","Nadir Slimani","Ayman Kaddour","Walid Barakat","Sharif Ndiaye","Talha Vural",
];
let nameIdx = 0;
const nextName = () => STUDENT_NAMES[nameIdx++ % STUDENT_NAMES.length];

// monthly cash-upfront targets, oldest → newest (current month pro-rated to today)
const daysIntoMonth = Math.min(31, today.getDate());
const monthTargets = [41000, 63000, Math.round(95000 * (daysIntoMonth / 31))];
const monthOf = (n) => (n >= 62 ? 0 : n >= daysIntoMonth ? 1 : 2);

const setterWeights = [
  [ID.bilal, 0.4], [ID.hamza, 0.25], [ID.ibrahim, 0.2], [ID.yusuf, 0.15],
];
const weightedSetter = () => {
  const r = rnd(); let acc = 0;
  for (const [id, w] of setterWeights) { acc += w; if (r < acc) return id; }
  return ID.bilal;
};

const deals = [];
const cashByMonth = [0, 0, 0];
for (let n = DAYS - 1; n >= 0; n--) {
  const m = monthOf(n);
  if (cashByMonth[m] >= monthTargets[m]) continue;
  const dealsToday = chance(0.35 + 0.45 * (ramp(n) - 0.72)) ? ri(1, m === 2 ? 3 : 2) : chance(0.3) ? 1 : 0;
  for (let k = 0; k < dealsToday; k++) {
    if (cashByMonth[m] >= monthTargets[m]) break;
    const total = pick([2500, 3000, 3500, 3500, 4000, 4500, 5000, 5000, 5500, 6500, 7500]);
    const roll = rnd();
    const type = roll < 0.55 ? "pif" : roll < 0.85 ? "deposit" : "split";
    const cash = type === "pif" ? total : type === "deposit" ? pick([1000, 1500, 2000, 2500]) : pick([0, 500]);
    const closer = chance(0.55) ? ID.omar : ID.zayd;
    const selfSet = chance(0.07); // closers occasionally source their own
    const setter = selfSet ? closer : weightedSetter();
    deals.push({ date: iso(dayAgo(n)), dayN: n, closer, setter, total, cash, type });
    cashByMonth[m] += cash;
  }
}
console.log(`  ${deals.length} deals · cash by month (old→new): ${cashByMonth.map((c) => "$" + c.toLocaleString()).join(" / ")}`);

const phaseByAge = (n) => {
  if (n > 75) return chance(0.4) ? "offer_won" : chance(0.3) ? "testimonial" : "applying";
  if (n > 45) return chance(0.55) ? "coaching_1on1" : "applying";
  if (n > 18) return chance(0.7) ? "coaching_1on1" : "onboarding";
  return "onboarding";
};
const studentRows = deals.map((deal) => {
  const phase = phaseByAge(deal.dayN);
  return {
    full_name: nextName(),
    email: null,
    phase,
    status: chance(0.94) ? "active" : "ghosting",
    coach_id: ID.musa,
    join_date: deal.date,
    calls_included: 10, calls_allotted: 10,
    payment_state: deal.type === "pif" ? "paid_in_full" : chance(0.85) ? "installments" : "behind",
    first_win_at: ["offer_won", "testimonial"].includes(phase) || (phase === "applying" && chance(0.3)) ? iso(dayAgo(Math.max(2, deal.dayN - ri(25, 45)))) : null,
    testimonial_collected: phase === "testimonial",
    is_demo: true,
  };
});
const { data: insertedStudents, error: stuErr } = await sb.from("students").insert(studentRows).select("id, full_name, phase, join_date");
if (stuErr) throw stuErr;
insertedStudents.forEach((s, i) => { deals[i].student_id = s.id; deals[i].student_name = s.full_name; });
console.log(`  ${insertedStudents.length} students`);

const dealRows = deals.map((d) => ({
  student_id: d.student_id,
  student_name: d.student_name,
  closer_id: d.closer,
  setter_id: d.setter,
  program_type: chance(0.8) ? "1:1 Pathway" : "Group Coaching",
  total_value: d.total,
  cash_collected_upfront: d.cash,
  payment_type: d.type,
  deal_date: d.date,
  created_by: d.closer,
  is_demo: true,
}));
const { error: dealErr } = await sb.from("deals").insert(dealRows);
if (dealErr) throw dealErr;

// ── installments for deposit/split deals ─────────────────────────────────────
console.log("Seeding installments…");
let paymentsCreated = 0;
for (const d of deals.filter((x) => x.type !== "pif")) {
  const planTotal = d.total - d.cash;
  if (planTotal <= 0) continue;
  const { data: plan, error: planErr } = await sb.from("installments").insert({
    student_id: d.student_id, student_name: d.student_name,
    closer_id: d.closer, setter_id: d.setter,
    coach_id: ID.musa, total_amount: planTotal, currency: "USD", created_by: d.closer,
  }).select("id").single();
  if (planErr) throw planErr;
  const nPay = ri(2, 4);
  const per = Math.round(planTotal / nPay);
  const rows = Array.from({ length: nPay }, (_, i) => {
    const due = new Date(d.date + "T00:00:00");
    due.setMonth(due.getMonth() + i + 1);
    const isPast = due < today;
    const status = isPast ? (chance(0.85) ? "paid" : "late") : "upcoming";
    return {
      installment_id: plan.id, sequence: i + 1,
      amount: i === nPay - 1 ? planTotal - per * (nPay - 1) : per,
      currency: "USD", due_date: iso(due), status,
      paid_at: status === "paid" ? new Date(due.getTime() - ri(0, 3) * 86400000).toISOString() : null,
      payment_method: pick(["whop", "wise", "bank", "whop"]),
    };
  });
  const { error: payErr } = await sb.from("installment_payments").insert(rows);
  if (payErr) throw payErr;
  paymentsCreated += rows.length;
}
console.log(`  ${paymentsCreated} scheduled payments`);

// ── EODs ─────────────────────────────────────────────────────────────────────
console.log("Seeding EODs…");
const WINS = [
  "Booked {n} solid calls — momentum is real.",
  "Best convo of the week, prospect basically closed himself.",
  "Cracked a new opener, reply rate way up today.",
  "Two referrals from an old lead alhamdulillah.",
  "Follow-ups paid off — 3 re-engaged from last month's list.",
  "Hit the dial target before asr, cleaned pipeline after.",
  "Quality over quantity day — fewer convos, deeper qualification.",
  "New niche list is responding, keeping this angle.",
  "Prospect showed up pre-sold from the content. Easy set.",
  "Slow start, strong finish — last hour got both sets.",
];
const BLOCKERS = [
  "", "", "", "",
  "Numbers burning out on one lead list, rotating tomorrow.",
  "Slow replies today, most leads at work hours.",
  "CRM tagging took too long, batching it going forward.",
  "Two no-shows back to back, tightening confirmations.",
  "Internet dropped mid-block, made up dials in the evening.",
  "Long onboarding call ate the morning block.",
];

const EOD_BASE = {
  dials: 0, leads_contacted: 0, dms_sent: 0, convos_started: 0,
  calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0,
  calls_taken: 0, closes: 0, cash_collected: 0, deferred_cash: 0, deposits: 0,
  follow_ups_done: 0, looms_reviewed: 0, roleplays_reviewed: 0,
  student_checkins: 0, escalations_resolved: 0,
};

const eodRows = [];
const cashByCloserDay = new Map();
for (const d of deals) {
  const k = `${d.closer}:${d.date}`;
  const cur = cashByCloserDay.get(k) ?? { cash: 0, closes: 0 };
  cur.cash += d.cash; cur.closes += 1;
  cashByCloserDay.set(k, cur);
}

for (const m of setters) {
  const uid = idByEmail.get(m.email);
  for (let n = DAYS - 1; n >= 0; n--) {
    if (!chance(m.quality * 0.97)) continue;
    const r = ramp(n) * (0.85 + rnd() * 0.35);
    const date = iso(dayAgo(n));
    const type = m.setter_type;
    const dials = type === "dm" ? 0 : Math.round((type === "full_cycle" ? 98 : 108) * r * (m.quality * 0.55 + 0.5));
    const leads = type === "phone" ? 0 : Math.round((type === "dm" ? 128 : 50) * r * (m.quality * 0.55 + 0.5));
    const dms = type === "phone" ? ri(0, 15) : Math.round(leads * (0.6 + rnd() * 0.3));
    const convos = Math.round((dials * 0.16 + leads * 0.22 + dms * 0.05) * (0.7 + rnd() * 0.6));
    const booked = Math.max(0, Math.min(6, Math.round(convos * (0.1 + m.quality * 0.1) + (rnd() - 0.45))));
    const scheduled = booked + (chance(0.3) ? 1 : 0);
    const shows = Math.max(0, booked - (chance(0.35) ? ri(1, 2) : 0));
    eodRows.push({
      ...EOD_BASE,
      user_id: uid, report_date: date,
      dials, leads_contacted: leads, dms_sent: dms, convos_started: convos,
      calls_booked: booked, calls_scheduled: scheduled, shows,
      no_shows: Math.max(0, scheduled - shows - (chance(0.5) ? 0 : 1)),
      calls_taken: 0, closes: 0, cash_collected: 0,
      wins: pick(WINS).replace("{n}", String(Math.max(1, booked))),
      blockers: pick(BLOCKERS),
      is_demo: true,
    });
  }
}

for (const closer of [ID.omar, ID.zayd]) {
  const q = closer === ID.omar ? 0.92 : 0.84;
  for (let n = DAYS - 1; n >= 0; n--) {
    if (!chance(q * 0.96)) continue;
    const date = iso(dayAgo(n));
    const dayDeals = cashByCloserDay.get(`${closer}:${date}`) ?? { cash: 0, closes: 0 };
    const taken = Math.max(dayDeals.closes, ri(1, Math.round(3 + 3 * ramp(n))));
    eodRows.push({
      ...EOD_BASE,
      user_id: closer, report_date: date,
      dials: 0, leads_contacted: 0, dms_sent: ri(0, 10), convos_started: ri(0, 6),
      calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: chance(0.25) ? 1 : 0,
      calls_taken: taken, closes: dayDeals.closes, cash_collected: dayDeals.cash,
      deposits: dayDeals.closes > 0 && chance(0.4) ? 1 : 0,
      follow_ups_done: ri(1, 6),
      wins: dayDeals.closes > 0 ? `Closed ${dayDeals.closes} — $${dayDeals.cash.toLocaleString()} collected.` : pick(WINS).replace("{n}", "0"),
      blockers: pick(BLOCKERS),
      is_demo: true,
    });
  }
}

for (const [uid, q] of [[ID.musa, 0.88], [ID.adam, 0.9]]) {
  for (let n = DAYS - 1; n >= 0; n--) {
    if (!chance(q * 0.95)) continue;
    const isCsm = uid === ID.adam;
    eodRows.push({
      ...EOD_BASE,
      user_id: uid, report_date: iso(dayAgo(n)),
      dials: 0, leads_contacted: 0, dms_sent: 0, convos_started: 0,
      calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0,
      calls_taken: isCsm ? 0 : ri(1, 4), closes: 0, cash_collected: 0,
      looms_reviewed: isCsm ? ri(2, 9) : 0,
      roleplays_reviewed: isCsm ? ri(1, 5) : 0,
      student_checkins: isCsm ? ri(2, 7) : ri(0, 2),
      escalations_resolved: isCsm && chance(0.25) ? 1 : 0,
      wins: isCsm
        ? pick(["Cleared the loom queue before maghrib.", "Two students unblocked on offer applications.", "Check-ins done — one save from ghosting."])
        : pick(["Great 1:1 block, strong progress across the board.", "Two students ready to move phases.", "Roleplay session unlocked a stuck student."]),
      blockers: pick(BLOCKERS),
      is_demo: true,
    });
  }
}
const { error: eodErr } = await sb.from("eods").upsert(eodRows, { onConflict: "user_id,report_date" });
if (eodErr) throw eodErr;
console.log(`  ${eodRows.length} EOD rows`);

// ── 1:1 calls ────────────────────────────────────────────────────────────────
console.log("Seeding 1:1 calls…");
const callRows = [];
const OUTCOMES = ["Dialed in the niche and offer angle.", "Reviewed loom feedback together.", "Roleplay: objection handling round 2.", "Application strategy for this week.", "Portfolio review + next milestones.", "Mindset reset, weekly plan rebuilt."];
for (const [i, s] of insertedStudents.entries()) {
  if (!["coaching_1on1", "applying", "offer_won", "testimonial"].includes(s.phase)) continue;
  const doneCoaching = s.phase !== "coaching_1on1"; // used up their 1:1 block
  const start = new Date(s.join_date + "T00:00:00"); start.setDate(start.getDate() + 10);
  // Weekly cadence from join+10 all the way to today (graduated students taper off).
  for (let c = 0; ; c++) {
    const d = new Date(start); d.setDate(d.getDate() + c * 7 + ri(-1, 1));
    if (d >= today) break;
    if (doneCoaching && c >= ri(7, 10)) break; // finished their 1:1 block
    if (!doneCoaching && chance(0.12)) continue; // occasional skipped week
    const noShow = chance(0.07);
    callRows.push({
      student_id: s.id, coach_id: ID.musa, call_date: iso(d),
      status: noShow ? "no_show" : "completed",
      outcome: noShow ? null : pick(OUTCOMES),
      progress_rating: noShow ? null : ri(2, 5),
      duration_min: noShow ? null : pick([25, 30, 30, 40, 45]),
      coach_notes: noShow ? "No-show — followed up on WhatsApp." : null,
    });
  }
  if (s.phase === "coaching_1on1" && i % 3 === 0) {
    const d = new Date(today); d.setDate(d.getDate() + ri(1, 6));
    callRows.push({ student_id: s.id, coach_id: ID.musa, call_date: iso(d), status: "scheduled" });
  }
}
const { error: callErr } = await sb.from("student_calls").insert(callRows);
if (callErr) throw callErr;
console.log(`  ${callRows.length} calls`);

// ── action items ─────────────────────────────────────────────────────────────
console.log("Seeding action items…");
const AI_TEXTS = [
  "Send updated loom for review", "Post the client win in community", "Rewrite outreach opener — too generic",
  "Book 3 practice roleplays this week", "Fix calendar link on IG bio", "Send testimonial video",
  "Complete module 4 before next call", "Apply to 5 offers from the sheet", "Update tracker with this week's numbers",
  "Record objection-handling loom", "Confirm payment method for installment 2", "Prep case study notes",
];
const aiRows = [];
const activeStudents = insertedStudents.filter((x) => !["offer_won", "testimonial"].includes(x.phase));
for (let i = 0; i < 26; i++) {
  const s = pick(activeStudents);
  const created = dayAgo(ri(0, 21));
  const done = chance(0.55);
  aiRows.push({
    student_id: s.id,
    created_by: pick([ID.musa, ID.adam]),
    text: pick(AI_TEXTS),
    due_date: chance(0.75) ? iso(new Date(created.getTime() + ri(2, 9) * 86400000)) : null,
    done,
    done_at: done ? new Date(created.getTime() + ri(1, 6) * 86400000).toISOString() : null,
    created_at: created.toISOString(),
    is_demo: true,
  });
}
for (const [assignee, text] of [
  [ID.bilal, "Refresh the lead list for next week"],
  [ID.hamza, "Test the new DM opener on 30 leads"],
  [ID.zayd, "Update payment links doc with Wise EUR"],
]) {
  aiRows.push({
    student_id: null, assignee_id: assignee, created_by: ID.omar,
    text, due_date: iso(dayAgo(-ri(1, 4))), done: false, created_at: dayAgo(ri(0, 3)).toISOString(), is_demo: true,
  });
}
const { error: aiErr } = await sb.from("student_action_items").insert(aiRows);
if (aiErr) throw aiErr;
console.log(`  ${aiRows.length} action items`);

// ── student EODs (daily logs; varied compliance drives at-risk realism) ─────
console.log("Seeding student EODs…");
const sEodRows = [];
for (const s of insertedStudents) {
  if (!["onboarding", "coaching_1on1", "applying"].includes(s.phase)) continue;
  const consistency = 0.45 + rnd() * 0.5; // some students grind, some coast
  const since = Math.min(DAYS - 1, Math.floor((today - new Date(s.join_date + "T00:00:00")) / 86400000));
  for (let n = Math.min(since, 45); n >= 0; n--) {
    if (!chance(consistency)) continue;
    const training = s.phase === "onboarding";
    sEodRows.push({
      student_id: s.id, report_date: iso(dayAgo(n)),
      roleplays: ri(0, 4), looms_sent: training ? ri(0, 4) : 0,
      applications_submitted: training ? ri(0, 3) : ri(1, 7),
      outreach_sent: ri(0, 12), replies: ri(0, 4), interviews: chance(0.12) ? 1 : 0,
      wins: chance(0.5) ? pick(["Got a reply from a dream offer.", "Best roleplay session yet.", "3 quality applications out.", "Loom approved by Adam!"]) : null,
      blockers: chance(0.25) ? pick(["Struggled with the opener.", "Slow day, low energy.", "Waiting on loom feedback."]) : null,
    });
  }
}
{
  const { error: seErr } = await sb.from("student_eods").insert(sEodRows);
  if (seErr) throw seErr;
  console.log(`  ${sEodRows.length} student EOD rows`);
}

// ── CSM tallies (last 45 days) ───────────────────────────────────────────────
console.log("Seeding CSM activity…");
const tallyRows = [];
for (let n = 45; n >= 0; n--) {
  if (chance(0.12)) continue;
  const d = dayAgo(n);
  const counts = { loom: ri(2, 8), roleplay: ri(1, 4), checkin: ri(2, 6), escalation: chance(0.2) ? 1 : 0 };
  for (const [kind, count] of Object.entries(counts)) {
    for (let c = 0; c < count; c++) {
      tallyRows.push({
        user_id: ID.adam, kind,
        student_id: chance(0.7) ? pick(insertedStudents).id : null,
        created_at: new Date(d.getTime() + ri(8, 20) * 3600000).toISOString(),
      });
    }
  }
}
const { error: tallyErr } = await sb.from("csm_tally").insert(tallyRows);
if (tallyErr) throw tallyErr;
console.log(`  ${tallyRows.length} tallies`);

// ── testimonials ─────────────────────────────────────────────────────────────
const grads = insertedStudents.filter((s) => ["offer_won", "testimonial"].includes(s.phase));
const testiRows = grads.slice(0, 6).map((s, i) => ({
  student_id: s.id,
  type: pick(["text", "video", "text", "trustpilot"]),
  status: ["published", "approved", "received", "received", "requested", "published"][i % 6],
  title: `${s.full_name.split(" ")[0]} — landed his first offer`,
  content_text: pick([
    "Came in with zero sales experience, closed my first offer in 9 weeks. The roleplays changed everything.",
    "The daily structure is what did it for me. EODs kept me honest.",
    "From stuck to signed. Coaching calls were worth the whole program.",
  ]),
  tags: ["win"],
  collected_by: ID.adam,
  collected_at: iso(dayAgo(ri(2, 30))),
}));
if (testiRows.length) {
  const { error: tErr } = await sb.from("testimonials").insert(testiRows);
  if (tErr) throw tErr;
}
console.log(`  ${testiRows.length} testimonials`);

// ── IG snapshots (3 months growth) ───────────────────────────────────────────
const igMonths = [
  { off: 2, followers: 6420, nf: 610, views: 148000, reach: 231000, dms: 214, posts: 18, visits: 5400, clicks: 380, inter: 9800 },
  { off: 1, followers: 7810, nf: 1390, views: 236000, reach: 388000, dms: 342, posts: 22, visits: 8900, clicks: 640, inter: 16400 },
  { off: 0, followers: 9640, nf: 1830, views: 305000, reach: 512000, dms: 431, posts: 24, visits: 12100, clicks: 890, inter: 22800 },
];
for (const m of igMonths) {
  const d = new Date(today.getFullYear(), today.getMonth() - m.off, 1);
  await sb.from("ig_monthly_snapshots").upsert({
    month: iso(d), followers: m.followers, new_followers: m.nf, views: m.views,
    reach: m.reach, dms: m.dms, posts: m.posts, profile_visits: m.visits,
    link_clicks: m.clicks, interactions: m.inter, is_demo: true,
  }, { onConflict: "month" });
}
console.log("  3 IG snapshots");

const totalCash = deals.reduce((a, d) => a + d.cash, 0);
console.log(`\n✅ Demo seed v2 complete.`);
console.log(`   ${deals.length} deals · $${totalCash.toLocaleString()} cash upfront over ~3 months`);
console.log(`   Monthly (old→new): ${cashByMonth.map((c) => "$" + c.toLocaleString()).join(" → ")}`);
console.log(`   Logins: bilal|yusuf|hamza|ibrahim|omar|zayd|musa|adam @isa.demo / DemoPortal2026!`);
