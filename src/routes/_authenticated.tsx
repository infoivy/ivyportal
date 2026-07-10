import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Search } from "lucide-react";
import { Toaster } from "sonner";
import { AuthContext, type AuthState } from "@/lib/auth-context";
import { installSessionOnlyCleanup } from "@/components/auth-page";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette } from "@/components/command-palette";
import { StudentBottomNav } from "@/components/student-bottom-nav";
import { setStudentPortalTab, getStudentPortalTab, onStudentPortalTab } from "@/lib/student-portal-bus";
import { PageSkeleton } from "@/components/ui/skeletons";

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
    const load = async (userId: string | null, fromSignIn = false) => {
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

      const path = window.location.pathname;
      const isStudent = rolesArr.includes("student");
      const isTeam = rolesArr.some(r => ["admin", "coach", "closer", "setter"].includes(r));

      if (fromSignIn) {
        // Role-based landing: only fires on actual sign-in, not on page refresh
        if (isStudent && !isTeam) {
          navigate({ to: "/student-portal", replace: true });
        } else if (!rolesArr.includes("admin") && !rolesArr.includes("founder")) {
          if (rolesArr.includes("setter")) navigate({ to: "/eods", replace: true });
          else if (rolesArr.includes("closer")) navigate({ to: "/sales-hq", replace: true });
          else if (rolesArr.includes("csm")) navigate({ to: "/csm", replace: true });
          else if (rolesArr.includes("coach")) navigate({ to: "/calls", replace: true });
        }
      } else {
        // On page refresh: still protect student-only users from team pages
        if (isStudent && !isTeam && (path === "/dashboard" || path === "/" || path === "/auth")) {
          navigate({ to: "/student-portal", replace: true });
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null, false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ user: null, roles: [], displayName: null, loading: false });
        navigate({ to: "/auth", replace: true });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        load(session?.user.id ?? null, true);
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); cleanupSessionOnly(); };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (state.loading) {
    return (
      <div className="dashboard-dark min-h-screen bg-[var(--background)]">
        <div className="h-12 border-b border-[var(--border)] bg-[var(--background)]/95" />
        <PageSkeleton />
      </div>
    );
  }

  const isStudent = state.roles.includes("student");
  const isTeam = state.roles.some(r => ["admin", "coach", "closer", "setter", "csm"].includes(r));
  const studentOnly = isStudent && !isTeam;

  return (
    <AuthContext.Provider value={state}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar roles={state.roles} />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Frosted top bar */}
            <header className="h-[52px] flex items-center justify-between border-b border-border px-3 frosted sticky top-0 z-30">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md motion-safe:transition-colors" />
                <div className="h-4 w-px bg-border mx-1" />
                <span className="text-[13px] font-semibold text-foreground">ISA</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Search */}
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
                  title="Search (⌘K)"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Search</span>
                  <kbd className="hidden md:inline text-[10px] opacity-50">⌘K</kbd>
                </button>

                {/* EOD due — subtle banner trigger (only shows when outstanding) */}
                {eodSubmitted === false && !studentOnly && (
                  <Link
                    to="/eods"
                    className="hidden sm:inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 motion-safe:transition-colors"
                  >
                    EOD due
                  </Link>
                )}

                <ThemeToggle />
                <NotificationsBell />

                {/* Avatar */}
                <button
                  onClick={signOut}
                  className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0 hover:opacity-80 motion-safe:transition-opacity"
                  title={`${state.displayName} — click to sign out`}
                >
                  {(state.displayName ?? "U").charAt(0).toUpperCase()}
                </button>
              </div>
            </header>

            <main className={`flex-1 min-w-0 overflow-auto relative ${studentOnly ? "pb-16 sm:pb-0" : ""}`}>
              <div className="page-enter">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        <Toaster
          theme="system"
          toastOptions={{
            style: { background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" }
          }}
        />
        <CommandPalette />
        {studentOnly && <StudentBottomNavBridge />}
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

function StudentBottomNavBridge() {
  const [tab, setTab] = useState(getStudentPortalTab());
  useEffect(() => { const off = onStudentPortalTab(setTab); return () => { off(); }; }, []);
  return <StudentBottomNav activeTab={tab} onTabChange={setStudentPortalTab} />;
}

