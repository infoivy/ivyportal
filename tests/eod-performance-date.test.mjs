import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseTeamOverviewDate } from "../src/lib/eod-performance-date.ts";

test("uses the latest submitted reporting date when today has no reports", () => {
  const reports = [{ report_date: "2026-07-16" }, { report_date: "2026-07-17" }];

  assert.equal(chooseTeamOverviewDate("2026-07-18", reports), "2026-07-17");
});

test("Performance applies the selected reporting range and member to one canonical dataset", () => {
  const route = readFileSync(
    new URL("../src/routes/_authenticated.performance.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /const dayList = buildDayList\(days\)/);
  assert.match(route, /queryKey: \["page", "performance", days\]/);
  assert.match(route, /\.gte\("report_date", from\)/);
  assert.match(route, /\.lte\("report_date", to\)/);
  assert.match(route, /memberId === "all" \? rows : rows\.filter\(\(row\) => row\.user_id === memberId\)/);
  assert.match(route, /value: sum\(selectedRows\.filter\(\(row\) => row\.report_date === date\), metric\)/);
  assert.match(route, /\(\[7, 30, 90\] as RangeDays\[\]\)/);
});
