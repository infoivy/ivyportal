import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, Copy, GraduationCap, HeartHandshake, Phone, RefreshCw, School, Shield, Sparkles,
  Trash2, UserCircle2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "admin" | "closer" | "setter" | "coach" | "csm" | "founder" | "cofounder" | "student";
export type SetterType = "phone" | "dm" | "full_cycle" | null;

// Every role needs a visibly distinct "on" state — a muted "on" reads as off.
export const roleLabel = (k: string) => (k === "cofounder" ? "co-founder" : k);

export const ROLES: { key: AppRole; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "admin", icon: Shield, color: "text-danger-fg border-danger/25 bg-danger-bg" },
  { key: "closer", icon: Phone, color: "text-chart-1 border-chart-1/25 bg-chart-1/10" },
  { key: "setter", icon: UserCircle2, color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "coach", icon: GraduationCap, color: "text-chart-4 border-chart-4/25 bg-chart-4/10" },
  { key: "csm", icon: HeartHandshake, color: "text-warning-fg border-warning/25 bg-warning-bg" },
  { key: "founder", icon: Sparkles, color: "text-chart-6 border-chart-6/25 bg-chart-6/10" },
  { key: "cofounder", icon: Sparkles, color: "text-chart-2 border-chart-2/25 bg-chart-2/10" },
  { key: "student", icon: School, color: "text-foreground border-foreground/30 bg-muted" },
];

const INVITATIONS_KEY = ["page", "team", "invitations"];

type InviteRow = {
  id: string;
  email: string;
  roles: string[];
  setter_type: string | null;
  token: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

const inviteUrl = (token: string) => `${window.location.origin}/auth?invite=${token}`;

const copyText = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success("Invite link copied"),
    () => toast.error("Could not copy · copy it manually"),
  );

function inviteStatus(row: InviteRow): "pending" | "used" | "expired" {
  if (row.used_at) return "used";
  if (new Date(row.expires_at) < new Date()) return "expired";
  return "pending";
}

const STATUS_CLS: Record<"pending" | "used" | "expired", string> = {
  pending: "text-warning-fg border-warning/25 bg-warning-bg",
  used:    "text-success-fg border-success/25 bg-success-bg",
  expired: "text-muted-foreground border-border bg-muted",
};

/**
 * Recent invitations with their real status (founder 2026-07-28: invites
 * "sometimes glitch" — a consumed or expired token silently gave zero roles).
 * Pending links copy again; used or expired ones regenerate in one click.
 */
export function InvitationsCard() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const q = useQuery({
    queryKey: INVITATIONS_KEY,
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as never as {
        from: (t: string) => {
          select: (c: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: InviteRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      }).from("invitations").select("id, email, roles, setter_type, token, used_at, expires_at, created_at")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const regenerate = async (row: InviteRow) => {
    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        insert: (v: object) => { select: (c: string) => { single: () => Promise<{ data: { token: string } | null; error: { message: string } | null }> } };
      };
    }).from("invitations").insert({
      email: row.email,
      roles: row.roles,
      setter_type: row.setter_type,
      invited_by: user?.id ?? null,
    }).select("token").single();
    if (error || !data) return toast.error(error?.message ?? "Could not regenerate");
    await copyText(inviteUrl(data.token));
    qc.invalidateQueries({ queryKey: INVITATIONS_KEY });
  };

  const remove = async (row: InviteRow) => {
    if (!confirm(`Delete the invitation for ${row.email}?`)) return;
    const { error } = await (supabase as never as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
    }).from("invitations").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: INVITATIONS_KEY });
  };

  if (!isAdmin || !q.data?.length) return null;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium">Invitations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Signing up with the invited email applies the roles. A used or expired link never works again: regenerate it.
        </p>
      </header>
      <div className="divide-y divide-border">
        {q.data.map(row => {
          const status = inviteStatus(row);
          return (
            <div key={row.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-medium text-foreground">{row.email}</span>
              <span className="text-muted-foreground">{row.roles.map(roleLabel).join(" · ") || "no roles"}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_CLS[status]}`}>{status}</span>
              <div className="ml-auto flex items-center gap-2">
                {status === "pending" ? (
                  <button onClick={() => copyText(inviteUrl(row.token))} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" /> Copy link
                  </button>
                ) : (
                  <button onClick={() => regenerate(row)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </button>
                )}
                <button onClick={() => remove(row)} className="text-danger-fg hover:underline" aria-label={`Delete invitation for ${row.email}`}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Create an invitation and hand back the link. Shared by Team admin and the directory header. */
export function InviteModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
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

    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        insert: (v: object) => { select: (c: string) => { single: () => Promise<{ data: { token: string } | null; error: { message: string } | null }> } };
      };
    }).from("invitations")
      .insert({
        email: email.trim().toLowerCase(),
        roles: selectedRoles,
        setter_type: selectedRoles.includes("setter") ? setterType : null,
        invited_by: user?.id ?? null,
      })
      .select("token")
      .single();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Could not create invite"); return; }
    setInviteLink(inviteUrl(data.token));
    qc.invalidateQueries({ queryKey: INVITATIONS_KEY });
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
                        has ? r.color : "text-muted-foreground border-[var(--border)] hover:border-ring/50"
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
                          : "border-[var(--border)] text-muted-foreground hover:border-ring/50"
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
              <button type="submit" disabled={saving} className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 py-1.5 rounded-sm disabled:opacity-50">
                {saving ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
