import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getTeamGoal, setTeamGoal } from "@/lib/mochi.functions";
import { useAuth } from "@/lib/auth-context";
import { humanDue } from "@/lib/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The collective goal — one bar the whole team pushes together.
 * Progress is Whop cash collected since the goal was set.
 */
export function TeamGoalCard() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("founder");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["team-goal"],
    queryFn: () => getTeamGoal(),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const g = q.data;
  if (!g?.active && !canEdit) return null;

  const pct = g?.active && g.amount ? Math.min(100, Math.round((g.progress / g.amount) * 100)) : 0;
  const daysLeft = g?.deadline
    ? Math.max(0, Math.ceil((new Date(g.deadline + "T23:59:59").getTime() - Date.now()) / 86400000))
    : null;
  // humanDue says "due by Thursday" / "due tomorrow" — reword for a goal.
  const deadlineLabel = g?.deadline
    ? humanDue(g.deadline).replace(/^was due/, "was due").replace(/^due by/, "by").replace(/^due/, "by")
    : null;

  if (!g?.active) {
    // Admin/founder see a quiet prompt to set one; the team sees nothing.
    return (
      <div className="card-surface px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Flag className="h-3.5 w-3.5" /> No team goal set right now.
        </div>
        <GoalEditor current={g ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["team-goal"] })} label="Set goal" />
      </div>
    );
  }

  return (
    <div className="card-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2.5">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <span className="text-[14px] font-medium text-foreground">
            Team goal — ${g.amount!.toLocaleString()} {deadlineLabel && <span className="text-muted-foreground font-normal">{deadlineLabel}</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-muted-foreground">
            <span className="text-foreground font-medium">${g.progress.toLocaleString()}</span> new since goal set · {pct}%
            {daysLeft != null && <> · {daysLeft === 0 ? "today" : `${daysLeft}d left`}</>}
          </span>
          {canEdit && <GoalEditor current={g} onSaved={() => qc.invalidateQueries({ queryKey: ["team-goal"] })} />}
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary motion-safe:transition-[width] duration-500 ease-(--ease-out)"
          style={{ width: `${pct}%` }}
        />
      </div>
      {g.note && <p className="text-[12px] text-muted-foreground mt-2">{g.note}</p>}

    </div>
  );
}

function GoalEditor({ current, onSaved, label }: { current: { amount: number | null; deadline: string | null; note: string | null } | null; onSaved: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(current?.amount ? String(current.amount) : "");
  const [deadline, setDeadline] = useState(current?.deadline ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (clear = false) => {
    setSaving(true);
    try {
      await setTeamGoal({
        data: clear
          ? { amount: null, deadline: null, note: null }
          : { amount: Number(amount) || null, deadline: deadline || null, note },
      });
      toast.success(clear ? "Goal cleared" : "Goal updated");
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {label ? (
          <Button size="sm" variant="outline">{label}</Button>
        ) : (
          <button className="text-muted-foreground hover:text-foreground" title="Edit goal">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Goal amount ($)</label>
          <Input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="5000" />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Deadline</label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] text-muted-foreground">Note to the team (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Expenses put us $1.5k in debt — let's clear it" />
        </div>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={saving}>Clear</Button>
          <Button size="sm" onClick={() => save(false)} disabled={saving || !amount || !deadline}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
