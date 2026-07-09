import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, StickyNote, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ISA Team" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { displayName, user, roles } = useAuth();
  const [stats, setStats] = useState({ eodsThisWeek: 0, notesToday: 0, todaySubmitted: false });

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    (async () => {
      const [{ count: eodCount }, { data: todayEod }, { count: notesCount }] = await Promise.all([
        supabase.from("eods").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("report_date", weekAgo),
        supabase.from("eods").select("id").eq("user_id", user.id).eq("report_date", today).maybeSingle(),
        supabase.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today),
      ]);
      setStats({ eodsThisWeek: eodCount ?? 0, notesToday: notesCount ?? 0, todaySubmitted: !!todayEod });
    })();
  }, [user]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {displayName?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted-foreground mt-1">Role: {roles.join(", ") || "member"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Today's EOD</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaySubmitted ? "Submitted" : "Pending"}</div>
            <Link to="/eods" className="text-xs text-primary flex items-center gap-1 mt-2">
              {stats.todaySubmitted ? "View" : "Submit now"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">EODs this week</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.eodsThisWeek} / 7</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Notes today</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.notesToday}</div></CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick access</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <QuickLink to="/eods" icon={FileText} title="Submit EOD" desc="Log today's numbers and notes" />
          <QuickLink to="/notes" icon={StickyNote} title="New note" desc="Capture context, wins, objections" />
          <QuickLink to="/sops" icon={BookOpen} title="SOPs" desc="Setting process & playbooks" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary transition-colors h-full">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
