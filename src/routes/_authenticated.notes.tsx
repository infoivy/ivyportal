import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, StickyNote, Search, Tag as TagIcon, Users, User as UserIcon, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — ISA Team" }] }),
  component: NotesPage,
});

type Note = {
  id: string;
  user_id: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  display_name?: string;
};

function NotesPage() {
  const { user, roles } = useAuth();
  const canSeeAll = roles.includes("admin") || roles.includes("closer");
  const [content, setContent] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    let q = supabase.from("notes").select("*").order("created_at", { ascending: false }).limit(200);
    if (scope === "mine" && user) q = q.eq("user_id", user.id);
    const { data } = await q;
    const rows = (data ?? []) as Note[];
    if (scope === "team") {
      const ids = Array.from(new Set(rows.map(n => n.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map(profs?.map(p => [p.id, p.display_name]) ?? []);
      setNotes(rows.map(n => ({ ...n, display_name: map.get(n.user_id) ?? "Unknown" })));
    } else setNotes(rows);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, scope]);

  const add = async () => {
    if (!user || !content.trim()) return;
    setSaving(true);
    const tags = tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("notes").insert({ user_id: user.id, content: content.trim(), tags });
    setSaving(false);
    if (error) toast.error(error.message);
    else { setContent(""); setTagsStr(""); toast.success("Note saved"); load(); }
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const allTags = useMemo(() => {
    const t = new Map<string, number>();
    notes.forEach(n => (n.tags ?? []).forEach(tag => t.set(tag, (t.get(tag) ?? 0) + 1)));
    return Array.from(t.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [notes]);

  const filtered = useMemo(() => {
    let out = notes;
    if (activeTag) out = out.filter(n => (n.tags ?? []).includes(activeTag));
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(n =>
        n.content.toLowerCase().includes(q) ||
        (n.tags ?? []).some(t => t.includes(q)) ||
        (n.display_name ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [notes, query, activeTag]);

  // Cmd/Ctrl+Enter to save
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); add(); }
  };

  return (
    <div className="min-h-full">
      <div className="max-w-[1200px] mx-auto p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-500/10 border border-amber-500/40">
              <StickyNote className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">Notes</h1>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {filtered.length} · {scope === "mine" ? "personal" : "team-wide"}
              </p>
            </div>
          </div>

          {canSeeAll && (
            <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
              <button
                onClick={() => setScope("mine")}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${
                  scope === "mine" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              ><UserIcon className="h-3 w-3" /> Mine</button>
              <button
                onClick={() => setScope("team")}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${
                  scope === "team" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              ><Users className="h-3 w-3" /> Team</button>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="rounded-md border border-border bg-card p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="grid h-6 w-6 place-items-center rounded-sm bg-emerald-500/15 border border-emerald-500/40">
              <Plus className="h-3 w-3 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold">New note</h3>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">⌘ + Enter to save</span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={onKey}
            rows={3}
            placeholder="Capture an objection you heard, a win, a script tweak, a coaching thought…"
            className="w-full bg-[#0a0b0f] border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-emerald-500/60 resize-none"
          />
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative">
              <TagIcon className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={tagsStr}
                onChange={e => setTagsStr(e.target.value)}
                onKeyDown={onKey}
                placeholder="tags (comma-separated) e.g. objection, script, win"
                className="w-full bg-[#0a0b0f] border border-border rounded-sm pl-7 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500/60"
              />
            </div>
            <button
              onClick={add}
              disabled={!content.trim() || saving}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-sm bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-md border border-border bg-card p-2.5 space-y-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search notes, tags, authors…"
              className="w-full bg-[#0a0b0f] border border-border rounded-sm pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500/60"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveTag(null)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border transition ${
                  activeTag === null
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >All</button>
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border transition ${
                    activeTag === tag
                      ? "bg-emerald-500 text-black border-emerald-500"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >#{tag} <span className="opacity-60 tabular-nums">{count}</span></button>
              ))}
            </div>
          )}
        </div>

        {/* Notes list */}
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.length === 0 && (
            <div className="md:col-span-2 rounded-md border border-dashed border-border bg-card/50 p-10 text-center">
              <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {notes.length === 0 ? "No notes yet — start capturing thoughts above." : "No notes match your filters."}
              </p>
            </div>
          )}
          {filtered.map(n => (
            <div
              key={n.id}
              className="group rounded-md border border-border bg-card p-3 hover:border-emerald-500/40 transition"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">{n.content}</p>
              <div className="mt-2.5 flex items-center flex-wrap gap-1.5 pt-2 border-t border-border/60">
                {(n.tags ?? []).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTag(t)}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 uppercase tracking-wider"
                  >#{t}</button>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {n.display_name && <span className="text-foreground/70">{n.display_name} · </span>}
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
                {n.user_id === user?.id && (
                  <button
                    onClick={() => del(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
