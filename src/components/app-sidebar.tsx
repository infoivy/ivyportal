import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  BarChart3, Database, Users, StickyNote, Shield, UserCircle, School, HeartHandshake, Phone, DollarSign,
  ListChecks, Trophy, TrendingUp, Quote, Sparkles, Building2, HeartPulse, ClipboardList,
} from "lucide-react";


import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";
import isaLogo from "@/assets/isa-logo.png.asset.json";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] };

const workItems: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "EOD Reports", url: "/eods", icon: FileText },
  { title: "Action Items", url: "/action-items", icon: ListChecks },
  { title: "Notes", url: "/notes", icon: StickyNote },
];

const salesItems: Item[] = [
  { title: "Sales HQ", url: "/sales-hq", icon: Building2, roles: ["admin", "closer"] },
  { title: "Revenue", url: "/revenue", icon: TrendingUp, roles: ["admin", "closer", "setter", "coach", "csm"] },
  { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ["admin", "closer", "setter"] },
  { title: "Closer Resources", url: "/closer-resources", icon: DollarSign, roles: ["admin", "closer"] },
  { title: "Training", url: "/training", icon: GraduationCap },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "CRM", url: "/crm", icon: Database, roles: ["admin"] },
];

const fulfillmentItems: Item[] = [
  { title: "Student Success", url: "/student-success", icon: HeartPulse, roles: ["admin", "csm", "coach", "founder"] },
  { title: "Students", url: "/students", icon: School, roles: ["admin", "closer", "csm", "coach"] },
  { title: "1-on-1 Calls", url: "/calls", icon: Phone, roles: ["admin", "coach"] },
  { title: "Coaches", url: "/coaches", icon: Trophy, roles: ["admin", "coach", "csm"] },
  { title: "CSM", url: "/csm", icon: HeartHandshake, roles: ["admin", "csm"] },
  { title: "Testimonials", url: "/testimonials", icon: Quote, roles: ["admin", "coach", "closer", "setter", "csm"] },
];

const knowledgeItems: Item[] = [
  { title: "Knowledge Hub", url: "/knowledge", icon: BookOpen },
];

const founderItems: Item[] = [
  { title: "Command", url: "/founder-hq", icon: LayoutDashboard, roles: ["founder", "admin"] },
  { title: "Founder Hub", url: "/founder", icon: Sparkles, roles: ["founder", "admin"] },
  { title: "IG Analytics", url: "/instagram", icon: BarChart3, roles: ["founder", "admin"] },
  { title: "Weekly Review", url: "/weekly-review", icon: ClipboardList, roles: ["founder", "admin"] },
];

const adminItems: Item[] = [
  { title: "Admin", url: "/admin", icon: Shield, roles: ["admin"] },
  { title: "Team", url: "/team", icon: Users, roles: ["admin"] },
];

const studentItems: Item[] = [
  { title: "My EODs", url: "/student-portal", icon: FileText },
  { title: "Profile", url: "/profile", icon: UserCircle },
];

export function AppSidebar({ roles }: { roles: string[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: s => s.location.pathname });
  const isAdmin = roles.includes("admin");
  const isStudent = roles.includes("student");
  const isTeam = roles.some(r => ["admin", "coach", "closer", "setter", "csm"].includes(r));
  const [crmEnabled, setCrmEnabled] = useState(false);

  useEffect(() => {
    supabase.from("founder_settings").select("crm_enabled").maybeSingle().then(({ data }) => {
      setCrmEnabled(!!(data as any)?.crm_enabled);
    });
  }, []);

  const isActive = (url: string) =>
    url === "/dashboard" ? currentPath === url : currentPath.startsWith(url);

  const renderGroup = (label: string, items: Item[]) => {
    const filtered = items.filter(i => {
      if (i.url === "/crm" && !crmEnabled) return false;
      return !i.roles || i.roles.some(r => roles.includes(r));
    });
    if (filtered.length === 0) return null;
    return (
      <SidebarGroup className="px-2 py-1.5">
        {!collapsed && (
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {filtered.map(item => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    className={
                      "relative h-9 rounded-md transition-colors " +
                      (active
                        ? "bg-white/[0.04] text-sidebar-foreground font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-primary"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.03]")
                    }
                  >
                    <Link to={item.url} className="flex items-center gap-2.5 pl-3">
                      <item.icon className={"h-4 w-4 shrink-0 " + (active ? "text-sidebar-foreground" : "text-sidebar-foreground/50")} />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
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
    <SidebarHeader className="border-b border-sidebar-border/60">
      <div className="px-2 py-2 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center p-1">
          <img src={isaLogo.url} alt="ISA" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm text-sidebar-foreground">Ivy Portal</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
          </div>
        )}
      </div>
    </SidebarHeader>
  );

  // Student-only view: minimal nav
  if (isStudent && !isTeam) {
    return (
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {header("Student")}
        <SidebarContent className="gap-0 py-2">
          {renderGroup("You", studentItems)}
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {header(isAdmin ? "Admin" : "Team")}
      <SidebarContent className="gap-0 py-2">
        {renderGroup("Work", workItems)}
        {renderGroup("Sales", salesItems)}
        {renderGroup("Fulfillment", fulfillmentItems)}
        {renderGroup("Knowledge", knowledgeItems)}
        {(roles.includes("founder") || isAdmin) && renderGroup("Founder", founderItems)}
        {isAdmin && renderGroup("Admin", adminItems)}
        {renderGroup("Account", [{ title: "Profile", url: "/profile", icon: UserCircle }])}
      </SidebarContent>
    </Sidebar>
  );
}
