import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, addDays, startOfWeek } from "date-fns";
import { Video, CheckCircle2, Circle, Play, X, ChevronRight, Loader2 } from "lucide-react";

type Slot = {
  id: string;
  scheduled_date: string | null;
  funnel_stage: "tof" | "mof" | null;
  hook: string;
  title: string | null;
  script: string | null;
  format: string | null;
  status: string;
  week_start: string | null;
  duration_sec: number | null;
};

function ymd(d: Date) { return format(d, "yyyy-MM-dd"); }
function mondayOf(d: Date) { return ymd(startOfWeek(d, { weekStartsOn: 1 })); }

const READY_STATUSES = new Set(["approved", "recorded", "filmed", "edited", "scheduled", "posted"]);
function isReady(s: Slot) {
  const filled = s.hook && !/^(TOF|MOF)\s·/.test(s.hook);
  const scripted = (s.script?.trim().length ?? 0) > 20;
  return !!filled && scripted && READY_STATUSES.has(s.status);
}

export function RecordingDay({ onOpenItem }: { onOpenItem: (id: string) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [recordingDay, setRecordingDay] = useState<number>(4);

  const thisWeek = mondayOf(new Date());
  const nextWeek = ymd(addDays(parseISO(thisWeek), 7));

  const load = async () => {
    setLoading(true);
    const [{ data: settings }, { data }] = await Promise.all([
      supabase.from("founder_settings").select("recording_day_of_week").maybeSingle(),
      supabase
        .from("content_items")
        .select("id, scheduled_date, funnel_stage, hook, title, script, format, status, week_start, duration_sec")
        .in("week_start", [thisWeek, nextWeek])
        .order("scheduled_date", { ascending: true }),
    ]);
    if (settings?.recording_day_of_week != null) setRecordingDay(settings.recording_day_of_week);
    setSlots((data ?? []) as Slot[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const ordered = useMemo(() => [...slots].sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "")), [slots]);
  const readyCount = ordered.filter(isReady).length;

  const setDay = async (n: number) => {
    setRecordingDay(n);
    const { data: existing } = await supabase.from("founder_settings").select("id").limit(1).maybeSingle();
    const { error } = existing
      ? await supabase.from("founder_settings").update({ recording_day_of_week: n }).eq("id", existing.id)
      : await supabase.from("founder_settings").insert({ recording_day_of_week: n });
    if (error) toast.error(error.message);
  };

  const markRecorded = async (id: string) => {
    const { error } = await supabase
      .from("content_items")
      .update({ status: "recorded", recorded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const current = focusIdx != null ? ordered[focusIdx] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-400" />
          <div>
            <div className="text-sm font-semibold">Recording Day</div>
            <div className="text-[10px] text-muted-foreground">Batch-shoot the next 2 weeks in one session</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs">
            <span className="text-lg font-bold text-blue-300">{readyCount}</span>
            <span className="text-muted-foreground"> / {ordered.length} ready</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Shoot day</span>
            <select value={recordingDay} onChange={e => setDay(parseInt(e.target.value, 10))} className="h-7 px-1.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs">
              {[1,2,3,4,5,6,0].map(n => <option key={n} value={n}>{dayNames[n]}</option>)}
            </select>
          </div>
          <button
            onClick={() => setFocusIdx(0)}
            disabled={ordered.length === 0}
            className="h-7 px-3 rounded-sm bg-blue-500 hover:bg-blue-400 text-blue-950 text-[11px] font-medium disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Play className="h-3 w-3" /> Focus mode
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[var(--background)] overflow-hidden border border-[var(--border)]">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${ordered.length ? (readyCount / ordered.length) * 100 : 0}%` }} />
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        {ordered.map((s, i) => {
          const ready = isReady(s);
          const filled = s.hook && !/^(TOF|MOF)\s·/.test(s.hook);
          const scripted = (s.script?.trim().length ?? 0) > 20;
          const stageColor = s.funnel_stage === "tof" ? "text-blue-300 border-blue-500/30 bg-blue-500/5" : "text-green-300 border-green-500/30 bg-green-500/5";
          return (
            <div key={s.id} className="flex items-center gap-3 border border-[var(--border)] bg-[var(--card)] rounded-sm p-2.5 hover:border-blue-500/40 transition">
              {ready ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0 space-y-0.5">
                <button onClick={() => onOpenItem(s.id)} className="text-left w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{s.scheduled_date ? format(parseISO(s.scheduled_date), "EEE MMM d") : "—"}</span>
                    {s.funnel_stage && <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${stageColor}`}>{s.funnel_stage}</span>}
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.status}</span>
                    {s.format && <span className="text-[9px] text-muted-foreground">· {s.format}</span>}
                  </div>
                  <div className={`text-xs mt-0.5 line-clamp-1 ${filled ? "" : "italic text-muted-foreground"}`}>
                    {filled ? s.hook : "Empty hook"}
                  </div>
                </button>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span className={filled ? "text-green-400" : ""}>{filled ? "✓" : "○"} Hook</span>
                  <span className={scripted ? "text-green-400" : ""}>{scripted ? "✓" : "○"} Script</span>
                  <span className={READY_STATUSES.has(s.status) ? "text-green-400" : ""}>{READY_STATUSES.has(s.status) ? "✓" : "○"} Approved</span>
                </div>
              </div>
              {ready && (s.status === "approved" || s.status === "scripted") && (
                <button
                  onClick={() => markRecorded(s.id)}
                  className="h-7 px-2 rounded-sm border border-blue-500/40 text-[10px] text-blue-300 hover:bg-blue-500/10 shrink-0"
                >
                  Mark recorded
                </button>
              )}
              <button
                onClick={() => setFocusIdx(i)}
                className="h-7 px-2 rounded-sm border border-[var(--border)] hover:border-blue-500/40 text-[10px] text-muted-foreground hover:text-blue-300 shrink-0 inline-flex items-center gap-0.5"
              >
                Focus <ChevronRight className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
        {ordered.length === 0 && (
          <div className="text-xs text-muted-foreground text-center p-8 border border-[var(--border)] rounded-sm">
            No slots this fortnight yet — open the Weekly plan to provision.
          </div>
        )}
      </div>

      {/* Focus mode */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setFocusIdx(null)}>
          <div className="w-full max-w-4xl bg-[var(--card)] border border-blue-500/30 rounded-sm" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-blue-400">
                {focusIdx! + 1} of {ordered.length} · {current.scheduled_date ? format(parseISO(current.scheduled_date), "EEE MMM d") : "—"}
              </div>
              <button onClick={() => setFocusIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hook</div>
                <div className="text-2xl font-semibold leading-tight">{current.hook || <span className="text-muted-foreground italic">No hook</span>}</div>
              </div>
              {current.script && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Script</div>
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed bg-[var(--background)] border border-[var(--border)] rounded-sm p-3">{current.script}</pre>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {current.format && <span className="px-2 py-0.5 border border-[var(--border)] rounded-sm">{current.format}</span>}
                {current.duration_sec && <span className="px-2 py-0.5 border border-[var(--border)] rounded-sm">{current.duration_sec}s</span>}
                {current.funnel_stage && <span className="px-2 py-0.5 border border-[var(--border)] rounded-sm uppercase">{current.funnel_stage}</span>}
              </div>
            </div>
            <div className="p-3 border-t border-[var(--border)] flex items-center justify-between">
              <button
                onClick={() => setFocusIdx(Math.max(0, focusIdx! - 1))}
                disabled={focusIdx! === 0}
                className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs disabled:opacity-30"
              >← Prev</button>
              <div className="flex gap-2">
                <button onClick={() => onOpenItem(current.id)} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Edit</button>
                {(current.status === "approved" || current.status === "scripted") && (
                  <button
                    onClick={async () => { await markRecorded(current.id); setFocusIdx(Math.min(ordered.length - 1, focusIdx! + 1)); }}
                    className="h-8 px-3 rounded-sm bg-blue-500 hover:bg-blue-400 text-blue-950 text-xs font-medium"
                  >Mark recorded → Next</button>
                )}
              </div>
              <button
                onClick={() => setFocusIdx(Math.min(ordered.length - 1, focusIdx! + 1))}
                disabled={focusIdx! === ordered.length - 1}
                className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs disabled:opacity-30"
              >Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
