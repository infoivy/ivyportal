import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, DollarSign, HeartHandshake } from "lucide-react";
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

import { fetchSetNudges, fetchUnclaimedSets, type SetNudge, type UnclaimedSet } from "@/lib/set-nudges";

type StudentAlert = {
  key: string;
  student_id: string;
  student_name: string;
  text: string;
  tone: string;
};

const DAY = 86400000;

/**
 * Computed fulfillment alerts — no table, same pattern as installment
 * reminders. Flags: no student EOD in 3+ days, payment behind, no 1-on-1 in
 * 14+ days (coaching phase), placement interview inside the next 48h.
 */
async function fetchStudentAlerts(): Promise<StudentAlert[]> {
  const now = Date.now();
  const thirty = new Date(now - 30 * DAY).toISOString().slice(0, 10);
  const sixty = new Date(now - 60 * DAY).toISOString().slice(0, 10);
  const [students, eods, calls, placements] = await Promise.all([
    supabase.from("students").select("id, full_name, phase, payment_state, eod_exempt, onboarding_completed_at, created_at, calls_allotted").eq("status", "active"),
    supabase.from("student_eods").select("student_id, report_date").gte("report_date", thirty),
    supabase.from("student_calls").select("student_id, call_date").eq("status", "completed").gte("call_date", sixty),
    supabase.from("student_placements").select("student_id, business_name, interview_at").not("interview_at", "is", null),
  ]);

  const lastEod = new Map<string, string>();
  for (const e of (eods.data ?? []) as { student_id: string; report_date: string }[]) {
    if (e.report_date > (lastEod.get(e.student_id) ?? "")) lastEod.set(e.student_id, e.report_date);
  }
  const lastCall = new Map<string, string>();
  for (const c of (calls.data ?? []) as { student_id: string; call_date: string }[]) {
    if (c.call_date > (lastCall.get(c.student_id) ?? "")) lastCall.set(c.student_id, c.call_date);
  }

  const alerts: StudentAlert[] = [];
  for (const st of (students.data ?? []) as { id: string; full_name: string; phase: string; payment_state: string | null; eod_exempt?: boolean; onboarding_completed_at?: string | null; created_at?: string; calls_allotted?: number | null }[]) {
    // Fresh unlock: the student finished Start Here — check in while it's
    // warm. Backfilled rows have completed_at == created_at; only alert on
    // real completions (stamped later than row creation).
    if (st.onboarding_completed_at && st.created_at !== st.onboarding_completed_at && Date.now() - new Date(st.onboarding_completed_at).getTime() <= 3 * DAY) {
      alerts.push({ key: `onb-${st.id}`, student_id: st.id, student_name: st.full_name, text: "Completed Start Here onboarding — portal unlocked", tone: "text-success-fg" });
    }
    const eodDate = lastEod.get(st.id);
    const eodDays = eodDate ? Math.floor((now - new Date(eodDate).getTime()) / DAY) : null;
    if (st.eod_exempt || !st.onboarding_completed_at) {
      // No missed-EOD alerts while tracking is off — or while the student is
      // still locked in Start Here and literally cannot submit an EOD.
    } else if (eodDays == null) {
      alerts.push({ key: `eod-${st.id}`, student_id: st.id, student_name: st.full_name, text: "No EOD in the last 30 days", tone: "text-danger-fg" });
    } else if (eodDays >= 3) {
      alerts.push({ key: `eod-${st.id}`, student_id: st.id, student_name: st.full_name, text: `No EOD in ${eodDays} days`, tone: eodDays >= 5 ? "text-danger-fg" : "text-warning-fg" });
    }
    if (st.payment_state === "behind") {
      alerts.push({ key: `pay-${st.id}`, student_id: st.id, student_name: st.full_name, text: "Payment behind", tone: "text-danger-fg" });
    }
    // 1:1 cadence only applies once they're through onboarding — the
    // "book your calls" push starts at unlock — and only to the 1:1
    // pathway: group-coaching students (calls_allotted 0) have no 1:1s.
    if (st.onboarding_completed_at && (st.calls_allotted ?? 0) > 0 && ["coaching_1on1", "applying"].includes(st.phase)) {
      const callDate = lastCall.get(st.id);
      const callDays = callDate ? Math.floor((now - new Date(callDate).getTime()) / DAY) : null;
      if (callDays == null || callDays > 14) {
        alerts.push({ key: `call-${st.id}`, student_id: st.id, student_name: st.full_name, text: callDays == null ? "No 1-on-1 on record" : `No 1-on-1 in ${callDays} days`, tone: "text-warning-fg" });
      }
    }
  }
  const nameById = new Map(((students.data ?? []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name]));
  for (const pl of (placements.data ?? []) as { student_id: string; business_name: string; interview_at: string }[]) {
    const t = new Date(pl.interview_at).getTime();
    if (t > now && t - now <= 48 * 3600_000) {
      const hours = Math.max(1, Math.round((t - now) / 3600_000));
      alerts.push({
        key: `int-${pl.student_id}-${pl.interview_at}`,
        student_id: pl.student_id,
        student_name: nameById.get(pl.student_id) ?? "Student",
        text: `Interview at ${pl.business_name} in ${hours}h`,
        tone: "text-success-fg",
      });
    }
  }
  // Worst first: red tones ahead of amber; interviews and fresh unlocks (both
  // time-sensitive positives) on top.
  const rank = (a: StudentAlert) => (a.key.startsWith("int-") || a.key.startsWith("onb-") ? 0 : a.tone.includes("danger") ? 1 : 2);
  return alerts.sort((a, b) => rank(a) - rank(b)).slice(0, 30);
}

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
  const isFulfillment = ["admin", "csm", "coach", "cofounder"].some((r) => roles.includes(r));

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
    queryFn: (): Promise<SetNudge[]> => fetchSetNudges(user!.id),
  });
  const setNudges = setsQ.data ?? [];

  const alertsQ = useQuery({
    queryKey: ["notifications", "students"],
    enabled: !!user && isFulfillment,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    queryFn: fetchStudentAlerts,
  });
  const studentAlerts = alertsQ.data ?? [];

  // Every setter gets pinged about unclaimed closing calls until someone takes them
  const isSetter = roles.includes("setter");
  const unclaimedQ = useQuery({
    queryKey: ["notifications", "unclaimed-sets"],
    enabled: !!user && isSetter,
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
    queryFn: fetchUnclaimedSets,
  });
  const unclaimedSets = unclaimedQ.data ?? [];

  if (!isAdmin && !isCoach && !isFulfillment && !isSetter && setNudges.length === 0) return null;

  const overdue = items.filter(i => i.days < 0).length;
  const dueSoon = items.length - overdue;
  const badgeCount = items.length + setNudges.length + studentAlerts.length + unclaimedSets.length;
  const badgeTone = overdue > 0 || setNudges.length > 0 || unclaimedSets.length > 0 || studentAlerts.some(a => a.tone.includes("danger")) ? "bg-danger" : dueSoon > 0 || studentAlerts.length > 0 ? "bg-warning" : "";

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
          {unclaimedSets.length > 0 && (
            <div className="border-b border-[var(--border)]">
              {unclaimedSets.map(s => (
                <Link key={s.id} to="/calendar" search={{} as never} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition">
                  <div className="mt-0.5 h-6 w-6 rounded-sm bg-danger-bg flex items-center justify-center">
                    <Bell className="h-3 w-3 text-danger-fg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">New set — {s.prospect}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(s.event_start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · nobody owns it yet
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-danger-fg whitespace-nowrap">claim it →</span>
                </Link>
              ))}
            </div>
          )}
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
                      {n.window.startsWith("keep warm") ? n.window : `${n.window} window open · call ${new Date(n.event_start).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-warning-fg whitespace-nowrap">tick it off →</span>
                </Link>
              ))}
            </div>
          )}
          {studentAlerts.length > 0 && (
            <div className="border-b border-[var(--border)]">
              {studentAlerts.map(a => (
                <Link key={a.key} to="/students/$id" params={{ id: a.student_id }} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition">
                  <div className="mt-0.5 h-6 w-6 rounded-sm bg-muted flex items-center justify-center">
                    <HeartHandshake className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">{a.student_name}</div>
                    <div className={`text-[10px] ${a.tone}`}>{a.text}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {items.length === 0 && setNudges.length === 0 && studentAlerts.length === 0 ? (
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
