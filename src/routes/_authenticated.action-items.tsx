import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { listTeamMembers } from "@/lib/team-admin.functions";
import { toast } from "sonner";
import { ListChecks, AlertTriangle, User, Filter, Plus, Trash2, Sparkles } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";

export const Route = createFileRoute("/_authenticated/action-items")({
  head: () => ({ meta: [{ title: "Action Items — ISA Team" }] }),
  component: ActionItemsHub,
});

type CallItem = { id?: string; text?: string; done?: boolean; due?: string | null; due_date?: string | null };
type CallRow = {
  id: string; student_id: string; coach_id: string | null; call_date: string;
  action_items_json: CallItem[] | null;
};
type AdHocRow = {
  id: string; student_id: string | null; created_by: string; assignee_id: string | null;
  text: string; due_date: string | null; done: boolean; done_at: string | null;
  created_at: string;
};
type Row = {
  key: string;
  source: "call" | "adhoc";
  callId?: string; index?: number; adhocId?: string;
  text: string; done: boolean; due: string | null;
  studentId: string | null; studentName: string;
  ownerId: string | null; ownerName: string; ownerLabel: string;
  createdByName?: string;
  refDate: string;
  canDelete: boolean;
};

type Filt = "all" | "mine" | "overdue" | "open";

function ActionItemsHub() {
  const { user, roles } = useAuth();
  const isStaff =
    roles.includes("admin") || roles.includes("coach") || roles.includes("csm") ||
    roles.includes("closer") || roles.includes("setter");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [adhoc, setAdhoc] = useState<AdHocRow[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const teamFn = useServerFn(listTeamMembers);
  const [filt, setFilt] = useState<Filt>("open");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Create form
  const [addOpen, setAddOpen] = useState(false);
  const [newTargets, setNewTargets] = useState<Set<string>>(new Set()); // "s:<studentId>" | "t:<userId>"
  const [newText, setNewText] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchPage = async () => {
    const [cRes, aRes, sRes, pRes, teamList] = await Promise.all([
      supabase.from("student_calls").select("id, student_id, coach_id, call_date, action_items_json").order("call_date", { ascending: false }).limit(2000),
      supabase.from("student_action_items").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("students").select("id, full_name"),
      supabase.from("profiles").select("id, display_name"),
      teamFn().catch(() => []),
    ]);
    const sm: Record<string, string> = {}; (sRes.data ?? []).forEach((s: { id: string; full_name: string }) => { sm[s.id] = s.full_name; });
    const pm: Record<string, string> = {}; (pRes.data ?? []).forEach((p: { id: string; display_name: string | null }) => { pm[p.id] = p.display_name ?? "Unknown"; });
    return { calls: (cRes.data ?? []) as CallRow[], adhoc: (aRes.data ?? []) as AdHocRow[], sm, pm, teamList };
  };

  const pageQ = useQuery({ queryKey: ["page", "action-items"], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setCalls(pageQ.data.calls);
    setAdhoc(pageQ.data.adhoc);
    setStudents(pageQ.data.sm);
    setProfiles(pageQ.data.pm);
    setTeam(pageQ.data.teamList);
    setLoading(false);
  }, [pageQ.data]);
  const load = () => pageQ.refetch();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const studentList = useMemo(
    () => Object.entries(students).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );
  const teamList = team;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const c of calls) {
      const items = Array.isArray(c.action_items_json) ? c.action_items_json : [];
      items.forEach((it, i) => {
        out.push({
          key: `call-${c.id}-${i}`,
          source: "call",
          callId: c.id, index: i,
          text: it.text ?? "",
          done: !!it.done,
          due: it.due ?? it.due_date ?? null,
          studentId: c.student_id,
          studentName: students[c.student_id] ?? "Unknown",
          ownerId: c.coach_id,
          ownerName: c.coach_id ? (profiles[c.coach_id] ?? "—") : "Unassigned",
          ownerLabel: "Coach",
          refDate: c.call_date,
          canDelete: false,
        });
      });
    }
    for (const a of adhoc) {
      const ownerId = a.assignee_id ?? a.created_by;
      out.push({
        key: `adhoc-${a.id}`,
        source: "adhoc",
        adhocId: a.id,
        text: a.text,
        done: a.done,
        due: a.due_date,
        studentId: a.student_id,
        studentName: a.student_id ? (students[a.student_id] ?? "Unknown") : (profiles[a.assignee_id ?? ""] ?? "Team"),
        ownerId,
        ownerName: profiles[ownerId] ?? "—",
        ownerLabel: a.assignee_id ? "Assignee" : "Assigned by",
        createdByName: profiles[a.created_by] ?? undefined,
        refDate: a.created_at.slice(0, 10),
        canDelete: a.created_by === user?.id || roles.includes("admin"),
      });
    }
    return out;
  }, [calls, adhoc, students, profiles, user, roles]);

  const isOverdue = (r: Row) => !r.done && r.due && r.due < today;

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (ownerFilter === "mine" && r.ownerId !== user?.id) return false;
      if (ownerFilter !== "all" && ownerFilter !== "mine" && r.ownerId !== ownerFilter) return false;
      if (filt === "mine" && r.ownerId !== user?.id) return false;
      if (filt === "overdue" && !isOverdue(r)) return false;
      if (filt === "open" && r.done) return false;
      return true;
    }).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.due ?? "9999", bd = b.due ?? "9999";
      if (ad !== bd) return ad.localeCompare(bd);
      return b.refDate.localeCompare(a.refDate);
    });
  }, [rows, filt, ownerFilter, user, today]);

  const uniqueOwners = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.ownerId) map.set(r.ownerId, r.ownerName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const counts = useMemo(() => ({
    open: rows.filter(r => !r.done).length,
    mine: rows.filter(r => !r.done && r.ownerId === user?.id).length,
    overdue: rows.filter(r => isOverdue(r)).length,
    all: rows.length,
  }), [rows, user, today]);

  const submitAdhoc = async () => {
    if (!user || newTargets.size === 0 || !newText.trim()) return;
    setSaving(true);
    const rows = Array.from(newTargets).map(target => {
      const [kind, targetId] = [target.slice(0, 1), target.slice(2)];
      return {
        student_id: kind === "s" ? targetId : null,
        assignee_id: kind === "t" ? targetId : null,
        created_by: user.id,
        text: newText.trim(),
        due_date: newDue || null,
      };
    });
    const { error } = await supabase.from("student_action_items").insert(rows as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(rows.length === 1 ? "Action item added" : `Action item added for ${rows.length} people`);
    setNewText(""); setNewDue(""); setNewTargets(new Set()); setAddOpen(false);
    load();
  };

  const toggleTarget = (key: string) => setNewTargets(prev => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const setGroup = (keys: string[], on: boolean) => setNewTargets(prev => {
    const n = new Set(prev);
    keys.forEach(k => on ? n.add(k) : n.delete(k));
    return n;
  });

  const toggleAdhoc = async (r: Row) => {
    if (!r.adhocId) return;
    const next = !r.done;
    const { error } = await supabase
      .from("student_action_items")
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq("id", r.adhocId);
    if (error) return toast.error(error.message);
    setAdhoc(prev => prev.map(a => a.id === r.adhocId ? { ...a, done: next, done_at: next ? new Date().toISOString() : null } : a));
  };

  const deleteAdhoc = async (id: string) => {
    if (!confirm("Delete this action item?")) return;
    const { error } = await supabase.from("student_action_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setAdhoc(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4 mb-1">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
            <ListChecks className="h-3 w-3" /> Action Items Hub
          </div>
          <h1 className="text-display text-foreground">Open action items</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coaches log items in <span className="text-foreground">/calls</span>; staff can add ad-hoc ones here anytime.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-[11px] text-muted-foreground">
            {counts.open} open <span className="mx-1">·</span> <span className="text-danger-fg">{counts.overdue} overdue</span>
          </div>
          {isStaff && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-muted hover:opacity-80 text-muted-foreground text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add ad-hoc item
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 items-center">
        {(["open", "all", "mine", "overdue"] as Filt[]).map(k => (
          <button
            key={k}
            onClick={() => setFilt(k)}
            className={`text-[10px] px-2.5 py-1 rounded-sm border transition ${
              filt === k
                ? k === "overdue" ? "text-danger-fg border-danger/25 bg-danger-bg"
                : "text-foreground border-[#2a3140] bg-[var(--accent)]"
                : "text-muted-foreground border-[var(--border)] hover:border-[#2a3140]"
            }`}
          >
            {k === "open" ? `Open · ${counts.open}` : k === "mine" ? `Mine · ${counts.mine}` : k === "overdue" ? `Overdue · ${counts.overdue}` : `All · ${counts.all}`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <SelectField value={ownerFilter} onChange={(v) => setOwnerFilter(v)} options={[{ value: "all", label: "All owners" }, { value: "mine", label: "My items" }]} />
        </div>
      </div>

      {loading && <div className="card-surface p-8 text-center text-xs text-muted-foreground">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="card-surface p-8 text-center text-xs text-muted-foreground">Nothing here. Nice.</div>
      )}
      {!loading && ([
        { label: "Students", items: filtered.filter(r => r.studentId) },
        { label: "Team", items: filtered.filter(r => !r.studentId) },
      ] as const).filter(sec => sec.items.length > 0).map(sec => (
      <section key={sec.label} className="space-y-2">
        <h2 className="text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground/70 px-1">{sec.label} · {sec.items.length}</h2>
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-lg overflow-hidden">
        <div className="hidden sm:grid grid-cols-[24px_minmax(0,1fr)_140px_120px_90px_28px] gap-2 px-3 py-2 border-b border-[var(--border)] text-[10px] text-muted-foreground">
          <span />
          <span>Item</span>
          <span>{sec.label === "Team" ? "Assignee" : "Student"}</span>
          <span>Owner</span>
          <span className="text-right">Due</span>
          <span />
        </div>
        {(expanded[sec.label] ? sec.items : sec.items.slice(0, 120)).map(r => {
          const overdue = isOverdue(r);
          return (
            <div
              key={r.key}
              className="grid grid-cols-[24px_minmax(0,1fr)_28px] sm:grid-cols-[24px_minmax(0,1fr)_140px_120px_90px_28px] gap-2 items-center px-3 py-2.5 border-b border-[var(--accent)] last:border-0 hover:bg-[var(--muted)]"
              title={r.source === "call" ? "From 1:1 call — student ticks off in portal" : "Ad-hoc — staff or student can tick off"}
            >
              <Checkbox
                checked={r.done}
                onCheckedChange={() => r.source === "adhoc" && toggleAdhoc(r)}
                disabled={r.source === "call"}
                aria-label={r.done ? "Done" : "Open"}
              />
              <div className="min-w-0">
                <div className={`text-xs flex items-center gap-1.5 ${r.done ? "line-through text-muted-foreground" : ""}`}>
                  {r.source === "adhoc" && <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="truncate">{r.text || <span className="italic text-muted-foreground">(no text)</span>}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {r.source === "call" ? `from call ${r.refDate}` : `ad-hoc · ${r.refDate}`}
                  {r.source === "adhoc" && r.createdByName && r.createdByName !== r.ownerName ? ` · from ${r.createdByName}` : ""}
                  {r.done ? " · ticked" : ""}
                </div>
                <div className="sm:hidden mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  {r.studentId ? (
                    <Link to="/students/$id" params={{ id: r.studentId }} className="inline-flex items-center gap-1 hover:text-success-fg">
                      <User className="h-3 w-3" /> {r.studentName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {r.studentName}</span>
                  )}
                  {r.ownerName && <span>· {r.ownerName}</span>}
                  {r.due && (
                    <span className={`inline-flex items-center gap-1 ${overdue ? "text-danger-fg" : ""}`}>
                      · {overdue && <AlertTriangle className="h-3 w-3" />}{r.due}
                    </span>
                  )}
                </div>
              </div>
              {r.studentId ? (
                <Link to="/students/$id" params={{ id: r.studentId }} className="hidden sm:flex text-xs truncate hover:text-success-fg items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" /> {r.studentName}
                </Link>
              ) : (
                <span className="hidden sm:flex text-xs truncate items-center gap-1 text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" /> {r.studentName}
                </span>
              )}
              <span className="hidden sm:block text-xs text-muted-foreground truncate" title={r.ownerLabel}>{r.ownerName}</span>
              <span className={`hidden sm:block text-[11px] text-right ${overdue ? "text-danger-fg" : r.due ? "text-muted-foreground" : "text-[#2a3140]"}`}>
                {r.due ? (overdue ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.due}</span> : r.due) : "—"}
              </span>
              <span className="flex justify-end">
                {r.canDelete && r.adhocId && (
                  <button
                    onClick={() => deleteAdhoc(r.adhocId!)}
                    className="p-1 rounded text-muted-foreground hover:text-danger-fg hover:bg-danger-bg"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {sec.items.length > 120 && !expanded[sec.label] && (
          <button
            onClick={() => setExpanded(e => ({ ...e, [sec.label]: true }))}
            className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition"
          >
            Show all {sec.items.length}
          </button>
        )}
        </div>
      </section>
      ))}

      {/* Add ad-hoc modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add action item</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-caption text-muted-foreground">For</Label>
              <span className="text-caption text-muted-foreground">{newTargets.size} selected</span>
            </div>
            <Command className="rounded-md border border-border h-64 [&_[cmdk-item]]:py-1.5">
              <CommandInput placeholder="Search students or team…" />
              <CommandList className="flex-1 max-h-none">
                <CommandEmpty>No one matches.</CommandEmpty>
                {([
                  { label: "Students", items: studentList.map(s => ({ key: `s:${s.id}`, name: s.name })) },
                  { label: "Team members", items: teamList.map(m => ({ key: `t:${m.id}`, name: m.name })) },
                ] as const).map(group => (
                  <CommandGroup
                    key={group.label}
                    heading={
                      <span className="flex items-center justify-between w-full">
                        {group.label}
                        <button
                          type="button"
                          onClick={() => {
                            const keys = group.items.map(i => i.key);
                            setGroup(keys, !keys.every(k => newTargets.has(k)));
                          }}
                          className="text-[10px] font-normal normal-case text-primary hover:underline"
                        >
                          {group.items.every(i => newTargets.has(i.key)) ? "Deselect all" : `All ${group.label.toLowerCase()}`}
                        </button>
                      </span>
                    }
                  >
                    {group.items.map(i => (
                      <CommandItem key={i.key} value={`${group.label} ${i.name}`} onSelect={() => toggleTarget(i.key)}>
                        <Checkbox checked={newTargets.has(i.key)} className="mr-2 pointer-events-none" />
                        <span className="truncate">{i.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </div>

          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Action item</Label>
            <Textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              rows={3}
              placeholder="e.g. Send updated resume by Friday"
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Due date (optional)</Label>
            <DateField value={newDue} onChange={setNewDue} placeholder="No due date" />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submitAdhoc} disabled={saving || newTargets.size === 0 || !newText.trim()}>
              {saving ? "Saving…" : newTargets.size > 1 ? `Add for ${newTargets.size} people` : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
