import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { EmailCard, PasswordCard, OrgCard } from "@/components/account-settings";
import { toast } from "sonner";
import { UserCircle, Save, Camera, Upload, Trash2 } from "lucide-react";
import { signAvatar, uploadAvatar } from "@/lib/avatars";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ISA" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_path")
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setDisplayName(data?.display_name ?? "");
        const p = (data as any)?.avatar_path ?? null;
        setAvatarPath(p);
        setAvatarSignedUrl(await signAvatar(p));
      });
  }, [user]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const path = await uploadAvatar(user.id, f);
      const { error } = await supabase.from("profiles").update({ avatar_path: path } as any).eq("id", user.id);
      if (error) throw error;
      setAvatarPath(path);
      setAvatarSignedUrl(await signAvatar(path));
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarPath) return;
    await supabase.storage.from("avatars").remove([avatarPath]);
    await supabase.from("profiles").update({ avatar_path: null } as any).eq("id", user.id);
    setAvatarPath(null);
    setAvatarSignedUrl(null);
    toast.success("Avatar removed");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-display text-foreground">Profile</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{user?.email} · {roles.join(" · ") || "member"}</p>
      </header>

      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-md border border-[var(--border)] bg-[var(--accent)] overflow-hidden flex items-center justify-center text-2xl font-semibold text-muted-foreground shrink-0">
            {avatarSignedUrl ? <img src={avatarSignedUrl} alt="" className="h-full w-full object-cover" /> : (displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[12px] text-muted-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" /> Profile picture
            </label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs bg-[var(--accent)] hover:bg-[#232935] border border-[#2a3140] px-3 py-1.5 rounded-sm"
              >
                <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload image"}
              </button>
              {avatarPath && (
                <button onClick={removeAvatar} className="flex items-center gap-1 text-xs text-danger-fg hover:text-danger-fg px-2 py-1.5">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">PNG or JPG, up to 5MB.</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
          />
        </div>

        {/* Password changes live in the PasswordCard below — one control, proper input */}
        <div className="flex items-center justify-end pt-3 border-t border-[var(--border)]">
          <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 py-1.5 rounded-sm text-xs">
            <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Account + org management — absorbed from the removed Settings page */}
      <EmailCard currentEmail={user?.email ?? ""} />
      <PasswordCard />
      {roles.some((r) => ["admin", "founder"].includes(r)) && <OrgCard userId={user?.id ?? null} />}
    </div>
  );
}
