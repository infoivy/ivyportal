import { Link } from "@tanstack/react-router";
import { friendlyPastDay } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays, ClipboardCheck, ClipboardList, GraduationCap,
  HeartPulse, MessageCircle, Sparkles, UserPlus, Users, Hourglass, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, startOfWeek, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useStudentHealth } from "@/lib/use-student-health";

/**
 * Faizan's home picture (founder 2026-07-31, expanded same day): he runs
 * fulfillment, so his overview leads with delivery truth — are students
 * active, checked in, reporting, moving through onboarding, and being
 * worked by the CSMs. Depth lives in the CSM table and the coldest list.
 */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

const PHASE_ORDER = ["onboarding", "training", "applying", "offer_won", "paused"] as const;
const PHASE_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  training: "Training",
  applying: "Applying",
  offer_won: "Offer won",
  paused: "Paused",
  coaching_1on1: "Training", // legacy phase folds into training
};

type CsmRow = {
  id: string;
  name: string;
  checkinsToday: number;
  checkinsWeek: number;
  loomsWeek: number;
  roleplaysWeek: number;
  escalationsWeek: number;
  notesWeek: number;
};

export function HomeFulfillmentPicture() {
  const health = useStudentHealth();

  const q = useQuery({
    queryKey: ["page", "home", "fulfillment"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const today = iso(new Date());
      const weekStart = iso(startOfWeek(new Date(), { weekStartsOn: 1 }));
      const twoWeeksAgo = iso(subDays(new Date(), 13));
      const sevenDaysAgo = iso(subDays(new Date(), 7));
      const inSevenDays = iso(subDays(new Date(), -7));
      const [studentsRes, checkinsRes, tallyGenRes, tallyStuRes, eodsRes, itemsRes, callsRes, csmRolesRes, profilesRes, notesRes] = await Promise.all([
        supabase.from("students").select("id, full_name, phase, status, created_at, onboarding_completed_at, testimonial_collected, first_win_at").eq("is_demo", false).is("archived_at" as never, null),
        (supabase.from("student_checkins" as never).select("student_id, csm_id, checked_at").gte("checked_at", twoWeeksAgo) as any),
        supabase.from("csm_tally").select("user_id, kind, created_at").is("student_id", null).gte("created_at", weekStart + "T00:00:00"),
        supabase.from("csm_tally").select("user_id, kind, created_at, students!inner(is_demo)").eq("students.is_demo", false).is("students.archived_at" as never, null).gte("created_at", weekStart + "T00:00:00"),
        supabase.from("student_eods").select("student_id, report_date, students!inner(is_demo)").eq("students.is_demo", false).is("students.archived_at" as never, null).gte("report_date", twoWeeksAgo),
        supabase.from("student_action_items").select("id, due_date, done, students!inner(is_demo)").eq("students.is_demo", false).is("students.archived_at" as never, null).eq("done", false),
        supabase.from("student_calls").select("id, students!inner(is_demo)", { count: "exact", head: true }).eq("students.is_demo", false).is("students.archived_at" as never, null).is("voided_at", null).eq("status", "scheduled").gte("call_date", today).lte("call_date", inSevenDays),
        supabase.from("user_roles").select("user_id").eq("role", "csm"),
        supabase.from("profiles").select("id, display_name").eq("is_demo", false),
        supabase.from("csm_student_notes").select("id, student_id, user_id, note, created_at, students!inner(is_demo)").eq("students.is_demo", false).is("students.archived_at" as never, null).order("created_at", { ascending: false }).limit(12),
      ]);

      const students = (studentsRes.data ?? []) as unknown as {
        id: string; full_name: string; phase: string; status: string;
        created_at: string; onboarding_completed_at: string | null;
        testimonial_collected: boolean | null; first_win_at: string | null;
      }[];
      const active = students.filter((s) => s.status === "active");
      const phaseCounts = new Map<string, number>();
      for (const s of active) {
        const label = PHASE_LABEL[s.phase] ?? s.phase;
        phaseCounts.set(label, (phaseCounts.get(label) ?? 0) + 1);
      }

      // Intake + onboarding movement
      const newThisWeek = students.filter((s) => s.created_at.slice(0, 10) >= weekStart).length;
      const stuckOnboarding = active.filter(
        (s) => s.phase === "onboarding" && !s.onboarding_completed_at && s.created_at.slice(0, 10) <= sevenDaysAgo,
      ).length;
      const testimonialsReady = active.filter((s) => s.first_win_at && s.testimonial_collected === false).length;

      // Check-in coverage: covered today vs due (2+ days or never), active
      // working phases only — same rule as the CSM coverage queue.
      const coveredPhases = new Set(["onboarding", "training", "applying", "coaching_1on1"]);
      const coverageStudents = active.filter((s) => coveredPhases.has(s.phase));
      const lastCheckin = new Map<string, string>();
      const checkins = ((checkinsRes.data ?? []) as { student_id: string; csm_id: string; checked_at: string }[]);
      for (const c of checkins) {
        const day = c.checked_at.slice(0, 10);
        const prev = lastCheckin.get(c.student_id);
        if (!prev || day > prev) lastCheckin.set(c.student_id, day);
      }
      const twoDaysAgo = iso(subDays(new Date(), 2));
      const checkedToday = coverageStudents.filter((s) => lastCheckin.get(s.id) === today).length;
      const dueCheckin = coverageStudents.filter((s) => {
        const last = lastCheckin.get(s.id);
        return !last || last <= twoDaysAgo;
      }).length;
      // Coldest first: who has waited longest (never checked in sorts first).
      const coldest = coverageStudents
        .map((s) => {
          const last = lastCheckin.get(s.id);
          const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86_400_000) : null;
          return { id: s.id, name: s.full_name, days };
        })
        .filter((s) => s.days === null || s.days >= 2)
        .sort((a, b) => (b.days ?? 999) - (a.days ?? 999))
        .slice(0, 5);

      // Student EODs: filed today + quiet for 14 days.
      const eods = (eodsRes.data ?? []) as { student_id: string; report_date: string }[];
      const filedToday = new Set(eods.filter((e) => e.report_date === today).map((e) => e.student_id)).size;
      const reported14 = new Set(eods.map((e) => e.student_id));
      const quiet14 = active.filter((s) => !reported14.has(s.id)).length;

      const items = (itemsRes.data ?? []) as { id: string; due_date: string | null }[];
      const overdueItems = items.filter((i) => i.due_date && i.due_date < today).length;

      // Per-CSM activity: check-ins from student_checkins, looms/roleplays/
      // escalations from csm_tally (generic + student-scoped merged).
      const csmIds = ((csmRolesRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id);
      const nameOf = new Map(((profilesRes.data ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "Unknown"]));
      const tally = [
        ...((tallyGenRes.data ?? []) as { user_id: string; kind: string; created_at: string }[]),
        ...((tallyStuRes.data ?? []) as { user_id: string; kind: string; created_at: string }[]),
      ];
      // Latest CSM notes: the founder wants to SEE who writes notes and who
      // doesn't — recent notes verbatim plus a per-CSM weekly note count.
      const studentName = new Map(students.map((s) => [s.id, s.full_name]));
      const notes = ((notesRes.data ?? []) as unknown as { id: string; student_id: string; user_id: string | null; note: string; created_at: string }[])
        .map((n) => ({
          id: n.id,
          when: n.created_at,
          csm: n.user_id ? (nameOf.get(n.user_id) ?? "Unknown") : "Unknown",
          student: studentName.get(n.student_id) ?? "Unknown",
          studentId: n.student_id,
          note: n.note,
        }));
      const notesWeekBy = new Map<string, number>();
      for (const n of ((notesRes.data ?? []) as unknown as { user_id: string | null; created_at: string }[])) {
        if (!n.user_id || n.created_at.slice(0, 10) < weekStart) continue;
        notesWeekBy.set(n.user_id, (notesWeekBy.get(n.user_id) ?? 0) + 1);
      }

      const csmRows: CsmRow[] = csmIds
        .filter((id) => nameOf.has(id))
        .map((id) => {
          const mine = tally.filter((t) => t.user_id === id);
          const myCheckins = checkins.filter((c) => c.csm_id === id);
          return {
            id,
            name: nameOf.get(id)!,
            checkinsToday: myCheckins.filter((c) => c.checked_at.slice(0, 10) === today).length,
            checkinsWeek: myCheckins.filter((c) => c.checked_at.slice(0, 10) >= weekStart).length,
            loomsWeek: mine.filter((t) => t.kind === "loom").length,
            roleplaysWeek: mine.filter((t) => t.kind === "roleplay").length,
            escalationsWeek: mine.filter((t) => t.kind === "escalation").length,
            notesWeek: notesWeekBy.get(id) ?? 0,
          };
        })
        .sort((a, b) => b.checkinsWeek - a.checkinsWeek);

      return {
        activeCount: active.length,
        phaseCounts: [...phaseCounts.entries()].sort(
          (a, b) => PHASE_ORDER.findIndex((p) => PHASE_LABEL[p] === a[0]) - PHASE_ORDER.findIndex((p) => PHASE_LABEL[p] === b[0]),
        ),
        newThisWeek,
        stuckOnboarding,
        testimonialsReady,
        checkedToday,
        dueCheckin,
        coldest,
        filedToday,
        quiet14,
        openItems: items.length,
        overdueItems,
        callsWeek: callsRes.count ?? 0,
        csmRows,
        notes,
      };
    },
  });

  const d = q.data;
  const bands = (() => {
    let red = 0, amber = 0;
    for (const h of health.data?.values() ?? []) {
      if (h.band === "red") red += 1;
      else if (h.band === "amber") amber += 1;
    }
    return { red, amber };
  })();

  return (
    <section className="card-surface overflow-hidden" aria-labelledby="fulfillment-picture-title">
      <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fulfillment</p>
        <h2 id="fulfillment-picture-title" className="mt-1 text-title font-semibold text-foreground">Delivery picture</h2>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        <Tile icon={Users} label="Active students" detail={`${d?.newThisWeek ?? 0} joined this week`} value={d?.activeCount} to="/students" />
        <Tile icon={HeartPulse} label="At risk" detail={`${bands.amber} more to watch`} value={bands.red} to="/student-success" tone={bands.red > 0 ? "danger" : undefined} />
        <Tile icon={MessageCircle} label="Checked in today" detail={`${d?.dueCheckin ?? 0} due a check-in (2+ days)`} value={d?.checkedToday} to="/csm" tone={(d?.dueCheckin ?? 0) > 0 ? "warning" : undefined} />
        <Tile icon={ClipboardCheck} label="Student EODs today" detail={`${d?.quiet14 ?? 0} quiet for 14+ days`} value={d?.filedToday} to="/student-success" />
        <Tile icon={Hourglass} label="Stuck in onboarding" detail="7+ days without finishing Start Here" value={d?.stuckOnboarding} to="/students" tone={(d?.stuckOnboarding ?? 0) > 0 ? "warning" : undefined} />
        <Tile icon={ClipboardList} label="Action items open" detail={`${d?.overdueItems ?? 0} overdue`} value={d?.openItems} to="/action-items" tone={(d?.overdueItems ?? 0) > 0 ? "warning" : undefined} />
        <Tile icon={Sparkles} label="Testimonials ready" detail="First win recorded, not collected" value={d?.testimonialsReady} to="/testimonials" />
        <Tile icon={CalendarDays} label="1-on-1 calls next 7 days" detail="Scheduled coaching and support" value={d?.callsWeek} to="/calls" />
        <Tile icon={UserPlus} label="New students this week" detail="Joined since Monday" value={d?.newThisWeek} to="/students" />
      </div>
      {d && d.phaseCounts.length > 0 && (
        <div className="border-t border-border px-5 py-3 sm:px-6 text-caption text-muted-foreground tabular-nums">
          {d.phaseCounts.map(([label, n], i) => (
            <span key={label}>{i > 0 && " · "}{label} <span className="font-medium text-foreground">{n}</span></span>
          ))}
        </div>
      )}
      {d && d.coldest.length > 0 && (
        <div className="border-t border-border px-5 py-3 sm:px-6 text-caption text-muted-foreground">
          Longest without a check-in:{" "}
          {d.coldest.map((s, i) => (
            <span key={s.id}>
              {i > 0 && " · "}
              <Link to="/students/$id" params={{ id: s.id }} className="text-foreground font-medium hover:underline">{s.name}</Link>
              {" "}({s.days === null ? "never" : `${s.days}d`})
            </span>
          ))}
        </div>
      )}
      {d && d.csmRows.length > 0 && (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-caption font-medium text-foreground flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-muted-foreground" /> CSM activity this week</p>
            <Link to={"/csm" as string} className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open workspace <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-caption">
              <thead>
                <tr className="text-micro text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">CSM</th>
                  <th className="text-right py-1.5 font-medium">Check-ins today</th>
                  <th className="text-right py-1.5 font-medium">This week</th>
                  <th className="text-right py-1.5 font-medium">Looms</th>
                  <th className="text-right py-1.5 font-medium">Roleplays</th>
                  <th className="text-right py-1.5 font-medium">Notes</th>
                  <th className="text-right py-1.5 font-medium">Escalations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.csmRows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium text-foreground">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">{r.checkinsToday}</td>
                    <td className="py-2 text-right tabular-nums">{r.checkinsWeek}</td>
                    <td className="py-2 text-right tabular-nums">{r.loomsWeek}</td>
                    <td className="py-2 text-right tabular-nums">{r.roleplaysWeek}</td>
                    <td className={`py-2 text-right tabular-nums ${r.notesWeek === 0 ? "text-warning-fg" : ""}`}>{r.notesWeek}</td>
                    <td className={`py-2 text-right tabular-nums ${r.escalationsWeek > 0 ? "text-warning-fg" : ""}`}>{r.escalationsWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {d && d.notes.length > 0 && (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <p className="text-caption font-medium text-foreground mb-2">Latest CSM notes</p>
          <div className="space-y-2.5">
            {d.notes.slice(0, 6).map((n) => (
              <div key={n.id} className="text-caption">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">{n.csm}</span>
                  <span className="text-muted-foreground">on</span>
                  <Link to="/students/$id" params={{ id: n.studentId }} className="font-medium text-foreground hover:underline">{n.student}</Link>
                  <span className="text-micro text-muted-foreground">{friendlyPastDay(n.when)}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Tile({ icon: Icon, label, detail, value, to, tone }: {
  icon: LucideIcon;
  label: string;
  detail: string;
  value: number | undefined;
  to: string;
  tone?: "danger" | "warning";
}) {
  return (
    <Link
      to={to as string}
      className="group grid min-h-16 grid-cols-[28px_minmax(0,1fr)_auto_18px] items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/40 motion-safe:transition-colors sm:odd:border-r xl:[&:nth-child(3n)]:border-r-0 xl:[&:not(:nth-child(3n))]:border-r sm:px-6"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-foreground">{label}</span>
        <span className="block truncate text-caption text-muted-foreground">{detail}</span>
      </span>
      <span className={`text-lg font-medium tabular-nums ${tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : "text-foreground"}`}>
        {value ?? "…"}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground motion-safe:transition-colors" />
    </Link>
  );
}
