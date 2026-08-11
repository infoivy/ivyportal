import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { EmailCard, PasswordCard, OrgCard } from "@/components/account-settings";
import { toast } from "sonner";
import { Camera, Mail, Save, Trash2, Upload } from "lucide-react";
import { signAvatar, uploadAvatar } from "@/lib/avatars";
import { syncStudentTimezone } from "@/lib/student-timezone.functions";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · ISA" }] }),
  component: ProfilePage,
});

/**
 * One "Personal information" card with everything identity: avatar, name,
 * contact, timezone, email, member-since. Security (password, org) sits
 * behind a second tab (founder reference 2026-07-29: S.O.K.-style profile).
 */
function ProfilePage() {
  const { user, roles } = useAuth();
  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [displayName, setDisplayName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isTeam = roles.some(r => ["admin", "founder", "cofounder", "closer", "setter", "coach", "csm"].includes(r));

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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f || !user) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    // Crop first (founder 2026-07-29): pick the visible area, then upload.
    setCropFile(f);
  };

  const uploadCropped = async (f: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const path = await uploadAvatar(user.id, f);
      const { error } = await supabase.from("profiles").update({ avatar_path: path } as any).eq("id", user.id);
      if (error) throw error;
      setAvatarPath(path);
      setAvatarSignedUrl(await signAvatar(path));
      setCropFile(null);
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
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

  const memberSince = user?.created_at ? format(new Date(user.created_at), "MMMM d, yyyy") : null;

  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-display text-foreground">Profile & settings</h1>
        <p className="text-body text-muted-foreground mt-1">{roles.map(r => r === "cofounder" ? "co-founder" : r).join(" · ") || "member"}</p>
      </header>

      <div className="inline-flex rounded-lg bg-muted p-[3px]">
        {(["profile", "security"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[13px] font-medium px-4 py-1.5 rounded-[8px] capitalize motion-safe:transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {cropFile && (
        <AvatarCropDialog file={cropFile} onCancel={() => setCropFile(null)} onCropped={uploadCropped} />
      )}

      {tab === "profile" ? (
        <section className="card-soft overflow-hidden">
          <div className="px-5 pt-5">
            <h2 className="text-title text-foreground">Personal information</h2>
            <p className="text-caption text-muted-foreground mt-0.5">Manage how you appear across the portal.</p>
          </div>

          <div className="p-5 flex flex-col sm:flex-row gap-6">
            <div className="shrink-0">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <div className="relative group h-24 w-24">
                <div className="h-24 w-24 rounded-full border border-[var(--border)] bg-[var(--accent)] overflow-hidden grid place-items-center text-2xl font-medium text-muted-foreground">
                  {avatarSignedUrl ? <img src={avatarSignedUrl} alt="" className="h-full w-full object-cover" /> : (displayName || "?").slice(0, 1).toUpperCase()}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change photo"
                  className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload"}
                </button>
                {avatarPath && (
                  <button onClick={removeAvatar} className="inline-flex items-center gap-1 text-danger-fg hover:underline">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 grid sm:grid-cols-2 gap-4 content-start">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[12px] text-muted-foreground">Display name</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
                />
              </div>
              {isTeam ? <TeamContactFields /> : <StudentTimezoneField />}
            </div>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3.5 py-3 flex flex-wrap items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground min-w-0 truncate">{user?.email}</span>
              <button
                onClick={() => setEmailOpen(v => !v)}
                className="ml-auto text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--border)] text-muted-foreground hover:text-foreground hover:border-ring/50 motion-safe:transition-colors"
              >
                {emailOpen ? "Cancel" : "Change email"}
              </button>
            </div>
            {emailOpen && <EmailCard currentEmail={user?.email ?? ""} />}
          </div>

          <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">{memberSince ? `Member since ${memberSince}` : ""}</span>
            <button onClick={save} disabled={saving} className="pressable flex items-center gap-1.5 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 rounded-xl text-[13px] disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          <PasswordCard />
          {roles.some((r) => ["admin", "founder"].includes(r)) && <OrgCard userId={user?.id ?? null} />}
        </div>
      )}
    </div>
  );
}

/**
 * Staff contact details as fields of the personal-information card: phone
 * (E.164, validated, autosaves) and timezone (autosaves). The Team page
 * shows everyone's local time from these.
 */
function TeamContactFields() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile-team-contact", user?.id],
    enabled: !!user,
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
  if (!q.data) return null;

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
    <>
      <div className="space-y-1.5">
        <label className="text-[12px] text-muted-foreground">Phone (WhatsApp)</label>
        <PhoneInput value={phone} onChange={savePhone} placeholder="Your number" />
        {phone && !isValidPhoneNumber(phone) && (
          <p className="text-[11px] text-danger-fg">That number doesn't look complete yet.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] text-muted-foreground">Timezone</label>
        <div className={saving ? "opacity-60 pointer-events-none" : ""}>
          <TimezoneCombobox value={tz} onChange={next => { if (next && next !== tz) void saveTz(next); }} />
        </div>
        <p className="text-[11px] text-muted-foreground">The Team page shows your current local time from this.</p>
      </div>
    </>
  );
}

/**
 * Students set their timezone at first portal open; this is where they change
 * it later (moved cities, travelling). Renders nothing for non-students.
 */
function StudentTimezoneField() {
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
    <div className="space-y-1.5">
      <label className="text-[12px] text-muted-foreground">Timezone</label>
      <div className={saving ? "opacity-60 pointer-events-none" : ""}>
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
      <p className="text-[11px] text-muted-foreground">Your coach and success team use this to reach you at sane hours.</p>
    </div>
  );
}
