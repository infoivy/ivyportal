import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  BarChart3, Database, Users, StickyNote, Shield, UserCircle, School, HeartHandshake, Phone, DollarSign,
  ListChecks, Trophy, TrendingUp, Quote, Sparkles,
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
  { title: "CSM", url: "/csm", icon: HeartHandshake, roles: ["admin", "csm"] },
];

const knowledgeItems: Item[] = [
  { title: "Knowledge Hub", url: "/knowledge", icon: BookOpen },
  { title: "Closer Resources", url: "/closer-resources", icon: DollarSign, roles: ["admin", "closer"] },
  { title: "Training", url: "/training", icon: GraduationCap },
];

const opsItems: Item[] = [
  { title: "Students", url: "/students", icon: School },
  { title: "1-on-1 Calls", url: "/calls", icon: Phone, roles: ["admin", "coach"] },
  { title: "Coaches", url: "/coaches", icon: Trophy, roles: ["admin", "coach", "csm"] },
  { title: "Revenue", url: "/revenue", icon: TrendingUp, roles: ["admin", "closer", "coach"] },
  { title: "Installments", url: "/installments", icon: DollarSign, roles: ["admin", "setter", "coach", "csm"] },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "CRM", url: "/crm", icon: Database },
  { title: "Testimonials", url: "/testimonials", icon: Quote, roles: ["admin", "coach", "closer", "setter", "csm"] },
];


const founderItems: Item[] = [
  { title: "Founder Hub", url: "/founder", icon: Sparkles, roles: ["founder"] },
  { title: "IG Analytics", url: "/instagram", icon: BarChart3, roles: ["founder"] },
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

  const isActive = (url: string) =>
    url === "/dashboard" ? currentPath === url : currentPath.startsWith(url);

  const renderGroup = (label: string, items: Item[]) => {
    const filtered = items.filter(i => !i.roles || i.roles.some(r => roles.includes(r)));
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
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60")
                    }
                  >
                    <Link to={item.url} className="flex items-center gap-2.5 pl-3">
                      <item.icon className={"h-4 w-4 shrink-0 " + (active ? "text-primary" : "text-sidebar-foreground/60")} />
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
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-sm ring-1 ring-primary/30 p-1">
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
        {renderGroup("Knowledge", knowledgeItems)}
        {renderGroup("Ops", opsItems)}
        {roles.includes("founder") && renderGroup("Founder", founderItems)}
        {isAdmin && renderGroup("Admin", adminItems)}
        {renderGroup("Account", [{ title: "Profile", url: "/profile", icon: UserCircle }])}
      </SidebarContent>
    </Sidebar>
  );
}
