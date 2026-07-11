import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, DollarSign } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Reminder = {
  id: string;
  student_id: string | null;
  student_name: string;
  amount: number;
  currency: string;
  due_date: string;
  days: number; // negative = overdue
};

type SetNudge = { id: string; prospect: string; event_start: string; window: string };

const SET_WINDOWS: { key: string; minutes: number }[] = [
  { key: "48h", minutes: 48 * 60 },
  { key: "24h", minutes: 24 * 60 },
  { key: "3h", minutes: 3 * 60 },
  { key: "1h", minutes: 60 },
];

function bucketLabel(days: number) {
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: "text-danger-fg" };
  if (days === 0) return { text: "Due today", tone: "text-warning-fg" };
  if (days === 1) return { text: "Due tomorrow", tone: "text-warning-fg" };
  return { text: `Due in ${days}d`, tone: "text-muted-foreground" };
}

export function NotificationsBell() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCoach = roles.includes("coach");

  const fetchReminders = async (): Promise<Reminder[]> => {
    const today = new Date();
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);
    const to = in3.toISOString().slice(0, 10);

    let q = supabase
      .from("installment_payments")
      .select("id, amount, currency, due_date, installments!inner(coach_id, student_id, students(id, full_name))")
      .eq("status", "upcoming")
      .lte("due_date", to)
      .order("due_date", { ascending: true })
      .limit(50);

    if (!isAdmin && isCoach && user) {
      q = q.eq("installments.coach_id", user.id);
    }

    const { data } = await q;
    const now = new Date(new Date().toISOString().slice(0, 10));
    const mapped: Reminder[] = (data ?? []).map((r: any) => {
      const due = new Date(r.due_date);
      const days = Math.round((due.getTime() - now.getTime()) / 86400000);
      const student = r.installments?.students;
      return {
        id: r.id,
        student_id: student?.id ?? null,
        student_name: student?.full_name ?? "Unknown student",
        amount: r.amount,
        currency: r.currency,
        due_date: r.due_date,
        days,
      };
    });
    return mapped;
  };

  const q = useQuery({
    queryKey: ["notifications", "installments", user?.id, isAdmin, isCoach],
    queryFn: fetchReminders,
    enabled: !!user && (isAdmin || isCoach),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  const items = q.data ?? [];

  // My claimed sets with an open, unticked reminder window → nudge me.
  const setsQ = useQuery({
    queryKey: ["notifications", "sets", user?.id],
    enabled: !!user,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    queryFn: async (): Promise<SetNudge[]> => {
      const { data } = await supabase
        .from("set_reminders")
        .select("id, prospect, event_start, reminder_log, confirmed_at, status")
        .eq("owner_id", user!.id)
        .eq("status", "active")
        .gte("event_start", new Date().toISOString())
        .order("event_start")
        .limit(30);
      const now = Date.now();
      const out: SetNudge[] = [];
      for (const r of (data ?? []) as any[]) {
        const msLeft = new Date(r.event_start).getTime() - now;
        // the tightest window that is open but not ticked yet
        const due = SET_WINDOWS.filter(w => msLeft <= w.minutes * 60_000 && !(r.reminder_log ?? {})[w.key]);
        if (due.length) out.push({ id: r.id, prospect: r.prospect, event_start: r.event_start, window: due[due.length - 1].key });
      }
      return out;
    },
  });
  const setNudges = setsQ.data ?? [];

  if (!isAdmin && !isCoach && setNudges.length === 0) return null;

  const overdue = items.filter(i => i.days < 0).length;
  const dueSoon = items.length - overdue;
  const badgeCount = items.length + setNudges.length;
  const badgeTone = overdue > 0 || setNudges.length > 0 ? "bg-danger" : dueSoon > 0 ? "bg-warning" : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 flex items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--card)] text-muted-foreground hover:text-foreground transition"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {badgeCount > 0 && (
            <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center text-white ${badgeTone}`}>
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-[var(--card)] border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reminders</span>
          <span className="text-[10px] text-muted-foreground">
            {overdue > 0 && <span className="text-danger-fg">{overdue} overdue · </span>}
            {dueSoon} upcoming
          </span>
        </div>
        <div className="max-h-96 overflow-auto">
          {setNudges.length > 0 && (
            <div className="border-b border-[var(--border)]">
              {setNudges.map(n => (
                <Link key={n.id} to="/calendar" search={{} as never} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition">
                  <div className="mt-0.5 h-6 w-6 rounded-sm bg-warning-bg flex items-center justify-center">
                    <Bell className="h-3 w-3 text-warning-fg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">Remind {n.prospect}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {n.window} window open · call {new Date(n.event_start).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-warning-fg whitespace-nowrap">tick it off →</span>
                </Link>
              ))}
            </div>
          )}
          {items.length === 0 && setNudges.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">Nothing needs you right now</div>
          ) : (
            items.map(item => {
              const b = bucketLabel(item.days);
              return (
                <Link
                  key={item.id}
                  to={item.student_id ? "/students/$id" : "/installments"}
                  params={item.student_id ? { id: item.student_id } : (undefined as any)}
                  className="flex items-start gap-2 px-3 py-2 border-b border-[var(--border)] hover:bg-muted/50 transition"
                >
                  <div className="mt-0.5 h-6 w-6 rounded-sm bg-muted flex items-center justify-center">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">{item.student_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.currency} {Number(item.amount).toLocaleString()} · {item.due_date}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${b.tone}`}>{b.text}</span>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
