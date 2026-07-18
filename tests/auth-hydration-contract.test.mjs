import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootRoute = readFileSync("src/routes/__root.tsx", "utf8");
const authenticatedRoute = readFileSync("src/routes/_authenticated.tsx", "utf8");

test("theme bootstrapping does not report an expected html class hydration mismatch", () => {
  assert.match(rootRoute, /<html[^>]*suppressHydrationWarning/);
});

test("missing browser sessions redirect only after hydration", () => {
  assert.doesNotMatch(authenticatedRoute, /beforeLoad\s*:/);
  assert.match(
    authenticatedRoute,
    /if \(!userId\)[\s\S]*navigate\(\{ to: "\/auth", replace: true \}\)/,
  );
  assert.match(authenticatedRoute, /state\.loading \|\| !state\.user/);
});
