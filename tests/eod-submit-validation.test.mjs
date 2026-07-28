import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../src/routes/_authenticated.eods.tsx", import.meta.url),
  "utf8",
);

test("missing summary produces an explicit submission error instead of a dead button", () => {
  assert.match(
    route,
    /if \(!form\.wins\.trim\(\)\) return toast\.error\("Add a wins \/ summary before submitting\."\);/,
  );
  assert.match(route, /<fieldset disabled=\{Boolean\(existingId\)\}/);
  assert.match(route, /<Button onClick=\{submit\} disabled=\{saving \|\| Boolean\(existingId\)\}/);
  assert.doesNotMatch(route, /disabled=\{saving \|\| !form\.wins\.trim\(\)\}/);
});
