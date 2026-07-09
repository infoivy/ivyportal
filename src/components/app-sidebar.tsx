import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  BarChart3, Database, Users, StickyNote, ShieldCheck, Shield,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean };

const workItems: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "EOD Reports", url: "/eods", icon: FileText },
  { title: "Notes", url: "/notes", icon: StickyNote },
];

const knowledgeItems: Item[] = [
  { title: "SOPs", url: "/sops", icon: BookOpen },
  { title: "Policies", url: "/policies", icon: ShieldCheck },
  { title: "Training", url: "/training", icon: GraduationCap },
];


const opsItems: Item[] = [
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "CRM", url: "/crm", icon: Database },
];

const adminItems: Item[] = [
  { title: "Admin", url: "/admin", icon: Shield, adminOnly: true },
  { title: "Team", url: "/team", icon: Users, adminOnly: true },
];

export function AppSidebar({ roles }: { roles: string[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: s => s.location.pathname });
  const isAdmin = roles.includes("admin");

  const isActive = (url: string) =>
    url === "/dashboard" ? currentPath === url : currentPath.startsWith(url);

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.filter(i => !i.adminOnly || isAdmin).map(item => (
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
      </SidebarContent>
    </Sidebar>
  );
}
