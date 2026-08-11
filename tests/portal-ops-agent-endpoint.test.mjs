import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const routeUrl = new URL("src/routes/api/agent/v1/portal-ops.ts", root);
const serviceUrl = new URL("src/lib/portal-ops.server.ts", root);
const eodKpiUrl = new URL("src/lib/eod-kpi.ts", root);

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName,
  }).outputText;
}

const eodKpiModuleUrl = `data:text/javascript;base64,${Buffer.from(
  transpile(readFileSync(eodKpiUrl, "utf8"), "eod-kpi.ts"),
).toString("base64")}`;
const executableService = readFileSync(serviceUrl, "utf8").replace(
  'from "@/lib/eod-kpi"',
  `from "${eodKpiModuleUrl}"`,
);
const service = await import(
  `data:text/javascript;base64,${Buffer.from(
    transpile(executableService, "portal-ops.server.ts"),
  ).toString("base64")}`
);

function buildQuery(rows, error = null) {
  const filters = [];
  const query = {
    select() { return query; },
    eq(column, value) { filters.push(["eq", column, value]); return query; },
    is(column, value) { filters.push(["is", column, value]); return query; },
    gte(column, value) { filters.push(["gte", column, value]); return query; },
    lte(column, value) { filters.push(["lte", column, value]); return query; },
    order() { return query; },
    then(resolve, reject) {
      let data = [...rows];
      for (const [kind, column, value] of filters) {
        if (kind === "eq") data = data.filter((row) => row[column] === value);
        if (kind === "is") data = data.filter((row) => row[column] === value);
        if (kind === "gte") data = data.filter((row) => row[column] >= value);
        if (kind === "lte") data = data.filter((row) => row[column] <= value);
      }
      return Promise.resolve({ data, error }).then(resolve, reject);
    },
  };
  return query;
}

function buildSupabase(fixtures, errors = {}) {
  return {
    from(table) {
      return buildQuery(fixtures[table] ?? [], errors[table] ?? null);
    },
  };
}

function eod(overrides = {}) {
  return {
    user_id: "real-setter",
    report_date: "2026-08-11",
    dials: 100,
    dms_sent: 0,
    leads_contacted: 100,
    convos_started: 4,
    calls_booked: 3,
    calls_scheduled: 3,
    shows: 2,
    no_shows: 0,
    closes: 1,
    cash_collected: 500,
    is_demo: false,
    ...overrides,
  };
}

test("Portal ops agent endpoint is bearer-protected, server-only, and real-only", () => {
  assert.equal(existsSync(routeUrl), true, "agent route must exist");
  assert.equal(existsSync(serviceUrl), true, "server-only report service must exist");

  const route = readFileSync(routeUrl, "utf8");
  const source = readFileSync(serviceUrl, "utf8");

  assert.match(route, /createFileRoute\("\/api\/agent\/v1\/portal-ops"\)/);
  assert.match(route, /GET:\s*async/);
  assert.doesNotMatch(route, /POST:|PUT:|PATCH:|DELETE:/);
  assert.match(route, /import\("@\/lib\/portal-ops\.server"\)/);

  assert.match(source, /process\.env\.ARRODES_API_TOKEN/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:token|authorization)/i);
  assert.match(source, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(source, /eod_exempt,setter_type,timezone/);
  assert.match(source, /eod_day_basis:\s*"profile_timezone"/);
  assert.match(source, /from\("eods"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(source, /from\("deals"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(source, /\.is\("voided_at", null\)/);
  assert.match(source, /data_mode:\s*"real_only"/);
  assert.doesNotMatch(source, /\.(?:insert|upsert|delete)\(/);
  assert.doesNotMatch(source, /\.from\([^)]*\)[\s\S]{0,500}?\.update\(/);
});

test("agent authorization rejects missing, invalid, and misconfigured credentials", () => {
  const original = process.env.ARRODES_API_TOKEN;
  try {
    process.env.ARRODES_API_TOKEN = "x".repeat(32);
    assert.equal(service.authorizeAgentRequest(new Request("https://portal.test")), false);
    assert.equal(service.authorizeAgentRequest(new Request("https://portal.test", {
      headers: { authorization: "Bearer short" },
    })), false);
    process.env.ARRODES_API_TOKEN = "too-short";
    assert.equal(service.authorizeAgentRequest(new Request("https://portal.test", {
      headers: { authorization: `Bearer ${"x".repeat(32)}` },
    })), false);
  } finally {
    if (original === undefined) delete process.env.ARRODES_API_TOKEN;
    else process.env.ARRODES_API_TOKEN = original;
  }
});

test("agent GET returns 401, a no-store real-only report, and a generic 500", async () => {
  const original = process.env.ARRODES_API_TOKEN;
  process.env.ARRODES_API_TOKEN = "a".repeat(32);
  try {
    const unauthorized = await service.handlePortalOpsAgentGet(new Request("https://portal.test"));
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(await unauthorized.json(), { error: "Unauthorized" });

    const request = new Request("https://portal.test", {
      headers: { authorization: `Bearer ${"a".repeat(32)}` },
    });
    const success = await service.handlePortalOpsAgentGet(request, async () => ({ data_mode: "real_only" }));
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("cache-control"), "no-store");
    assert.deepEqual(await success.json(), { data_mode: "real_only" });

    const unavailable = await service.handlePortalOpsAgentGet(request, async () => {
      throw new Error("private database detail");
    });
    assert.equal(unavailable.status, 500);
    assert.deepEqual(await unavailable.json(), {
      error: "Portal report unavailable",
      error_code: "report",
    });
  } finally {
    if (original === undefined) delete process.env.ARRODES_API_TOKEN;
    else process.env.ARRODES_API_TOKEN = original;
  }
});

test("report behavior filters demo and voided data and respects profile-local EOD dates", async () => {
  const supabaseAdmin = buildSupabase({
    eods: [
      eod(),
      eod({ user_id: "demo-setter", dials: 999, cash_collected: 9999, is_demo: true }),
    ],
    user_roles: [
      { user_id: "real-setter", role: "setter" },
      { user_id: "demo-setter", role: "setter" },
    ],
    profiles: [
      {
        id: "real-setter",
        display_name: "Real Setter",
        active: true,
        is_demo: false,
        eod_exempt: false,
        setter_type: "phone",
        timezone: "America/New_York",
      },
      {
        id: "demo-setter",
        display_name: "Demo Setter",
        active: true,
        is_demo: true,
        eod_exempt: false,
        setter_type: "phone",
        timezone: "Asia/Riyadh",
      },
    ],
    deals: [
      { cash_collected_upfront: 500, total_value: 1000, deal_date: "2026-08-11", is_demo: false, voided_at: null },
      { cash_collected_upfront: 900, total_value: 900, deal_date: "2026-08-11", is_demo: true, voided_at: null },
      { cash_collected_upfront: 700, total_value: 700, deal_date: "2026-08-11", is_demo: false, voided_at: "2026-08-11T10:00:00Z" },
    ],
  });

  const report = await service.buildPortalOpsReport({
    supabaseAdmin,
    now: new Date("2026-08-11T22:30:00.000Z"),
  });

  assert.equal(report.data_mode, "real_only");
  assert.equal(report.eod_day_basis, "profile_timezone");
  assert.equal(report.dates.today, "2026-08-12", "report header uses the Riyadh business date");
  assert.equal(report.team.active_members, 1);
  assert.equal(report.team.submitted_today, 1);
  assert.equal(report.activity.today.dials, 100);
  assert.equal(report.activity.today.cash_collected, 500);
  assert.equal(report.setters.length, 1);
  assert.deepEqual(report.setters[0].local_dates, { today: "2026-08-11", yesterday: "2026-08-10" });
  assert.equal(report.setters[0].today.submitted, true);
  assert.equal(report.deals_week_to_date.count, 1);
  assert.equal(report.deals_week_to_date.cash_collected, 500);
  assert.equal(report.deals_week_to_date.deal_value, 1000);
});

test("report behavior labels synchronous client setup failures without exposing details", async () => {
  const supabaseAdmin = Object.defineProperty({}, "from", {
    get() {
      throw new Error("missing private environment");
    },
  });
  await assert.rejects(
    service.buildPortalOpsReport({ supabaseAdmin, now: new Date("2026-08-11T12:00:00.000Z") }),
    (error) =>
      error instanceof Error && error.message === "missing private environment" && error.code === "query_setup",
  );
});

test("report behavior surfaces database failures to the generic endpoint boundary", async () => {
  const supabaseAdmin = buildSupabase(
    { eods: [], user_roles: [], profiles: [], deals: [] },
    { eods: { message: "database detail" } },
  );
  await assert.rejects(
    service.buildPortalOpsReport({ supabaseAdmin, now: new Date("2026-08-11T12:00:00.000Z") }),
    (error) => error instanceof Error && error.message === "database detail" && error.code === "eods",
  );
});
