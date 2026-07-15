import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/routes/_authenticated.sops.isa-setting-process.tsx", import.meta.url), "utf8");
const sections = readFileSync(new URL("../src/data/sections.tsx", import.meta.url), "utf8");

test("script library follows the operating order", () => {
  const inbound = route.indexOf('title: "1. Inbound Setting"');
  const financial = route.indexOf('title: "2. Financial Qualification"');
  const outbound = route.indexOf('title: "3. Outbound Setting"');
  const closing = route.indexOf('title: "4. Closing and Follow-Up"');
  const operations = route.indexOf('title: "5. Setter Mastery and Operations"');

  assert.ok(inbound >= 0);
  assert.ok(inbound < financial && financial < outbound && outbound < closing && closing < operations);
});

test("library uses normal scrolling instead of the zoom canvas", () => {
  assert.match(route, /<LibraryView headerH=\{headerH\}/);
  assert.match(route, /className="fixed top-0 left-0 right-0 z-40/);
  assert.doesNotMatch(route, /<TransformWrapper[\s\S]*<LibraryView/);
});

test("workflow guide can be hidden without removing the stage labels", () => {
  assert.match(route, /guideCollapsed/);
  assert.match(route, /Hide guide/);
  assert.match(route, /Show guide/);
  assert.match(route, /Move on when:/);
});

test("copy controls only appear on individual usable scripts", () => {
  assert.doesNotMatch(route, /Copy all/);
  assert.match(sections, /copyable = true/);
  assert.match(sections, /<Q copyable=\{false\}>my job is to find the right men/);
});
