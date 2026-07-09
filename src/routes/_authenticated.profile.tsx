import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { UserCircle, Save, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ISA" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      setDisplayName(data?.display_name ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  const changePassword = async () => {
    const pw = prompt("Enter new password (min 8 chars):");
    if (!pw || pw.length < 8) return;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <header className="border-b border-[#1f2530] pb-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1 flex items-center gap-1">
          <UserCircle className="h-3 w-3" /> Account
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{user?.email} · {roles.join(" · ") || "member"}</p>
      </header>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-md border border-[#1f2530] bg-[#1a1f29] overflow-hidden flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" /> Avatar URL
            </label>
            <input
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs focus:outline-none focus:border-emerald-500/40"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full h-9 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-sm focus:outline-none focus:border-emerald-500/40"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#1f2530]">
          <button onClick={changePassword} className="text-xs text-muted-foreground hover:text-foreground">
            Change password
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium px-3 py-1.5 rounded-sm text-xs">
            <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
