# Ivy Content

Private founder-only content growth operating system for `content.ivysalesacademy.com`.

This is a standalone app. It does not import from, route through, or deploy with the main Ivy Portal.

## Local app

```bash
cp .env.example .env
npm install
npm run dev
```

Without Supabase environment variables the app runs with representative local demo data for design review. With variables configured, sign-in, content records, metrics, audit history, and the AI operator use the standalone Supabase project.

## Create the standalone Supabase project

1. Create a new project in Supabase and create the founder user under Authentication.
2. From this directory, link and migrate:

```bash
npx supabase link --project-ref YOUR_CONTENT_PROJECT_REF
npx supabase db push
```

3. In Supabase SQL Editor, add only the founder:

```sql
insert into public.founder_access(user_id)
select id from auth.users where email = 'YOUR_FOUNDER_EMAIL';
```

4. Keep public signups disabled. Add `https://content.ivysalesacademy.com` as the Site URL and redirect URL.
5. Configure Edge Function secrets and deploy it:

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-5.4-mini
npx supabase functions deploy content-operator
```

6. Put the standalone project's URL and publishable key into Vercel using the names in `.env.example`.

## Deploy

Create a separate Vercel project with its Root Directory set to `content-portal`, then attach `content.ivysalesacademy.com`. Do not attach that domain to the main portal project.

The OpenAI key belongs only in Supabase Edge Function secrets. It must never be a `VITE_` variable or a Vercel browser variable.
