import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import ts from "typescript";

const loaderSource = readFileSync(new URL("../src/lib/auth-session-loader.ts", import.meta.url), "utf8");
const { outputText: loaderModule } = ts.transpileModule(loaderSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "auth-session-loader.ts",
});
const { createAuthSessionLoader, isolateAuthBoundaryCache, signOutWithLocalFallback } = await import(
  `data:text/javascript;base64,${Buffer.from(loaderModule).toString("base64")}`
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test("auth cache boundary clears stale account data on mount and unmount", () => {
  const queryClient = new QueryClient();
  const accountKey = ["unscoped-account"];

  queryClient.setQueryData(accountKey, { userId: "A" });
  const closeA = isolateAuthBoundaryCache(queryClient);
  assert.equal(queryClient.getQueryData(accountKey), undefined);

  queryClient.setQueryData(accountKey, { userId: "A" });
  closeA();
  assert.equal(queryClient.getQueryData(accountKey), undefined);

  queryClient.setQueryData(accountKey, { userId: "A" });
  const closeB = isolateAuthBoundaryCache(queryClient);
  assert.equal(queryClient.getQueryData(accountKey), undefined);
  closeB();
});

test("sign-out retries locally after a global failure", async () => {
  const calls = [];
  const error = await signOutWithLocalFallback(async options => {
    calls.push(options);
    return { error: options ? null : new Error("global sign-out failed") };
  });

  assert.equal(error, null);
  assert.deepEqual(calls, [undefined, { scope: "local" }]);
});

test("sign-out retries locally when the global attempt throws", async () => {
  const calls = [];
  const error = await signOutWithLocalFallback(async options => {
    calls.push(options);
    if (!options) throw new Error("global sign-out threw");
    return { error: null };
  });

  assert.equal(error, null);
  assert.deepEqual(calls, [undefined, { scope: "local" }]);
});

test("sign-out returns a thrown local failure for inline feedback", async () => {
  const localFailure = new Error("local sign-out threw");
  const error = await signOutWithLocalFallback(async options => {
    if (!options) return { error: new Error("global sign-out failed") };
    throw localFailure;
  });

  assert.equal(error, localFailure);
});

function createHarness() {
  const sessionCalls = [];
  const roleCalls = [];
  const profileCalls = [];
  const userCalls = [];
  const eodCalls = [];
  const events = [];

  const enqueue = (calls, userId) => {
    const pending = deferred();
    calls.push({ userId, ...pending });
    return pending.promise;
  };

  const loader = createAuthSessionLoader({
    getSessionUserId: () => enqueue(sessionCalls, null),
    loadRoles: userId => enqueue(roleCalls, userId),
    loadDisplayName: userId => enqueue(profileCalls, userId),
    loadUser: userId => enqueue(userCalls, userId),
    loadEodStatus: (userId, roles) => {
      const pending = deferred();
      eodCalls.push({ userId, roles, ...pending });
      return pending.promise;
    },
    onLoading: userId => events.push({ type: "loading", userId }),
    onSignedOut: () => events.push({ type: "signed-out" }),
    onCommit: account => events.push({ type: "commit", ...account }),
    onEodStatus: (userId, submitted) => events.push({ type: "eod", userId, submitted }),
    onAuthError: error => events.push({ type: "auth-error", message: error.message }),
    onEodError: (userId, error) => events.push({ type: "eod-error", userId, message: error.message }),
  });

  const resolveAccount = (index, userId, roles = ["student"], displayName = userId) => {
    roleCalls[index].resolve(roles);
    profileCalls[index].resolve(displayName);
    userCalls[index].resolve({ id: userId, email: `${userId.toLowerCase()}@example.com` });
  };

  return {
    loader,
    sessionCalls,
    roleCalls,
    profileCalls,
    userCalls,
    eodCalls,
    events,
    resolveAccount,
  };
}

test("sign-out invalidates a deferred initial session lookup", async () => {
  const h = createHarness();

  h.loader.refresh();
  h.loader.transition(null);
  h.sessionCalls[0].resolve("A");
  await flush();

  assert.equal(h.roleCalls.length, 0);
  assert.deepEqual(h.events, [{ type: "signed-out" }]);
});

test("landing intent survives a refresh superseded before session resolution", async () => {
  const h = createHarness();

  h.loader.refresh({ wantsLanding: true });
  h.loader.refresh();
  h.sessionCalls[0].resolve("A");
  await flush();
  assert.equal(h.roleCalls.length, 0);

  h.sessionCalls[1].resolve("A");
  await flush();
  h.resolveAccount(0, "A", ["setter"]);
  await flush();

  const commit = h.events.find(event => event.type === "commit");
  assert.equal(commit.user.id, "A");
  assert.equal(commit.shouldLand, true);
});

test("duplicate sign-in keeps B landing intent and never commits stale A or B work", async () => {
  const h = createHarness();

  h.loader.transition("A");
  h.resolveAccount(0, "A", ["setter"]);
  await flush();
  assert.equal(h.events.at(-1).type, "commit");
  assert.equal(h.events.at(-1).user.id, "A");

  h.loader.transition("B", { wantsLanding: true });
  h.loader.transition("B", { wantsLanding: true });
  h.resolveAccount(1, "B", ["student"]);
  await flush();
  assert.equal(h.events.filter(event => event.type === "commit").length, 1);

  h.resolveAccount(2, "B", ["student"]);
  await flush();

  const commits = h.events.filter(event => event.type === "commit");
  assert.equal(commits.length, 2);
  assert.equal(commits[1].user.id, "B");
  assert.equal(commits[1].shouldLand, true);
  assert.deepEqual(
    h.events.filter(event => event.type === "loading"),
    [{ type: "loading", userId: "B" }],
  );
});

test("a rapid A to B to A sign-in preserves A landing intent", async () => {
  const h = createHarness();

  h.loader.transition("A");
  h.resolveAccount(0, "A", ["setter"]);
  await flush();
  h.events.length = 0;

  h.loader.transition("B", { wantsLanding: true });
  h.loader.transition("A", { wantsLanding: true });
  h.resolveAccount(1, "B", ["student"]);
  h.resolveAccount(2, "A", ["setter"]);
  await flush();

  assert.deepEqual(
    h.events.filter(event => event.type === "commit"),
    [{
      type: "commit",
      userId: "A",
      user: { id: "A", email: "a@example.com" },
      roles: ["setter"],
      displayName: "A",
      shouldLand: true,
    }],
  );
});

test("EOD status is account-scoped and a submission beats an older query", async () => {
  const h = createHarness();

  h.loader.transition("A");
  h.resolveAccount(0, "A", ["setter"]);
  await flush();
  assert.equal(h.eodCalls.length, 1);

  assert.equal(h.loader.recordEodSubmitted("A"), true);
  h.eodCalls[0].resolve(false);
  await flush();

  h.loader.transition("B", { wantsLanding: true });
  assert.equal(h.loader.recordEodSubmitted("A"), false);
  h.resolveAccount(1, "B", ["student"]);
  await flush();
  assert.equal(h.loader.recordEodSubmitted("A"), false);
  assert.equal(h.loader.recordEodSubmitted("B"), true);
  h.eodCalls[1].resolve(false);
  await flush();

  assert.deepEqual(
    h.events.filter(event => event.type === "eod"),
    [
      { type: "eod", userId: "A", submitted: true },
      { type: "eod", userId: "B", submitted: true },
    ],
  );
});

test("auth query errors and verified-user mismatches fail closed", async () => {
  const h = createHarness();

  h.loader.transition("A");
  h.roleCalls[0].reject(new Error("roles unavailable"));
  h.profileCalls[0].resolve("A");
  h.userCalls[0].resolve({ id: "A" });
  await flush();

  assert.equal(h.events.some(event => event.type === "commit"), false);
  assert.deepEqual(h.events.at(-1), { type: "auth-error", message: "roles unavailable" });

  h.loader.transition("A");
  h.roleCalls[1].resolve(["student"]);
  h.profileCalls[1].resolve("A");
  h.userCalls[1].resolve({ id: "B" });
  await flush();

  assert.equal(h.events.filter(event => event.type === "commit").length, 0);
  assert.match(h.events.at(-1).message, /identity/i);
});

test("session lookup errors fail closed before account queries start", async () => {
  const h = createHarness();

  h.loader.refresh();
  h.sessionCalls[0].reject(new Error("session unavailable"));
  await flush();

  assert.equal(h.roleCalls.length, 0);
  assert.deepEqual(h.events, [{ type: "auth-error", message: "session unavailable" }]);
});

test("EOD lookup errors stay recoverable without invalidating the committed account", async () => {
  const h = createHarness();

  h.loader.transition("A");
  h.resolveAccount(0, "A", ["setter"]);
  await flush();
  h.eodCalls[0].reject(new Error("EOD unavailable"));
  await flush();

  assert.deepEqual(h.events.at(-1), {
    type: "eod-error",
    userId: "A",
    message: "EOD unavailable",
  });
  assert.equal(h.loader.recordEodSubmitted("A"), true);
});
