const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

const expectedTables = [
  'audit_log', 'business_expenses', 'calendar_connections', 'commission_rates',
  'content_hooks', 'content_ideas', 'content_items', 'content_week_ideas',
  'content_week_plans', 'crm_lead_notes', 'csm_student_notes', 'csm_tally',
  'deals', 'docs', 'eod_correction_archive', 'eods', 'founder_settings',
  'ig_connections', 'ig_dashboards', 'ig_monthly_snapshots', 'ig_top_reels',
  'installment_payments', 'installments', 'invitations', 'kpi_targets', 'notes',
  'onboarding_progress', 'onboarding_templates', 'org_settings', 'payment_links',
  'payout_adjustments', 'payout_confirmations', 'profiles', 'role_access',
  'service_credentials', 'set_follow_ups', 'set_reminder_events', 'set_reminders',
  'setter_daily_logs', 'student_action_items', 'student_alerts',
  'student_call_attendance', 'student_calls', 'student_checkins', 'student_eods',
  'student_guide_steps', 'student_milestone_progress', 'student_milestones',
  'student_placements', 'student_weekly_eods', 'students', 'team_chat',
  'testimonials', 'training_videos', 'user_roles', 'wallet_entries',
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
