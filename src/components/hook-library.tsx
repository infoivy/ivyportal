import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Search, Star, Trash2, Plus, Upload, Loader2, Copy } from "lucide-react";
import { SelectField } from "@/components/ui/select-field";

type Hook = {
  id: string;
  text: string;
  example: string | null;
  category: string | null;
  funnel_stage: "tof" | "mof" | null;
  favorite: boolean;
  times_used: number;
  created_at: string;
};

export function HookLibrary() {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | "tof" | "mof">("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStage, setImportStage] = useState<"tof" | "mof">("tof");
  const [newText, setNewText] = useState("");
  const [newStage, setNewStage] = useState<"tof" | "mof">("tof");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("content_hooks").select("*").order("favorite", { ascending: false }).order("created_at", { ascending: false });
    setHooks((data ?? []) as Hook[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hooks.filter(h => {
      if (stage !== "all" && h.funnel_stage !== stage) return false;
      if (onlyFav && !h.favorite) return false;
      if (needle && !(h.text.toLowerCase().includes(needle) || (h.example ?? "").toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [hooks, q, stage, onlyFav]);

  const add = async () => {
    if (!user || !newText.trim()) return;
    const { error } = await supabase.from("content_hooks").insert({
      created_by: user.id, text: newText.trim(), funnel_stage: newStage,
    });
    if (error) return toast.error(error.message);
    setNewText(""); load();
  };

  const toggleFav = async (h: Hook) => {
    const { error } = await supabase.from("content_hooks").update({ favorite: !h.favorite }).eq("id", h.id);
    if (error) toast.error(error.message); else load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this hook?")) return;
    const { error } = await supabase.from("content_hooks").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const copy = async (h: Hook) => {
    await navigator.clipboard.writeText(h.text);
    toast.success("Copied");
    supabase.from("content_hooks").update({ times_used: (h.times_used ?? 0) + 1 }).eq("id", h.id).then(() => load());
  };

  const bulkImport = async () => {
    if (!user) return;
    const lines = importText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("Paste some hooks first"); return; }
    const rows = lines.map(t => ({ created_by: user.id, text: t, funnel_stage: importStage }));
    const { error } = await supabase.from("content_hooks").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} hooks`);
    setImportText(""); setShowImport(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search hooks…"
            className="flex-1 h-7 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {(["all","tof","mof"] as const).map(s => (
            <button key={s} onClick={() => setStage(s)} className={`h-7 px-2.5 rounded-sm text-[10px] uppercase tracking-wider border ${stage === s ? "bg-muted border-border text-muted-foreground" : "border-[var(--border)] text-muted-foreground hover:border-border"}`}>{s}</button>
          ))}
        </div>
        <button onClick={() => setOnlyFav(v => !v)} className={`h-7 px-2.5 rounded-sm text-[10px] uppercase tracking-wider border inline-flex items-center gap-1 ${onlyFav ? "bg-warning-bg border-warning/25 text-warning-fg" : "border-[var(--border)] text-muted-foreground hover:border-warning/25"}`}>
          <Star className="h-3 w-3" /> Favs
        </button>
        <button onClick={() => setShowImport(v => !v)} className="h-7 px-2.5 rounded-sm text-[10px] uppercase tracking-wider border border-[var(--border)] text-muted-foreground hover:border-border inline-flex items-center gap-1">
          <Upload className="h-3 w-3" /> Bulk import
        </button>
      </div>

      {/* Quick add */}
      <div className="flex flex-wrap gap-2 border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
        <SelectField value={newStage} onChange={(v) => setNewStage(v as "tof" | "mof")} options={[{ value: "tof", label: "TOF" }, { value: "mof", label: "MOF" }]} />
        <input
          value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Add a hook… (e.g., 'Nobody talks about this, but…')"
          className="flex-1 min-w-[240px] h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border"
        />
        <button onClick={add} disabled={!newText.trim()} className="h-8 px-3 rounded-sm bg-muted hover:bg-muted text-muted-foreground text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {showImport && (
        <div className="border border-border bg-muted rounded-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Paste one hook per line</span>
            <SelectField value={importStage} onChange={(v) => setImportStage(v as "tof" | "mof")} options={[{ value: "tof", label: "TOF" }, { value: "mof", label: "MOF" }]} />
          </div>
          <textarea
            value={importText} onChange={e => setImportText(e.target.value)}
            rows={6}
            placeholder={"Nobody talks about this, but…\nHere's what I wish I knew at 22…\n3 mistakes killing your…"}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-y focus:outline-none focus:border-border"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowImport(false)} className="h-7 px-3 rounded-sm border border-[var(--border)] text-[11px]">Cancel</button>
            <button onClick={bulkImport} className="h-7 px-3 rounded-sm bg-muted hover:bg-muted text-muted-foreground text-[11px] font-medium">Import</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm divide-y divide-[var(--accent)]">
          {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center p-8">No hooks match — add one above, or bulk import.</div>}
          {filtered.map(h => (
            <div key={h.id} className="p-3 group hover:bg-[#141821] flex items-start gap-3">
              <button onClick={() => toggleFav(h)} className="shrink-0 pt-0.5">
                <Star className={`h-3.5 w-3.5 ${h.favorite ? "fill-amber-400 text-warning-fg" : "text-muted-foreground hover:text-warning-fg"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm">{h.text}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  {h.funnel_stage && <span className={`px-1.5 py-0.5 rounded-sm border uppercase tracking-wider ${h.funnel_stage === "tof" ? "text-muted-foreground border-border" : "text-success-fg border-success/25"}`}>{h.funnel_stage}</span>}
                  {h.times_used > 0 && <span>Used {h.times_used}×</span>}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button onClick={() => copy(h)} className="h-7 w-7 grid place-items-center rounded-sm border border-[var(--border)] hover:border-border text-muted-foreground hover:text-muted-foreground" title="Copy">
                  <Copy className="h-3 w-3" />
                </button>
                <button onClick={() => del(h.id)} className="h-7 w-7 grid place-items-center rounded-sm border border-[var(--border)] hover:border-danger/25 text-muted-foreground hover:text-danger-fg" title="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
