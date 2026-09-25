import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const playbook = read("src/components/dm-setter-playbook.tsx");
const route = read("src/routes/_authenticated.sops.dm-setter-playbook.tsx");
const knowledge = read("src/routes/_authenticated.knowledge.index.tsx");

test("the DM Setter Playbook is the one DM setting script in Knowledge", () => {
  const setting = knowledge.indexOf('value === "setting"');
  const playbookCard = knowledge.indexOf('to: "/sops/dm-setter-playbook"', setting);
  const discoveryCard = knowledge.indexOf('to: "/sops/simple-discovery-framework"', setting);
  assert.ok(setting >= 0 && playbookCard > setting, "playbook card sits in the Setting section");
  assert.ok(playbookCard < discoveryCard, "playbook card is pinned first");
  assert.doesNotMatch(knowledge, /isa-setting-process|title: "Setting Process"/);
});

test("the retired Setting Process routes land on the playbook", () => {
  for (const path of [
    "src/routes/_authenticated.sops.isa-setting-process.tsx",
    "src/routes/_authenticated.sops.dm-setting-mastery.tsx",
  ]) {
    assert.match(read(path), /redirect\(\{ to: "\/sops\/dm-setter-playbook", replace: true \}\)/);
  }
  assert.ok(!existsSync(new URL("src/components/dm-mastery-board.tsx", root)));
  assert.ok(!existsSync(new URL("src/routes/print.tsx", root)), "the public old one-pager is gone");
});

test("students never reach the setter scripts", () => {
  assert.match(route, /roles\.every\(\(r\) => r === "student"\)/);
  assert.match(route, /<Navigate to="\/knowledge" replace \/>/);
});

test("the playbook keeps its founder rules", () => {
  // Qualify on where he lives, never on where he or his family is from.
  assert.match(playbook, /Where he lives\. Never where he's from\./);
  assert.match(playbook, /Never\s+judge\s+a\s+lead\s+by\s+his\s+name,\s+profile\s+picture,\s+accent\s+or\s+family\s+background/);
  // Money never comes up in the Instagram DMs (Meta flags it).
  assert.match(playbook, /Money stays out of the DMs/);
  // Outbound stays paused behind manager approval.
  assert.match(playbook, /id: "pb-outbound", label: "Outbound \(paused\)"/);
  assert.match(playbook, /Don't do any of this unless your manager approves it/);
  // Videos go out through Mochi, so scripts carry no video link placeholders.
  assert.doesNotMatch(playbook, /\[(free video link|pre-call video|video link)\]/);
});

test("playbook copy has no em dashes", () => {
  assert.doesNotMatch(playbook, /—/);
  assert.doesNotMatch(route, /—/);
});
