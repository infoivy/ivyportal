import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { timeIn } from "@/components/student-local-time";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { DateField } from "@/components/ui/date-field";
import { toast } from "sonner";
import {
  Users, Shield, Phone, UserCircle2, GraduationCap, Pencil, X, HeartHandshake, Sparkles, School,
  Upload, Trash2, PowerOff, Power, UserPlus, Copy, Check,
} from "lucide-react";
import { signAvatars, uploadAvatar } from "@/lib/avatars";
import { deleteTeamMember, setMemberActive, approveAsStudent } from "@/lib/team-admin.functions";
import { fetchAllTemplates, progressPercent, type OnboardingTemplate } from "@/lib/onboarding";
import { InvitationsCard, InviteModal, ROLES, roleLabel, type AppRole, type SetterType } from "@/components/invite-modal";
import { TeamActivityLog } from "@/components/team-activity-log";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · ISA" }] }),
  component: TeamPage,
});

type Member = {
  timezone: string | null;
  base_pay_day: number;
  started_on: string | null;
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  phone: string | null;
  base_pay_monthly: number | null;
  csm_daily_target: number | null;
  eod_exempt: boolean;
  active: boolean;
  roles: string[];
  setter_type: SetterType;
};
function TeamPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const approveStudentFn = useServerFn(approveAsStudent);
  const navigate = useNavigate();
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [progressByUser, setProgressByUser] = useState<Map<string, Set<string>>>(new Map());

  const deleteMemberFn = useServerFn(deleteTeamMember);
  const setActiveFn = useServerFn(setMemberActive);

  const fetchPage = async () => {
    const [{ data: profs }, { data: rolesData }, tpls, { data: progressRows }, lastActRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path, active, phone, timezone, setter_type, base_pay_monthly, base_pay_day, started_on, csm_daily_target, eod_exempt" as any).eq("is_demo", false),
      supabase.from("user_roles").select("user_id, role"),
      fetchAllTemplates(),
      supabase.from("onboarding_progress").select("user_id, role, step_id"),
      (supabase.from("team_last_activity" as never).select("actor_id, last_at") as unknown as Promise<{ data: { actor_id: string; last_at: string }[] | null }>),
    ]);
    const lastActivity = new Map(((lastActRes.data ?? []) as { actor_id: string; last_at: string }[]).map(r => [r.actor_id, r.last_at]));
    const rolesByUser = new Map<string, string[]>();
    (rolesData ?? []).forEach(r => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const list: Member[] = (profs ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      avatar_path: p.avatar_path ?? null,
      phone: p.phone ?? null,
      timezone: p.timezone ?? null,
      base_pay_monthly: p.base_pay_monthly ?? null,
      base_pay_day: p.base_pay_day ?? 1,
      started_on: p.started_on ?? null,
      csm_daily_target: (p as any).csm_daily_target ?? null,
      eod_exempt: (p as any).eod_exempt === true,
      active: p.active ?? true,
      roles: rolesByUser.get(p.id) ?? [],
      setter_type: (p.setter_type ?? null) as SetterType,
    }));
    const avatars = await signAvatars(list.map(m => m.avatar_path));
    const pmap = new Map<string, Set<string>>();
    ((progressRows ?? []) as any[]).forEach(r => {
      const s = pmap.get(r.user_id) ?? new Set<string>();
      s.add(`${r.role}:${r.step_id}`);
      pmap.set(r.user_id, s);
    });
    return {
      members: list.filter(m => !(m.roles.length === 1 && m.roles[0] === "student")),
      avatars, templates: tpls, pmap, lastActivity,
    };
  };

  const qc = useQueryClient();
  const pageQ = useQuery({ queryKey: ["page", "team"], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setMembers(pageQ.data.members);
    setAvatarUrls(pageQ.data.avatars);
    setTemplates(pageQ.data.templates);
    setProgressByUser(pageQ.data.pmap);
  }, [pageQ.data]);
  const load = () => pageQ.refetch();

  const memberOnboardingPct = (m: Member): number | null => {
    for (const r of ["setter", "closer", "coach", "csm"] as const) {
      if (!m.roles.includes(r)) continue;
      const t = templates.find(t => t.role === r);
      if (!t) continue;
      return progressPercent(t.steps, progressByUser.get(m.id) ?? new Set(), r);
    }
    return null;
  };

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (has && role === "admin" && userId === user?.id) {
      if (!confirm("Remove the admin role from YOURSELF? You will lose access to this page.")) return;
    }
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Role updated");
    load();
    // Your own sidebar/dashboard reflect the change without a full reload
    if (userId === user?.id) window.dispatchEvent(new CustomEvent("isa:roles-changed"));
  };

  const toggleActive = async (m: Member) => {
    if (!confirm(m.active ? `Deactivate ${m.display_name}? They won't be able to sign in.` : `Reactivate ${m.display_name}?`)) return;
    try {
      await setActiveFn({ data: { userId: m.id, active: !m.active } });
      toast.success(m.active ? "Deactivated" : "Reactivated");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteMember = async (m: Member) => {
    const confirmName = prompt(`Type "${m.display_name}" to permanently delete this account and all their data:`);
    if (confirmName !== m.display_name) return toast.error("Name did not match. Cancelled.");
    try {
      await deleteMemberFn({ data: { userId: m.id } });
      toast.success("Account deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-8 text-center text-sm text-muted-foreground">
          Admins only.
        </div>
      </div>
    );
  }

  const filtered = members.filter(m => (m.display_name ?? "").toLowerCase().includes(q.toLowerCase()));
  const lastActivity = pageQ.data?.lastActivity ?? new Map<string, string>();

  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">Team</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Assign roles, edit profiles, deactivate or permanently remove team members.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search members…"
            className="h-8 px-3 rounded-sm border border-[var(--border)] bg-[var(--card)] text-xs w-56 focus:outline-none focus:border-ring"
          />
          <button
            onClick={() => setInviteOpen(true)}
            className="h-8 flex items-center gap-1.5 text-xs font-medium px-3 rounded-sm border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite member
          </button>
        </div>
      </header>

      {/* Access requests live on the Students page — nearly all raw signups
          are students. Team keeps a pointer plus the team-hire action. */}
      {members.some(m => m.roles.length === 0 && m.active) && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-body text-muted-foreground flex-1 min-w-[200px]">
            <span className="font-semibold text-foreground">{members.filter(m => m.roles.length === 0 && m.active).length} access request{members.filter(m => m.roles.length === 0 && m.active).length === 1 ? "" : "s"}</span>
            {" "}waiting in the Requests tab. Hiring one of them as a team member instead?
            {" "}
            {members.filter(m => m.roles.length === 0 && m.active).map(m => (
              <button key={m.id} onClick={() => setEditing(m)} className="text-primary hover:underline mr-2">
                {m.display_name ?? "Unnamed"} →
              </button>
            ))}
          </div>
          <Link to="/students/requests" className="text-caption font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors shrink-0">
            Open Requests
          </Link>
        </div>
      )}

      <InvitationsCard />

      <div className="card-surface overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No members match "{q}"</div>}
          {filtered.map(m => (
            <article key={m.id} className={`flex min-h-[76px] items-center gap-3 px-4 py-3.5 sm:min-h-[82px] sm:px-5 ${!m.active ? "opacity-50" : ""}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-body font-semibold text-foreground">
                {m.avatar_path && avatarUrls[m.avatar_path]
                  ? <img src={avatarUrls[m.avatar_path]} alt="" className="h-full w-full object-cover" />
                  : (m.display_name ?? "?").trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to="/performance"
                    search={{ member: m.id }}
                    className="truncate text-body font-semibold text-foreground hover:underline underline-offset-4 decoration-border hover:decoration-foreground"
                    title="Open Performance"
                  >
                    {m.display_name ?? "Unnamed"}
                  </Link>
                  {!m.active && <span className="text-[9px] text-danger-fg border border-danger/25 bg-danger-bg px-1.5 py-0.5 rounded-full">Inactive</span>}
                  {m.eod_exempt && <span className="text-[9px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-full">EOD exempt</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
                  <span className="capitalize">{m.roles.map(roleLabel).join(" · ") || "No roles yet"}</span>
                  {m.roles.includes("setter") && m.setter_type && (
                    <span>· {m.setter_type === "phone" ? "phone" : m.setter_type === "full_cycle" ? "full cycle" : "DM"}</span>
                  )}
                  {m.timezone ? (
                    <span className="tabular-nums" title={m.timezone.replace(/_/g, " ")}>· {timeIn(m.timezone, new Date())} local</span>
                  ) : (
                    <span className="italic opacity-70">· no timezone yet</span>
                  )}
                  {(() => {
                    const pct = memberOnboardingPct(m);
                    if (pct === null) return null;
                    const color = pct === 100 ? "text-success-fg" : pct >= 50 ? "text-warning-fg" : "text-danger-fg";
                    return <span className={color} title="Onboarding progress">· onboarding {pct}%</span>;
                  })()}
                  {(() => {
                    const last = lastActivity.get(m.id);
                    if (!last) return <span className="italic opacity-70">· no activity logged</span>;
                    const stale = Date.now() - new Date(last).getTime() > 2 * 86400000;
                    return <span className={stale ? "text-warning-fg" : ""} title={new Date(last).toLocaleString()}>· active {formatDistanceToNowStrict(new Date(last))} ago</span>;
                  })()}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setEditing(m)}
                  title="Edit roles & profile"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {m.id !== user?.id && (
                  <>
                    <button
                      onClick={() => toggleActive(m)}
                      title={m.active ? "Deactivate (block login)" : "Reactivate"}
                      className={`p-2 rounded-md motion-safe:transition-colors ${m.active ? "text-muted-foreground hover:text-warning-fg hover:bg-muted" : "text-success-fg hover:bg-success-bg"}`}
                    >
                      {m.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteMember(m)}
                      title="Permanently delete"
                      className="p-2 rounded-md text-muted-foreground hover:text-danger-fg hover:bg-danger-bg motion-safe:transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <TeamActivityLog />

      {editing && (
        <EditProfileModal
          member={editing}
          initialUrl={editing.avatar_path ? avatarUrls[editing.avatar_path] ?? null : null}
          onToggleRole={toggleRole}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            // Base pay feeds Payouts, Finance, the payout banner, and the
            // cash-in calendar's money-out layer.
            invalidateForTables(qc, ["profiles"]);
            qc.invalidateQueries({ queryKey: ["payout-alert"] });
          }}
        />
      )}
      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function EditProfileModal({ member, initialUrl, onToggleRole, onClose, onSaved }: {
  member: Member;
  initialUrl: string | null;
  onToggleRole: (userId: string, role: AppRole, has: boolean) => Promise<any>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [tz, setTz] = useState(member.timezone ?? "");
  const [basePay, setBasePay] = useState(member.base_pay_monthly != null ? String(member.base_pay_monthly) : "");
  const [startedOn, setStartedOn] = useState(member.started_on ?? "");
  const [csmTarget, setCsmTarget] = useState(String((member as any).csm_daily_target ?? 10));
  const [eodExempt, setEodExempt] = useState(member.eod_exempt === true);
  const [setterType, setSetterType] = useState<SetterType>(member.setter_type);
  const [avatarPath, setAvatarPath] = useState<string | null>(member.avatar_path);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localRoles, setLocalRoles] = useState<string[]>(member.roles);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = async (role: AppRole) => {
    const has = localRoles.includes(role);
    setLocalRoles(has ? localRoles.filter(r => r !== role) : [...localRoles, role]);
    await onToggleRole(member.id, role, has);
  };

  const [cropFile, setCropFile] = useState<File | null>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    setCropFile(f);
  };
  const uploadCropped = async (f: File) => {
    setUploading(true);
    try {
      const path = await uploadAvatar(member.id, f);
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(f));
      setCropFile(null);
      toast.success("Photo updated · save to keep it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_path: avatarPath,
      phone: phone.trim() || null,
      timezone: tz || null,
      setter_type: setterType,
      base_pay_monthly: basePay.trim() ? Number(basePay) : null,
      ...(startedOn ? {
        started_on: startedOn,
        base_pay_day: Math.min(31, Math.max(1, Number(startedOn.slice(8, 10)) || 1)),
      } : {}),
      csm_daily_target: Math.max(1, Number(csmTarget) || 10),
      eod_exempt: eodExempt,
    } as any).eq("id", member.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  };

  const showSetterType = localRoles.includes("setter");

  return (
    <div className="fixed inset-0 overflow-y-auto z-50 bg-black/60 backdrop-blur-sm flex p-4" onClick={onClose}>
      {cropFile && <AvatarCropDialog file={cropFile} onCancel={() => setCropFile(null)} onCropped={uploadCropped} />}
      <div className="m-auto bg-[var(--card)] border border-[var(--border)] rounded-sm max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit member profile</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-md bg-[var(--accent)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
            {avatarPreview ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" /> : (displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1.5">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1 text-xs bg-[var(--accent)] hover:bg-muted border border-[var(--border)] px-3 py-1.5 rounded-sm">
              <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload picture"}
            </button>
            <p className="text-[12px] text-muted-foreground">PNG or JPG, up to 5MB.</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Display name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                 className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Phone (optional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 123 4567" inputMode="tel"
                 className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Timezone (they can also set it on their Profile)</label>
          <TimezoneCombobox value={tz} onChange={setTz} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground">Base pay · $/month (optional)</label>
            <input value={basePay} onChange={e => setBasePay(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="500" inputMode="decimal"
              className="w-full h-9 px-3 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground">First day (sets their monthly pay day)</label>
            <DateField value={startedOn} onChange={setStartedOn} placeholder="Pick their start date" clearable={false} className="h-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[12px] text-muted-foreground">Roles</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map(r => {
              const has = localRoles.includes(r.key);
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  onClick={() => toggle(r.key)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm border transition ${
                    has ? r.color : "text-muted-foreground border-[var(--border)] bg-transparent hover:border-ring/50"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {roleLabel(r.key)}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 cursor-pointer hover:border-ring/50 transition">
          <input type="checkbox" checked={eodExempt} onChange={e => setEodExempt(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
          <span>
            <span className="block text-[13px] text-foreground font-medium">Exempt from EODs</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">Removed from expected filers, missed-day nudges, and Performance cards. They can still submit if they want.</span>
          </span>
        </label>
        {localRoles.includes("csm") && (
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground">CSM daily target · students reached (10 full-time, 5 part-time)</label>
            <input value={csmTarget} onChange={e => setCsmTarget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="10" inputMode="numeric"
              className="w-full h-9 px-3 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-ring" />
          </div>
        )}
        {showSetterType && (
          <div className="space-y-1">
            <label className="text-[12px] text-muted-foreground">Setter type</label>
            <div className="flex gap-1.5">
              {([
                { key: null, label: "Not set" },
                { key: "phone" as const, label: "Phone setter (100 dials + 3 sets/day)" },
                { key: "dm" as const, label: "DM setter (300 DMs + 6 sets/day)" },
                { key: "full_cycle" as const, label: "Full cycle (100 dials + 50 outreached + 3 sets/day)" },
              ]).map(opt => (
                <button
                  key={String(opt.key)}
                  onClick={() => setSetterType(opt.key as SetterType)}
                  className={`text-[10px] px-2 py-1 rounded-sm border transition ${
                    setterType === opt.key
                      ? "border-success/25 bg-success-bg text-success-fg"
                      : "border-[var(--border)] text-muted-foreground hover:border-ring/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-[12px] text-muted-foreground pt-1 border-t border-[var(--border)]">ID: {member.id}</div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 py-1.5 rounded-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
