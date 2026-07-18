import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootRoute = readFileSync("src/routes/__root.tsx", "utf8");
const authenticatedRoute = readFileSync("src/routes/_authenticated.tsx", "utf8");
const eodRoute = readFileSync("src/routes/_authenticated.eods.tsx", "utf8");

test("theme bootstrapping does not report an expected html class hydration mismatch", () => {
  assert.match(rootRoute, /<html[^>]*suppressHydrationWarning/);
});

test("missing browser sessions redirect only after hydration", () => {
  assert.doesNotMatch(authenticatedRoute, /beforeLoad\s*:/);
  const signedOutHandler = authenticatedRoute.match(
    /onSignedOut: \(\) => \{([\s\S]*?)\n      \},/,
  )?.[1];
  assert.ok(signedOutHandler);
  assert.match(signedOutHandler, /navigate\(\{ to: "\/auth", replace: true \}\)/);
  assert.match(authenticatedRoute, /state\.loading \|\| !state\.user/);
});

test("the auth boundary wires account transitions through the behavioral loader", () => {
  assert.match(authenticatedRoute, /createAuthSessionLoader/);
  assert.match(
    authenticatedRoute,
    /const clearAuthBoundaryCache = isolateAuthBoundaryCache\(queryClient\);[\s\S]*?loader\.refresh/,
  );
  assert.doesNotMatch(authenticatedRoute, /createLatestRequestGate/);
  assert.match(
    authenticatedRoute,
    /const clearAccountState[\s\S]*?queryClient\.clear\(\)/,
  );
  for (const callback of ["onLoading", "onSignedOut", "onAuthError"]) {
    assert.match(
      authenticatedRoute,
      new RegExp(`${callback}: \\(.*?\\) => \\{[\\s\\S]*?clearAccountState\\(`),
    );
  }
  assert.match(authenticatedRoute, /if \(error\) throw error/);
  assert.match(authenticatedRoute, /loader\.recordEodSubmitted\(userId\)/);
  assert.match(
    eodRoute,
    /CustomEvent\("isa:eod-submitted", \{ detail: \{ userId: user\.id \} \}\)/,
  );
  const cleanup = authenticatedRoute.match(/return \(\) => \{([\s\S]*?)\n    \};/)?.[1];
  assert.ok(cleanup);
  assert.match(cleanup, /clearAuthBoundaryCache\(\)/);
});

test("sign-out failure remains visible on the session error screen", () => {
  const signOut = authenticatedRoute.match(/const signOut = async \(\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(signOut);
  assert.match(signOut, /signOutWithLocalFallback/);
  assert.match(signOut, /if \(error\) setAuthError\(/);
});
