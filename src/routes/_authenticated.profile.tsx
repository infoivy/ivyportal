import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { EmailCard, PasswordCard, OrgCard } from "@/components/account-settings";
import { toast } from "sonner";
import { UserCircle, Save, Camera, Upload, Trash2 } from "lucide-react";
import { signAvatar, uploadAvatar } from "@/lib/avatars";
import { syncStudentTimezone } from "@/lib/student-timezone.functions";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · ISA" }] }),
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

      {/* Students: their timezone drives staff scheduling and the weekly
          EOD auto-submit — editable here after the first-login confirmation */}
      <StudentTimezoneCard />

      {/* Team members: phone + timezone so the founder can reach people at
          sane hours and see everyone's local time on the Team page */}
      <TeamContactCard />

      {/* Account + org management — absorbed from the removed Settings page */}
      <EmailCard currentEmail={user?.email ?? ""} />
      <PasswordCard />
      {roles.some((r) => ["admin", "founder"].includes(r)) && <OrgCard userId={user?.id ?? null} />}
    </div>
  );
}

/**
 * Staff contact details: phone (E.164, validated) and timezone. Renders only
 * for team-role holders; students have their own timezone card and submit
 * WhatsApp through the portal gate.
 */
function TeamContactCard() {
  const { user, roles } = useAuth();
  const isTeam = roles.some(r => ["admin", "founder", "cofounder", "closer", "setter", "coach", "csm"].includes(r));
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile-team-contact", user?.id],
    enabled: !!user && isTeam,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("phone, timezone" as never).eq("id", user!.id).maybeSingle();
      return (data ?? { phone: null, timezone: null }) as unknown as { phone: string | null; timezone: string | null };
    },
  });
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [tz, setTz] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!q.data || hydrated) return;
    setPhone(q.data.phone ?? undefined);
    setTz(q.data.timezone ?? "");
    setHydrated(true);
  }, [q.data, hydrated]);
  if (!isTeam || !q.data) return null;

  const missing = !q.data.phone || !q.data.timezone;
  const savePhone = async (next: string | undefined) => {
    setPhone(next);
    if (next && !isValidPhoneNumber(next)) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ phone: next ?? null } as never).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile-team-contact"] });
    qc.invalidateQueries({ queryKey: ["page", "team"] });
  };
  const saveTz = async (next: string) => {
    setTz(next);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ timezone: next } as never).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Timezone saved");
    qc.invalidateQueries({ queryKey: ["profile-team-contact"] });
    qc.invalidateQueries({ queryKey: ["page", "team"] });
  };

  return (
    <div className="card-surface p-5 space-y-4">
      <div>
        <div className="text-sm font-medium">Contact & timezone</div>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {missing
            ? "Add your phone number and timezone so the team can reach you at sane hours."
            : "The Team page shows your current local time from this."}
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-[12px] text-muted-foreground">Phone (WhatsApp)</label>
        <div className="max-w-sm">
          <PhoneInput value={phone} onChange={savePhone} placeholder="Your number" />
        </div>
        {phone && !isValidPhoneNumber(phone) && (
          <p className="text-[11px] text-danger-fg">That number doesn't look complete yet.</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-[12px] text-muted-foreground">Timezone</label>
        <div className={`max-w-sm ${saving ? "opacity-60 pointer-events-none" : ""}`}>
          <TimezoneCombobox value={tz} onChange={next => { if (next && next !== tz) void saveTz(next); }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Students set their timezone at first portal open; this is where they change
 * it later (moved cities, travelling). Renders nothing for non-students.
 */
function StudentTimezoneCard() {
  const { user } = useAuth();
  const syncTzFn = useServerFn(syncStudentTimezone);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile-student-tz", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, timezone").eq("user_id", user!.id).maybeSingle();
      return data ?? null;
    },
  });
  const [saving, setSaving] = useState(false);
  if (!q.data) return null;
  const tz = q.data.timezone;
  return (
    <div className="card-surface p-5 space-y-3">
      <div>
        <div className="text-sm font-medium">Your timezone</div>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Your coach and success team use this to reach you at sane hours. Moved or travelling? Update it here.
        </p>
      </div>
      <div className={`max-w-sm ${saving ? "opacity-60 pointer-events-none" : ""}`}>
        <TimezoneCombobox
          value={tz ?? ""}
          onChange={async next => {
            if (!next || next === tz) return;
            setSaving(true);
            try {
              await syncTzFn({ data: { timezone: next } });
              toast.success("Timezone updated");
              qc.invalidateQueries({ queryKey: ["profile-student-tz"] });
            } catch (err) {
              toast.error(String((err as Error).message ?? err));
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    </div>
  );
}
