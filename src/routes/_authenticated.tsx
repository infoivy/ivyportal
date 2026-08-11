import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Search } from "lucide-react";
import { Toaster } from "sonner";
import { useAccess } from "@/lib/use-access";
import { AuthContext, type AuthState } from "@/lib/auth-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { installSessionOnlyCleanup } from "@/components/auth-page";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette } from "@/components/command-palette";
import { StudentBottomNav } from "@/components/student-bottom-nav";
import { StaffBottomNav } from "@/components/staff-bottom-nav";
import { ApplicationPending } from "@/components/application-pending";
import { setStudentPortalTab, getStudentPortalTab, onStudentPortalTab } from "@/lib/student-portal-bus";
import { todayLocal } from "@/lib/dates";
import {
  createAuthSessionLoader,
  isolateAuthBoundaryCache,
  signOutWithLocalFallback,
} from "@/lib/auth-session-loader";
import { PageSkeleton } from "@/components/ui/skeletons";
import { STAFF_ROLES, pageLabelForPath } from "@/lib/portal-navigation";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ user: null, roles: [], displayName: null, loading: true });
  const [eodSubmitted, setEodSubmitted] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Central student gate. Students have a three-surface portal; every other
  // route is staff. Route files carry their own guards too, but this is the
  // one place that covers direct URLs, the command palette, and future routes
  // nobody remembered to gate (students reached /eods and the policy docs
  // this way, founder-reported 2026-07-28).
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pureStudent =
    !state.loading &&
    state.roles.includes("student") &&
    !state.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
  useEffect(() => {
    if (!pureStudent) return;
    const allowed = ["/student-portal", "/knowledge", "/profile"].some(
      base => pathname === base || pathname.startsWith(base + "/"),
    );
    if (!allowed) navigate({ to: "/student-portal", replace: true });
  }, [pureStudent, pathname, navigate]);

  useEffect(() => {
    const cleanupSessionOnly = installSessionOnlyCleanup();
    const clearAuthBoundaryCache = isolateAuthBoundaryCache(queryClient);
    const clearAccountState = (loading: boolean) => {
      queryClient.clear();
      setEodSubmitted(null);
      setState({ user: null, roles: [], displayName: null, loading });
    };
    const loader = createAuthSessionLoader({
      getSessionUserId: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session?.user.id ?? null;
      },
      loadRoles: async (userId) => {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        if (error) throw error;
        return (data ?? []).map(row => row.role as string);
      },
      loadDisplayName: async (userId) => {
        const { data, error } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
        if (error) throw error;
        return data?.display_name ?? null;
      },
      loadUser: async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
      },
      loadEodStatus: async (userId, roles) => {
        // Cofounders and founders don't file EODs (founder-confirmed 2026-07-14).
        if (roles.includes("cofounder") || roles.includes("founder")) return true;
        const { data, error } = await supabase
          .from("eods")
          .select("id")
          .eq("is_demo", false)
          .eq("user_id", userId)
          .eq("report_date", todayLocal())
          .maybeSingle();
        if (error) throw error;
        return !!data;
      },
      onLoading: () => {
        setAuthError(null);
        clearAccountState(true);
      },
      onSignedOut: () => {
        setAuthError(null);
        clearAccountState(false);
        window.sessionStorage.removeItem("isa-landing-pending");
        navigate({ to: "/auth", replace: true });
      },
      onCommit: ({ user, roles, displayName, shouldLand }) => {
        setAuthError(null);
        setState({ user, roles, displayName: displayName ?? user.email ?? null, loading: false });

        const path = window.location.pathname;
        const isStudent = roles.includes("student");
        const isTeam = roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
        if (shouldLand) window.sessionStorage.removeItem("isa-landing-pending");

        if (shouldLand) {
          if (isStudent && !isTeam) {
            navigate({ to: "/student-portal", replace: true });
          } else if (isTeam) navigate({ to: "/dashboard", replace: true });
        } else {
          if (isStudent && !isTeam && (path === "/dashboard" || path === "/" || path === "/auth")) {
            navigate({ to: "/student-portal", replace: true });
          }
          const canDashboard = roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
          if (!canDashboard && path === "/dashboard") navigate({ to: "/profile", replace: true });
        }
      },
      onEodStatus: (_userId, submitted) => setEodSubmitted(submitted),
      onAuthError: () => {
        clearAccountState(false);
        setAuthError("We couldn't verify this session. Try again or sign out.");
      },
      onEodError: () => setEodSubmitted(null),
    });

    const refreshSession = () => loader.refresh();
    loader.refresh({ wantsLanding: window.sessionStorage.getItem("isa-landing-pending") === "1" });
    const onRolesChanged = refreshSession;
    const onAuthRetry = () => {
      setAuthError(null);
      setState({ user: null, roles: [], displayName: null, loading: true });
      loader.refresh({ wantsLanding: window.sessionStorage.getItem("isa-landing-pending") === "1" });
    };
    window.addEventListener("isa:roles-changed", onRolesChanged);
    window.addEventListener("isa:auth-retry", onAuthRetry);
    const onEodSubmitted = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId) loader.recordEodSubmitted(userId);
    };
    window.addEventListener("isa:eod-submitted", onEodSubmitted);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loader.transition(null);
      } else if (event === "SIGNED_IN") {
        // supabase-js re-emits SIGNED_IN on every page load and tab refocus.
        // Only an actual sign-in (auth page sets the one-shot flag) may
        // trigger role landing — otherwise every hard navigation yanks the
        // user back to their default page.
        loader.transition(session?.user.id ?? null, {
          wantsLanding: window.sessionStorage.getItem("isa-landing-pending") === "1",
        });
      } else if (event === "USER_UPDATED") {
        loader.transition(session?.user.id ?? null);
      }
    });
    return () => {
      loader.dispose();
      sub.subscription.unsubscribe();
      clearAuthBoundaryCache();
      cleanupSessionOnly();
      window.removeEventListener("isa:roles-changed", onRolesChanged);
      window.removeEventListener("isa:auth-retry", onAuthRetry);
      window.removeEventListener("isa:eod-submitted", onEodSubmitted);
    };
  }, [navigate, queryClient]);

  // Presence ping (founder-asked 2026-08-09): one row per person per LOCAL
  // day in portal_activity — on sign-in, on tab refocus, and every 10 minutes
  // while visible. Powers "who was in the portal, when, and how long".
  const userId = state.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const ping = (open: boolean) => {
      if (document.visibilityState === "hidden") return;
      void (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<unknown>)(
        "portal_ping", { _day: todayLocal(), _open: open },
      ).then(() => {}, () => {});
    };
    ping(true); // sign-in / page load counts as an open
    const timer = setInterval(() => ping(false), 10 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [userId]);

  const signOut = async () => {
    const error = await signOutWithLocalFallback(options => supabase.auth.signOut(options));
    if (error) setAuthError("We couldn't sign out this browser. Try again.");
  };

  if (authError) {
    return (
      <div className="dashboard-dark min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="card-surface max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Session verification failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{authError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => window.dispatchEvent(new Event("isa:auth-retry"))}>
              Try again
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state.loading || !state.user) {
    return (
      <div className="dashboard-dark min-h-screen bg-[var(--background)]">
        <div className="h-12 border-b border-[var(--border)] bg-[var(--background)]/95" />
        <PageSkeleton />
      </div>
    );
  }

  const isStudent = state.roles.includes("student");
  const isTeam = state.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
  const studentOnly = isStudent && !isTeam;

  // New signups have no role until an admin approves them — no team shell.
  // They fill in phone + timezone first, then wait on "Application pending."
  if (state.user && state.roles.length === 0) {
    return (
      <AuthContext.Provider value={state}>
        <div className="min-h-screen bg-background">
          <ApplicationPending email={state.user.email ?? ""} onSignOut={signOut} />
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={state}>
      <SidebarProvider>
        <RouteProgress />
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar roles={state.roles} />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Frosted top bar */}
            <header className="h-14 sm:h-[52px] flex items-center justify-between border-b border-border px-1 sm:px-3 frosted sticky top-0 z-30">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="h-12 w-12 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md motion-safe:transition-colors" />
                <div className="h-4 w-px bg-border mx-1" />
                <PageContextLabel />
              </div>
              <div className="flex items-center gap-1.5">
                {/* Search */}
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
                  className="inline-flex h-12 w-12 sm:h-auto sm:w-auto items-center justify-center gap-1.5 text-[12px] sm:px-2.5 sm:py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
                  title="Search (⌘K)"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Search</span>
                  <kbd className="hidden md:inline text-[10px] opacity-50">⌘K</kbd>
                </button>

                {/* EOD due — status color reserved for meaning */}
                {eodSubmitted === false && !studentOnly && (
                  <Link
                    to="/eods"
                    className="hidden sm:inline-flex items-center gap-1 text-caption px-2.5 py-1.5 rounded-md bg-warning-bg text-warning-fg hover:opacity-80 motion-safe:transition-opacity"
                  >
                    EOD due
                  </Link>
                )}

                <ThemeToggle />
                <NotificationsBell />

                {/* Account menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-12 w-12 sm:h-7 sm:w-7 rounded-full bg-muted text-foreground flex items-center justify-center text-micro font-semibold shrink-0 hover:bg-accent motion-safe:transition-colors"
                      title={state.displayName ?? "Account"}
                    >
                      {(state.displayName ?? "U").charAt(0).toUpperCase()}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuLabel className="text-caption text-muted-foreground font-normal truncate">
                      {state.displayName}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={signOut}>
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <main className={`flex-1 min-w-0 overflow-x-clip relative ${studentOnly ? "pb-20 sm:pb-0" : isTeam ? "pb-24 md:pb-0" : ""}`}>
              {/* relative + min-h-full: full-viewport pages (SOP canvas) position
                  against this wrapper even while the enter animation holds a transform */}
              <div className="page-enter relative min-h-full">
                <AccessGate roles={state.roles}>
                  <Outlet />
                </AccessGate>
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
        {isTeam && !studentOnly && <StaffBottomNav />}
      </SidebarProvider>
    </AuthContext.Provider>
  );
}


function PageContextLabel() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const label = pageLabelForPath(path);
  return <span className="text-body font-semibold text-foreground truncate">{label}</span>;
}

function StudentBottomNavBridge() {
  const [tab, setTab] = useState(getStudentPortalTab());
  useEffect(() => { const off = onStudentPortalTab(setTab); return () => { off(); }; }, []);
  return <StudentBottomNav activeTab={tab} onTabChange={setStudentPortalTab} />;
}


/** 2px indeterminate bar under the header while a route transition is pending. */
function RouteProgress() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  if (!isPending) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden bg-transparent" aria-hidden>
      <div className="h-full w-1/3 bg-primary rounded-full animate-route-progress" />
    </div>
  );
}

/** Blocks pages an admin has turned off for this person's role. */
function AccessGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { pageHidden } = useAccess();
  if (!pageHidden(pathname)) return <>{children}</>;
  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="card-surface p-8 text-center">
        <p className="text-sm font-medium text-foreground">This page is turned off for your role</p>
        <p className="text-[13px] text-muted-foreground mt-2">
          An admin has hidden this page in the access defaults. If you think you need it, ask a founder or admin.
        </p>
      </div>
    </div>
  );
}
