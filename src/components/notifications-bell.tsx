import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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

function bucketLabel(days: number) {
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: "text-red-400" };
  if (days === 0) return { text: "Due today", tone: "text-amber-400" };
  if (days === 1) return { text: "Due tomorrow", tone: "text-amber-300" };
  return { text: `Due in ${days}d`, tone: "text-muted-foreground" };
}

export function NotificationsBell() {
  const { user, roles } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const isAdmin = roles.includes("admin");
  const isCoach = roles.includes("coach");

  const load = async () => {
    if (!user || (!isAdmin && !isCoach)) return;
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

    if (!isAdmin && isCoach) {
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
    setItems(mapped);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, isCoach]);

  if (!isAdmin && !isCoach) return null;

  const overdue = items.filter(i => i.days < 0).length;
  const dueSoon = items.length - overdue;
  const badgeCount = items.length;
  const badgeTone = overdue > 0 ? "bg-red-500" : dueSoon > 0 ? "bg-amber-500" : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 flex items-center justify-center rounded-sm border border-[#1f2530] bg-[#0f1116] text-muted-foreground hover:text-foreground transition"
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
      <PopoverContent align="end" className="w-80 p-0 bg-[#0f1116] border-[#1f2530]">
        <div className="px-3 py-2 border-b border-[#1f2530] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reminders</span>
          <span className="text-[10px] text-muted-foreground">
            {overdue > 0 && <span className="text-red-400">{overdue} overdue · </span>}
            {dueSoon} upcoming
          </span>
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No installment reminders</div>
          ) : (
            items.map(item => {
              const b = bucketLabel(item.days);
              return (
                <Link
                  key={item.id}
                  to={item.student_id ? "/students/$id" : "/installments"}
                  params={item.student_id ? { id: item.student_id } : (undefined as any)}
                  className="flex items-start gap-2 px-3 py-2 border-b border-[#1f2530] hover:bg-[#141821] transition"
                >
                  <div className="mt-0.5 h-6 w-6 rounded-sm bg-[#141821] flex items-center justify-center">
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
