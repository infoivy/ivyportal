import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const routeUrl = new URL("src/routes/api/agent/v1/portal-ops.ts", root);
const serviceUrl = new URL("src/lib/portal-ops.server.ts", root);

test("Portal ops agent endpoint is bearer-protected, server-only, and real-only", () => {
  assert.equal(existsSync(routeUrl), true, "agent route must exist");
  assert.equal(existsSync(serviceUrl), true, "server-only report service must exist");

  const route = readFileSync(routeUrl, "utf8");
  const service = readFileSync(serviceUrl, "utf8");

  assert.match(route, /createFileRoute\("\/api\/agent\/v1\/portal-ops"\)/);
  assert.match(route, /GET:\s*async/);
  assert.doesNotMatch(route, /POST:|PUT:|PATCH:|DELETE:/);
  assert.match(route, /import\("@\/lib\/portal-ops\.server"\)/);
  assert.match(route, /"cache-control":\s*"no-store"/i);

  assert.match(service, /process\.env\.ARRODES_API_TOKEN/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /authorization/i);
  assert.match(service, /Bearer /);
  assert.doesNotMatch(service, /console\.(?:log|error)\([^\n]*(?:token|authorization)/i);

  assert.match(service, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(service, /from\("eods"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(service, /from\("deals"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(service, /data_mode:\s*"real_only"/);
  assert.doesNotMatch(service, /\.(?:insert|upsert|delete)\(/);
  assert.doesNotMatch(service, /\.from\([^)]*\)[\s\S]{0,500}?\.update\(/);
});
