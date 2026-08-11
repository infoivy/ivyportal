import { createHash, timingSafeEqual } from "node:crypto";

import type { supabaseAdmin as SupabaseAdminValue } from "@/integrations/supabase/client.server";
import { didHitKpi, owesEods, type EodKpiRow, type SetterType } from "@/lib/eod-kpi";

const REPORT_TIMEZONE = "Asia/Riyadh";
const REPORTING_ROLES = new Set(["setter", "closer", "coach", "csm"]);
const METRIC_KEYS = [
  "dials",
  "dms_sent",
  "leads_contacted",
  "convos_started",
  "calls_booked",
  "calls_scheduled",
  "shows",
  "no_shows",
  "closes",
  "cash_collected",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];
type EodRow = EodKpiRow &
  Record<MetricKey, number | null> & {
    user_id: string;
    is_demo: boolean;
  };

type ProfileRow = {
  id: string;
  display_name: string | null;
  active: boolean | null;
  is_demo: boolean;
  eod_exempt: boolean | null;
  setter_type: SetterType;
  timezone: string | null;
};

type RoleRow = { user_id: string; role: string };
type DealRow = {
  cash_collected_upfront: number | null;
  total_value: number | null;
  deal_date: string;
  is_demo: boolean;
  voided_at: string | null;
};

type SupabaseAdmin = typeof SupabaseAdminValue;

type PortalOpsDependencies = {
  supabaseAdmin?: SupabaseAdmin;
  now?: Date;
};

type PortalOpsReportBuilder = () => Promise<unknown>;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function authorizeAgentRequest(request: Request): boolean {
  const expected = process.env.ARRODES_API_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  if (!expected || expected.length < 32 || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(supplied), digest(expected));
}

function businessDate(date: Date, timezone = REPORT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function addDays(iso: string, amount: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekStartFor(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

type ProfileCalendar = {
  today: string;
  yesterday: string;
  weekStart: string;
};

function profileCalendar(profile: ProfileRow, now: Date): ProfileCalendar | null {
  if (!profile.timezone) return null;
  try {
    const today = businessDate(now, profile.timezone);
    return { today, yesterday: addDays(today, -1), weekStart: weekStartFor(today) };
  } catch {
    return null;
  }
}

function totals(rows: EodRow[]): Record<MetricKey, number> {
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [key, rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)]),
  ) as Record<MetricKey, number>;
}

function rolesByUser(rows: RoleRow[], realProfileIds: Set<string>): Map<string, string[]> {
  const output = new Map<string, string[]>();
  for (const row of rows) {
    if (!realProfileIds.has(row.user_id)) continue;
    output.set(row.user_id, [...(output.get(row.user_id) ?? []), row.role]);
  }
  return output;
}

function safeName(profile: ProfileRow): string {
  return profile.display_name?.trim() || "Unnamed team member";
}

export async function buildPortalOpsReport(dependencies: PortalOpsDependencies = {}) {
  const supabaseAdmin =
    dependencies.supabaseAdmin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const now = dependencies.now ?? new Date();
  const today = businessDate(now);
  const yesterday = addDays(today, -1);
  const weekStart = weekStartFor(today);

  const [eodResult, roleResult, profileResult, dealResult] = await Promise.all([
    supabaseAdmin
      .from("eods")
      .select(
        "user_id,report_date,dials,dms_sent,leads_contacted,convos_started,calls_booked,calls_scheduled,shows,no_shows,closes,cash_collected,is_demo",
      )
      .eq("is_demo", false)
      .gte("report_date", addDays(weekStart, -8))
      .lte("report_date", addDays(today, 1))
      .order("report_date", { ascending: false }),
    supabaseAdmin.from("user_roles").select("user_id,role"),
    supabaseAdmin
      .from("profiles")
      // Generated types lag the additive eod_exempt migration; the live column
      // is already used by the canonical Home, EOD, and Team surfaces.
      .select("id,display_name,active,is_demo,eod_exempt,setter_type,timezone" as never)
      .eq("is_demo", false),
    supabaseAdmin
      .from("deals")
      .select("cash_collected_upfront,total_value,deal_date,is_demo,voided_at")
      .eq("is_demo", false)
      .is("voided_at", null)
      .gte("deal_date", weekStart)
      .lte("deal_date", today),
  ]);

  const firstError = eodResult.error ?? roleResult.error ?? profileResult.error ?? dealResult.error;
  if (firstError) throw new Error(firstError.message);

  const eods = (eodResult.data ?? []) as EodRow[];
  const profiles = (profileResult.data ?? []) as unknown as ProfileRow[];
  const roles = (roleResult.data ?? []) as RoleRow[];
  const deals = (dealResult.data ?? []) as DealRow[];
  const realProfileIds = new Set(profiles.map((profile) => profile.id));
  const roleMap = rolesByUser(roles, realProfileIds);
  const activeProfiles = profiles.filter((profile) => profile.active !== false);
  const calendarByUser = new Map(
    activeProfiles
      .map((profile) => [profile.id, profileCalendar(profile, now)] as const)
      .filter((entry): entry is readonly [string, ProfileCalendar] => entry[1] !== null),
  );
  const expectedProfiles = activeProfiles.filter((profile) =>
    owesEods({
      roles: roleMap.get(profile.id) ?? [],
      active: profile.active,
      eod_exempt: profile.eod_exempt,
    }),
  );
  const expectedWithTimezone = expectedProfiles.filter((profile) => calendarByUser.has(profile.id));
  const timezoneUnknown = expectedProfiles.filter((profile) => !calendarByUser.has(profile.id));
  const todayRows = eods.filter((row) => row.report_date === calendarByUser.get(row.user_id)?.today);
  const yesterdayRows = eods.filter((row) => row.report_date === calendarByUser.get(row.user_id)?.yesterday);
  const weekRows = eods.filter((row) => {
    const calendar = calendarByUser.get(row.user_id);
    return Boolean(calendar && row.report_date >= calendar.weekStart && row.report_date <= calendar.today);
  });
  const submittedToday = new Set(todayRows.map((row) => row.user_id));
  const submittedYesterday = new Set(yesterdayRows.map((row) => row.user_id));
  const missingToday = expectedWithTimezone.filter((profile) => !submittedToday.has(profile.id));
  const missingYesterday = expectedWithTimezone.filter((profile) => !submittedYesterday.has(profile.id));
  const latestByUserAndDate = new Map(eods.map((row) => [`${row.user_id}:${row.report_date}`, row]));

  const setters = activeProfiles
    .filter((profile) => (roleMap.get(profile.id) ?? []).includes("setter"))
    .map((profile) => {
      const calendar = calendarByUser.get(profile.id);
      const yesterdayRow = calendar
        ? latestByUserAndDate.get(`${profile.id}:${calendar.yesterday}`)
        : undefined;
      const todayRow = calendar ? latestByUserAndDate.get(`${profile.id}:${calendar.today}`) : undefined;
      return {
        name: safeName(profile),
        setter_type: profile.setter_type,
        timezone_status: calendar ? "configured" : "unknown",
        local_dates: calendar ? { today: calendar.today, yesterday: calendar.yesterday } : null,
        today: !calendar
          ? { submitted: null, hit_kpi: null, metrics: null }
          : todayRow
            ? { submitted: true, hit_kpi: didHitKpi(todayRow, profile.setter_type), metrics: totals([todayRow]) }
            : { submitted: false, hit_kpi: null, metrics: null },
        yesterday: !calendar
          ? { submitted: null, hit_kpi: null, metrics: null }
          : yesterdayRow
            ? {
                submitted: true,
                hit_kpi: didHitKpi(yesterdayRow, profile.setter_type),
                metrics: totals([yesterdayRow]),
              }
            : { submitted: false, hit_kpi: null, metrics: null },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    data_mode: "real_only",
    generated_at: now.toISOString(),
    timezone: REPORT_TIMEZONE,
    eod_day_basis: "profile_timezone",
    dates: { today, yesterday, week_start: weekStart },
    team: {
      active_members: activeProfiles.length,
      reporting_members: activeProfiles.filter((profile) =>
        (roleMap.get(profile.id) ?? []).some((role) => REPORTING_ROLES.has(role)),
      ).length,
      expected_eod_reporters: expectedProfiles.length,
      eod_timezone_eligible: expectedWithTimezone.length,
      timezone_unknown: timezoneUnknown.map(safeName),
      submitted_today: expectedWithTimezone.filter((profile) => submittedToday.has(profile.id)).length,
      missing_today: missingToday.map(safeName),
      submitted_yesterday: expectedWithTimezone.filter((profile) => submittedYesterday.has(profile.id)).length,
      missing_yesterday: missingYesterday.map(safeName),
    },
    activity: {
      today: totals(todayRows),
      yesterday: totals(yesterdayRows),
      week_to_date: totals(weekRows),
    },
    setters,
    deals_week_to_date: {
      count: deals.length,
      cash_collected: deals.reduce((sum, deal) => sum + (Number(deal.cash_collected_upfront) || 0), 0),
      deal_value: deals.reduce((sum, deal) => sum + (Number(deal.total_value) || 0), 0),
    },
  };
}

export async function handlePortalOpsAgentGet(
  request: Request,
  buildReport: PortalOpsReportBuilder = buildPortalOpsReport,
): Promise<Response> {
  if (!authorizeAgentRequest(request)) return json({ error: "Unauthorized" }, 401);

  try {
    return json(await buildReport());
  } catch (error) {
    console.error(
      "[portal-ops-agent] report failed",
      error instanceof Error ? error.message : "Unknown report error",
    );
    return json({ error: "Portal report unavailable" }, 500);
  }
}
