import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { toast } from "sonner";
import { ListTodo, PhoneCall, Plus, ArrowRight, CheckCircle2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useStudentHealth } from "@/lib/use-student-health";
import { BAND_META } from "@/lib/student-health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { humanDue } from "@/lib/dates";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86400000;

/**
 * The CSM's morning answer to "who needs me today?": active students ranked
 * red → amber → green, tiebroken by how long since fulfillment last touched
 * them (check-in, note, or completed 1-on-1). Coverage target: every active
 * student touched every 3 days.
 */
export function CsmTodayQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: healthMap } = useStudentHealth();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [itemText, setItemText] = useState("");
  const [itemDue, setItemDue] = useState<Date | undefined>(undefined);
  const [dueOpen, setDueOpen] = useState(false);

  const q = useQuery({
    queryKey: ["csm-today-queue"],
    staleTime: 60_000,
    queryFn: async () => {
      const fourteen = new Date(Date.now() - 14 * DAY).toISOString();
      const [students, tallies, notes, calls] = await Promise.all([
        supabase.from("students").select("id, full_name, phase, status").eq("status", "active"),
        supabase.from("csm_tally").select("student_id, created_at, kind, user_id").gte("created_at", fourteen),
        supabase.from("csm_student_notes").select("student_id, created_at").gte("created_at", fourteen),
        supabase.from("student_calls").select("student_id, call_date").eq("status", "completed").gte("call_date", iso(new Date(Date.now() - 14 * DAY))),
      ]);
      const lastTouch = new Map<string, number>();
      const bump = (sid: string | null, t: string) => {
        if (!sid) return;
        const ms = new Date(t).getTime();
        if (ms > (lastTouch.get(sid) ?? 0)) lastTouch.set(sid, ms);
      };
      // Checked off = I logged a check-in for them today (local day).
      const todayLocal = new Intl.DateTimeFormat("en-CA").format(new Date());
      const checkedToday = new Set<string>();
      for (const t of (tallies.data ?? []) as any[]) {
        bump(t.student_id, t.created_at);
        if (t.kind === "checkin" && t.student_id && new Intl.DateTimeFormat("en-CA").format(new Date(t.created_at)) === todayLocal) {
          checkedToday.add(t.student_id);
        }
      }
      for (const n of (notes.data ?? []) as any[]) bump(n.student_id, n.created_at);
      for (const c of (calls.data ?? []) as any[]) bump(c.student_id, c.call_date + "T12:00:00");
      return { students: (students.data ?? []) as { id: string; full_name: string; phase: string }[], lastTouch, checkedToday };
    },
  });

  const ranked = useMemo(() => {
    if (!q.data || !healthMap) return null;
    const bandRank = { red: 0, amber: 1, green: 2 } as const;
    return q.data.students
      .map((s) => {
        const h = healthMap.get(s.id);
        const touchedMs = q.data.lastTouch.get(s.id) ?? 0;
        const daysSinceTouch = touchedMs ? Math.floor((Date.now() - touchedMs) / DAY) : null;
        return { ...s, h, daysSinceTouch };
      })
      .sort((a, b) => {
        const br = bandRank[a.h?.band ?? "amber"] - bandRank[b.h?.band ?? "amber"];
        if (br !== 0) return br;
        return (b.daysSinceTouch ?? 99) - (a.daysSinceTouch ?? 99);
      });
  }, [q.data, healthMap]);

  if (!ranked || ranked.length === 0) return null;

  const touched3d = ranked.filter((s) => s.daysSinceTouch != null && s.daysSinceTouch <= 3).length;
  // Locked students belong to the "stuck in Start Here" bell alert, not the
  // daily work queue — they have no EODs/calls/placements to work yet.
  // Graduated students owe no touch cadence either; they only appear when
  // something is actually wrong (payment/ghosting turns them non-green).
  const needsWork = ranked.filter((s) => {
    if (s.h?.locked) return false;
    const graduated = ["offer_won", "testimonial", "graduated"].includes(s.phase);
    if (graduated) return (s.h?.band ?? "green") !== "green";
    return (s.h?.band ?? "amber") !== "green" || s.daysSinceTouch == null || s.daysSinceTouch > 3;
  });

  const checkIn = async (studentId: string) => {
    const { error } = await supabase.from("csm_tally").insert({
      user_id: user!.id, kind: "checkin", student_id: studentId, note: "Queue check-in",
    });
    if (error) return toast.error(error.message);
    // Optimistically check the row off so the queue visibly shrinks as you work.
    qc.setQueryData(["csm-today-queue"], (old: unknown) => {
      const o = old as { checkedToday?: Set<string> } | undefined;
      if (!o?.checkedToday) return old;
      return { ...o, checkedToday: new Set([...o.checkedToday, studentId]) };
    });
    toast.success("Check-in logged");
    invalidateForTables(qc, ["csm_tally"]);
  };

  const localIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const addItem = async (studentId: string) => {
    const text = itemText.trim();
    if (!text) return;
    const { error } = await supabase.from("student_action_items").insert({
      student_id: studentId, text, created_by: user!.id,
      due_date: itemDue ? localIso(itemDue) : null,
    });
    if (error) return toast.error(error.message);
    toast.success(itemDue ? `Action item added · ${humanDue(localIso(itemDue))}` : "Action item added");
    setItemText("");
    setItemDue(undefined);
    setDueOpen(false);
    setNoteFor(null);
    invalidateForTables(qc, ["student_action_items"]);
  };

  return (
    <div className="card-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
          Today
          <span className="text-[11px] text-muted-foreground font-normal">who needs attention, worst first</span>
        </div>
        <span className={`text-[12px] tabular-nums ${touched3d === ranked.length ? "text-success-fg" : "text-muted-foreground"}`}>
          {touched3d} of {ranked.length} touched in the last 3 days
        </span>
      </div>

      {needsWork.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-4 text-center">
          Everyone is green and recently touched. Rare air · keep it that way.
        </p>
      ) : (
        <div className="space-y-1">
          {needsWork.slice(0, 12).map((s) => {
            const band = s.h?.band ?? "amber";
            const done = q.data?.checkedToday?.has(s.id) ?? false;
            return (
              <div key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-2.5 py-2 motion-safe:transition-colors ${done ? "bg-success-bg/40" : "hover:bg-muted/50"}`}>
                {done ? (
                  <span className="grid h-[22px] w-[26px] place-items-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-success-fg" />
                  </span>
                ) : (
                  <span className={`text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full border shrink-0 ${BAND_META[band].chip}`}>
                    {s.h?.score ?? "–"}
                  </span>
                )}
                <Link to="/students/$id" params={{ id: s.id }} className={`text-[13px] font-medium hover:underline underline-offset-4 decoration-border min-w-28 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {s.full_name}
                </Link>
                <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                  {done ? (
                    <span className="text-[10px] text-success-fg bg-success-bg border border-success/25 rounded-full px-2 py-px">checked in today</span>
                  ) : (
                    <>
                      {(s.h?.reasons ?? []).slice(0, 2).map((r, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-px truncate">{r}</span>
                      ))}
                      {s.daysSinceTouch == null ? (
                        <span className="text-[10px] text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-px">never touched</span>
                      ) : s.daysSinceTouch > 3 ? (
                        <span className="text-[10px] text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-px">last touch {s.daysSinceTouch}d ago</span>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!done && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => checkIn(s.id)} title="Log a check-in">
                      <PhoneCall className="h-3 w-3 mr-1" /> Check-in
                    </Button>
                  )}
                  <Popover open={noteFor === s.id} onOpenChange={(o) => { setNoteFor(o ? s.id : null); if (!o) { setItemDue(undefined); setDueOpen(false); } }}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" title="Assign an action item">
                        <Plus className="h-3 w-3 mr-1" /> Item
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 space-y-2">
                      <Input
                        value={itemText}
                        onChange={(e) => setItemText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addItem(s.id); }}
                        placeholder={`Action item for ${s.full_name.split(" ")[0]}…`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setDueOpen(o => !o)}
                        className={`flex w-full items-center gap-1.5 rounded-sm border px-2 py-1.5 text-[11px] motion-safe:transition-colors ${itemDue ? "border-primary/25 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        <CalendarDays className="h-3 w-3" />
                        {itemDue ? humanDue(localIso(itemDue)) : "Add due date"}
                        {itemDue && (
                          <span
                            role="button"
                            className="ml-auto text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); setItemDue(undefined); }}
                          >
                            clear
                          </span>
                        )}
                      </button>
                      {dueOpen && (
                        <Calendar
                          mode="single"
                          selected={itemDue}
                          onSelect={(d) => { setItemDue(d); setDueOpen(false); }}
                          disabled={{ before: new Date() }}
                        />
                      )}
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => addItem(s.id)} disabled={!itemText.trim()}>Add</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Link to="/students/$id" params={{ id: s.id }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors" title="Open student">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
          {needsWork.length > 12 && (
            <p className="text-[11px] text-muted-foreground px-2 pt-1">+{needsWork.length - 12} more below the fold · clear the top first.</p>
          )}
        </div>
      )}
    </div>
  );
}
