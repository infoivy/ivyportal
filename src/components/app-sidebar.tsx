import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileText, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import {
  ADMIN_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  STAFF_ROLES,
  isVisibleToRoles,
  matchesNavItem,
  type PortalNavItem,
} from "@/lib/portal-navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import isaLogo from "@/assets/isa-logo.png.asset.json";
import {
  getStudentPortalTab,
  onStudentPortalTab,
  setStudentPortalTab,
} from "@/lib/student-portal-bus";

type SidebarItem = PortalNavItem & { badge?: number };

const studentTabItems = [
  { tab: "eod", title: "My Portal", icon: FileText },
  { tab: "leaderboard", title: "Leaderboard", icon: UserCircle },
];

function StudentJourneyGroup({ collapsed, currentPath }: { collapsed: boolean; currentPath: string }) {
  const [activeTab, setActiveTab] = useState(getStudentPortalTab());
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    const off = onStudentPortalTab(setActiveTab);
    return () => { off(); };
  }, []);

  const onPortal = currentPath.startsWith("/student-portal");
  return (
    <SidebarGroup className={`px-2 py-2.5 ${collapsed ? "border-t border-sidebar-border/60 first:border-t-0 py-2" : ""}`}>
      {!collapsed && (
        <SidebarGroupLabel className="px-2 mb-1 h-auto text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
          Journey
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {studentTabItems.map((item) => {
            const active = onPortal && (
              item.tab === activeTab ||
              (item.tab === "eod" && !studentTabItems.some((candidate) => candidate.tab === activeTab))
            );
            return (
              <SidebarMenuItem key={item.tab}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={collapsed ? item.title : undefined}
                  className={`h-12 md:h-9 rounded-md px-2 motion-safe:transition-colors motion-safe:duration-150 ${
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Link
                    to="/student-portal"
                    onClick={() => {
                      setStudentPortalTab(item.tab);
                      if (isMobile) setOpenMobile(false);
                    }}
                    className="flex items-center gap-2.5"
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                    {!collapsed && <span className="text-body leading-none">{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ roles }: { roles: string[] }) {
  const { pageHidden } = useAccess();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const isAdmin = roles.includes("admin");
  const isStudent = roles.includes("student");
  const isTeam = roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
  const [org, setOrg] = useState<{ name: string; logo: string | null }>({ name: "Ivy Portal", logo: null });
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  useEffect(() => {
    supabase.from("org_settings").select("org_name, logo_url").maybeSingle().then(({ data }) => {
      if (data) setOrg({ name: data.org_name, logo: data.logo_url });
    });
  }, []);

  const canApproveRequests = isAdmin || roles.includes("closer") || roles.includes("csm");
  useEffect(() => {
    if (!canApproveRequests) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("pending_signups");
      if (alive) setPendingApprovals((data ?? []).length);
    })();
    return () => { alive = false; };
  }, [canApproveRequests, currentPath]);

  const renderGroup = (label: string, items: readonly SidebarItem[]) => {
    const filtered = items.filter((item) => isVisibleToRoles(item, roles) && !pageHidden(item.url));
    if (!filtered.length) return null;

    return (
      <SidebarGroup className={`px-2 py-2.5 ${collapsed ? "border-t border-sidebar-border/60 first:border-t-0 py-2" : ""}`}>
        {!collapsed && (
          <SidebarGroupLabel className="px-2 mb-1 h-auto text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {filtered.map((item) => {
              const active = matchesNavItem(item, currentPath);
              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={collapsed ? item.title : undefined}
                    className={`h-12 md:h-9 rounded-md px-2 motion-safe:transition-colors motion-safe:duration-150 ${
                      active
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Link to={item.url as never} preload="intent" onClick={closeMobileNav} className="flex items-center gap-2.5">
                      <span className="relative shrink-0 flex">
                        <item.icon className={`h-4 w-4 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                        {collapsed && (item.badge ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                        )}
                      </span>
                      {!collapsed && <span className="text-body leading-none">{item.title}</span>}
                      {!collapsed && (item.badge ?? 0) > 0 && (
                        <span className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-4 text-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const header = (label: string) => (
    <SidebarHeader className="h-14 md:h-[52px] justify-center border-b border-sidebar-border px-2 py-0">
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <img src={org.logo ?? isaLogo.url} alt={org.name} className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-semibold text-body text-foreground truncate">{org.name}</span>
            <span className="text-micro text-muted-foreground">{label}</span>
          </div>
        )}
      </div>
    </SidebarHeader>
  );

  if (isStudent && !isTeam) {
    return (
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {header("Student")}
        <SidebarContent className="gap-0 py-2">
          <StudentJourneyGroup collapsed={collapsed} currentPath={currentPath} />
          {renderGroup("Library", [{
            key: "student-knowledge",
            title: "Knowledge",
            description: "Training and reference material.",
            url: "/knowledge",
            icon: BookOpen,
          }])}
          {renderGroup("You", [{
            key: "student-profile",
            title: "Profile",
            description: "Account settings.",
            url: "/profile",
            icon: UserCircle,
          }])}
        </SidebarContent>
      </Sidebar>
    );
  }

  const primaryItems = PRIMARY_NAV_ITEMS.map((item) => (
    item.key === "customers" ? { ...item, badge: canApproveRequests ? pendingApprovals : 0 } : item
  ));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {header(isAdmin ? "Admin" : "Team")}
      <SidebarContent className="gap-0 py-2">
        {renderGroup("Workspace", primaryItems)}
        {isAdmin && renderGroup("System", ADMIN_NAV_ITEMS)}
        {renderGroup("Account", [{
          key: "profile",
          title: "Profile",
          description: "Account settings.",
          url: "/profile",
          icon: UserCircle,
        }])}
      </SidebarContent>
    </Sidebar>
  );
}
