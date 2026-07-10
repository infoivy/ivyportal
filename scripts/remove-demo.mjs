/**
 * Remove all demo data created by seed-demo.mjs.
 * Deletes rows where is_demo=true and removes demo auth users.
 *
 * Usage: node --env-file=.env scripts/remove-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_SUFFIX = "@isa.demo";

// Delete demo rows from data tables (order matters for FK constraints)
const TABLES = ["student_action_items", "eods", "deals", "ig_monthly_snapshots", "students"];

console.log("Removing demo data…");
for (const table of TABLES) {
  const { error, count } = await sb.from(table).delete({ count: "exact" }).eq("is_demo", true);
  if (error) console.error(`  ✗ ${table}: ${error.message}`);
  else console.log(`  ✓ ${table}: ${count ?? "?"} rows deleted`);
}

// Remove demo auth users by email suffix
console.log("Removing demo auth users…");
const { data: { users }, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error("Could not list users:", listErr.message); process.exit(1); }

const demoUsers = users.filter(u => u.email?.endsWith(DEMO_SUFFIX));
for (const u of demoUsers) {
  const { error } = await sb.auth.admin.deleteUser(u.id);
  if (error) console.error(`  ✗ ${u.email}: ${error.message}`);
  else console.log(`  ✓ ${u.email} deleted`);
}

if (demoUsers.length === 0) console.log("  (no demo users found)");
console.log("\n✅ Demo teardown complete.");
