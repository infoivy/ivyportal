import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GROUP_CALL_SCHEDULE,
  GROUP_COACHING_CALLS_PER_WEEK,
  countStudentDailyEods,
  fromStoredCallsAttended,
  getStudentWeeklyDraftAction,
  getStudentWeeklyWindow,
  parseGroupCallSchedule,
  toAttendedRecords,
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

test("schedule has one call per weekday and survives malformed settings", () => {
  assert.equal(GROUP_COACHING_CALLS_PER_WEEK, 7);
  assert.equal(DEFAULT_GROUP_CALL_SCHEDULE.length, 7);
  assert.deepEqual(parseGroupCallSchedule(null), DEFAULT_GROUP_CALL_SCHEDULE);
  assert.deepEqual(parseGroupCallSchedule([]), DEFAULT_GROUP_CALL_SCHEDULE);
  assert.deepEqual(parseGroupCallSchedule([{ day: "Mon", name: "Drills" }, { bogus: true }]), [
    { day: "Mon", name: "Drills" },
  ]);
});

test("attended day keys resolve to durable {day, name} records and back", () => {
  const records = toAttendedRecords(["Wed", "Mon"], DEFAULT_GROUP_CALL_SCHEDULE);
  assert.deepEqual(records, [
    { day: "Mon", name: "Off Call Drills" },
    { day: "Wed", name: "Roleplays" },
  ]);
  assert.deepEqual(fromStoredCallsAttended(records), ["Mon", "Wed"]);
  assert.deepEqual(fromStoredCallsAttended(null), []);
  assert.deepEqual(fromStoredCallsAttended([{ nope: 1 }]), []);
});

test("does not touch a weekly draft before stored state is hydrated", () => {
  assert.equal(
    getStudentWeeklyDraftAction({
      hydrated: false,
      hasSubmission: false,
      form: {
        callsAttended: [],
        oneOnOneCalls: 0,
        implementation: "",
        biggestWin: "",
        biggestBlocker: "",
        nextWeekCommitment: "",
      },
    }),
    "skip",
  );
});

test("requires honest attendance against the schedule and concrete reflection", () => {
  const schedule = DEFAULT_GROUP_CALL_SCHEDULE;
  assert.equal(
    validateStudentWeeklyEod(
      { callsAttended: ["Xyz"], oneOnOneCalls: null, implementation: "Applied it", nextWeekCommitment: "Five apps" },
      schedule,
    ),
    "Attended calls don't match this week's call schedule — reload and try again.",
  );
  assert.equal(
    validateStudentWeeklyEod(
      { callsAttended: ["Mon", "Mon"], oneOnOneCalls: null, implementation: "Applied it", nextWeekCommitment: "Five apps" },
      schedule,
    ),
    "Attended calls don't match this week's call schedule — reload and try again.",
  );
  assert.equal(
    validateStudentWeeklyEod(
      { callsAttended: ["Mon"], oneOnOneCalls: 3.5, implementation: "Applied it", nextWeekCommitment: "Five apps" },
      schedule,
    ),
    "1:1 calls this week must be a small whole number.",
  );
  assert.equal(
    validateStudentWeeklyEod(
      { callsAttended: [], oneOnOneCalls: null, implementation: "", nextWeekCommitment: "Five apps" },
      schedule,
    ),
    "Explain what you implemented from the calls, or what stopped you.",
  );
  assert.equal(
    validateStudentWeeklyEod(
      {
        callsAttended: ["Mon", "Sun"],
        oneOnOneCalls: 2,
        implementation: "Tightened my roleplay tonality and rebuilt my loom intro.",
        nextWeekCommitment: "Attend all seven calls",
      },
      schedule,
    ),
    null,
  );
});
