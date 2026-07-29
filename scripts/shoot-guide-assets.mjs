#!/usr/bin/env node
/**
 * Fresh role-view screenshots for the portal guides.
 *
 * Creates temporary single-role accounts, logs in as each with Playwright
 * (installed Chrome), captures every page the guides reference FROM THAT
 * ROLE'S OWN VIEW, saves PNGs to scripts/guide-assets/, then deletes the
 * temp accounts. Re-run seed-portal-guides.mjs afterwards to upload.
 *
 * Usage: npm i --no-save playwright && node --env-file=.env scripts/shoot-guide-assets.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "https://portal.ivysalesacademy.com";
const OUT = "scripts/guide-assets";
const PASSWORD = "GuideShots2026!x";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);
mkdirSync(OUT, { recursive: true });

const PERSONAS = {
  setter: { email: "guide-setter@isa.guide", name: "Yusuf (Guide)", roles: ["setter"], setter_type: "phone" },
  closer: { email: "guide-closer@isa.guide", name: "Omar (Guide)", roles: ["closer"] },
  csm: { email: "guide-csm@isa.guide", name: "Musa (Guide)", roles: ["csm"] },
  coach: { email: "guide-coach@isa.guide", name: "Bilal (Guide)", roles: ["coach"] },
  admin: { email: "guide-admin@isa.guide", name: "Admin (Guide)", roles: ["admin", "founder", "cofounder"] },
};

// name → { persona, path, action?, fullPage? }
const SHOTS = [
  // setter
  { name: "dashboard-setter", persona: "setter", path: "/dashboard" },
  { name: "setter-eod", persona: "setter", path: "/eods" },
  { name: "setter-calendar", persona: "setter", path: "/calendar" },
  { name: "set-tracker", persona: "setter", path: "/calendar", action: async (page) => {
      await page.getByRole("button", { name: "Sets", exact: true }).click().catch(() => {});
      await page.waitForTimeout(2500);
    } },
  { name: "setter-knowledge", persona: "setter", path: "/knowledge" },
  { name: "setting-process", persona: "setter", path: "/sops/isa-setting-process" },
  // closer
  { name: "money-in", persona: "closer", path: "/revenue" },
  { name: "log-a-close", persona: "closer", path: "/revenue", action: async (page) => {
      await page.getByRole("button", { name: /log a close/i }).click();
    } },
  { name: "payment-plans", persona: "closer", path: "/revenue?tab=plans" },
  { name: "closer-crm", persona: "closer", path: "/crm" },
  { name: "closer-resources", persona: "closer", path: "/closer-resources" },
  // csm
  { name: "csm-workspace", persona: "csm", path: "/csm" },
  { name: "student-success", persona: "csm", path: "/student-success" },
  { name: "action-items", persona: "csm", path: "/action-items" },
  { name: "testimonials", persona: "csm", path: "/testimonials" },
  { name: "students-csm", persona: "csm", path: "/students" },
  { name: "student-detail", persona: "csm", path: "/students", action: async (page) => {
      await page.getByText("Ahmed Malik (Demo)", { exact: false }).first().click();
      await page.waitForTimeout(3500);
    } },
  // coach
  { name: "calls", persona: "coach", path: "/calls" },
  { name: "log-call-modal", persona: "coach", path: "/calls", action: async (page) => {
      await page.getByRole("button", { name: /log call|add call/i }).first().click().catch(() => {});
      await page.waitForTimeout(1200);
    } },
  { name: "students-coach", persona: "coach", path: "/students" },
  // admin / founders
  { name: "dashboard", persona: "admin", path: "/dashboard" },
  { name: "performance", persona: "admin", path: "/performance" },
  { name: "founder-money-in", persona: "admin", path: "/revenue" },
  { name: "payouts", persona: "admin", path: "/payouts" },
  { name: "finance", persona: "admin", path: "/finance" },
  { name: "team", persona: "admin", path: "/team" },
  { name: "admin", persona: "admin", path: "/admin" },
  { name: "admin-calendar", persona: "admin", path: "/calendar" },
  { name: "knowledge", persona: "admin", path: "/knowledge" },
];

// ── create temp accounts ─────────────────────────────────────────────────────
const created = [];
for (const [k, p] of Object.entries(PERSONAS)) {
  const { data, error } = await sb.auth.admin.createUser({
    email: p.email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: p.name },
  });
  if (error) throw new Error(`create ${p.email}: ${error.message}`);
  const id = data.user.id;
  created.push(id);
  for (const role of p.roles) {
    const { error: rErr } = await sb.from("user_roles").upsert({ user_id: id, role }, { onConflict: "user_id,role" });
    if (rErr) throw new Error(`role ${role} for ${p.email}: ${rErr.message}`);
  }
  if (p.setter_type) await sb.from("profiles").update({ setter_type: p.setter_type }).eq("id", id);
  p.id = id;
  console.log("account +", k, id);
}

// ── demo students so screenshots show FULL pages (flagged is_demo, removed after)
const demoStudentIds = [];
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const DEMO_STUDENTS = [
  { full_name: "Ahmed Malik (Demo)", phase: "training", payment_state: "installments", grade: "B" },
  { full_name: "Yusuf Rahman (Demo)", phase: "applying", payment_state: "paid_in_full", grade: "A" },
  { full_name: "Ibrahim Diallo (Demo)", phase: "onboarding", payment_state: "installments", grade: null },
  { full_name: "Zaid Hussain (Demo)", phase: "applying", payment_state: "scholarship", grade: "B" },
  { full_name: "Hamza Ali (Demo)", phase: "training", payment_state: "paid_in_full", grade: "C" },
  { full_name: "Bilal Osman (Demo)", phase: "onboarding", payment_state: "installments", grade: null },
];
const csmId = () => PERSONAS.csm.id;
const coachId = () => PERSONAS.coach.id;
async function seedDemoStudents() {
  for (const [i, d] of DEMO_STUDENTS.entries()) {
    const { data: stu, error } = await sb.from("students").insert({
      full_name: d.full_name, email: null, phase: d.phase, status: "active",
      join_date: iso(daysAgo(20 + i * 4)), calls_included: 10, calls_allotted: 10,
      payment_state: d.payment_state, student_grade: d.grade, is_demo: true,
      coach_id: coachId(),
      next_action: i === 0 ? "Review his latest loom batch, then book the midpoint call" : null,
    }).select("id").single();
    if (error) throw new Error(`demo student: ${error.message}`);
    demoStudentIds.push(stu.id);
    const eods = [];
    for (let n = 0; n < 18; n++) {
      if ((n * 7 + i) % 5 === 0) continue; // realistic gaps
      const applying = d.phase === "applying";
      eods.push({
        student_id: stu.id, report_date: iso(daysAgo(n)),
        roleplays: 2 + ((n + i) % 3), looms_sent: applying ? 0 : 2 + ((n + i) % 2),
        applications_submitted: applying ? 3 + ((n + i) % 4) : 0,
        replies: (n + i) % 3, interviews: (n + i) % 7 === 0 ? 1 : 0,
        wins: n % 4 === 0 ? "Got a reply from a fitness brand — sending my loom tonight." : null,
      });
    }
    await sb.from("student_eods").insert(eods);
    await sb.from("student_action_items").insert([
      { student_id: stu.id, created_by: csmId(), text: "Send 3 looms to the review channel", due_date: iso(daysAgo(-1)), done: false },
      { student_id: stu.id, created_by: csmId(), text: "Rewatch module 4 and redo the objection roleplay", due_date: iso(daysAgo(1)), done: false },
      { student_id: stu.id, created_by: csmId(), text: "Join Thursday's group call with questions ready", done: true, done_at: daysAgo(2).toISOString() },
    ]);
    await sb.from("student_calls").insert([
      { student_id: stu.id, coach_id: coachId(), call_date: iso(daysAgo(6 + i)), status: "completed", progress_rating: 3 + (i % 3), outcome: "Worked through his loom script — much tighter close.", action_items_json: [{ text: "Apply the new script in 5 applications", done: i % 2 === 0 }] },
      { student_id: stu.id, coach_id: coachId(), call_date: iso(daysAgo(-3 - i)), status: "scheduled" },
    ]);
    await sb.from("csm_student_notes").insert([
      { student_id: stu.id, user_id: csmId(), note: "Checked in on WhatsApp — motivated but stuck on loom pacing. Sent him two example looms.", tags: ["check-in"] },
      { student_id: stu.id, user_id: csmId(), note: "Reviewed 3 looms today, feedback delivered. Second one was close to approval quality.", tags: ["progress"] },
    ]);
    if (d.phase === "applying") {
      await sb.from("student_placements").insert([
        { student_id: stu.id, business_name: "Peak Performance Coaching", role_title: "Appointment setter", stage: "interviewing", interview_at: daysAgo(-2).toISOString() },
        { student_id: stu.id, business_name: "Elevate Fitness Co", role_title: "DM setter", stage: "applied" },
      ]);
    }
  }
  console.log(`demo students + ${demoStudentIds.length}`);
}
async function cleanupDemoStudents() {
  if (!demoStudentIds.length) return;
  for (const t of ["student_eods", "student_action_items", "student_calls", "csm_student_notes", "student_placements"]) {
    await sb.from(t).delete().in("student_id", demoStudentIds);
  }
  await sb.from("students").delete().in("id", demoStudentIds);
  console.log("demo students cleaned");
}
await seedDemoStudents();

// ── shoot ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = { ok: [], failed: [] };
try {
  for (const personaKey of Object.keys(PERSONAS)) {
    const shots = SHOTS.filter((s) => s.persona === personaKey);
    if (!shots.length) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
    await ctx.addInitScript(() => { try { localStorage.setItem("isa-theme", "dark"); } catch {} });
    const page = await ctx.newPage();
    // sign in
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // let React hydrate or the form submits natively
    await page.fill("#email", PERSONAS[personaKey].email);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Sign in →" }).click();
    await page.waitForURL((u) => !String(u).includes("/auth"), { timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log("signed in as", personaKey);
    for (const shot of shots) {
      try {
        await page.goto(`${BASE}${shot.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(4000);
        if (shot.action) { await shot.action(page); await page.waitForTimeout(1500); }
        await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: false });
        results.ok.push(shot.name);
        console.log("  📸", shot.name);
        // close any open dialog before the next shot
        await page.keyboard.press("Escape").catch(() => {});
      } catch (e) {
        results.failed.push(`${shot.name}: ${e.message?.slice(0, 120)}`);
        console.log("  ✗", shot.name, e.message?.slice(0, 120));
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await cleanupDemoStudents();
  // ── cleanup temp accounts ──────────────────────────────────────────────────
  for (const id of created) {
    await sb.from("user_roles").delete().eq("user_id", id);
    await sb.from("profiles").delete().eq("id", id);
    const { error } = await sb.auth.admin.deleteUser(id);
    console.log(error ? `cleanup FAILED ${id}: ${error.message}` : `account - ${id}`);
  }
}
console.log(`\n✅ ${results.ok.length} shots, ${results.failed.length} failed`);
if (results.failed.length) console.log(results.failed.join("\n"));
