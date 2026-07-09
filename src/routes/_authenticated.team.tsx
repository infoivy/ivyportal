import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Users, Shield, Phone, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — ISA" }] }),
  component: TeamPage,
});

type AppRole = "admin" | "closer" | "setter";
type Member = { id: string; display_name: string | null; roles: string[] };
const ROLES: { key: AppRole; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "admin", icon: Shield, color: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
  { key: "closer", icon: Phone, color: "text-sky-400 border-sky-500/30 bg-sky-500/5" },
  { key: "setter", icon: UserCircle2, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
];

function TeamPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("id, display_name");
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    (rolesData ?? []).forEach(r => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setMembers((profs ?? []).map(p => ({ id: p.id, display_name: p.display_name, roles: rolesByUser.get(p.id) ?? [] })));
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
    closers: members.filter(m => m.roles.includes("closer")).length,
    setters: members.filter(m => m.roles.includes("setter")).length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Access control</div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Assign roles and manage who sees what.</p>
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search members…"
          className="h-8 px-3 rounded-sm border border-[#1f2530] bg-[#0f1116] text-xs w-56 focus:outline-none focus:border-emerald-500/40"
        />
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Members" value={counts.total} icon={<Users className="h-3 w-3" />} />
        <StatTile label="Admins" value={counts.admins} icon={<Shield className="h-3 w-3" />} accent="rose" />
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
              <div className="h-8 w-8 rounded-sm bg-[#1a1f29] border border-[#1f2530] flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {(m.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{m.display_name ?? "Unnamed"}</div>
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
    </div>
  );
}

function StatTile({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "emerald" | "sky" | "rose" }) {
  const color =
    accent === "emerald" ? "text-emerald-400" :
    accent === "sky" ? "text-sky-400" :
    accent === "rose" ? "text-rose-400" : "text-foreground";
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
