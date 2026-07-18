import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseTeamOverviewDate } from "../src/lib/eod-performance-date.ts";

test("uses the latest submitted reporting date when today has no reports", () => {
  const reports = [{ report_date: "2026-07-16" }, { report_date: "2026-07-17" }];

  assert.equal(chooseTeamOverviewDate("2026-07-18", reports), "2026-07-17");
});

test("Performance applies the chosen reporting date to its team summary and overview", () => {
  const route = readFileSync(
    new URL("../src/routes/_authenticated.eods.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /chooseTeamOverviewDate\(today, teamEods\)/);
  assert.match(route, /teamEods\.filter\(e => e\.report_date === teamDate\)/);
  assert.match(route, /<TeamOverview roster=\{teamRoster\} eods=\{teamEods\} today=\{teamDate\}/);
});
