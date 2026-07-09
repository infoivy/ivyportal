import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle } from "lucide-react";
import { Toaster } from "sonner";
import { AuthContext, type AuthState } from "@/lib/auth-context";
import { installSessionOnlyCleanup } from "@/components/auth-page";
import { NotificationsBell } from "@/components/notifications-bell";

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
  const [eodSubmitted, setEodSubmitted] = useState<boolean | null>(null);

  const checkEod = async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("eods").select("id").eq("user_id", userId).eq("report_date", today).maybeSingle();
    setEodSubmitted(!!data);
  };

  useEffect(() => {
    const cleanupSessionOnly = installSessionOnlyCleanup();
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
      const rolesArr = (rolesRes.data ?? []).map(r => r.role as string);
      setState({
        user: userRes.data.user,
        roles: rolesArr,
        displayName: profileRes.data?.display_name ?? userRes.data.user?.email ?? null,
        loading: false,
      });
      checkEod(userId);
      // Redirect students to their portal if they land on team-only pages
      const isStudent = rolesArr.includes("student");
      const isTeam = rolesArr.some(r => ["admin", "coach", "closer", "setter"].includes(r));
      if (isStudent && !isTeam) {
        const path = window.location.pathname;
        if (path === "/dashboard" || path === "/" || path === "/auth") {
          navigate({ to: "/student-portal", replace: true });
        }
      }
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
    return () => { alive = false; sub.subscription.unsubscribe(); cleanupSessionOnly(); };
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
        <div className="dashboard-dark min-h-screen flex w-full">
          <AppSidebar roles={state.roles} />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center justify-between border-b border-[#1f2530] px-3 bg-[#0a0b0f]/95 backdrop-blur sticky top-0 z-30">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div className="h-5 w-px bg-[#1f2530] mx-1" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">ISA / Team</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-sm border border-[#1f2530] bg-[#0f1116] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
                {eodSubmitted === false && (
                  <Link
                    to="/eods"
                    className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-sm border border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 transition"
                  >
                    <AlertCircle className="h-3 w-3" />
                    EOD due
                  </Link>
                )}
                <div className="text-[11px] text-muted-foreground hidden md:flex flex-col items-end leading-tight">
                  <span className="text-foreground font-medium">{state.displayName}</span>
                  <span className="uppercase tracking-wider text-[9px]">{state.roles.join(" · ") || "member"}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground h-8">
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
                </Button>
              </div>
            </header>
            <main className="flex-1 min-w-0 overflow-auto relative bg-[#0a0b0f]">
              <Outlet />
            </main>
          </div>
        </div>
        <Toaster theme="dark" toastOptions={{ style: { background: "#0f1116", border: "1px solid #1f2530", color: "#e5e7eb" } }} />
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

