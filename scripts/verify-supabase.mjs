const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

const expectedTables = [
  'calendar_connections', 'commission_rates', 'content_hooks', 'content_ideas',
  'content_items', 'content_week_ideas', 'content_week_plans', 'crm_lead_notes',
  'csm_student_notes', 'csm_tally', 'deals', 'docs', 'eods', 'founder_settings',
  'ig_connections', 'ig_dashboards', 'ig_monthly_snapshots', 'ig_top_reels',
  'installment_payments', 'installments', 'notes', 'onboarding_progress',
  'onboarding_templates', 'payment_links', 'payout_confirmations', 'profiles', 'service_credentials',
  'student_action_items', 'student_calls', 'student_eods', 'student_weekly_eods', 'students',
  'testimonials', 'user_roles',
];

const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/verify_security_schema`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});

if (!response.ok) {
  console.error(`Security schema check failed (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const rows = await response.json();
const byName = new Map(rows.map((row) => [row.table_name, row]));
const missing = expectedTables.filter((table) => !byName.has(table));
const unprotected = expectedTables.filter((table) => {
  const row = byName.get(table);
  return row && (!row.rls_enabled || Number(row.policy_count) < 1);
});

if (missing.length || unprotected.length) {
  if (missing.length) console.error(`Missing tables: ${missing.join(', ')}`);
  if (unprotected.length) console.error(`Missing RLS or policies: ${unprotected.join(', ')}`);
  process.exit(1);
}

console.log(`Verified ${expectedTables.length} application tables: RLS is enabled and each has at least one policy.`);
