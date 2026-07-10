import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You can't delete your own account here.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.active) {
      throw new Error("You can't deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ban / unban via auth admin
    const banDuration = data.active ? "none" : "876000h"; // ~100 years
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: banDuration,
    } as any);
    if (banErr) throw new Error(banErr.message);
    // Flip flag on profiles
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (profErr) throw new Error(profErr.message);
    return { ok: true };
  });

/**
 * Team roster for assignment pickers. Any business-role holder may call it —
 * RLS hides other people's user_roles rows from non-admins, so this goes
 * through the server after verifying the caller is staff.
 */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: myRoles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const staff = (myRoles ?? []).some((r) =>
      ["admin", "founder", "closer", "setter", "coach", "csm"].includes(r.role as string));
    if (!staff) throw new Error("staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("user_id, role")
      .in("role", ["admin", "closer", "setter", "coach", "csm"]);
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [] as { id: string; name: string }[];
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, display_name, active").in("id", ids);
    return (profs ?? [])
      .filter((p) => (p as { active?: boolean }).active !== false)
      .map((p) => ({ id: p.id, name: p.display_name ?? "Unnamed" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
