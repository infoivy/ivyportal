import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, CheckCircle2, Calendar, Quote, Loader2,
  Phone, TrendingUp, Users, Trophy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/student-success")({
  head: () => ({ meta: [{ title: "Student Success HQ — ISA" }] }),
  component: StudentSuccessHQ,
});

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  phase: string;
  status: string;
  coach_id: string | null;
  join_date: string;
  testimonial_collected: boolean;
  payment_state: string | null;
};

type CallRow = { student_id: string; call_date: string; next_call_date: string | null };
type InstallmentPayment = { id: string; student_id?: string; status: string; due_date: string; installment_id: string };
type Installment = { id: string; student_id: string };
type AdHocItem = { id: string; student_id: string; text: string; done: boolean; due_date: string | null; created_at: string };
type CsmNote = { student_id: string; created_at: string };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function StudentSuccessHQ() {
  const { roles } = useAuth();
  const canView = roles.some(r => ["admin", "csm", "coach", "founder"].includes(r));

  if (!canView) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Admin, CSM, coach, or founder access required.
        </div>
      </div>
    );
  }

  return <StudentSuccessInner />;
}

function StudentSuccessInner() {
  const today = isoDate(new Date());
  const sevenDaysAgo = isoDate(new Date(Date.now() - 7 * 86400000));
  const fourteenDaysAgo = isoDate(new Date(Date.now() - 14 * 86400000));

  // Monday of current week
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return isoDate(d);
  })();
  const weekEnd = isoDate(new Date(new Date(weekStart).getTime() + 6 * 86400000));

  // Start of current month
  const monthStart = today.slice(0, 8) + "01";

  const [students, setStudents] = useState<Student[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [payments, setPayments] = useState<(InstallmentPayment & { student_id: string })[]>([]);
  const [adhoc, setAdhoc] = useState<AdHocItem[]>([]);
  const [csmNotes, setCsmNotes] = useState<CsmNote[]>([]);
  const [studentEods, setStudentEods] = useState<{ student_id: string; report_date: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [studRes, callsRes, instRes, payRes, adhocRes, eodRes, noteRes, profRes] = await Promise.all([
      supabase.from("students").select("id, full_name, email, phase, status, coach_id, join_date, testimonial_collected, payment_state").order("full_name"),
      supabase.from("student_calls").select("student_id, call_date, next_call_date").order("call_date", { ascending: false }).limit(2000),
      supabase.from("installments").select("id, student_id"),
      supabase.from("installment_payments").select("id, installment_id, status, due_date"),
      supabase.from("student_action_items").select("id, student_id, text, done, due_date, created_at").eq("done", false).order("due_date", { ascending: true }),
      supabase.from("student_eods").select("student_id, report_date").gte("report_date", sevenDaysAgo),
      supabase.from("csm_student_notes").select("student_id, created_at").gte("created_at", fourteenDaysAgo + "T00:00:00"),
      supabase.from("profiles").select("id, display_name"),
    ]);

    const studs = (studRes.data ?? []) as Student[];
    setStudents(studs);
    setCalls((callsRes.data ?? []) as CallRow[]);

    // Join installment_payments with student_id via installments
    const instMap = new Map<string, string>();
    ((instRes.data ?? []) as Installment[]).forEach(i => instMap.set(i.id, i.student_id));
    const enrichedPayments = ((payRes.data ?? []) as InstallmentPayment[]).map(p => ({
      ...p,
      student_id: instMap.get(p.installment_id) ?? "",
    })).filter(p => p.student_id);
    setPayments(enrichedPayments);

    setAdhoc((adhocRes.data ?? []) as AdHocItem[]);
    setStudentEods((eodRes.data ?? []) as { student_id: string; report_date: string }[]);
    setCsmNotes((noteRes.data ?? []) as CsmNote[]);

    const profMap: Record<string, string> = {};
    ((profRes.data ?? []) as any[]).forEach(p => { profMap[p.id] = p.display_name ?? "Unnamed"; });
    setProfiles(profMap);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // At-risk detection
  const atRisk = useMemo(() => {
    const recentCallByStudent = new Map<string, string>();
    calls.forEach(c => {
      const existing = recentCallByStudent.get(c.student_id);
      if (!existing || c.call_date > existing) recentCallByStudent.set(c.student_id, c.call_date);
    });

    const eodsByStudent = new Set(studentEods.map(e => e.student_id));

    const lateStudentIds = new Set(
      payments.filter(p => p.status === "late" || p.status === "missed").map(p => p.student_id)
    );

    return students.filter(s => {
      if (s.phase === "graduated" || s.phase === "paused") return false;
      const lastCall = recentCallByStudent.get(s.id);
      const noRecentCall = !lastCall || lastCall < fourteenDaysAgo;
      const isGhosting = s.status === "ghosting";
      const noRecentEod = !eodsByStudent.has(s.id);
      const paymentLate = lateStudentIds.has(s.id);
      return noRecentCall || isGhosting || noRecentEod || paymentLate;
    });
  }, [students, calls, studentEods, payments]);

  // This week's 1:1s
  const thisWeekCalls = useMemo(() => {
    const seen = new Map<string, CallRow>();
    calls.forEach(c => {
      if (c.call_date >= weekStart && c.call_date <= weekEnd) {
        if (!seen.has(c.student_id) || c.call_date > seen.get(c.student_id)!.call_date) {
          seen.set(c.student_id, c);
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.call_date.localeCompare(b.call_date));
  }, [calls, weekStart, weekEnd]);

  // Open action items grouped by student
  const actionByStudent = useMemo(() => {
    const map = new Map<string, AdHocItem[]>();
    adhoc.forEach(a => {
      const list = map.get(a.student_id) ?? [];
      list.push(a);
      map.set(a.student_id, list);
    });
    return map;
  }, [adhoc]);

  // Pending testimonials
  const pendingTestimonials = useMemo(() =>
    students.filter(s =>
      !s.testimonial_collected &&
      (s.phase === "coaching_1on1" || s.phase === "graduated")
    ),
    [students]
  );

  // Weekly digest stats
  const digest = useMemo(() => {
    const newThisWeek = students.filter(s => s.join_date >= weekStart).length;
    const graduated = students.filter(s => s.phase === "graduated").length;
    const activeCsmNotes = csmNotes.length;
    const callsThisWeek = thisWeekCalls.length;
    return { newThisWeek, graduated, activeCsmNotes, callsThisWeek };
  }, [students, csmNotes, thisWeekCalls, weekStart]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const studentName = (id: string) => students.find(s => s.id === id)?.full_name ?? "Unknown";

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-foreground leading-none">Student Success</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">At-risk flags, this week's calls, open action items, testimonial pipeline.</p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryChip label="At-risk" value={atRisk.length} icon={<AlertTriangle className="h-3.5 w-3.5" />} accent={atRisk.length > 0 ? "red" : "green"} />
          <SummaryChip label="Calls this week" value={thisWeekCalls.length} icon={<Phone className="h-3.5 w-3.5" />} />
          <SummaryChip label="Open action items" value={adhoc.length} icon={<CheckCircle2 className="h-3.5 w-3.5" />} accent={adhoc.length > 0 ? "amber" : "green"} />
          <SummaryChip label="Testimonials pending" value={pendingTestimonials.length} icon={<Quote className="h-3.5 w-3.5" />} accent={pendingTestimonials.length > 0 ? "amber" : "green"} />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="action-items" className="text-xs">Action Items {adhoc.length > 0 ? `(${adhoc.length})` : ""}</TabsTrigger>
            <TabsTrigger value="testimonials" className="text-xs">Testimonials {pendingTestimonials.length > 0 ? `(${pendingTestimonials.length})` : ""}</TabsTrigger>
            <TabsTrigger value="digest" className="text-xs">Weekly Digest</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5">
            {/* At-risk */}
            <section className="space-y-2">
              <h2 className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" /> At-risk students
              </h2>
              {atRisk.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-400 border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-3">
                  <CheckCircle2 className="h-4 w-4" /> No at-risk students right now.
                </div>
              ) : (
                <div className="rounded-sm border border-red-500/20 bg-card overflow-hidden">
                  {atRisk.map(s => {
                    const flags: string[] = [];
                    const recentCall = calls.find(c => c.student_id === s.id);
                    const lastCallDate = calls.filter(c => c.student_id === s.id)[0]?.call_date;
                    if (!lastCallDate || lastCallDate < fourteenDaysAgo) flags.push("No call in 14d");
                    if (s.status === "ghosting") flags.push("Ghosting");
                    if (!studentEods.some(e => e.student_id === s.id)) flags.push("No EOD in 7d");
                    if (payments.some(p => p.student_id === s.id && (p.status === "late" || p.status === "missed"))) flags.push("Payment late");
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-accent last:border-0">
                        <div>
                          <Link to="/students/$id" params={{ id: s.id }} className="text-sm font-medium hover:text-green-400 transition">
                            {s.full_name}
                          </Link>
                          <div className="flex gap-1.5 mt-0.5 flex-wrap">
                            {flags.map(f => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400">{f}</span>
                            ))}
                          </div>
                        </div>
                        <span className={`text-[12px] px-2 py-0.5 rounded-md border ${
                          s.status === "ghosting" ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : s.status === "active" ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : "border-zinc-500/30 bg-zinc-500/5 text-zinc-400"
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* This week's calls */}
            <section className="space-y-2">
              <h2 className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-blue-400" /> This week's 1:1s ({weekStart} – {weekEnd})
              </h2>
              {thisWeekCalls.length === 0 ? (
                <div className="text-xs text-muted-foreground border border-dashed border-border rounded-sm p-4 text-center">
                  No 1:1 calls logged this week yet.
                </div>
              ) : (
                <div className="rounded-sm border border-border bg-card overflow-hidden">
                  {thisWeekCalls.map(c => (
                    <div key={c.student_id + c.call_date} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-accent last:border-0">
                      <Link to="/students/$id" params={{ id: c.student_id }} className="text-sm font-medium hover:text-green-400 transition">
                        {studentName(c.student_id)}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{c.call_date}</span>
                        {c.next_call_date && (
                          <span className="text-[10px] text-muted-foreground">→ next: {c.next_call_date}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ─── ACTION ITEMS TAB ─────────────────────────────── */}
          <TabsContent value="action-items" className="space-y-3">
            <h2 className="text-[13px] text-muted-foreground">Open action items by student</h2>
            {adhoc.length === 0 ? (
              <div className="text-xs text-green-400 border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> All action items resolved.
              </div>
            ) : (
              Array.from(actionByStudent.entries()).map(([sid, items]) => (
                <div key={sid} className="rounded-sm border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-card">
                    <Link to="/students/$id" params={{ id: sid }} className="text-xs font-semibold hover:text-green-400 transition">
                      {studentName(sid)}
                    </Link>
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-accent last:border-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs">{item.text}</div>
                        {item.due_date && (
                          <div className={`text-[10px] mt-0.5 ${item.due_date < today ? "text-red-400" : "text-muted-foreground"}`}>
                            Due {item.due_date}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </TabsContent>

          {/* ─── TESTIMONIALS TAB ─────────────────────────────── */}
          <TabsContent value="testimonials" className="space-y-3">
            <h2 className="text-[13px] text-muted-foreground">Pending testimonials</h2>
            <p className="text-xs text-muted-foreground">Students in coaching or graduated phase who haven't provided a testimonial yet.</p>
            {pendingTestimonials.length === 0 ? (
              <div className="text-xs text-green-400 border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> All eligible students have testimonials.
              </div>
            ) : (
              <div className="rounded-sm border border-border bg-card overflow-hidden">
                {pendingTestimonials.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-accent last:border-0">
                    <Link to="/students/$id" params={{ id: s.id }} className="text-sm font-medium hover:text-green-400 transition">
                      {s.full_name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] px-2 py-0.5 rounded-md border ${
                        s.phase === "graduated"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      }`}>
                        {s.phase === "graduated" ? "Graduated" : "1:1 Coaching"}
                      </span>
                      <Link to="/students/$id" params={{ id: s.id }} className="text-[11px] px-2 py-1 rounded-sm border border-border text-muted-foreground hover:text-foreground transition">
                        Request →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── WEEKLY DIGEST TAB ────────────────────────────── */}
          <TabsContent value="digest" className="space-y-3">
            <h2 className="text-[13px] text-muted-foreground">Weekly digest — {weekStart} to {weekEnd}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DigestCard label="New students this week" value={digest.newThisWeek} icon={<Users className="h-4 w-4 text-sky-400" />} />
              <DigestCard label="Total graduated" value={digest.graduated} icon={<Trophy className="h-4 w-4 text-amber-400" />} />
              <DigestCard label="1:1s this week" value={digest.callsThisWeek} icon={<Phone className="h-4 w-4 text-blue-400" />} />
              <DigestCard label="CSM notes (14d)" value={digest.activeCsmNotes} icon={<TrendingUp className="h-4 w-4 text-green-400" />} />
            </div>
            <div className="rounded-sm border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold">At-a-glance</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>· {students.filter(s => s.status === "active").length} active students across all phases</li>
                <li>· {atRisk.length} at-risk flag{atRisk.length !== 1 ? "s" : ""} to resolve</li>
                <li>· {pendingTestimonials.length} testimonial{pendingTestimonials.length !== 1 ? "s" : ""} to collect</li>
                <li>· {adhoc.length} open action item{adhoc.length !== 1 ? "s" : ""}</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode;
  accent?: "red" | "amber" | "green";
}) {
  const color = accent === "red" ? "text-red-400" : accent === "amber" ? "text-amber-400" : accent === "green" ? "text-green-400" : "text-foreground";
  return (
    <div className="card-surface p-3">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className={`text-[20px] font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function DigestCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="card-surface p-4 space-y-2">
      <div className="flex items-center gap-2">{icon}<span className="text-[12px] text-muted-foreground">{label}</span></div>
      <div className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
    </div>
  );
}
