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
  { name: "setter-eod", persona: "setter", path: "/eods" },
  { name: "dashboard-setter", persona: "setter", path: "/dashboard" },
  { name: "set-tracker", persona: "setter", path: "/calendar", action: async (page) => {
      await page.getByRole("button", { name: "Sets", exact: true }).click();
      await page.waitForTimeout(2500);
      // Show the whole pool so the shot demonstrates owner badges
      await page.getByRole("button", { name: "All sets" }).click().catch(() => {});
    } },
  { name: "sales-today", persona: "closer", path: "/sales?tab=operations", fullPage: false },
  { name: "log-a-close", persona: "closer", path: "/revenue", action: async (page) => {
      await page.getByRole("button", { name: /log a close/i }).click();
    } },
  { name: "installments", persona: "closer", path: "/installments" },
  { name: "closer-resources", persona: "closer", path: "/closer-resources" },
  { name: "csm-workspace", persona: "csm", path: "/csm?tab=workspace" },
  { name: "student-success", persona: "csm", path: "/student-success" },
  { name: "action-items", persona: "csm", path: "/action-items" },
  { name: "action-item-new", persona: "csm", path: "/action-items", action: async (page) => {
      await page.getByRole("button", { name: /add ad-hoc item/i }).click();
    } },
  { name: "testimonials", persona: "csm", path: "/testimonials" },
  { name: "calls", persona: "coach", path: "/calls" },
  { name: "log-call-modal", persona: "coach", path: "/calls", action: async (page) => {
      await page.getByRole("button", { name: /log call/i }).first().click();
    } },
  { name: "students", persona: "coach", path: "/students" },
  { name: "student-detail", persona: "coach", path: "/students", action: async (page) => {
      // open the first student row
      await page.locator("a[href^='/students/']").first().click();
      await page.waitForTimeout(3000);
    } },
  { name: "dashboard", persona: "admin", path: "/dashboard" },
  { name: "team", persona: "admin", path: "/team" },
  { name: "admin", persona: "admin", path: "/admin" },
  { name: "access-defaults", persona: "admin", path: "/admin", action: async (page) => {
      await page.getByText("Access defaults", { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(800);
    } },
  { name: "finance", persona: "admin", path: "/finance" },
  { name: "content", persona: "admin", path: "/content" },
  { name: "add-student", persona: "admin", path: "/students", action: async (page) => {
      await page.getByRole("button", { name: /add student/i }).click();
    } },
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

// ── shoot ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = { ok: [], failed: [] };
try {
  for (const personaKey of Object.keys(PERSONAS)) {
    const shots = SHOTS.filter((s) => s.persona === personaKey);
    if (!shots.length) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
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
