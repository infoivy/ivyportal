import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Search,
  Star,
  Trash2,
  Plus,
  Upload,
  Loader2,
  Copy,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { SelectField } from "@/components/ui/select-field";
import { HOOK_FRAMEWORKS, ivyStarterHooks } from "@/data/growth-operator";

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
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | "tof" | "mof">("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [framework, setFramework] = useState<string>("all");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStage, setImportStage] = useState<"tof" | "mof">("tof");
  const [newText, setNewText] = useState("");
  const [newStage, setNewStage] = useState<"tof" | "mof">("tof");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_hooks")
      .select("*")
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false });
    setHooks((data ?? []) as Hook[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hooks.filter((h) => {
      if (stage !== "all" && h.funnel_stage !== stage) return false;
      if (onlyFav && !h.favorite) return false;
      if (framework !== "all" && h.category !== framework) return false;
      if (
        needle &&
        !(h.text.toLowerCase().includes(needle) || (h.example ?? "").toLowerCase().includes(needle))
      )
        return false;
      return true;
    });
  }, [hooks, q, stage, onlyFav, framework]);

  const add = async () => {
    if (!user || !newText.trim()) return;
    const { error } = await supabase.from("content_hooks").insert({
      created_by: user.id,
      text: newText.trim(),
      funnel_stage: newStage,
      category: "custom",
    });
    if (error) return toast.error(error.message);
    setNewText("");
    load();
  };

  const seedFromSop = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const starters = ivyStarterHooks();
      const existing = new Set(hooks.map((h) => h.text.trim().toLowerCase()));
      const rows = starters
        .filter((s) => !existing.has(s.text.trim().toLowerCase()))
        .map((s) => ({
          created_by: user.id,
          text: s.text,
          funnel_stage: s.funnel_stage,
          category: s.category,
        }));
      if (rows.length === 0) {
        toast.message("Library already has these SOP starters");
        return;
      }
      const { error } = await supabase.from("content_hooks").insert(rows);
      if (error) return toast.error(error.message);
      toast.success(`Added ${rows.length} hooks from Grow 7 frameworks`);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const toggleFav = async (h: Hook) => {
    const { error } = await supabase
      .from("content_hooks")
      .update({ favorite: !h.favorite })
      .eq("id", h.id);
    if (error) toast.error(error.message);
    else load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this hook?")) return;
    const { error } = await supabase.from("content_hooks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const copy = async (h: Hook) => {
    await navigator.clipboard.writeText(h.text);
    toast.success("Copied");
    supabase
      .from("content_hooks")
      .update({ times_used: (h.times_used ?? 0) + 1 })
      .eq("id", h.id)
      .then(() => load());
  };

  const bulkImport = async () => {
    if (!user) return;
    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("Paste some hooks first");
      return;
    }
    const rows = lines.map((t) => ({
      created_by: user.id,
      text: t,
      funnel_stage: importStage,
      category: "import",
    }));
    const { error } = await supabase.from("content_hooks").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} hooks`);
    setImportText("");
    setShowImport(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" /> Grow 7 hook frameworks
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
              From GA hooks training. Seed Ivy-flavored starters, then edit anything. You approve
              what goes on camera · Hermes/agents draft, they don’t post.
            </p>
          </div>
          <button
            type="button"
            onClick={seedFromSop}
            disabled={seeding || !user}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate SOP starters
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {HOOK_FRAMEWORKS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFramework((cur) => (cur === f.id ? "all" : f.id))}
              className={`text-left rounded-lg border px-3 py-2 ${
                framework === f.id
                  ? "border-primary bg-primary/10"
                  : "border-[var(--border)] bg-muted/10 hover:bg-muted/20"
              }`}
            >
              <div className="text-[12px] font-medium text-foreground">{f.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{f.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--card)] rounded-xl p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hooks…"
            className="flex-1 h-7 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "tof", "mof"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`h-7 px-2.5 rounded-md text-[10px] uppercase tracking-wider border ${
                stage === s
                  ? "bg-muted border-border text-foreground"
                  : "border-[var(--border)] text-muted-foreground hover:border-border"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOnlyFav((v) => !v)}
          className={`h-7 px-2.5 rounded-md text-[10px] uppercase tracking-wider border inline-flex items-center gap-1 ${
            onlyFav
              ? "bg-warning-bg border-warning/25 text-warning-fg"
              : "border-[var(--border)] text-muted-foreground"
          }`}
        >
          <Star className="h-3 w-3" /> Favs
        </button>
        {framework !== "all" && (
          <button
            onClick={() => setFramework("all")}
            className="h-7 px-2.5 rounded-md text-[10px] border border-primary/40 text-primary"
          >
            Clear framework filter
          </button>
        )}
        <button
          onClick={() => setShowImport((v) => !v)}
          className="h-7 px-2.5 rounded-md text-[10px] uppercase tracking-wider border border-[var(--border)] text-muted-foreground inline-flex items-center gap-1"
        >
          <Upload className="h-3 w-3" /> Bulk import
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border border-[var(--border)] bg-[var(--card)] rounded-xl p-3">
        <SelectField
          value={newStage}
          onChange={(v) => setNewStage(v as "tof" | "mof")}
          options={[
            { value: "tof", label: "TOF" },
            { value: "mof", label: "MOF" },
          ]}
        />
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Add or edit your own hook…"
          className="flex-1 min-w-[240px] h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border"
        />
        <button
          onClick={add}
          disabled={!newText.trim()}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {showImport && (
        <div className="border border-border bg-muted/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Paste one hook per line
            </span>
            <SelectField
              value={importStage}
              onChange={(v) => setImportStage(v as "tof" | "mof")}
              options={[
                { value: "tof", label: "TOF" },
                { value: "mof", label: "MOF" },
              ]}
            />
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md p-2 text-xs resize-y"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowImport(false)}
              className="h-7 px-3 rounded-md border text-[11px]"
            >
              Cancel
            </button>
            <button
              onClick={bulkImport}
              className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-xl divide-y divide-[var(--border)]">
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center p-8">
              No hooks yet. Hit Generate SOP starters, or add your own.
            </div>
          )}
          {filtered.map((h) => (
            <div key={h.id} className="p-3.5 group hover:bg-muted/30 flex items-start gap-3">
              <button type="button" onClick={() => toggleFav(h)} className="shrink-0 pt-0.5">
                <Star
                  className={`h-3.5 w-3.5 ${h.favorite ? "fill-amber-400 text-warning-fg" : "text-muted-foreground"}`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-snug">{h.text}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  {h.funnel_stage && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                        h.funnel_stage === "tof"
                          ? "text-muted-foreground border-border"
                          : "text-success-fg border-success/25"
                      }`}
                    >
                      {h.funnel_stage}
                    </span>
                  )}
                  {h.category && h.category !== "custom" && (
                    <span className="px-1.5 py-0.5 rounded-md border border-[var(--border)]">
                      {HOOK_FRAMEWORKS.find((f) => f.id === h.category)?.name ?? h.category}
                    </span>
                  )}
                  {h.times_used > 0 && <span>Used {h.times_used}×</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                <button
                  type="button"
                  onClick={() => copy(h)}
                  className="h-8 w-8 grid place-items-center rounded-md border border-[var(--border)]"
                  title="Copy"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => del(h.id)}
                  className="h-8 w-8 grid place-items-center rounded-md border border-[var(--border)] hover:border-danger/25 text-muted-foreground hover:text-danger-fg"
                  title="Delete"
                >
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
