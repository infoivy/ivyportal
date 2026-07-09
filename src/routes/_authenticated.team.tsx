import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — ISA" }] }),
  component: TeamPage,
});

type AppRole = "admin" | "closer" | "setter";
type Member = { id: string; display_name: string | null; roles: string[] };
const ROLES: AppRole[] = ["admin", "closer", "setter"];

function TeamPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [members, setMembers] = useState<Member[]>([]);

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
    return <div className="p-6"><p className="text-muted-foreground">Admins only.</p></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Team</h1>
      <div className="grid gap-3">
        {members.map(m => (
          <Card key={m.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-medium">{m.display_name ?? "Unnamed"}</div>
                <div className="text-xs text-muted-foreground">{m.id === user?.id && "You"}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {ROLES.map(r => {
                  const has = m.roles.includes(r);
                  return (
                    <Button
                      key={r}
                      size="sm"
                      variant={has ? "default" : "outline"}
                      onClick={() => toggleRole(m.id, r, has)}
                    >
                      {r}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
