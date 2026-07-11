import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  Database, Users, StickyNote, Shield, UserCircle, School, HeartHandshake, Phone, DollarSign, Armchair,
  ListChecks, TrendingUp, Quote, Building2, HeartPulse, Sparkles, Clapperboard, Wallet, Megaphone,
  MessagesSquare, Instagram,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";
import isaLogo from "@/assets/isa-logo.png.asset.json";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const todayItems: Item[] = [
  { title: "Dashboard",    url: "/dashboard",    icon: LayoutDashboard, roles: ["admin", "founder", "closer", "setter", "coach"] },
  { title: "EOD Reports",  url: "/eods",         icon: FileText },
  { title: "Action Items", url: "/action-items", icon: ListChecks },
  { title: "Team Chat",    url: "/chat",         icon: MessagesSquare },
];

const salesItems: Item[] = [
  { title: "Sales",            url: "/sales",            icon: Building2,     roles: ["admin", "closer"] },
  { title: "Revenue",          url: "/revenue",          icon: TrendingUp,    roles: ["admin", "closer", "coach"] },
  { title: "Closer Resources", url: "/closer-resources", icon: DollarSign,    roles: ["admin", "closer"] },
  { title: "Training",         url: "/training",         icon: GraduationCap, roles: ["admin", "founder", "closer", "setter", "coach"] },
  { title: "Calendar",         url: "/calendar",         icon: Calendar },
  { title: "CRM",              url: "/crm",              icon: Database,      roles: ["admin"] },
  { title: "Instagram CRM",    url: "/mochi",            icon: Instagram,     roles: ["admin", "founder"] },
];

const studentsItems: Item[] = [
  { title: "Students",        url: "/students",        icon: School,         roles: ["admin", "closer", "csm", "coach"] },
  { title: "1-on-1 Calls",    url: "/calls",           icon: Phone,          roles: ["admin", "coach", "csm"] },
  { title: "Student Success", url: "/student-success", icon: HeartPulse,     roles: ["admin", "csm", "coach", "founder"] },
  { title: "CSM",             url: "/csm",             icon: HeartHandshake, roles: ["admin", "csm"] },
  { title: "Student Alerts",  url: "/alerts",          icon: Megaphone,      roles: ["admin", "founder", "coach", "closer", "setter", "csm"] },
  { title: "Testimonials",    url: "/testimonials",    icon: Quote,          roles: ["admin", "coach", "closer", "setter", "csm"] },
];

const libraryItems: Item[] = [
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Notes",     url: "/notes",     icon: StickyNote },
];

const founderItems: Item[] = [
  { title: "Gathering Hub", url: "/command", icon: Armchair, roles: ["founder"] },
  { title: "Finance", url: "/finance", icon: Wallet, roles: ["founder"] },
  { title: "Content", url: "/content", icon: Clapperboard, roles: ["founder"] },
];

const adminItems: Item[] = [
  { title: "Admin", url: "/admin", icon: Shield, roles: ["admin"] },
  { title: "Team",  url: "/team",  icon: Users,  roles: ["admin"] },
];

const studentOnlyItems: Item[] = [
  { title: "My Portal", url: "/student-portal", icon: FileText },
  { title: "Profile",   url: "/profile",        icon: UserCircle },
];

export function AppSidebar({ roles }: { roles: string[] }) {
  const { pageHidden } = useAccess();
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
      if (pageHidden(i.url)) return false;
      return !i.roles || i.roles.some(r => roles.includes(r));
    });
    if (filtered.length === 0) return null;
    return (
      <SidebarGroup className="px-2 py-1.5">
        {!collapsed && (
          <SidebarGroupLabel className="px-2 mb-1 h-auto text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-px">
            {filtered.map(item => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={collapsed ? item.title : undefined}
                    className={
                      "h-8 rounded-md px-2 motion-safe:transition-colors motion-safe:duration-150 " +
                      (active
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
                    }
                  >
                    <Link to={item.url} preload="intent" className="flex items-center gap-2.5">
                      <item.icon className={"h-4 w-4 shrink-0 " + (active ? "text-foreground" : "text-muted-foreground")} />
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
  };

  const header = (label: string) => (
    <SidebarHeader className="border-b border-sidebar-border px-2 py-2.5">
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <img src={isaLogo.url} alt="ISA" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-semibold text-body text-foreground truncate">Ivy Portal</span>
            <span className="text-micro text-muted-foreground">{label}</span>
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
          {renderGroup("You", studentOnlyItems)}
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {header(isAdmin ? "Admin" : "Team")}
      <SidebarContent className="gap-0 py-2">
        {renderGroup("Today", todayItems)}
        {renderGroup("Sales", salesItems)}
        {renderGroup("Students", studentsItems)}
        {renderGroup("Library", libraryItems)}
        {roles.includes("founder") && renderGroup("Founder", founderItems)}
        {isAdmin && renderGroup("Admin", adminItems)}
        {renderGroup("Account", [{ title: "Profile", url: "/profile", icon: UserCircle }])}
      </SidebarContent>
    </Sidebar>
  );
}
