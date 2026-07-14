import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Users, Shield, Phone, UserCircle2, GraduationCap, Pencil, X, HeartHandshake, Sparkles, School,
  Upload, Trash2, PowerOff, Power, UserPlus, Copy, Check,
} from "lucide-react";
import { signAvatars, uploadAvatar } from "@/lib/avatars";
import { deleteTeamMember, setMemberActive, approveAsStudent } from "@/lib/team-admin.functions";
import { fetchAllTemplates, progressPercent, type OnboardingTemplate } from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — ISA" }] }),
  component: TeamPage,
});

type AppRole = "admin" | "closer" | "setter" | "coach" | "csm" | "founder" | "cofounder" | "student";
type SetterType = "phone" | "dm" | "full_cycle" | null;
type Member = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  phone: string | null;
  base_pay_monthly: number | null;
  csm_daily_target: number | null;
  active: boolean;
  roles: string[];
  setter_type: SetterType;
};
// Every role needs a visibly distinct "on" state — a muted "on" reads as off.
const roleLabel = (k: string) => (k === "cofounder" ? "co-founder" : k);

const ROLES: { key: AppRole; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "admin", icon: Shield, color: "text-danger-fg border-danger/25 bg-danger-bg" },
  { key: "closer", icon: Phone, color: "text-chart-1 border-chart-1/25 bg-chart-1/10" },
  { key: "setter", icon: UserCircle2, color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "coach", icon: GraduationCap, color: "text-chart-4 border-chart-4/25 bg-chart-4/10" },
  { key: "csm", icon: HeartHandshake, color: "text-warning-fg border-warning/25 bg-warning-bg" },
  { key: "founder", icon: Sparkles, color: "text-chart-6 border-chart-6/25 bg-chart-6/10" },
  { key: "cofounder", icon: Sparkles, color: "text-chart-2 border-chart-2/25 bg-chart-2/10" },
  { key: "student", icon: School, color: "text-foreground border-foreground/30 bg-muted" },
];

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
    const [{ data: profs }, { data: rolesData }, tpls, { data: progressRows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path, active, phone, setter_type, base_pay_monthly, csm_daily_target" as any),
      supabase.from("user_roles").select("user_id, role"),
      fetchAllTemplates(),
      supabase.from("onboarding_progress").select("user_id, role, step_id"),
    ]);
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
      base_pay_monthly: p.base_pay_monthly ?? null,
      csm_daily_target: (p as any).csm_daily_target ?? null,
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
      avatars, templates: tpls, pmap,
    };
  };

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
  const counts = {
    total: members.length,
    admins: members.filter(m => m.roles.includes("admin")).length,
    coaches: members.filter(m => m.roles.includes("coach")).length,
    closers: members.filter(m => m.roles.includes("closer")).length,
    setters: members.filter(m => m.roles.includes("setter")).length,
    csms: members.filter(m => m.roles.includes("csm")).length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
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
            {" "}waiting on the Students page. Hiring one of them as a team member instead?
            {" "}
            {members.filter(m => m.roles.length === 0 && m.active).map(m => (
              <button key={m.id} onClick={() => setEditing(m)} className="text-primary hover:underline mr-2">
                {m.display_name ?? "Unnamed"} →
              </button>
            ))}
          </div>
          <Link to="/students" className="text-caption font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors shrink-0">
            Review on Students
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <StatTile label="Members" value={counts.total} icon={<Users className="h-3 w-3" />} />
        <StatTile label="Admins" value={counts.admins} icon={<Shield className="h-3 w-3" />} accent="rose" />
        <StatTile label="Coaches" value={counts.coaches} icon={<GraduationCap className="h-3 w-3" />} accent="fuchsia" />
        <StatTile label="Closers" value={counts.closers} icon={<Phone className="h-3 w-3" />} accent="sky" />
        <StatTile label="Setters" value={counts.setters} icon={<UserCircle2 className="h-3 w-3" />} accent="emerald" />
        <StatTile label="CSMs" value={counts.csms} icon={<HeartHandshake className="h-3 w-3" />} accent="amber" />
      </div>

      <div className="card-surface overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-[var(--border)] text-[12px] text-muted-foreground gap-4">
          <span>Member</span>
          <span className="hidden sm:block">Roles</span>
          <span>Actions</span>
        </div>
        {filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No members match "{q}"</div>}
        {filtered.map(m => (
          <div key={m.id} className={`grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-[var(--accent)] last:border-0 hover:bg-[var(--muted)] transition ${!m.active ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-sm bg-[var(--accent)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {m.avatar_path && avatarUrls[m.avatar_path]
                  ? <img src={avatarUrls[m.avatar_path]} alt="" className="h-full w-full object-cover" />
                  : (m.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  <Link to="/team/$id" params={{ id: m.id }} className="hover:underline underline-offset-4 decoration-border hover:decoration-foreground" title="Open performance page">
                    {m.display_name ?? "Unnamed"}
                  </Link>
                  {!m.active && <span className="text-[9px] text-danger-fg border border-danger/25 bg-danger-bg px-1.5 py-0.5 rounded-sm">Inactive</span>}
                  <button onClick={() => setEditing(m)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  {m.roles.includes("setter") && m.setter_type && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-success/25 bg-success-bg text-success-fg">
                      {m.setter_type === "phone" ? "Phone setter" : m.setter_type === "full_cycle" ? "Full cycle" : "DM setter"}
                    </span>
                  )}
                  {m.roles.length === 0 && (
                    <span className="italic">No roles assigned</span>
                  )}
                  {(() => {
                    const pct = memberOnboardingPct(m);
                    if (pct === null) return null;
                    const color = pct === 100 ? "text-success-fg border-success/25 bg-success-bg"
                      : pct >= 50 ? "text-warning-fg border-warning/25 bg-warning-bg"
                      : "text-danger-fg border-danger/25 bg-danger-bg";
                    return (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border ${color}`} title="Onboarding progress">
                        <GraduationCap className="h-2.5 w-2.5" /> {pct}%
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 order-last sm:order-none flex gap-1.5 flex-wrap justify-start sm:justify-end">
              {ROLES.filter(r => m.roles.includes(r.key)).map(r => {
                const Icon = r.icon;
                return (
                  <span
                    key={r.key}
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm border ${r.color}`}
                  >
                    <Icon className="h-3 w-3" />
                    {roleLabel(r.key)}
                  </span>
                );
              })}
              {m.roles.length === 0 && (
                <button
                  onClick={() => setEditing(m)}
                  className="text-[10px] px-2 py-1 rounded-sm border border-dashed border-[#2a3140] text-muted-foreground hover:text-foreground"
                >
                  Assign roles
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {m.id !== user?.id && (
                <>
                  <button
                    onClick={() => toggleActive(m)}
                    title={m.active ? "Deactivate (block login)" : "Reactivate"}
                    className={`p-1.5 rounded-sm border ${m.active ? "border-[var(--border)] text-muted-foreground hover:text-warning-fg hover:border-warning/25" : "border-success/25 text-success-fg hover:bg-success-bg"}`}
                  >
                    {m.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteMember(m)}
                    title="Permanently delete"
                    className="p-1.5 rounded-sm border border-[var(--border)] text-muted-foreground hover:text-danger-fg hover:border-danger/25"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditProfileModal
          member={editing}
          initialUrl={editing.avatar_path ? avatarUrls[editing.avatar_path] ?? null : null}
          onToggleRole={toggleRole}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} invitedBy={user?.id ?? null} />
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
  const [basePay, setBasePay] = useState(member.base_pay_monthly != null ? String(member.base_pay_monthly) : "");
  const [csmTarget, setCsmTarget] = useState(String((member as any).csm_daily_target ?? 10));
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const path = await uploadAvatar(member.id, f);
      setAvatarPath(path);
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
      setAvatarPreview(data?.signedUrl ?? null);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_path: avatarPath,
      phone: phone.trim() || null,
      setter_type: setterType,
      base_pay_monthly: basePay.trim() ? Number(basePay) : null,
      csm_daily_target: Math.max(1, Number(csmTarget) || 10),
    } as any).eq("id", member.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  };

  const showSetterType = localRoles.includes("setter");

  return (
    <div className="fixed inset-0 overflow-y-auto z-50 bg-black/60 backdrop-blur-sm flex p-4" onClick={onClose}>
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
              className="flex items-center gap-1 text-xs bg-[var(--accent)] hover:bg-[#232935] border border-[#2a3140] px-3 py-1.5 rounded-sm">
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
          <label className="text-[12px] text-muted-foreground">Base pay · $/month (optional)</label>
          <input value={basePay} onChange={e => setBasePay(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="500" inputMode="decimal"
            className="w-full h-9 px-3 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-ring" />
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
                    has ? r.color : "text-muted-foreground border-[var(--border)] bg-transparent hover:border-[#2a3140]"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {roleLabel(r.key)}
                </button>
              );
            })}
          </div>
        </div>
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
                { key: "dm" as const, label: "DM setter (125 contacted + 3 sets/day)" },
                { key: "full_cycle" as const, label: "Full cycle (100 dials + 50 outreached + 3 sets/day)" },
              ]).map(opt => (
                <button
                  key={String(opt.key)}
                  onClick={() => setSetterType(opt.key as SetterType)}
                  className={`text-[10px] px-2 py-1 rounded-sm border transition ${
                    setterType === opt.key
                      ? "border-success/25 bg-success-bg text-success-fg"
                      : "border-[var(--border)] text-muted-foreground hover:border-[#2a3140]"
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

function InviteModal({ onClose, invitedBy }: { onClose: () => void; invitedBy: string | null }) {
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [setterType, setSetterType] = useState<SetterType>(null);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleRole = (role: AppRole) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email is required");
    if (selectedRoles.length === 0) return toast.error("Select at least one role");
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("invitations")
      .insert({
        email: email.trim().toLowerCase(),
        roles: selectedRoles,
        setter_type: selectedRoles.includes("setter") ? setterType : null,
        invited_by: invitedBy,
      })
      .select("token")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setInviteLink(`${window.location.origin}/auth?invite=${data.token}`);
    toast.success("Invitation created");
  };

  const copy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 overflow-y-auto z-50 bg-black/60 backdrop-blur-sm flex p-4" onClick={onClose}>
      <div className="m-auto bg-[var(--card)] border border-[var(--border)] rounded-sm max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Invite team member</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Share this link. When they sign up with the invited email address, their roles are assigned automatically. Link expires in 30 days.</p>
            <div className="flex items-center gap-2 p-3 rounded-sm bg-[var(--background)] border border-[var(--border)] text-[11px] break-all text-foreground font-mono">
              {inviteLink}
            </div>
            <button
              onClick={copy}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-sm bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition"
            >
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy invite link</>}
            </button>
            <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com" required autoFocus
                className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-primary/25"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] text-muted-foreground">Roles</label>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(r => {
                  const has = selectedRoles.includes(r.key);
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.key} type="button"
                      onClick={() => toggleRole(r.key)}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm border transition ${
                        has ? r.color : "text-muted-foreground border-[var(--border)] hover:border-[#2a3140]"
                      }`}
                    >
                      <Icon className="h-3 w-3" /> {roleLabel(r.key)}
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedRoles.includes("setter") && (
              <div className="space-y-1">
                <label className="text-[12px] text-muted-foreground">Setter type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: null, label: "Not set" },
                    { key: "phone" as const, label: "Phone (100 dials)" },
                    { key: "dm" as const, label: "DM (125 leads)" },
                    { key: "full_cycle" as const, label: "Full cycle (100 dials + 50 outreached)" },
                  ]).map(opt => (
                    <button
                      key={String(opt.key)} type="button"
                      onClick={() => setSetterType(opt.key as SetterType)}
                      className={`text-[10px] px-2 py-1 rounded-sm border transition ${
                        setterType === opt.key
                          ? "border-success/25 bg-success-bg text-success-fg"
                          : "border-[var(--border)] text-muted-foreground hover:border-[#2a3140]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
              <button type="submit" disabled={saving} className="text-xs bg-primary hover:bg-primary text-black font-medium px-3 py-1.5 rounded-sm disabled:opacity-50">
                {saving ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "emerald" | "sky" | "rose" | "fuchsia" | "amber" }) {
  const color =
    accent === "emerald" ? "text-success-fg" :
    accent === "sky" ? "text-muted-foreground" :
    accent === "rose" ? "text-danger-fg" :
    accent === "amber" ? "text-warning-fg" :
    accent === "fuchsia" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="card-surface p-3">
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-[20px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
