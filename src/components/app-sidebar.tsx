import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, BookOpen, Calendar, GraduationCap,
  BarChart3, Database, Users, StickyNote, Shield, UserCircle, School, HeartHandshake, Phone, DollarSign,
  ListChecks, Trophy, TrendingUp, Quote, Sparkles, Building2, HeartPulse, ClipboardList,
  Instagram,
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
  color?: string; // Apple Settings-style icon tint
};

// Semantic icon colors by section
const C = {
  blue:    "#2563EB",
  emerald: "#16A34A",
  violet:  "#7C3AED",
  amber:   "#D97706",
  red:     "#DC2626",
  sky:     "#0284C7",
  rose:    "#E11D48",
  teal:    "#0D9488",
};

const workItems: Item[] = [
  { title: "Dashboard",    url: "/dashboard",    icon: LayoutDashboard, color: C.blue },
  { title: "EOD Reports",  url: "/eods",         icon: FileText,        color: C.emerald },
  { title: "Action Items", url: "/action-items", icon: ListChecks,      color: C.amber },
  { title: "Notes",        url: "/notes",        icon: StickyNote,      color: C.sky },
];

const salesItems: Item[] = [
  { title: "Sales HQ",          url: "/sales-hq",         icon: Building2,   color: C.emerald, roles: ["admin", "closer"] },
  { title: "Revenue",           url: "/revenue",           icon: TrendingUp,  color: C.emerald, roles: ["admin", "closer", "setter", "coach", "csm"] },
  { title: "Analytics",         url: "/analytics",         icon: BarChart3,   color: C.blue,    roles: ["admin", "closer", "setter"] },
  { title: "Closer Resources",  url: "/closer-resources",  icon: DollarSign,  color: C.amber,   roles: ["admin", "closer"] },
  { title: "Training",          url: "/training",          icon: GraduationCap, color: C.violet },
  { title: "Calendar",          url: "/calendar",          icon: Calendar,    color: C.sky },
  { title: "CRM",               url: "/crm",               icon: Database,    color: C.rose,    roles: ["admin"] },
];

const fulfillmentItems: Item[] = [
  { title: "Student Success", url: "/student-success", icon: HeartPulse,    color: C.rose,   roles: ["admin", "csm", "coach", "founder"] },
  { title: "Students",        url: "/students",        icon: School,        color: C.violet, roles: ["admin", "closer", "csm", "coach"] },
  { title: "1-on-1 Calls",    url: "/calls",           icon: Phone,         color: C.teal,   roles: ["admin", "coach"] },
  { title: "Coaches",         url: "/coaches",         icon: Trophy,        color: C.amber,  roles: ["admin", "coach", "csm"] },
  { title: "CSM",             url: "/csm",             icon: HeartHandshake, color: C.teal,  roles: ["admin", "csm"] },
  { title: "Testimonials",    url: "/testimonials",    icon: Quote,         color: C.violet, roles: ["admin", "coach", "closer", "setter", "csm"] },
];

const knowledgeItems: Item[] = [
  { title: "Knowledge Hub", url: "/knowledge", icon: BookOpen, color: C.amber },
];

const founderItems: Item[] = [
  { title: "Command",       url: "/founder-hq",    icon: LayoutDashboard, color: C.violet, roles: ["founder", "admin"] },
  { title: "Founder Hub",   url: "/founder",       icon: Sparkles,        color: C.violet, roles: ["founder", "admin"] },
  { title: "IG Analytics",  url: "/instagram",     icon: Instagram,       color: C.rose,   roles: ["founder", "admin"] },
  { title: "Weekly Review", url: "/weekly-review", icon: ClipboardList,   color: C.sky,    roles: ["founder", "admin"] },
];

const adminItems: Item[] = [
  { title: "Admin", url: "/admin", icon: Shield, color: C.red,  roles: ["admin"] },
  { title: "Team",  url: "/team",  icon: Users,  color: C.blue, roles: ["admin"] },
];

const studentItems: Item[] = [
  { title: "My EODs", url: "/student-portal", icon: FileText,    color: C.emerald },
  { title: "Profile", url: "/profile",        icon: UserCircle,  color: C.blue },
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
      <SidebarGroup className="px-2 py-1">
        {!collapsed && (
          <SidebarGroupLabel className="px-2 mb-0.5 text-[11px] font-medium text-muted-foreground/60">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-[2px]">
            {filtered.map(item => {
              const active = isActive(item.url);
              const iconColor = item.color ?? C.blue;
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={collapsed ? item.title : undefined}
                    className={
                      "h-9 rounded-xl px-2 motion-safe:transition-colors motion-safe:duration-150 " +
                      (active
                        ? "bg-primary/10 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted")
                    }
                  >
                    <Link to={item.url} className="flex items-center gap-2.5">
                      {/* Apple Settings-style icon container */}
                      <span
                        className="h-[26px] w-[26px] shrink-0 rounded-[7px] flex items-center justify-center"
                        style={{
                          backgroundColor: active
                            ? `color-mix(in srgb, ${iconColor} 15%, transparent)`
                            : "color-mix(in srgb, currentColor 8%, transparent)",
                          color: active ? iconColor : undefined,
                        }}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      {!collapsed && (
                        <span className="text-[13px] leading-none">{item.title}</span>
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
    <SidebarHeader className="border-b border-sidebar-border/60 px-2 py-2.5">
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <img src={isaLogo.url} alt="ISA" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-semibold text-[13px] text-foreground truncate">Ivy Portal</span>
            <span className="text-[11px] text-muted-foreground/70">{label}</span>
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
        {renderGroup("Account", [{ title: "Profile", url: "/profile", icon: UserCircle, color: C.blue }])}
      </SidebarContent>
    </Sidebar>
  );
}
