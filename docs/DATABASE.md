# Ivy Portal database

The application database lives in Supabase `public`. The migration history in `supabase/migrations/` is authoritative. All application tables below have row-level security (RLS) enabled; do not replace a policy with a broad authenticated-user policy without checking the associated role gate.

## Roles and auth

`profiles` is created for every Supabase auth user by `handle_new_user`. The first profile in a brand-new database is granted both `admin` and `founder`; later people begin role-less. `user_roles` stores the many-to-many role assignments. Roles are `admin`, `founder`, `closer`, `setter`, `csm`, `coach`, and `student`.

| Table | Purpose | RLS in plain language |
| --- | --- | --- |
| `profiles` | Names, avatar, phone, and team preferences. | Signed-in users can read profiles and update their own; admins may update any profile. |
| `user_roles` | Role assignments. | People can read their own roles; admins can read and manage all assignments. |
| `eods` | Team daily end-of-day KPIs and notes. | A user manages their own reports; admins and closers can read the team reports. |
| `notes` | Personal/team call notes. | A user manages their own notes; admins and closers can read all notes. |
| `calendar_connections` | Per-user calendar OAuth connection metadata. | Each user manages their own connection; admins and closers can view team connections. |

## Revenue and team operations

| Table | Purpose | RLS in plain language |
| --- | --- | --- |
| `deals` | Closed deals, value, cash, closer, setter, and student association. | Admins have full access; team members can read; closers/coaches can create and update their permitted records. |
| `commission_rates` | Configurable commission rates and thresholds. | Signed-in staff may read; admins manage rates. |
| `payment_links` | Student payment-link details. | Closers and admins manage these sensitive records. |
| `installments` | Installment-plan headers. | Staff can read/create/update; only admins delete. |
| `installment_payments` | Individual planned/paid installment entries. | Staff can read/create/update; only admins delete. |
| `crm_lead_notes` | CRM lead notes and follow-up context. | Authorized team members read; authors/admins manage the allowed records. |
| `service_credentials` | Operational service credentials/configuration. | Admin-only read and write. Never expose the values in frontend code or logs. |

## Student success

| Table | Purpose | RLS in plain language |
| --- | --- | --- |
| `students` | Student profile, phase, status, coach, and programme information. | Team can read; students can read their own record; admins/coaches create and update; only admins delete. |
| `student_calls` | Scheduled and completed coaching calls. | Team can read; students can read their own calls; admins/coaches create, update, and delete. |
| `student_eods` | Student daily self-reports. | Team can read; students submit and correct their own metrics; admins/coaches may insert or correct. Authenticated deletion is revoked, and row ID, student, report date, and creation time are immutable. |
| `student_weekly_eods` | Weekly student accountability: group-call attendance, implementation, blockers, wins, and next commitment. | Students read/submit/update only their own; fulfillment roles read; admins may correct. No student delete policy. |
| `student_action_items` | Action items derived from student calls. | Staff manage items for the student workflow; the secure toggle function supports a student changing an allowed item. |
| `csm_student_notes` | CSM observations and follow-ups. | CSM/admin team can read; CSMs create their own; authors may update/delete their own and admins can manage all. |
| `csm_tally` | CSM activity counts (loom, roleplay, check-in, escalation). | CSMs/admins can read; CSMs add their own rows; owners/admins update and delete. |
| `testimonials` | Student testimonial status, file reference, and request tracking. | Staff can read/create/update; only admins delete. |

## Knowledge, onboarding, and content

| Table | Purpose | RLS in plain language |
| --- | --- | --- |
| `docs` | Internal knowledge-base pages with role visibility. | Signed-in people can read documents visible to their role; admins manage the library. |
| `onboarding_templates` | Role-specific onboarding checklists. | Signed-in people read templates; admins manage them. |
| `onboarding_progress` | A user’s completion state for onboarding tasks. | People manage their own progress; admins can view all progress. |
| `content_items` | Founder content pipeline, scripts, assets, scheduling, and post metrics. | Founder/admin-only management. |
| `content_hooks` | Reusable content hooks and examples. | Founder/admin-only management. |
| `content_ideas` | Content-idea inbox and promotion state. | Founder/admin-only management. |
| `content_week_ideas` | Two-week content planning ideas. | Founder/admin-only management. |
| `content_week_plans` | Weekly content plan and cadence. | Founder/admin-only management. |
| `founder_settings` | Founder Hub settings and operational preferences. | Founder/admin-only management. |
| `ig_connections` | Instagram connection configuration. | A founder manages only their own connection. |
| `ig_dashboards` | Per-founder Instagram dashboard state. | A founder manages only their own dashboard. |
| `ig_monthly_snapshots` | Monthly Instagram analytics snapshots. | Founder/admin-only access. |
| `ig_top_reels` | Top-reel analytics entries. | Founder/admin-only access. |

## Functions and triggers

- `has_role(user_id, role)`: security-definer role check used by RLS. Keep it as the database source of truth.
- `handle_new_user()`: auth trigger creating the profile and assigning the first account `admin` plus `founder`.
- `link_student_on_signup()`: links a student login to its student record when the matching workflow applies.
- `student_toggle_action_item(call_id, index, done)`: narrowly scoped student action-item update.
- `deals_prevent_reassignment()`: protects deal ownership/reassignment rules.
- `testimonial_sync_student_flags()`: synchronizes testimonial status to the related student flags.
- `protect_student_eod_history_identity()`: prevents daily EOD ownership, report-date, and creation-history rewrites.
- `protect_student_weekly_eod_history()`: prevents weekly EOD identity and submission-history rewrites.
- `set_updated_at()` and `update_updated_at_column()`: shared update timestamp helpers.
- `verify_security_schema()`: service-role-only, read-only check used by `npm run supabase:verify`; it returns table/RLS/policy metadata and no application rows.

`on_auth_user_created` and `on_auth_user_link_student` are the auth triggers. Most operational tables also have an `updated_at` trigger, including profiles, EODs, student records/calls/EODs/action items, revenue/installments, knowledge, content planning, Instagram, calendar connections, testimonials, and CSM notes.

## Storage buckets

| Bucket | Use | Access |
| --- | --- | --- |
| `avatars` | Private user avatar images. | A signed-in user can read their own avatar; do not make avatars public. |
| `testimonials` | Testimonial uploads. | Staff can read/upload; only admins delete. |

## Deployment verification

Run `npm run supabase:verify` with local `.env`. It calls the service-role-only verification function and fails if any of the 33 application tables is missing, has RLS disabled, or has no policy. This is a structural check; it does not replace role-by-role human testing.
