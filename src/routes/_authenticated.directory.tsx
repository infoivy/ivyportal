import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STAFF_ROLES, TEAM_DIRECTORY_ROLES } from "@/lib/portal-navigation";
import { InviteModal } from "@/components/invite-modal";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({ meta: [{ title: "Team directory · Ivy Portal" }] }),
  component: TeamDirectoryPage,
});

type DirectoryMember = {
  id: string;
  displayName: string;
  roles: string[];
};

const ROLE_ORDER = ["founder", "cofounder", "admin", "closer", "setter", "coach", "csm"];
const STAFF_ROLE_SET = new Set<string>(STAFF_ROLES);

function TeamDirectoryPage() {
  const { user, roles } = useAuth();
  const canView = TEAM_DIRECTORY_ROLES.some((role) => roles.includes(role));
  const isAdmin = roles.includes("admin");
  const [inviteOpen, setInviteOpen] = useState(false);

  const directoryQ = useQuery({
    queryKey: ["page", "team-directory"],
    enabled: canView,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DirectoryMember[]> => {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, active")
          .eq("is_demo", false)
          .order("display_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesResult.error)
        throw new Error(`Directory profiles failed: ${profilesResult.error.message}`);
      if (rolesResult.error)
        throw new Error(`Directory roles failed: ${rolesResult.error.message}`);

      const rolesByUser = new Map<string, string[]>();
      for (const row of rolesResult.data ?? []) {
        const existing = rolesByUser.get(row.user_id) ?? [];
        existing.push(row.role);
        rolesByUser.set(row.user_id, existing);
      }

      return (profilesResult.data ?? [])
        .filter((profile) => profile.active !== false)
        .map((profile) => ({
          id: profile.id,
          displayName: profile.display_name?.trim() || "Unnamed team member",
          roles: (rolesByUser.get(profile.id) ?? [])
            .filter((role) => STAFF_ROLE_SET.has(role))
            .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)),
        }))
        .filter((member) => member.roles.length > 0)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
  });

  if (!canView) {
    return (
      <PageShell className="pb-24 sm:pb-6">
        <div className="card-surface mx-auto mt-14 max-w-lg p-7 text-center">
          <UsersRound className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-title font-semibold text-foreground">
            Team directory unavailable
          </h1>
          <p className="mt-2 text-body text-muted-foreground">
            This read-only directory is available to active staff roles.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-24 sm:pb-6">
      <div className="pt-2">
        <p className="mb-2 text-micro font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          People
        </p>
        <PageHeader
          title="Team directory"
          subtitle="A read-only view of current staff membership. Account access and role changes remain in Admin."
          actions={isAdmin ? (
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Invite member
            </Button>
          ) : undefined}
        />
      </div>

      {directoryQ.isLoading ? (
        <div className="card-surface divide-y divide-border" aria-label="Loading team directory">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex min-h-[76px] items-center gap-3 px-4 py-3.5 sm:px-5">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : directoryQ.isError ? (
        <div className="card-surface p-7 text-center" role="alert">
          <AlertCircle className="mx-auto h-5 w-5 text-destructive" aria-hidden="true" />
          <h2 className="mt-4 text-title font-semibold text-foreground">
            Directory could not load
          </h2>
          <p className="mt-2 text-body text-muted-foreground">
            {directoryQ.error instanceof Error
              ? directoryQ.error.message
              : "The staff directory is temporarily unavailable."}
          </p>
          <Button className="mt-5 min-h-12 sm:min-h-9" onClick={() => directoryQ.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
          </Button>
        </div>
      ) : directoryQ.data?.length ? (
        <section className="card-surface overflow-hidden" aria-labelledby="directory-list-title">
          <h2 id="directory-list-title" className="sr-only">
            Current staff
          </h2>
          <div className="divide-y divide-border">
            {directoryQ.data.map((member) => (
              <article
                key={member.id}
                className="flex min-h-[76px] items-center gap-3 px-4 py-3.5 sm:min-h-[82px] sm:px-5"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-body font-semibold text-foreground"
                  aria-hidden="true"
                >
                  {initials(member.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="truncate text-body font-semibold text-foreground">
                      {member.displayName}
                    </h3>
                    {member.id === user?.id && (
                      <span className="text-micro font-medium text-muted-foreground">You</span>
                    )}
                  </div>
                  <p className="mt-1 text-caption capitalize text-muted-foreground">
                    {member.roles.map(roleLabel).join(" · ")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="card-surface px-5 py-10 text-center">
          <p className="text-body font-medium text-foreground">
            No active staff records are available.
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            Account administration remains available to admins.
          </p>
        </div>
      )}

      <p className="px-1 text-caption text-muted-foreground">
        Source: active Portal profiles and assigned staff roles. This page cannot change account
        access.
      </p>
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </PageShell>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function roleLabel(role: string) {
  return role === "cofounder" ? "co-founder" : role.replaceAll("_", " ");
}
