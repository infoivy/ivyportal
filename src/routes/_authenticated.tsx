import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Toaster } from "sonner";
import { AuthContext, type AuthState } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({ user: null, roles: [], displayName: null, loading: true });

  useEffect(() => {
    let alive = true;
    const load = async (userId: string | null) => {
      if (!userId) {
        if (alive) setState({ user: null, roles: [], displayName: null, loading: false });
        return;
      }
      const [rolesRes, profileRes, userRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      setState({
        user: userRes.data.user,
        roles: (rolesRes.data ?? []).map(r => r.role as string),
        displayName: profileRes.data?.display_name ?? userRes.data.user?.email ?? null,
        loading: false,
      });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ user: null, roles: [], displayName: null, loading: false });
        navigate({ to: "/auth", replace: true });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        load(session?.user.id ?? null);
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (state.loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <AuthContext.Provider value={state}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar roles={state.roles} />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b px-3 bg-background/80 backdrop-blur">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-sm font-medium">ISA Team</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground hidden sm:flex flex-col items-end">
                  <span>{state.displayName}</span>
                  <span className="uppercase tracking-wider">{state.roles.join(" · ") || "member"}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-1" /> Sign out
                </Button>
              </div>
            </header>
            <main className="flex-1 min-w-0 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </AuthContext.Provider>
  );
}
