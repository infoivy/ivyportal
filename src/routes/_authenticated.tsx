import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
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
import { setStudentPortalTab, getStudentPortalTab, onStudentPortalTab } from "@/lib/student-portal-bus";
import { todayLocal } from "@/lib/dates";
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
    // The rep's own calendar day — EODs belong to the day they lived,
    // wherever they are (must match the EOD form's date exactly).
    const today = todayLocal();
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

      // Sign-in happens on /auth before this layout mounts, so the SIGNED_IN
      // event is missed — the auth page leaves a one-shot flag instead.
      if (!fromSignIn && window.sessionStorage.getItem("isa-landing-pending")) {
        window.sessionStorage.removeItem("isa-landing-pending");
        fromSignIn = true;
      }

      if (fromSignIn) {
        // Role-based landing: only fires on actual sign-in, not on page refresh
        if (isStudent && !isTeam) {
          navigate({ to: "/student-portal", replace: true });
        } else if (!rolesArr.includes("admin") && !rolesArr.includes("founder")) {
          if (rolesArr.includes("setter")) navigate({ to: "/eods", replace: true });
          else if (rolesArr.includes("closer")) navigate({ to: "/sales", search: { tab: "operations" }, replace: true });
          else if (rolesArr.includes("csm")) navigate({ to: "/csm", search: { tab: "overview" }, replace: true });
          else if (rolesArr.includes("coach")) navigate({ to: "/calls", replace: true });
        }
      } else {
        // On page refresh: still protect student-only users from team pages
        if (isStudent && !isTeam && (path === "/dashboard" || path === "/" || path === "/auth")) {
          navigate({ to: "/student-portal", replace: true });
        }
        // CSMs without another dashboard-holding role land on their own board
        const canDashboard = rolesArr.some(r => ["admin", "founder", "closer", "setter", "coach"].includes(r));
        if (!canDashboard && rolesArr.includes("csm") && path === "/dashboard") {
          navigate({ to: "/csm", search: { tab: "overview" }, replace: true });
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null, false));
    const onRolesChanged = () => {
      supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null, false));
    };
    window.addEventListener("isa:roles-changed", onRolesChanged);
    const onEodSubmitted = () => setEodSubmitted(true);
    window.addEventListener("isa:eod-submitted", onEodSubmitted);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ user: null, roles: [], displayName: null, loading: false });
        navigate({ to: "/auth", replace: true });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        load(session?.user.id ?? null, true);
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); cleanupSessionOnly(); window.removeEventListener("isa:roles-changed", onRolesChanged); window.removeEventListener("isa:eod-submitted", onEodSubmitted); };
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

  // New signups have no role until an admin approves them — no team shell.
  if (state.user && state.roles.length === 0) {
    return <PendingApproval email={state.user.email ?? ""} onSignOut={signOut} />;
  }

  return (
    <AuthContext.Provider value={state}>
      <SidebarProvider>
        <RouteProgress />
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar roles={state.roles} />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Frosted top bar */}
            <header className="h-[52px] flex items-center justify-between border-b border-border px-3 frosted sticky top-0 z-30">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md motion-safe:transition-colors" />
                <div className="h-4 w-px bg-border mx-1" />
                <PageContextLabel />
              </div>
              <div className="flex items-center gap-1.5">
                {/* Search */}
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
                  className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
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
                      className="h-7 w-7 rounded-full bg-muted text-foreground flex items-center justify-center text-micro font-semibold shrink-0 hover:bg-accent motion-safe:transition-colors"
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

            <main className={`flex-1 min-w-0 overflow-x-clip relative ${studentOnly ? "pb-16 sm:pb-0" : ""}`}>
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
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

function PendingApproval({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  // Re-check roles when approval might have happened
  useEffect(() => {
    const recheck = () => window.dispatchEvent(new CustomEvent("isa:roles-changed"));
    const t = setInterval(recheck, 30_000);
    window.addEventListener("focus", recheck);
    return () => { clearInterval(t); window.removeEventListener("focus", recheck); };
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="card-surface max-w-sm w-full p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-warning-bg flex items-center justify-center">
          <span className="text-xl">⏳</span>
        </div>
        <div>
          <h1 className="text-title text-foreground">Waiting for approval</h1>
          <p className="text-body text-muted-foreground mt-1.5">
            Your account <span className="text-foreground">{email}</span> is created and waiting
            to be approved. This page updates automatically once that happens.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onSignOut}>
          <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
        </Button>
      </div>
    </div>
  );
}

const PAGE_LABELS: Array<[string, string]> = [
  ["/dashboard", "Overview"], ["/eods", "Performance"], ["/action-items", "Action Items"], ["/chat", "Team Chat"],
  ["/sales", "Sales"], ["/revenue", "Deals"], ["/installments", "Installments"],
  ["/payouts", "Payouts"], ["/closer-resources", "Closer Resources"], ["/training", "Training"],
  ["/calendar", "Calendar"], ["/crm", "CRM"], ["/finance", "Finance"], ["/mochi", "Mochi"], ["/students", "Students"], ["/calls", "1-on-1 Calls"],
  ["/student-success", "Student Success"], ["/csm", "CSM"],
  ["/testimonials", "Testimonials"], ["/knowledge", "Knowledge"], ["/policies", "Knowledge"],
  ["/sops", "Knowledge"], ["/content", "Content"], ["/admin", "Admin"],
  ["/team", "Team"], ["/profile", "Profile"], ["/settings", "Settings"], ["/student-portal", "My Portal"],
];

function PageContextLabel() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const label = PAGE_LABELS.find(([p]) => path.startsWith(p))?.[1] ?? "Ivy Portal";
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
