import assert from "node:assert/strict";
import test from "node:test";

import {
  GROUP_COACHING_CALLS_PER_WEEK,
  countStudentDailyEods,
  getStudentWeeklyDraftAction,
  getStudentWeeklyWindow,
  validateStudentWeeklyEod,
} from "../src/lib/student-weekly-eod.ts";

test("uses the current Monday-to-Sunday week on Sunday", () => {
  assert.deepEqual(getStudentWeeklyWindow("2026-07-19"), {
    weekStart: "2026-07-13",
    weekEnd: "2026-07-19",
    dueToday: true,
  });
});

test("keeps the latest completed week open after Sunday", () => {
  assert.deepEqual(getStudentWeeklyWindow("2026-07-20"), {
    weekStart: "2026-07-13",
    weekEnd: "2026-07-19",
    dueToday: false,
  });
  assert.deepEqual(getStudentWeeklyWindow("2026-07-18"), {
    weekStart: "2026-07-06",
    weekEnd: "2026-07-12",
    dueToday: false,
  });
});

test("weekly windows remain correct across a year boundary", () => {
  assert.deepEqual(getStudentWeeklyWindow("2027-01-03"), {
    weekStart: "2026-12-28",
    weekEnd: "2027-01-03",
    dueToday: true,
  });
  assert.deepEqual(getStudentWeeklyWindow("2027-01-04"), {
    weekStart: "2026-12-28",
    weekEnd: "2027-01-03",
    dueToday: false,
  });
});

test("counts unique daily EODs only inside the accountability week", () => {
  const count = countStudentDailyEods(
    ["2026-07-12", "2026-07-13", "2026-07-13", "2026-07-18", "2026-07-19", "2026-07-20"],
    { weekStart: "2026-07-13", weekEnd: "2026-07-19", dueToday: true },
  );
  assert.equal(count, 3);
});

test("does not touch a weekly draft before stored state is hydrated", () => {
  assert.equal(
    getStudentWeeklyDraftAction({
      hydrated: false,
      hasSubmission: false,
      form: {
        groupCallsAttended: 0,
        implementation: "",
        biggestWin: "",
        biggestBlocker: "",
        nextWeekCommitment: "",
      },
    }),
    "skip",
  );
});

test("requires an honest 0-to-7 attendance count and concrete reflection", () => {
  assert.equal(GROUP_COACHING_CALLS_PER_WEEK, 7);
  assert.equal(
    validateStudentWeeklyEod({
      groupCallsAttended: 8,
      implementation: "Applied it",
      nextWeekCommitment: "Five applications",
    }),
    "Group calls attended must be between 0 and 7.",
  );
  assert.equal(
    validateStudentWeeklyEod({
      groupCallsAttended: 0,
      implementation: "",
      nextWeekCommitment: "Five applications",
    }),
    "Explain what you implemented or what stopped you this week.",
  );
  assert.equal(
    validateStudentWeeklyEod({
      groupCallsAttended: 0,
      implementation: "I missed the calls because of work and will reschedule.",
      nextWeekCommitment: "Attend all seven",
    }),
    null,
  );
});
