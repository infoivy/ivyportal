import { createServerFn } from "@tanstack/react-start";

/**
 * Email/password signup that works without a confirmation email.
 *
 * Supabase's "Confirm email" setting plus its rate-limited built-in mailer
 * meant email signups were created but could never sign in (the link never
 * arrived). The portal is approval-gated anyway — accounts have no role and
 * see nothing until an admin/closer/CSM places them — so confirmation adds
 * no security here. This creates the account pre-confirmed via the admin
 * API; the client signs in with the password immediately after.
 */
export const signUpEmail = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; fullName?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    return { email, password, fullName: String(input?.fullName ?? "").trim().slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
    });
    if (error) {
      if (/already|exists|registered/i.test(error.message)) {
        throw new Error("An account with this email already exists · try signing in instead.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
