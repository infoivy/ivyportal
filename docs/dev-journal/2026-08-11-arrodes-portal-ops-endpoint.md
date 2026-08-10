# 2026-08-11 · Arrodes Portal ops endpoint

## Why

Vercel correctly prevents Sensitive environment variables from being pulled into a local operator runtime. The existing local report therefore received only a redaction placeholder for the Supabase service-role key and failed with `Invalid API key`.

## Change

- Added `GET /api/agent/v1/portal-ops` as a narrow server-side reporting boundary.
- Protected the endpoint with the revocable `ARRODES_API_TOKEN` bearer stored only in Vercel Sensitive environment configuration and the approved local secret store.
- Compared bearer digests with `timingSafeEqual` and returned generic unauthorized/error responses.
- Kept the Supabase service-role client in a dynamically imported `.server.ts` module.
- Added `Cache-Control: no-store`.
- Returned aggregate operational data only: EOD coverage, EOD activity, setter KPI state, and week-to-date logged deals.
- Excluded demo profiles, demo EODs, demo deals, inactive profiles from active-team denominators, and voided deals.
- Resolved each member's EOD day in that member's profile timezone; missing or invalid timezones are reported as unknown and are never counted as missing EODs.
- Omitted email addresses, EOD narrative fields, student/customer records, credentials, and raw database rows.

## Verification

- Focused endpoint contract: passed.
- TypeScript: passed.
- ESLint: passed with one inherited warning in `home-setter-week.tsx`.
- Production build: passed and generated the route tree.
- `git diff --check`: passed.
- Untouched `origin/main` baseline has one existing weekly-EOD source-contract failure in `portal-reliability-contract.test.mjs`; the endpoint did not introduce or alter it.
- Production dependency audit reports two inherited high advisories in transitive `js-yaml` and `nanoid`; this change does not modify dependencies.

## Release notes

No database migration is required. Production acceptance must verify unauthenticated `401`, authenticated `200`, `data_mode: real_only`, and the canonical `portal.ivysalesacademy.com` route before monitoring is enabled.
