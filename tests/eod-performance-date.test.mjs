import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseTeamOverviewDate } from "../src/lib/eod-performance-date.ts";

test("uses the latest submitted reporting date when today has no reports", () => {
  const reports = [{ report_date: "2026-07-16" }, { report_date: "2026-07-17" }];

  assert.equal(chooseTeamOverviewDate("2026-07-18", reports), "2026-07-17");
});

test("Performance applies the selected reporting day(s) to its team summary and overview", () => {
  const route = readFileSync(
    new URL("../src/routes/_authenticated.eods.tsx", import.meta.url),
    "utf8",
  );

  // Auto behavior still anchors on today-or-latest-submitted…
  assert.match(route, /chooseTeamOverviewDate\(today, teamEods\)/);
  assert.match(route, /teamDates\.length \? teamDates : \[latestTeamDate\]/);
  // …and both the summary chips and the overview consume the same selection.
  assert.match(route, /const daySet = new Set\(selectedTeamDays\)/);
  assert.match(route, /teamEods\.filter\(e => daySet\.has\(e\.report_date\)\)/);
  assert.match(route, /<TeamOverview roster=\{teamRoster\} eods=\{teamEods\} days=\{selectedTeamDays\}/);
  // The calendar picker is wired to the same state.
  assert.match(route, /<TeamDayPicker today=\{today\} selected=\{teamDates\} onChange=\{setTeamDates\}/);
});
