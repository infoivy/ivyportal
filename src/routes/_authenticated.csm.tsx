import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { HeartHandshake, Search, StickyNote, Trash2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/csm")({
  head: () => ({ meta: [{ title: "CSM — ISA Portal" }] }),
  component: CsmPage,
});

type Student = { id: string; full_name: string; email: string | null; phase: string; status: string; coach_id: string | null };
type CsmNote = {
  id: string; student_id: string; user_id: string; note: string; tags: string[] | null; created_at: string;
  student_name?: string; author?: string;
};

function CsmPage() {
  const { user, roles } = useAuth();
  const canUse = roles.includes("admin") || roles.includes("csm");
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<CsmNote[]>([]);
  const [studentId, setStudentId] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("progress, check-in");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [studentsRes, notesRes] = await Promise.all([
      supabase.from("students").select("id, full_name, email, phase, status, coach_id").order("full_name", { ascending: true }),
      supabase.from("csm_student_notes").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const studentRows = (studentsRes.data ?? []) as Student[];
    setStudents(studentRows);
    if (!studentId && studentRows[0]) setStudentId(studentRows[0].id);

    const noteRows = (notesRes.data ?? []) as CsmNote[];
    const userIds = Array.from(new Set(noteRows.map((n) => n.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const names = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]));
    const studentNames = new Map(studentRows.map((s) => [s.id, s.full_name]));
    setNotes(noteRows.map((n) => ({ ...n, author: names.get(n.user_id) ?? "Unknown", student_name: studentNames.get(n.student_id) ?? "Student" })));
  };

  useEffect(() => { if (canUse) load(); }, [canUse]);

  const filteredStudents = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q));
  }, [students, query]);

  const selected = students.find((s) => s.id === studentId);
  const selectedNotes = notes.filter((n) => n.student_id === studentId);
  const mineThisWeek = notes.filter((n) => n.user_id === user?.id && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000).length;

  const saveNote = async () => {
    if (!user || !studentId || !note.trim()) return;
    setSaving(true);
    const parsedTags = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("csm_student_notes").insert({ student_id: studentId, user_id: user.id, note: note.trim(), tags: parsedTags });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNote("");
    toast.success("CSM note saved");
    load();
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("csm_student_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    load();
  };

  if (!canUse) {
    return <div className="p-6 text-sm text-muted-foreground">CSM access required.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-amber-400 mb-1">
            <HeartHandshake className="h-3 w-3" /> Client success
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CSM Workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Student notes, follow-ups, and CSM daily reporting.</p>
        </div>
        <Link to="/eods" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-medium">
          <FileText className="h-3.5 w-3.5" /> Submit CSM EOD
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Students" value={students.length} />
        <Stat label="1:1 students" value={students.filter((s) => s.phase === "coaching_1on1").length} />
        <Stat label="CSM notes" value={notes.length} />
        <Stat label="My 7d notes" value={mineThisWeek} accent />
      </div>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4">
        <aside className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
          <div className="p-3 border-b border-[#1f2530]">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" className="w-full h-8 pl-8 pr-3 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-emerald-500/40" />
            </div>
          </div>
          <div className="max-h-[620px] overflow-auto divide-y divide-[#1a1f29]">
            {filteredStudents.map((s) => (
              <button key={s.id} onClick={() => setStudentId(s.id)} className={`w-full text-left p-3 hover:bg-[#14171e] transition ${studentId === s.id ? "bg-amber-500/5" : ""}`}>
                <div className="text-sm font-medium truncate">{s.full_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.email ?? "no email"}</div>
                <div className="mt-1 flex gap-1">
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[#2a3140] rounded-sm text-muted-foreground">{s.phase.replace("_", " ")}</span>
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[#2a3140] rounded-sm text-muted-foreground">{s.status}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold">{selected?.full_name ?? "Select a student"}</h2>
                <p className="text-[11px] text-muted-foreground">{selected?.email ?? "Choose a student to add success notes"}</p>
              </div>
              {selected && <Link to={"/students/$id" as any} params={{ id: selected.id } as any} className="text-[11px] text-emerald-400 hover:text-emerald-300">Open tracker</Link>}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Add a student success note, risk signal, follow-up, accountability update…" className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-emerald-500/40" />
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma-separated" className="h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-emerald-500/40" />
              <button onClick={saveNote} disabled={saving || !note.trim() || !studentId} className="h-8 px-3 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-medium disabled:opacity-40">
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {selectedNotes.length === 0 && <div className="border border-dashed border-[#1f2530] rounded-sm p-8 text-center text-xs text-muted-foreground">No CSM notes for this student yet.</div>}
            {selectedNotes.map((n) => (
              <div key={n.id} className="group border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
                <div className="flex items-start gap-2">
                  <StickyNote className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{n.note}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[10px] text-muted-foreground">
                      {(n.tags ?? []).map((tag) => <span key={tag} className="px-1.5 py-0.5 rounded-sm border border-amber-500/30 text-amber-400 uppercase tracking-wider">#{tag}</span>)}
                      <span className="ml-auto">{n.author} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      {(n.user_id === user?.id || roles.includes("admin")) && (
                        <button onClick={() => deleteNote(n.id)} className="p-1 rounded-sm text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10" title="Delete note">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border border-[#1f2530] rounded-sm p-3 ${accent ? "bg-amber-500/5" : "bg-[#0f1116]"}`}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-mono font-semibold ${accent ? "text-amber-400" : "text-foreground"}`}>{value}</div>
    </div>
  );
}