import { createFileRoute } from "@tanstack/react-router";
import {
  verifyState,
  exchangeCodeForTokens,
  decodeIdTokenEmail,
  getRedirectUri,
  pickColorForIndex,
} from "@/lib/calendar.server";

export const Route = createFileRoute("/api/public/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const origin = url.origin;

        if (err) {
          return Response.redirect(`${origin}/calendar?connect=denied`, 302);
        }
        if (!code || !state) {
          return Response.redirect(`${origin}/calendar?connect=missing`, 302);
        }

        let userId: string;
        try {
          ({ userId } = verifyState(state));
        } catch (e) {
          console.error("[google-oauth] state verify failed", e);
          return Response.redirect(`${origin}/calendar?connect=invalid_state`, 302);
        }

        try {
          const redirectUri = getRedirectUri(request.url);
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            return Response.redirect(`${origin}/calendar?connect=no_refresh`, 302);
          }
          const email = decodeIdTokenEmail(tokens.id_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Count existing connections to assign a stable color
          const { count } = await supabaseAdmin
            .from("calendar_connections")
            .select("id", { count: "exact", head: true });
          const color = pickColorForIndex(count ?? 0);

          const { error: upsertErr } = await supabaseAdmin
            .from("calendar_connections")
            .upsert(
              {
                user_id: userId,
                provider: "google",
                google_email: email,
                calendar_id: "primary",
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                access_token_expires_at: expiresAt,
                scope: tokens.scope,
                color_hex: color,
                connected_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
          if (upsertErr) {
            console.error("[google-oauth] upsert failed", upsertErr);
            return Response.redirect(`${origin}/calendar?connect=db_error`, 302);
          }
          return Response.redirect(`${origin}/calendar?connect=ok`, 302);
        } catch (e) {
          console.error("[google-oauth] exchange failed", e);
          return Response.redirect(`${origin}/calendar?connect=exchange_failed`, 302);
        }
      },
    },
  },
});
