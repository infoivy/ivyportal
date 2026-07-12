import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { Megaphone, Send, AtSign, X, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MentionTextarea, type MentionPerson } from "@/components/mention-textarea";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Student Alerts — ISA Team" }] }),
  component: AlertsPage,
});

type Alert = {
  id: string;
  body: string;
  student_id: string | null;
  created_by: string;
  created_at: string;
};

function AlertsPage() {
  const { user, roles } = useAuth();
  const isTeam = roles.some(r => ["admin", "founder", "coach", "csm", "closer", "setter"].includes(r));
  if (!isTeam) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">Team access required.</div>
      </div>
    );
  }
  return <AlertsInner userId={user?.id ?? ""} isAdmin={roles.includes("admin")} />;
}

function AlertsInner({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [taggedStudent, setTaggedStudent] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pageQ = useQuery({
    queryKey: ["page", "alerts"],
    refetchInterval: 20_000, // channel stays fresh without realtime plumbing
    queryFn: async () => {
      const [alertsRes, profsRes, studentsRes] = await Promise.all([
        supabase.from("student_alerts").select("*").order("created_at", { ascending: true }).limit(500),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("students").select("id, full_name").order("full_name"),
      ]);
      const names: Record<string, string> = {};
      (profsRes.data ?? []).forEach((p: { id: string; display_name: string | null }) => { names[p.id] = p.display_name ?? "Teammate"; });
      const students = (studentsRes.data ?? []) as { id: string; full_name: string }[];
      const studentNames: Record<string, string> = {};
      students.forEach(st => { studentNames[st.id] = st.full_name; });
      const people: MentionPerson[] = [
        ...(profsRes.data ?? []).filter((p: { display_name: string | null }) => p.display_name).map((p: { id: string; display_name: string | null }) => ({ id: p.id, name: p.display_name as string, kind: "member" as const })),
        ...students.map((s) => ({ id: s.id, name: s.full_name, kind: "student" as const })),
      ];
      return { alerts: (alertsRes.data ?? []) as Alert[], names, students, studentNames, people };
    },
  });
  const d = pageQ.data;

  // pin to the bottom on new messages
  const count = d?.alerts.length ?? 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [count]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: Alert[] }[] = [];
    for (const a of d?.alerts ?? []) {
      const dt = new Date(a.created_at);
      const label = isToday(dt) ? "Today" : isYesterday(dt) ? "Yesterday" : format(dt, "EEEE, MMM d");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(a);
      else groups.push({ label, items: [a] });
    }
    return groups;
  }, [d?.alerts]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("student_alerts").insert({
      body: text,
      student_id: taggedStudent?.id ?? null,
      created_by: userId,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    setTaggedStudent(null);
    qc.invalidateQueries({ queryKey: ["page", "alerts"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this alert for everyone?")) return;
    const { error } = await supabase.from("student_alerts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["page", "alerts"] });
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 52px)" }}>
      <header className="pb-4 shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
          <Megaphone className="h-3 w-3" /> Team channel
        </div>
        <h1 className="text-display text-foreground">Student Alerts</h1>
        <p className="text-body text-muted-foreground mt-1">
          One shared feed for anything the team must know about a student. History stays forever.
        </p>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain card-surface p-4 space-y-4">
        {pageQ.isLoading && <p className="text-caption text-muted-foreground text-center py-8">Loading…</p>}
        {!pageQ.isLoading && count === 0 && (
          <p className="text-caption text-muted-foreground text-center py-8">
            No alerts yet. Tag a student and post the first one.
          </p>
        )}
        {grouped.map(g => (
          <div key={g.label}>
            <div className="flex items-center gap-3 my-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-micro text-muted-foreground">{g.label}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3">
              {g.items.map(a => (
                <div key={a.id} className="group flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-sm bg-muted flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
                    {(d?.names[a.created_by] ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium">{d?.names[a.created_by] ?? "Teammate"}</span>
                      <span className="text-micro text-muted-foreground">{format(new Date(a.created_at), "h:mm a")}</span>
                      {isAdmin && (
                        <button onClick={() => remove(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger-fg transition" title="Delete (admin)">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {a.student_id && (
                      <Link
                        to="/students/$id"
                        params={{ id: a.student_id }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-0.5 mt-1 hover:opacity-80"
                      >
                        <User className="h-3 w-3" /> {d?.studentNames[a.student_id] ?? "Student"}
                      </Link>
                    )}
                    <p className="text-[13px] text-foreground leading-relaxed mt-1 whitespace-pre-wrap break-words">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="shrink-0 pt-3">
        {taggedStudent && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-0.5">
              <User className="h-3 w-3" /> {taggedStudent.name}
              <button onClick={() => setTaggedStudent(null)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Tag a student">
                <AtSign className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="p-0 w-72">
              <Command className="h-64">
                <CommandInput placeholder="Search students…" />
                <CommandList className="flex-1">
                  <CommandEmpty>No student found.</CommandEmpty>
                  <CommandGroup>
                    {(d?.students ?? []).map(st => (
                      <CommandItem
                        key={st.id}
                        value={st.full_name}
                        onSelect={() => { setTaggedStudent({ id: st.id, name: st.full_name }); setPickerOpen(false); }}
                      >
                        {st.full_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <MentionTextarea
            value={body}
            onChange={setBody}
            onSubmit={send}
            people={d?.people ?? []}
            onPick={(p) => { if (p.kind === "student") setTaggedStudent({ id: p.id, name: p.name }); }}
            placeholder={taggedStudent ? `Alert about ${taggedStudent.name}…` : "Write an alert… (@ to tag, Enter to send)"}
            className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring"
          />
          <Button onClick={send} disabled={sending || !body.trim()} className="h-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
