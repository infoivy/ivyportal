import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
          <div className="h-20 w-20 rounded-md border border-[#1f2530] bg-[#1a1f29] overflow-hidden flex items-center justify-center text-2xl font-bold text-muted-foreground shrink-0">
            {avatarSignedUrl ? <img src={avatarSignedUrl} alt="" className="h-full w-full object-cover" /> : (displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" /> Profile picture
            </label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs bg-[#1a1f29] hover:bg-[#232935] border border-[#2a3140] px-3 py-1.5 rounded-sm"
              >
                <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload image"}
              </button>
              {avatarPath && (
                <button onClick={removeAvatar} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1.5">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">PNG or JPG, up to 5MB.</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full h-9 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-sm focus:outline-none focus:border-green-500/40"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#1f2530]">
          <button onClick={changePassword} className="text-xs text-muted-foreground hover:text-foreground">
            Change password
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-green-950 font-medium px-3 py-1.5 rounded-sm text-xs">
            <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
