import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { approveAsStudent } from "@/lib/team-admin.functions";
import { StudentsTabBar } from "@/components/students-tab-bar";
import { toast } from "sonner";
import { UserPlus, GraduationCap, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students/requests")({
  head: () => ({ meta: [{ title: "Access Requests · ISA Team" }] }),
  component: RequestsPage,
});

type Pending = { id: string; display_name: string | null; created_at: string };
const TEAM_ROLES = ["setter", "closer", "csm", "coach"] as const;

/**
 * Everyone who signed up through the shared portal link and is waiting to be
 * let in. Closers and CSMs approve students (that's who they onboard);
 * admins can also place someone as a team member.
 */
function RequestsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const canApprove = isAdmin || roles.includes("closer") || roles.includes("csm");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const approveFn = useServerFn(approveAsStudent);
  const [busy, setBusy] = useState<string | null>(null);
  const [teamPick, setTeamPick] = useState<{ id: string; role: (typeof TEAM_ROLES)[number] } | null>(null);

  const q = useQuery({
    queryKey: ["students", "access-requests"],
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async () => {
      // RLS hides other users' user_roles rows from plain closers/CSMs, so
      // "profiles minus placed" can't be computed client-side; the
      // security-definer pending_signups() returns the queue for approver roles.
      const { data, error } = await supabase.rpc("pending_signups");
      if (error) throw error;
      return (data ?? []) as Pending[];
    },
  });
  const pending = q.data ?? [];

  const approveStudent = async (p: Pending) => {
    setBusy(p.id);
    try {
      const r = await approveFn({ data: { userId: p.id } });
      toast.success("Approved. Set their name, payment, and package.");
      qc.invalidateQueries({ queryKey: ["students"] });
      if (r.studentId) navigate({ to: "/students/$id", params: { id: r.studentId }, search: { setup: "payment" } as never });
    } catch (e) { toast.error(String((e as Error).message ?? e)); }
    finally { setBusy(null); }
  };

  const approveTeam = async (p: Pending, role: (typeof TEAM_ROLES)[number]) => {
    setBusy(p.id);
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: p.id, role });
      if (error) throw error;
      toast.success(`${p.display_name ?? "Member"} is now a ${role}. Finish their profile on the Team page.`);
      setTeamPick(null);
      qc.invalidateQueries({ queryKey: ["students", "access-requests"] });
    } catch (e) { toast.error(String((e as Error).message ?? e)); }
    finally { setBusy(null); }
  };

  if (!canApprove) {
    return (
      <div className="w-full max-w-none p-4 sm:p-6">
        <StudentsTabBar />
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">
          Admin, closer, or CSM access required.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <StudentsTabBar />
      <header className="pb-2">
        <h1 className="text-display text-foreground">Access requests</h1>
        <p className="text-body text-muted-foreground mt-1">
          Everyone who signed up through the portal link and is waiting to be let in. Most are students you just closed. Approve them and set up their payment.
        </p>
      </header>

      {q.isLoading ? (
        <div className="text-caption text-muted-foreground py-8 text-center">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <CheckCircle2 className="h-6 w-6 text-success-fg mx-auto mb-3" />
          <div className="text-sm font-medium text-foreground">No one waiting</div>
          <p className="text-caption text-muted-foreground mt-1">New signups through the portal link will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(p => (
            <div key={p.id} className="card-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-caption font-semibold shrink-0">
                  {(p.display_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground truncate">{p.display_name ?? "Unnamed"}</div>
                  <div className="text-caption text-muted-foreground">requested {p.created_at.slice(0, 10)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    disabled={busy === p.id}
                    onClick={() => approveStudent(p)}
                    className="inline-flex items-center gap-1.5 text-caption font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors disabled:opacity-50"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    {busy === p.id ? "Working…" : "Student"}
                  </button>
                  {isAdmin && (
                    <button
                      disabled={busy === p.id}
                      onClick={() => setTeamPick(teamPick?.id === p.id ? null : { id: p.id, role: "setter" })}
                      className="inline-flex items-center gap-1.5 text-caption font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted motion-safe:transition-colors disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Team member
                    </button>
                  )}
                </div>
              </div>
              {isAdmin && teamPick?.id === p.id && (
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  <span className="text-caption text-muted-foreground">Role:</span>
                  {TEAM_ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => setTeamPick({ id: p.id, role: r })}
                      className={`text-caption px-2.5 py-1 rounded-md border motion-safe:transition-colors ${teamPick.role === r ? "border-primary/25 bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    disabled={busy === p.id}
                    onClick={() => approveTeam(p, teamPick.role)}
                    className="ml-auto text-caption font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors disabled:opacity-50"
                  >
                    Confirm {teamPick.role}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
