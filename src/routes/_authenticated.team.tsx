import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Users, Shield, Phone, UserCircle2, GraduationCap, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — ISA" }] }),
  component: TeamPage,
});

type AppRole = "admin" | "closer" | "setter" | "coach";
type Member = { id: string; display_name: string | null; avatar_url: string | null; roles: string[] };
const ROLES: { key: AppRole; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "admin", icon: Shield, color: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
  { key: "closer", icon: Phone, color: "text-sky-400 border-sky-500/30 bg-sky-500/5" },
  { key: "setter", icon: UserCircle2, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  { key: "coach", icon: GraduationCap, color: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/5" },
];

function TeamPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url");
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    (rolesData ?? []).forEach(r => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setMembers((profs ?? []).map(p => ({
      id: p.id, display_name: p.display_name, avatar_url: (p as any).avatar_url ?? null,
      roles: rolesByUser.get(p.id) ?? [],
    })));
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Role updated");
    load();
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-8 text-center text-sm text-muted-foreground">
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
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Access control</div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Assign roles, edit display names and avatars for any team member.</p>
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search members…"
          className="h-8 px-3 rounded-sm border border-[#1f2530] bg-[#0f1116] text-xs w-56 focus:outline-none focus:border-emerald-500/40"
        />
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatTile label="Members" value={counts.total} icon={<Users className="h-3 w-3" />} />
        <StatTile label="Admins" value={counts.admins} icon={<Shield className="h-3 w-3" />} accent="rose" />
        <StatTile label="Coaches" value={counts.coaches} icon={<GraduationCap className="h-3 w-3" />} accent="fuchsia" />
        <StatTile label="Closers" value={counts.closers} icon={<Phone className="h-3 w-3" />} accent="sky" />
        <StatTile label="Setters" value={counts.setters} icon={<UserCircle2 className="h-3 w-3" />} accent="emerald" />
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 border-b border-[#1f2530] text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Member</span>
          <span>Roles</span>
        </div>
        {filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No members match "{q}"</div>}
        {filtered.map(m => (
          <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e] transition">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-sm bg-[#1a1f29] border border-[#1f2530] overflow-hidden flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : (m.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {m.display_name ?? "Unnamed"}
                  <button onClick={() => setEditing(m)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{m.id === user?.id ? "You" : m.id.slice(0, 8)}</div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {ROLES.map(r => {
                const has = m.roles.includes(r.key);
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    onClick={() => toggleRole(m.id, r.key, has)}
                    className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition ${
                      has ? r.color : "text-muted-foreground border-[#1f2530] bg-transparent hover:border-[#2a3140]"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {r.key}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editing && <EditProfileModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditProfileModal({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }).eq("id", member.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f1116] border border-[#1f2530] rounded-sm max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit member profile</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-md bg-[#1a1f29] border border-[#1f2530] overflow-hidden flex items-center justify-center text-lg font-bold text-muted-foreground">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Avatar URL</label>
            <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://…"
                   className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Display name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                 className="w-full h-9 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1f2530]">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium px-3 py-1.5 rounded-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "emerald" | "sky" | "rose" | "fuchsia" }) {
  const color =
    accent === "emerald" ? "text-emerald-400" :
    accent === "sky" ? "text-sky-400" :
    accent === "rose" ? "text-rose-400" :
    accent === "fuchsia" ? "text-fuchsia-400" : "text-foreground";
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
