import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { toast } from "sonner";
import { ArchiveX, Briefcase, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanDue } from "@/lib/dates";

export type Placement = {
  id: string;
  student_id: string;
  business_name: string;
  role_title: string;
  source: string;
  stage: "lead" | "interviewing" | "trial" | "placed" | "lost";
  pay_notes: string | null;
  interview_at: string | null;
  started_at: string | null;
  notes: string | null;
  created_at: string;
};

export const STAGES = [
  { value: "lead", label: "Lead", badge: "text-muted-foreground bg-muted border-border" },
  { value: "interviewing", label: "Interviewing", badge: "text-chart-1 bg-chart-1/10 border-chart-1/25" },
  { value: "trial", label: "Trial", badge: "text-warning-fg bg-warning-bg border-warning/25" },
  { value: "placed", label: "Placed", badge: "text-success-fg bg-success-bg border-success/25" },
  { value: "lost", label: "Lost", badge: "text-muted-foreground bg-muted border-border line-through" },
] as const;

export const stageMeta = (stage: string) => STAGES.find((s) => s.value === stage) ?? STAGES[0];

/**
 * The placement pipeline for one student — the businesses they're talking to
 * about a setter role. Lives at the top of the student detail page and as a
 * portal tab; a placement hitting "Placed" is the win the whole mentorship
 * points at (a DB trigger stamps students.offer_landed_at).
 */
export function PlacementsSection({ studentId, compact = false }: { studentId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [bizName, setBizName] = useState("");
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["placements", studentId],
    staleTime: 60_000,
    queryFn: async () =>
      ((await supabase.from("student_placements").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", studentId).is("voided_at", null).order("created_at", { ascending: false })).data ?? []) as Placement[],
  });
  const rows = q.data ?? [];
  // Covers the per-student list, the board, CSM overview counts, health
  // scores, and bell interview reminders in one call.
  const refresh = () => invalidateForTables(qc, ["student_placements"]);

  const add = async () => {
    const name = bizName.trim();
    if (!name) return;
    setSaving(true);
    const { error } = await supabase.from("student_placements").insert({
      student_id: studentId,
      business_name: name,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setBizName("");
    setAdding(false);
    refresh();
  };

  const setStage = async (id: string, stage: string) => {
    const { error } = await supabase.from("student_placements").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    if (stage === "placed") toast.success("Placed! 🎉");
    refresh();
  };

  const setInterview = async (id: string, when: string) => {
    const { error } = await supabase.from("student_placements").update({ interview_at: when ? new Date(when).toISOString() : null }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    const reason = prompt("Why should this opportunity be removed from active records?")?.trim();
    if (!reason) return;
    if (reason.length < 3) return toast.error("Enter a short correction reason.");
    const { error } = await supabase.rpc("void_student_placement", { p_placement_id: id, p_reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Opportunity removed from active records · history preserved");
    refresh();
  };

  return (
    <div className={compact ? "" : "card-surface p-4"}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          Placements
          <span className="text-[11px] text-muted-foreground font-normal">the businesses in play · this is the goal</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Opportunity
        </Button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Business / coach name…"
            autoFocus
            className="h-9"
          />
          <Button size="sm" onClick={add} disabled={saving || !bizName.trim()}>Add</Button>
        </div>
      )}

      {q.isLoading ? (
        <p className="text-[13px] text-muted-foreground py-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
          No opportunities yet · add the first business this student is talking to.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((p) => {
            const meta = stageMeta(p.stage);
            return (
              <div key={p.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-muted/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground truncate">{p.business_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {p.role_title}
                    {p.interview_at && p.stage === "interviewing" && (
                      <> · interview {humanDue(p.interview_at.slice(0, 10)).replace("due ", "")}</>
                    )}
                    {p.stage === "placed" && p.started_at && <> · started {p.started_at}</>}
                  </div>
                </div>
                {p.stage === "interviewing" && (
                  <Input
                    type="datetime-local"
                    value={p.interview_at ? p.interview_at.slice(0, 16) : ""}
                    onChange={(e) => setInterview(p.id, e.target.value)}
                    className="h-8 w-44 text-[12px]"
                    title="Interview time"
                  />
                )}
                <SelectField
                  value={p.stage}
                  onChange={(v) => setStage(p.id, v)}
                  className={`h-7 w-32 text-[11px] border ${meta.badge}`}
                  options={STAGES.map((s) => ({ value: s.value, label: s.label }))}
                />
                <button
                  onClick={() => remove(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger-fg motion-safe:transition-opacity"
                  title="Remove from active records"
                >
                  <ArchiveX className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** All students' placements, grouped by stage — the fulfillment pipeline board. */
export function PlacementBoard() {
  const q = useQuery({
    queryKey: ["placement-board"],
    staleTime: 60_000,
    queryFn: async () => {
      const [placements, students] = await Promise.all([
        supabase.from("student_placements").select("*, students!inner(is_demo)").eq("students.is_demo", false).is("voided_at", null).neq("stage", "lost").order("updated_at", { ascending: false }),
        supabase.from("students").select("id, full_name").eq("is_demo", false),
      ]);
      const names = new Map(((students.data ?? []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name]));
      return { rows: (placements.data ?? []) as Placement[], names };
    },
  });
  const d = q.data;
  if (!d || d.rows.length === 0) return null;

  const byStage = (stage: string) => d.rows.filter((p) => p.stage === stage);
  const cols = STAGES.filter((s) => s.value !== "lost");

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3">
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        Placement pipeline
        <span className="text-[11px] text-muted-foreground font-normal">every opportunity across all students</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cols.map((stage) => {
          const items = byStage(stage.value);
          return (
            <div key={stage.value} className="rounded-md bg-muted/30 p-2 min-h-24">
              <div className="flex items-baseline justify-between px-1 mb-1.5">
                <span className={`text-[11px] font-medium px-1.5 py-px rounded-full border ${stage.badge}`}>{stage.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    to="/students/$id"
                    params={{ id: p.student_id }}
                    className="block rounded bg-card border border-border/60 px-2 py-1.5 hover:border-border motion-safe:transition-colors"
                  >
                    <div className="text-[12px] font-medium text-foreground truncate">{p.business_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{d.names.get(p.student_id) ?? "Student"}</div>
                  </Link>
                ))}
                {items.length > 8 && <div className="text-[10px] text-muted-foreground px-1">+{items.length - 8} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
