#!/usr/bin/env node
/**
 * Ivy Portal Ops daily report — REAL data only (is_demo = false).
 * Reads Supabase via service role from Documents/ivy/.env
 * Usage:
 *   node scripts/portal-ops-report.mjs
 *   node scripts/portal-ops-report.mjs --json
 *   node scripts/portal-ops-report.mjs --include-demo   # explicit only
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const includeDemo = args.has("--include-demo");

const KPI = {
  phone: { primary: "dials", primaryTarget: 100, setsTarget: 3 },
  dm: { primary: "dms_sent", primaryTarget: 125, setsTarget: 3 },
  full_cycle: {
    primary: "dials",
    primaryTarget: 100,
    secondary: "dms_sent",
    secondaryTarget: 50,
    setsTarget: 3,
  },
};

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function bizToday(tz = "Asia/Riyadh") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function sum(rows, key) {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
}

function gradeSetter(type, row) {
  const t = type && KPI[type] ? type : row.dials > 0 ? "phone" : "dm";
  const k = KPI[t];
  const primary = Number(row[k.primary]) || 0;
  const sets = Number(row.calls_booked) || 0;
  const primaryHit = primary >= k.primaryTarget;
  const setsHit = sets >= k.setsTarget;
  let secondaryHit = true;
  if (k.secondary) {
    secondaryHit = (Number(row[k.secondary]) || 0) >= k.secondaryTarget;
  }
  const hit = primaryHit && setsHit && secondaryHit;
  return { type: t, primary, primaryTarget: k.primaryTarget, sets, setsTarget: k.setsTarget, hit };
}

async function main() {
  const env = loadEnv(resolve(ROOT, ".env"));
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Documents/ivy/.env");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = bizToday("Asia/Riyadh");
  const yesterday = addDays(today, -1);
  const weekStart = (() => {
    // Monday-start week containing today (Riyadh calendar day as plain date)
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay(); // 0 Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt.toISOString().slice(0, 10);
  })();

  let eodQ = sb
    .from("eods")
    .select(
      "user_id,report_date,dials,dms_sent,leads_contacted,convos_started,calls_booked,calls_scheduled,shows,no_shows,closes,cash_collected,wins,blockers,is_demo",
    )
    .gte("report_date", addDays(weekStart, -7))
    .lte("report_date", today)
    .order("report_date", { ascending: false });

  if (!includeDemo) eodQ = eodQ.eq("is_demo", false);

  const [
    { data: eods, error: eodErr },
    { data: roles, error: roleErr },
    { data: profiles, error: profErr },
    { data: deals, error: dealErr },
  ] = await Promise.all([
    eodQ,
    sb.from("user_roles").select("user_id,role"),
    sb.from("profiles").select("id,display_name,active,setter_type"),
    sb
      .from("deals")
      .select("id,cash_collected,deal_value,closed_at,status,closer_id,setter_id,is_demo")
      .gte("closed_at", weekStart)
      .limit(200),
  ]);

  if (eodErr || roleErr || profErr) {
    console.error(eodErr?.message || roleErr?.message || profErr?.message);
    process.exit(1);
  }

  const nameOf = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p.display_name || p.id.slice(0, 8)]),
  );
  const setterType = Object.fromEntries((profiles || []).map((p) => [p.id, p.setter_type]));
  const setterIds = new Set((roles || []).filter((r) => r.role === "setter").map((r) => r.user_id));

  const yRows = (eods || []).filter((r) => r.report_date === yesterday);
  const weekRows = (eods || []).filter((r) => r.report_date >= weekStart && r.report_date <= today);
  const realDealRows = (deals || []).filter((d) => includeDemo || d.is_demo !== true);

  // Per-setter yesterday
  const yBySetter = [];
  for (const uid of setterIds) {
    const row = yRows.find((r) => r.user_id === uid);
    if (!row) {
      yBySetter.push({
        name: nameOf[uid] || uid.slice(0, 8),
        missing: true,
        type: setterType[uid] || null,
      });
      continue;
    }
    const g = gradeSetter(setterType[uid], row);
    yBySetter.push({
      name: nameOf[uid] || uid.slice(0, 8),
      missing: false,
      ...g,
      dms: row.dms_sent,
      dials: row.dials,
      booked: row.calls_booked,
      shows: row.shows,
      closes: row.closes,
      cash: row.cash_collected,
      blockers: row.blockers,
    });
  }

  const performers = yBySetter.filter((s) => !s.missing && s.hit);
  const under = yBySetter.filter((s) => !s.missing && !s.hit);
  const missing = yBySetter.filter((s) => s.missing);

  const report = {
    generated_at: new Date().toISOString(),
    timezone: "Asia/Riyadh",
    today,
    yesterday,
    week_start: weekStart,
    data_mode: includeDemo ? "includes_demo" : "real_only",
    portal_urls: {
      overview: "https://portal.ivysalesacademy.com/",
      eods: "https://portal.ivysalesacademy.com/eods",
      content_plan: "https://portal.ivysalesacademy.com/content?tab=plan",
      sales: "https://portal.ivysalesacademy.com/sales",
    },
    caution:
      "Portal Overview tiles may include prop/demo UI. This report uses eods.is_demo=false unless --include-demo.",
    counts: {
      eod_rows_in_window: (eods || []).length,
      yesterday_eods: yRows.length,
      week_eods: weekRows.length,
      setters_on_roster: setterIds.size,
    },
    yesterday_team: {
      dials: sum(yRows, "dials"),
      dms_sent: sum(yRows, "dms_sent"),
      convos: sum(yRows, "convos_started"),
      booked: sum(yRows, "calls_booked"),
      shows: sum(yRows, "shows"),
      no_shows: sum(yRows, "no_shows"),
      closes: sum(yRows, "closes"),
      cash_collected: sum(yRows, "cash_collected"),
    },
    week_team: {
      dials: sum(weekRows, "dials"),
      dms_sent: sum(weekRows, "dms_sent"),
      booked: sum(weekRows, "calls_booked"),
      shows: sum(weekRows, "shows"),
      closes: sum(weekRows, "closes"),
      cash_collected: sum(weekRows, "cash_collected"),
    },
    setters_yesterday: {
      hit_kpi: performers.map((s) => s.name),
      below_kpi: under.map((s) => ({
        name: s.name,
        type: s.type,
        primary: s.primary,
        target: s.primaryTarget,
        sets: s.sets,
        sets_target: s.setsTarget,
      })),
      missing_eod: missing.map((s) => s.name),
      detail: yBySetter,
    },
    week_deals: {
      count: realDealRows.length,
      note: dealErr ? dealErr.message : null,
    },
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Human brief
  const lines = [];
  lines.push(`IVY PORTAL OPS — ${today} (Riyadh)`);
  lines.push(`Mode: ${report.data_mode} | Window: week from ${weekStart}`);
  lines.push(`Sources: eods + profiles + user_roles (not Overview prop tiles)`);
  lines.push("");
  if ((eods || []).length === 0) {
    lines.push("⚠ No REAL EOD rows in the lookback window.");
    lines.push(
      "Most historical eods are is_demo=true. Team must file real EODs for this report to be useful.",
    );
    lines.push("");
  }
  lines.push(`YESTERDAY (${yesterday}) team`);
  lines.push(
    `  Dials ${report.yesterday_team.dials} · DMs ${report.yesterday_team.dms_sent} · Convos ${report.yesterday_team.convos} · Booked ${report.yesterday_team.booked} · Shows ${report.yesterday_team.shows} · Closes ${report.yesterday_team.closes} · Cash ${report.yesterday_team.cash_collected}`,
  );
  lines.push("");
  lines.push("SETTERS YESTERDAY");
  if (performers.length) lines.push(`  Hit KPI: ${performers.map((s) => s.name).join(", ")}`);
  else lines.push("  Hit KPI: (none)");
  if (under.length) {
    lines.push("  Below KPI:");
    for (const s of under) {
      lines.push(
        `    - ${s.name} (${s.type || "?"}): primary ${s.primary}/${s.primaryTarget}, sets ${s.sets}/${s.setsTarget}`,
      );
    }
  } else lines.push("  Below KPI: (none with EOD)");
  if (missing.length) lines.push(`  Missing EOD: ${missing.map((s) => s.name).join(", ")}`);
  else lines.push("  Missing EOD: (none on setter roster)");
  lines.push("");
  lines.push(`THIS WEEK (from ${weekStart}) team`);
  lines.push(
    `  Dials ${report.week_team.dials} · DMs ${report.week_team.dms_sent} · Booked ${report.week_team.booked} · Shows ${report.week_team.shows} · Closes ${report.week_team.closes} · Cash ${report.week_team.cash_collected}`,
  );
  lines.push("");
  lines.push("LINKS");
  lines.push(`  Overview: ${report.portal_urls.overview}`);
  lines.push(`  EODs: ${report.portal_urls.eods}`);
  lines.push(`  Content plan: ${report.portal_urls.content_plan}`);
  lines.push("");
  lines.push(report.caution);

  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
