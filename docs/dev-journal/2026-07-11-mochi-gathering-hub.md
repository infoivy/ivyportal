# Log: Mochi Instagram CRM integration + The Room (dither charts, fireplace) + sidebar scroll

### Prompt
1. Integrate themochi.app (Instagram CRM) via its MCP so the dashboard shows live IG leads/conversations/DMs/comments; Close CRM later; ties into EODs eventually.
2. Rebuild the Gathering Hub as a cozy founder data room with tripwire.sh/dither-kit-style charts and a fireplace — all company data, simply.
3. Whop API key provided for the hub.
4. Replace the ugly native sidebar scrollbar with the shadcn ScrollArea.

### Issue
Mochi has no public REST API — only an OAuth-protected MCP endpoint. The portal needed server-side, auto-refreshing access to it, plus founder-facing surfaces for the data.

### What I did
- **OAuth**: Mochi's auth server supports RFC 7591 dynamic client registration + PKCE. Registered a client, ran a localhost:8765 callback flow (user approved in browser), stored access/refresh tokens + client id in `service_credentials` (admin-only RLS), alongside the provided `whop_api_key`.
- **Server layer** (`src/lib/mochi.functions.ts`): `callTool()` speaks JSON-RPC to the MCP (handles SSE-framed responses), auto-refreshes the 24h access token, persists rotated refresh tokens. Server functions: `getMochiStatus`, `getMochiDashboard` (funnel trend + message counts + source breakdown in parallel), `getMochiPayments` (Whop/Stripe net revenue synced through Mochi). All gated founder/admin.
- **Dashboard**: `MochiIgSection` — "Instagram · via Mochi · live" card (new leads, conversations, DMs in/out, comment leads, booked + dither sparkline), 7D/30D toggle, 5-min refetch.
- **Gathering Hub**: new default tab "The Room" (`src/components/founder/the-room.tsx`) — Doom-fire dithered fireplace canvas (`dither-fireplace.tsx`, ~15fps, reduced-motion → static frame, pauses when tab hidden), KPI card (cash MTD, IG leads 30d, content this cycle, Whop net 30d), four dither charts: weekly cash bars, daily IG leads area (zero-padded — Mochi only returns active days), team dials+DMs stacked area, content-posted bars / lead-source donut.
- **Dither charts**: vendored Boring-Software-Inc/dither-kit (MIT, 33 files) into `src/components/dither-kit/`; added deps `motion`, `d3-scale`, `d3-shape`. The npm `@dither-kit/core` package is an empty placeholder — the real source is the GitHub repo's shadcn registry.
- **Sidebar**: `SidebarContent` in `ui/sidebar.tsx` now wraps children in the existing Radix `ScrollArea` — native scrollbar gone on desktop sidebar and mobile sheet alike.

### How I did it
Probed the MCP with curl (401 → `.well-known/oauth-protected-resource` → authorization server metadata), registered via the open registration endpoint, one-shot node script for the PKCE dance. Enumerated all 40+ tools; sampled `get_funnel_trend`, `get_message_counts`, `get_lead_source_breakdown` to fix types. Followed the existing `close-crm.functions.ts` credential pattern. Verified with tsc + build + Playwright screenshots using a temporary founder account (`ui-check@isa.demo`, deleted after). Local preview must run with `--env-file=.env` — server functions need non-VITE `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`.

### What was challenging
- Mochi's OAuth lives under `/api/zapier/oauth/` and the docs site 403s scrapers; everything was discovered via RFC well-known endpoints.
- The MCP answers with a single SSE frame on POST — the parser handles both framings.
- `npm i --no-save playwright` gets pruned by any later `npm i` — reinstalled for screenshots.
- Mochi trend data omits zero days; charts needed client-side zero-padding to read correctly with sparse data.

### Future work
- **EOD tie-in (user called it "absolute")**: pull per-setter DM/lead counts (`get_setter_metrics`, `get_member_metrics`) into the EOD form as prefill/verification.
- Close CRM second view: /crm already exists on API key; unify into a two-CRM switcher when he's ready.
- Direct Whop API integration (key stored) if Mochi's synced payment data proves insufficient.
- A "connect Mochi" admin UI for token re-auth without a terminal (tokens die if refresh fails repeatedly).
- Vercel env vars must include the SUPABASE_* server names (already true in prod for Close to work).
