import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { MentionTextarea, type MentionPerson } from "@/components/mention-textarea";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Team Chat · ISA Team" }] }),
  component: ChatPage,
});

type Kind = "general" | "issue" | "tip" | "bug";

type Message = {
  id: string;
  body: string;
  kind: Kind;
  created_by: string;
  created_at: string;
  student_id: string | null;
};

const KIND_META: Record<Kind, { label: string; badge: string | null }> = {
  general: { label: "General", badge: null },
  issue: { label: "Issue", badge: "text-warning-fg bg-warning-bg border-warning/25" },
  tip: { label: "Tip", badge: "text-success-fg bg-success-bg border-success/25" },
  bug: { label: "Bug", badge: "text-danger-fg bg-danger-bg border-danger/25" },
};

function ChatPage() {
  const { user, roles } = useAuth();
  const isTeam = roles.some(r => ["admin", "founder", "coach", "csm", "closer", "setter"].includes(r));
  if (!isTeam) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">Team access required.</div>
      </div>
    );
  }
  return <ChatInner userId={user?.id ?? ""} isAdmin={roles.includes("admin")} />;
}

function ChatInner({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("general");
  const [taggedStudent, setTaggedStudent] = useState<{ id: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pageQ = useQuery({
    queryKey: ["page", "chat"],
    refetchInterval: 20_000, // channel stays fresh without realtime plumbing
    queryFn: async () => {
      const [generalMsgsRes, studentMsgsRes, profsRes, studentsRes] = await Promise.all([
        supabase.from("team_chat").select("*").is("student_id", null).order("created_at", { ascending: true }).limit(500),
        supabase.from("team_chat").select("*, students!inner(is_demo)").eq("students.is_demo", false).order("created_at", { ascending: true }).limit(500),
        supabase.from("profiles").select("id, display_name").eq("is_demo", false),
        supabase.from("students").select("id, full_name").eq("is_demo", false).order("full_name"),
      ]);
      const names: Record<string, string> = {};
      (profsRes.data ?? []).forEach((p: { id: string; display_name: string | null }) => { names[p.id] = p.display_name ?? "Teammate"; });
      const studentNames: Record<string, string> = {};
      ((studentsRes.data ?? []) as { id: string; full_name: string }[]).forEach((st) => { studentNames[st.id] = st.full_name; });
      const people: MentionPerson[] = [
        ...(profsRes.data ?? []).filter((p: any) => p.display_name).map((p: any) => ({ id: p.id, name: p.display_name as string, kind: "member" as const })),
        ...((studentsRes.data ?? []) as { id: string; full_name: string }[]).map((s) => ({ id: s.id, name: s.full_name, kind: "student" as const })),
      ];
      const messages = [...(generalMsgsRes.data ?? []), ...(studentMsgsRes.data ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(-500) as Message[];
      return { messages, names, studentNames, people };
    },
  });
  const d = pageQ.data;

  // pin to the bottom on new messages
  const count = d?.messages.length ?? 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [count]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: Message[] }[] = [];
    for (const m of d?.messages ?? []) {
      const dt = new Date(m.created_at);
      const label = isToday(dt) ? "Today" : isYesterday(dt) ? "Yesterday" : format(dt, "EEEE, MMM d");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(m);
      else groups.push({ label, items: [m] });
    }
    return groups;
  }, [d?.messages]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("team_chat").insert({ body: text, kind, created_by: userId, student_id: taggedStudent?.id ?? null });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    setKind("general");
    setTaggedStudent(null);
    qc.invalidateQueries({ queryKey: ["page", "chat"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    const { error } = await supabase.from("team_chat").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["page", "chat"] });
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 52px)" }}>
      <header className="pb-4 shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
          <MessagesSquare className="h-3 w-3" /> Team channel
        </div>
        <h1 className="text-display text-foreground">Team Chat</h1>
        <p className="text-body text-muted-foreground mt-1">
          Anything goes · questions, wins, issues, tips, bugs. History stays forever.
        </p>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain card-surface p-4 space-y-4">
        {pageQ.isLoading && <p className="text-caption text-muted-foreground text-center py-8">Loading…</p>}
        {!pageQ.isLoading && count === 0 && (
          <p className="text-caption text-muted-foreground text-center py-8">
            Quiet in here. Say hi, drop a tip, or report a bug.
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
              {g.items.map(m => (
                <div key={m.id} className="group flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-sm bg-muted flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
                    {(d?.names[m.created_by] ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium">{d?.names[m.created_by] ?? "Teammate"}</span>
                      {m.kind !== "general" && KIND_META[m.kind]?.badge && (
                        <span className={`text-[10px] font-medium border rounded-full px-1.5 py-px ${KIND_META[m.kind].badge}`}>
                          {KIND_META[m.kind].label}
                        </span>
                      )}
                      <span className="text-micro text-muted-foreground">{format(new Date(m.created_at), "h:mm a")}</span>
                      {isAdmin && (
                        <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger-fg motion-safe:transition-opacity" title="Delete (admin)">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {m.student_id && (
                      <Link
                        to="/students/$id"
                        params={{ id: m.student_id }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-0.5 mt-1 hover:opacity-80"
                      >
                        {d?.studentNames[m.student_id] ?? "Student"}
                      </Link>
                    )}
                    <p className="text-[13px] text-foreground leading-relaxed mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="shrink-0 pt-3 relative">
        <div className="flex gap-1.5 mb-2">
          {(Object.keys(KIND_META) as Kind[]).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border motion-safe:transition-colors ${
                kind === k
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <div className="relative">
          {taggedStudent && (
            <span className="absolute -top-7 left-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-warning-fg bg-warning-bg border border-warning/25 rounded-full px-2 py-0.5">
              {taggedStudent.name}
              <button onClick={() => setTaggedStudent(null)} className="hover:opacity-70">×</button>
            </span>
          )}
          <MentionTextarea
            value={body}
            onChange={setBody}
            onSubmit={send}
            onPick={(p) => { if (p.kind === "student") setTaggedStudent({ id: p.id, name: p.name }); }}
            people={d?.people ?? []}
            placeholder={kind === "general" ? "Write a message… (@ to mention, Enter to send)" : `Report ${kind === "tip" ? "a tip" : `a${kind === "issue" ? "n issue" : " bug"}`}…`}
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 motion-safe:transition-colors"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
