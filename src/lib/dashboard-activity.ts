export type DashboardDateRange = { from: string; to: string };

export type DashboardEodActivity = {
  report_date: string;
  dms_sent: number | null;
  convos_started: number | null;
  calls_booked: number | null;
  shows: number | null;
  closes: number | null;
};

export type MochiActivityDay = {
  day: string;
  new_leads: number | null;
  qualified: number | null;
  booked: number | null;
  won: number | null;
};

export type CloseCallActivityDay = {
  date: string;
  dials: number | null;
  answered: number | null;
};

export type CloseLeadActivityDay = { date: string; count: number | null };

export type DashboardTrendRow = {
  key: string;
  label: string;
  dms: number;
  convos: number;
  booked: number;
  shows: number;
  closes: number;
  mochiLeads: number;
  mochiQualified: number;
  mochiBooked: number;
  mochiWon: number;
  closeDials: number;
  closeAnswered: number;
  closeLeads: number;
};

export type FunnelRow = {
  label: string;
  value: number;
  pct: number | null;
  color: string;
};

const DAY_MS = 86_400_000;
const number = (value: number | null | undefined) => Number(value) || 0;

function parseIsoDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  return isoDay(new Date(parseIsoDay(value).getTime() + amount * DAY_MS));
}

function dateCount(range: DashboardDateRange): number {
  return (
    Math.floor((parseIsoDay(range.to).getTime() - parseIsoDay(range.from).getTime()) / DAY_MS) + 1
  );
}

function labelFor(value: string, compact: boolean): string {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    ...(compact
      ? { weekday: "short" as const }
      : { month: "short" as const, day: "numeric" as const }),
  }).format(parseIsoDay(value));
}

function emptyRow(key: string, label: string): DashboardTrendRow {
  return {
    key,
    label,
    dms: 0,
    convos: 0,
    booked: 0,
    shows: 0,
    closes: 0,
    mochiLeads: 0,
    mochiQualified: 0,
    mochiBooked: 0,
    mochiWon: 0,
    closeDials: 0,
    closeAnswered: 0,
    closeLeads: 0,
  };
}

/**
 * Builds chart buckets from the selected range itself. EOD and CRM values stay
 * in separate fields because the same booking can exist in both systems.
 */
export function buildDashboardTrend(input: {
  range: DashboardDateRange;
  eods: DashboardEodActivity[];
  mochi: MochiActivityDay[];
  closeCalls: CloseCallActivityDay[];
  closeLeads: CloseLeadActivityDay[];
}): DashboardTrendRow[] {
  const count = dateCount(input.range);
  if (count <= 0) return [];

  const bucketSize = count <= 31 ? 1 : count <= 93 ? 3 : 7;
  const compactLabels = count <= 7;
  const rows: DashboardTrendRow[] = [];
  const bucketByDate = new Map<string, DashboardTrendRow>();

  for (let offset = 0; offset < count; offset += bucketSize) {
    const start = addDays(input.range.from, offset);
    const end = addDays(input.range.from, Math.min(count - 1, offset + bucketSize - 1));
    const label =
      bucketSize === 1
        ? labelFor(start, compactLabels)
        : `${labelFor(start, false)}–${labelFor(end, false)}`;
    const row = emptyRow(start, label);
    rows.push(row);
    for (let day = offset; day < Math.min(count, offset + bucketSize); day += 1) {
      bucketByDate.set(addDays(input.range.from, day), row);
    }
  }

  for (const activity of input.eods) {
    const row = bucketByDate.get(activity.report_date.slice(0, 10));
    if (!row) continue;
    row.dms += number(activity.dms_sent);
    row.convos += number(activity.convos_started);
    row.booked += number(activity.calls_booked);
    row.shows += number(activity.shows);
    row.closes += number(activity.closes);
  }

  for (const activity of input.mochi) {
    const row = bucketByDate.get(activity.day.slice(0, 10));
    if (!row) continue;
    row.mochiLeads += number(activity.new_leads);
    row.mochiQualified += number(activity.qualified);
    row.mochiBooked += number(activity.booked);
    row.mochiWon += number(activity.won);
  }

  for (const activity of input.closeCalls) {
    const row = bucketByDate.get(activity.date.slice(0, 10));
    if (!row) continue;
    row.closeDials += number(activity.dials);
    row.closeAnswered += number(activity.answered);
  }

  for (const activity of input.closeLeads) {
    const row = bucketByDate.get(activity.date.slice(0, 10));
    if (row) row.closeLeads += number(activity.count);
  }

  return rows;
}

const pct = (value: number, previous: number) =>
  previous > 0 ? Math.round((value / previous) * 1_000) / 10 : null;

export function buildEodFunnel(input: {
  dms: number;
  convos: number;
  booked: number;
  shows: number;
  closes: number;
}): FunnelRow[] {
  return [
    {
      label: "DMs → Convos",
      value: input.convos,
      pct: pct(input.convos, input.dms),
      color: "var(--chart-1)",
    },
    {
      label: "Convos → Booked",
      value: input.booked,
      pct: pct(input.booked, input.convos),
      color: "var(--chart-3)",
    },
    {
      label: "Booked → Shows",
      value: input.shows,
      pct: pct(input.shows, input.booked),
      color: "var(--chart-5)",
    },
    {
      label: "Booked → Closed",
      value: input.closes,
      pct: pct(input.closes, input.booked),
      color: "var(--chart-4)",
    },
  ];
}

export function buildMochiFunnel(input: {
  leads: number;
  qualified: number;
  booked: number;
  won: number;
}): FunnelRow[] {
  return [
    { label: "New leads", value: input.leads, pct: null, color: "var(--chart-2)" },
    {
      label: "Qualified",
      value: input.qualified,
      pct: pct(input.qualified, input.leads),
      color: "var(--chart-1)",
    },
    {
      label: "Booked",
      value: input.booked,
      pct: pct(input.booked, input.qualified),
      color: "var(--chart-3)",
    },
    { label: "Won", value: input.won, pct: pct(input.won, input.booked), color: "var(--chart-4)" },
  ];
}

export function trendHasData(
  rows: DashboardTrendRow[],
  keys: (keyof DashboardTrendRow)[],
): boolean {
  return rows.some((row) =>
    keys.some((key) => typeof row[key] === "number" && Number(row[key]) > 0),
  );
}
