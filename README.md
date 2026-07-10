# Ivy Portal

The Ivy Sales Academy internal hub for EOD reporting, team operations, student success, revenue/installments, knowledge, and founder content planning.

## Run locally

```bash
npm ci
cp .env.example .env
# Add the values from your Supabase project to .env
npm run dev
```

Open the local URL Vite prints. Production runs at `https://portal.ivysalesacademy.com`.

## Environment variables

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed by the browser app. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` support server/maintenance scripts. `SUPABASE_SERVICE_ROLE_KEY` is only for local scripts and Vercel server environment variables; never commit it or expose it to the browser.

## Database and deployment

The project is linked to its own Supabase project. Apply schema changes by adding a migration under `supabase/migrations/`, then run:

```bash
npx supabase db push
npm run supabase:verify
```

Vercel builds the app with `npm run build`. Configure the same production environment variables in Vercel. After any deployment, use the verification checklist below and see [docs/DATABASE.md](docs/DATABASE.md) for the data model.

## First account and roles

In a clean database, the first person to sign up receives `admin` and `founder`. Every later team member needs a role granted by an admin:

```bash
npm run roles:grant -- person@example.com setter
```

Use one of: `admin`, `founder`, `closer`, `setter`, `csm`, `coach`, or `student`.

## Production smoke test

1. Open `https://portal.ivysalesacademy.com` and create/sign in to the founder account.
2. Confirm Dashboard, EODs, Team, Students, Revenue, Installments, Knowledge, and Founder Hub load for the intended roles.
3. Submit one current-day test EOD and confirm it appears in the dashboard/team view.
4. Open one student and verify a payment-link copy action works.
5. Confirm Founder Hub loads only for founder/admin and payment details only for closer/admin.
6. Run `npm run build`, `npx tsc --noEmit`, and `npm run supabase:verify` locally after database/app changes.

## Important rules

See [AGENTS.md](AGENTS.md) for the non-negotiable EOD, commission, content-cadence, access-control, and historical-record rules. See [docs/ROADMAP.md](docs/ROADMAP.md) for parked ideas.
