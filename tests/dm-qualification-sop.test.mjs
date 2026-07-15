import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/data/sections.tsx", import.meta.url);
const contentUrl = new URL("../src/data/content.ts", import.meta.url);
const stylesUrl = new URL("../src/styles.css", import.meta.url);
const routeUrl = new URL("../src/routes/_authenticated.sops.isa-setting-process.tsx", import.meta.url);

async function read(url) {
  return readFile(url, "utf8");
}

test("financial qualification is a dedicated top-level dashboard section", async () => {
  const [source, content, styles] = await Promise.all([
    read(sourceUrl),
    read(contentUrl),
    read(stylesUrl),
  ]);

  assert.match(content, /\| "financial"/);
  assert.match(content, /id: "financial", label: "Financial Qualification"/);
  assert.match(styles, /--tab-financial:/);
  assert.match(source, /id: "financial",\s+heading: "Financial Qualification"/);
});

test("the setter dashboard contains a high-volume DM qualification lane", async () => {
  const source = await read(sourceUrl);

  for (const requiredText of [
    "Backlog Triage: 1,000+ DMs",
    "The DM Qualification Lane",
    "Green → Book",
    "Amber → Nurture",
    "Red → Disqualify Warmly",
    "Never qualify by country, accent, name, or nationality",
  ]) {
    assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("the qualification lane includes exact capacity, decision, and readiness scripts", async () => {
  const source = await read(sourceUrl);

  for (const requiredText of [
    "how many hours a day could you realistically protect for this",
    "income and savings wise",
    "make this decision yourself",
    "move on this month",
    "without putting yourself or your family under pressure",
    "somewhere in the four figures",
    "$1,000–$1,499 can be reviewed when the rest is strong",
  ]) {
    assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("pre-call notes capture the qualification result and route", async () => {
  const route = await read(routeUrl);

  assert.match(route, /QUALIFICATION RESULT \(Green \/ Amber \/ Red\):/);
  assert.match(route, /ROUTE \(Book \/ Nurture \/ Free community \/ Disqualify\):/);
});
