import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardTrend,
  buildEodFunnel,
  buildMochiFunnel,
} from "../src/lib/dashboard-activity.ts";

const eod = {
  report_date: "2026-07-17",
  dms_sent: 25,
  convos_started: 8,
  calls_booked: 2,
  shows: 1,
  closes: 1,
};

test("builds an exact historical range instead of anchoring it to today", () => {
  const rows = buildDashboardTrend({
    range: { from: "2026-07-17", to: "2026-07-17" },
    eods: [eod],
    mochi: [],
    closeCalls: [],
    closeLeads: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, "2026-07-17");
  assert.equal(rows[0].booked, 2);
  assert.equal(rows[0].shows, 1);
});

test("keeps EOD and CRM activity source-separated so overlapping bookings are not doubled", () => {
  const [row] = buildDashboardTrend({
    range: { from: "2026-07-17", to: "2026-07-17" },
    eods: [eod],
    mochi: [{ day: "2026-07-17", new_leads: 12, qualified: 4, booked: 2, won: 1 }],
    closeCalls: [{ date: "2026-07-17", dials: 40, answered: 15 }],
    closeLeads: [{ date: "2026-07-17", count: 9 }],
  });

  assert.equal(row.booked, 2);
  assert.equal(row.mochiBooked, 2);
  assert.equal(row.closeDials, 40);
  assert.equal(row.closeLeads, 9);
});

test("90-day bucketing preserves every activity row", () => {
  const eods = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 3, 20 + index)).toISOString().slice(0, 10);
    return { ...eod, report_date: date, calls_booked: 1 };
  });
  const rows = buildDashboardTrend({
    range: { from: "2026-04-20", to: "2026-07-18" },
    eods,
    mochi: [],
    closeCalls: [],
    closeLeads: [],
  });

  assert.equal(
    rows.reduce((sum, row) => sum + row.booked, 0),
    90,
  );
  assert.ok(rows.length < 90, "long ranges should be bucketed for readable charts");
});

test("creates truthful source-specific funnels without adding CRM and EOD counts", () => {
  const eodRows = buildEodFunnel({ dms: 100, convos: 50, booked: 10, shows: 6, closes: 2 });
  const mochiRows = buildMochiFunnel({ leads: 80, qualified: 30, booked: 8, won: 2 });

  assert.deepEqual(
    eodRows.map((row) => row.value),
    [50, 10, 6, 2],
  );
  assert.deepEqual(
    mochiRows.map((row) => row.value),
    [80, 30, 8, 2],
  );
  assert.equal(eodRows[1].pct, 20);
  assert.equal(mochiRows[2].pct, 26.7);
});
