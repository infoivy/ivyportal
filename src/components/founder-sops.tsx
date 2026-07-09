import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "@/components/markdown-view";
import { MarkdownEditor } from "@/components/markdown-editor";
import { toast } from "sonner";
import { BookOpen, Pencil, Check, X, Plus, Loader2, CalendarClock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type FounderDoc = {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
  last_reviewed_at: string | null;
  pinned: boolean;
};

export function FounderSops() {
  const [docs, setDocs] = useState<FounderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("docs")
      .select("id, slug, title, content, updated_at, last_reviewed_at, pinned")
      .eq("is_founder_only", true)
      .order("pinned", { ascending: false })
      .order("title", { ascending: true });
    if (error) toast.error(error.message);
    setDocs((data ?? []) as FounderDoc[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId && docs.length > 0) setSelectedId(docs[0].id);
  }, [docs, selectedId]);

  const selected = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);

  const startEdit = () => {
    if (!selected) return;
    setDraftTitle(selected.title);
    setDraftContent(selected.content ?? "");
    setMode("edit");
  };

  const cancelEdit = () => { setMode("view"); setDraftTitle(""); setDraftContent(""); };

  const save = async () => {
    if (!selected) return;
    if (!draftTitle.trim()) return toast.error("Title required");
    setSaving(true);
    const { error } = await supabase
      .from("docs")
      .update({ title: draftTitle.trim(), content: draftContent })
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setMode("view");
    await load();
  };

  const markReviewed = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("docs")
      .update({ last_reviewed_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) toast.error(error.message);
    else { toast.success("Marked reviewed"); await load(); }
  };

  const createDoc = async () => {
    const title = prompt("New SOP title:")?.trim();
    if (!title) return;
    const slug =
      title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80) +
      "-" +
      Math.random().toString(36).slice(2, 6);
    setCreating(true);
    const { data, error } = await supabase
      .from("docs")
      .insert({
        title,
        slug,
        category: "content",
        content: "# " + title + "\n\nStart writing here.",
        role_visibility: ["admin", "founder"],
        is_founder_only: true,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    await load();
    if (data?.id) setSelectedId(data.id);
  };

  const reviewedStaleness = (d: FounderDoc): { label: string; stale: boolean } => {
    const when = d.last_reviewed_at ?? d.updated_at;
    if (!when) return { label: "never reviewed", stale: true };
    const days = (Date.now() - new Date(when).getTime()) / 86400000;
    return {
      label: `${formatDistanceToNow(new Date(when))} ago`,
      stale: days > 30,
    };
  };

  return (
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <aside className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f2530]">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3 w-3" /> SOPs & Playbooks
          </div>
          <button
            onClick={createDoc}
            disabled={creating}
            className="h-6 w-6 grid place-items-center rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40"
            title="New SOP"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </button>
        </div>
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            No SOPs yet. Click <span className="text-fuchsia-400">+</span> to create one.
          </div>
        ) : (
          <ul className="divide-y divide-[#1a1f29]">
            {docs.map((d) => {
              const active = d.id === selectedId;
              const rev = reviewedStaleness(d);
              return (
                <li key={d.id}>
                  <button
                    onClick={() => { setSelectedId(d.id); setMode("view"); }}
                    className={`w-full text-left px-3 py-2 hover:bg-[#14171e] ${active ? "bg-fuchsia-500/5 border-l-2 border-fuchsia-500" : ""}`}
                  >
                    <div className="text-xs font-medium line-clamp-2">{d.title}</div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <CalendarClock className="h-2.5 w-2.5" />
                      <span className={rev.stale ? "text-amber-400" : ""}>{rev.label}</span>
                      {rev.stale && <span className="text-amber-400">· stale</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="border border-[#1f2530] bg-[#0f1116] rounded-sm min-h-[400px]">
        {!selected ? (
          <div className="p-8 text-sm text-muted-foreground text-center">
            {loading ? "Loading…" : "Select an SOP from the left, or create a new one."}
          </div>
        ) : mode === "view" ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1f2530]">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Last reviewed {reviewedStaleness(selected).label}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={markReviewed}
                  className="h-8 px-3 rounded-sm border border-[#1f2530] hover:border-emerald-500/40 text-xs text-emerald-300"
                >
                  Mark reviewed
                </button>
                <button
                  onClick={startEdit}
                  className="h-8 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium inline-flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {selected.content?.trim() ? (
                <MarkdownView content={selected.content} />
              ) : (
                <p className="text-sm text-muted-foreground italic">Empty — click Edit to start writing.</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1f2530]">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-0"
              />
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="h-8 px-3 rounded-sm border border-[#1f2530] hover:border-red-500/40 text-xs inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="h-8 px-3 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              </div>
            </div>
            <div className="p-4">
              <MarkdownEditor value={draftContent} onChange={setDraftContent} minHeight={500} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
