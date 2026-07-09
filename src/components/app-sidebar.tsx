import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  BarChart3, Database, Users, StickyNote, ShieldCheck, Shield, UserCircle, School, HeartHandshake, Phone, DollarSign,
} from "lucide-react";


import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] };

const workItems: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "EOD Reports", url: "/eods", icon: FileText },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "CSM", url: "/csm", icon: HeartHandshake, roles: ["admin", "csm"] },
];

const knowledgeItems: Item[] = [
  { title: "SOPs", url: "/sops", icon: BookOpen },
  { title: "Policies", url: "/policies", icon: ShieldCheck },
  { title: "Training", url: "/training", icon: GraduationCap },
];

const opsItems: Item[] = [
  { title: "Students", url: "/students", icon: School },
  { title: "1-on-1 Calls", url: "/calls", icon: Phone, roles: ["admin", "coach"] },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "CRM", url: "/crm", icon: Database },
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
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map(item => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  // Student-only view: minimal nav
  if (isStudent && !isTeam) {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="px-2 py-1 flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">ISA</div>
            {!collapsed && <span className="font-semibold text-sm">Student</span>}
          </div>
        </SidebarHeader>
        <SidebarContent>
          {renderGroup("You", studentItems)}
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">ISA</div>
          {!collapsed && <span className="font-semibold text-sm">Team</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Work", workItems)}
        {renderGroup("Knowledge", knowledgeItems)}
        {renderGroup("Ops", opsItems)}
        {isAdmin && renderGroup("Admin", adminItems)}
        {renderGroup("Account", [{ title: "Profile", url: "/profile", icon: UserCircle }])}
      </SidebarContent>
    </Sidebar>
  );
}
