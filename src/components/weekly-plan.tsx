import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureWeekProvisioned, generateWeekIdeas, promoteIdeaToSlot,
} from "@/lib/weekly-plan.functions";
import {
  ChevronLeft, ChevronRight, Sparkles, Loader2, Wand2, ArrowRight, CheckCircle2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, parseISO, addDays, startOfWeek, isSameDay } from "date-fns";

type Stage = "mof" | "tof";
type WeekIdea = {
  id: string;
  week_start: string;
  position: number;
  stage: Stage;
  text: string;
  matched_creative_type: string | null;
  promoted_item_id: string | null;
};
type WeekSlot = {
  id: string;
  scheduled_date: string | null;
  funnel_stage: Stage | null;
  hook: string;
  status: string;
  format: string | null;
  link_when_posted: string | null;
  week_start: string | null;
};

// Kept in sync with the "Content Brainstorm Session" SOP → Step 3 video formats.
const CREATIVE_TYPES = [
  "Talking head",
  "Pick up the phone angle",
  "Side angle",
  "Miro board walkthrough",
  "Ceiling angle",
  "Prestigious background",
  "Vlog style",
];

// Monday-start local YYYY-MM-DD. Do NOT use toISOString — it shifts by the
// local UTC offset, so in any UTC+X timezone a local Monday becomes the
// previous UTC day (Sunday). That is the exact off-by-one date bug.
function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
function mondayOf(d: Date): string {
  return ymd(startOfWeek(d, { weekStartsOn: 1 }));
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOT_LABELS = [
  { stage: "tof" as Stage, position: "1 of 4" },
  { stage: "tof" as Stage, position: "2 of 4" },
  { stage: "tof" as Stage, position: "3 of 4" },
  { stage: "tof" as Stage, position: "4 of 4" },
  { stage: "mof" as Stage, position: "1 of 3" },
  { stage: "mof" as Stage, position: "2 of 3" },
  { stage: "mof" as Stage, position: "3 of 3" },
];

export function WeeklyPlan({ onOpenItem }: { onOpenItem: (id: string) => void }) {
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [ideas, setIdeas] = useState<WeekIdea[]>([]);
  const [slots, setSlots] = useState<WeekSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [brand, setBrand] = useState<string>(() => {
    try { return localStorage.getItem("weekly-plan-brand") ?? ""; } catch { return ""; }
  });
  const [showBrand, setShowBrand] = useState(false);

  const ensureFn = useServerFn(ensureWeekProvisioned);
  const generateFn = useServerFn(generateWeekIdeas);
  const promoteFn = useServerFn(promoteIdeaToSlot);

  // Compute both weeks the plan covers
  const nextWeekStart = useMemo(() => ymd(addDays(parseISO(weekStart), 7)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Provision both weeks so the recording day → 2-week horizon works.
      await Promise.all([
        ensureFn({ data: { weekStart } }),
        ensureFn({ data: { weekStart: nextWeekStart } }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to prepare weeks");
    }
    const [{ data: is }, { data: it }] = await Promise.all([
      supabase.from("content_week_ideas").select("*").in("week_start", [weekStart, nextWeekStart]).order("position"),
      supabase.from("content_items")
        .select("id, scheduled_date, funnel_stage, hook, status, format, link_when_posted, week_start")
        .in("week_start", [weekStart, nextWeekStart])
        .order("scheduled_date", { ascending: true }),
    ]);
    setIdeas((is ?? []) as WeekIdea[]);
    setSlots((it ?? []) as WeekSlot[]);
    setLoading(false);
  }, [weekStart, nextWeekStart, ensureFn]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try { localStorage.setItem("weekly-plan-brand", brand); } catch {}
  }, [brand]);

  const monday = useMemo(() => parseISO(weekStart), [weekStart]);
  const isThisWeek = mondayOf(new Date()) === weekStart;
  const weekEnd = addDays(monday, 6);
  const nextEnd = addDays(parseISO(nextWeekStart), 6);


  const saveIdeaField = async (id: string, patch: Partial<WeekIdea>) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    const { error } = await supabase.from("content_week_ideas").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const runGenerate = async (overwrite: boolean) => {
    setGenerating(true);
    try {
      const res = await generateFn({ data: { weekStart, brandContext: brand, overwrite } });
      toast.success(`AI filled ${res.updated} idea${res.updated === 1 ? "" : "s"}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const promote = async (ideaId: string, contentItemId: string) => {
    try {
      await promoteFn({ data: { ideaId, contentItemId } });
      toast.success("Promoted to slot");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Promote failed");
    }
  };

  const shift = (n: number) => setWeekStart(mondayOf(addDays(monday, n * 7)));

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className="flex flex-wrap items-center gap-2 border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
        <button onClick={() => shift(-1)} className="h-7 w-7 grid place-items-center rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setWeekStart(mondayOf(new Date()))} className="h-7 px-2 rounded-sm border border-[#1f2530] text-[10px] hover:border-fuchsia-500/40 uppercase tracking-wider">This week</button>
        <button onClick={() => shift(1)} className="h-7 w-7 grid place-items-center rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <div className="ml-2 flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-3.5 w-3.5 text-fuchsia-400" />
          <span className="text-sm font-semibold">
            {format(monday, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          {isThisWeek && <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 uppercase tracking-wider">Now</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowBrand(v => !v)}
            className="h-7 px-2 rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40 text-[11px] text-muted-foreground"
          >
            Brand context {brand ? "✓" : ""}
          </button>
          <button
            onClick={() => runGenerate(false)}
            disabled={generating || loading}
            className="h-7 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-[11px] font-medium disabled:opacity-40 inline-flex items-center gap-1"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            AI fill empty
          </button>
          <button
            onClick={() => runGenerate(true)}
            disabled={generating || loading}
            className="h-7 px-2 rounded-sm border border-fuchsia-500/40 hover:border-fuchsia-400 text-[11px] text-fuchsia-300 disabled:opacity-40"
            title="Overwrite existing ideas"
          >
            Regen all
          </button>
        </div>
      </div>

      {showBrand && (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Brand / niche context (used by AI ideation)
          </div>
          <textarea
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            rows={3}
            placeholder="e.g. I coach 6-figure agency owners on scaling ops. Voice: direct, blunt, no fluff. Signature angles: hiring, delegation, systems."
            className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-y focus:outline-none focus:border-fuchsia-500/40"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Saved on this device. Feed the model your niche, voice, and repeat themes.</p>
        </div>
      )}

      {/* TOF vs MOF reference */}
      <div className="grid md:grid-cols-2 gap-2">
        <div className="border border-blue-500/30 bg-blue-500/5 rounded-sm p-3">
          <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">TOF · Top of Funnel · Mon–Thu</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Reach cold strangers. No pitch, no offer. Hooks, entertainment, relatable moments, value drops, identity content.
          </div>
          <div className="text-[10px] italic text-blue-400/70 mt-1">Would a total stranger stop at this?</div>
        </div>
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-sm p-3">
          <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">MOF · Middle of Funnel · Fri–Sun</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Move warm followers closer. Social proof, breakdowns, results, deeper value, CTAs.
          </div>
          <div className="text-[10px] italic text-emerald-400/70 mt-1">Would a warm follower take action from this?</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading weeks…</div>
      ) : (
        <div className="space-y-6">
          <WeekBlock
            label="This week"
            weekStart={weekStart}
            slots={slots.filter(s => s.week_start === weekStart)}
            ideas={ideas.filter(i => i.week_start === weekStart)}
            onOpenItem={onOpenItem}
            onSaveIdea={saveIdeaField}
            onPromote={promote}
            onRepair={load}
          />
          <WeekBlock
            label="Next week"
            weekStart={nextWeekStart}
            slots={slots.filter(s => s.week_start === nextWeekStart)}
            ideas={ideas.filter(i => i.week_start === nextWeekStart)}
            onOpenItem={onOpenItem}
            onSaveIdea={saveIdeaField}
            onPromote={promote}
            onRepair={load}
          />
        </div>
      )}
    </div>
  );
}

function WeekBlock({
  label, weekStart, slots, ideas, onOpenItem, onSaveIdea, onPromote, onRepair,
}: {
  label: string;
  weekStart: string;
  slots: WeekSlot[];
  ideas: WeekIdea[];
  onOpenItem: (id: string) => void;
  onSaveIdea: (id: string, patch: Partial<WeekIdea>) => void;
  onPromote: (ideaId: string, contentItemId: string) => void;
  onRepair: () => void;
}) {
  const monday = parseISO(weekStart);
  const weekEnd = addDays(monday, 6);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, WeekSlot[]>();
    for (let i = 0; i < 7; i++) map.set(ymd(addDays(monday, i)), []);
    for (const s of slots) {
      if (!s.scheduled_date) continue;
      const arr = map.get(s.scheduled_date);
      if (arr) arr.push(s);
    }
    return map;
  }, [slots, monday]);
  const mofIdeas = ideas.filter(i => i.stage === "mof").sort((a, b) => a.position - b.position);
  const tofIdeas = ideas.filter(i => i.stage === "tof").sort((a, b) => a.position - b.position);
  const availableSlotsFor = (stage: Stage) => slots.filter(s => s.funnel_stage === stage);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 border-b border-[#1f2530] pb-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 font-semibold">{label}</span>
        <span className="text-sm font-semibold">{format(monday, "MMM d")} – {format(weekEnd, "MMM d")}</span>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reel schedule</h2>
            <span className="text-[10px] text-muted-foreground">7 reels · 4 TOF · 3 MOF</span>
          </div>
          <div className="space-y-1.5">
            {DAYS.map((day, idx) => {
              const date = ymd(addDays(monday, idx));
              const daySlots = slotsByDay.get(date) ?? [];
              const meta = SLOT_LABELS[idx];
              const isToday = isSameDay(addDays(monday, idx), new Date());
              const stageColor = meta.stage === "tof" ? "border-blue-500/30 bg-blue-500/5" : "border-emerald-500/30 bg-emerald-500/5";
              const stageBadge = meta.stage === "tof" ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
              return (
                <div key={day} className={`border rounded-sm ${stageColor} ${isToday ? "ring-1 ring-fuchsia-500/40" : ""}`}>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/5">
                    <span className="text-[10px] font-mono w-14 text-muted-foreground">{day} {format(addDays(monday, idx), "d")}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${stageBadge}`}>{meta.stage} · {meta.position}</span>
                    {isToday && <span className="text-[9px] uppercase tracking-wider text-fuchsia-400 font-bold">Today</span>}
                  </div>
                  <div className="p-2 space-y-1">
                    {daySlots.length === 0 ? (
                      <button onClick={onRepair} className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 italic px-1 underline decoration-dotted">
                        Slot missing — click to repair
                      </button>
                    ) : daySlots.map(s => {
                      const isFilled = s.hook && !/^(TOF|MOF)\s·/.test(s.hook);
                      return (
                        <button key={s.id} onClick={() => onOpenItem(s.id)} className="w-full text-left px-2 py-1.5 rounded-sm bg-[#0a0b0f]/60 hover:bg-[#0a0b0f] border border-transparent hover:border-fuchsia-500/40 transition">
                          <div className="flex items-center gap-2">
                            {isFilled ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> : <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <span className={`text-xs ${isFilled ? "" : "text-muted-foreground italic"} line-clamp-2`}>{isFilled ? s.hook : "Empty slot — click to draft"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-muted-foreground">
                            <span className="uppercase tracking-wider">{s.status}</span>
                            {s.format && <span>· {s.format}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ideation pad · 10 ideas</h2>
            <span className="text-[10px] text-muted-foreground">1–5 MOF · 6–10 TOF</span>
          </div>
          <div className="space-y-1.5">
            <IdeaGroup title="MOF · Ideas 1–5" stageColor="border-emerald-500/30" ideas={mofIdeas} slots={availableSlotsFor("mof")} onChange={onSaveIdea} onPromote={onPromote} />
            <IdeaGroup title="TOF · Ideas 6–10" stageColor="border-blue-500/30" ideas={tofIdeas} slots={availableSlotsFor("tof")} onChange={onSaveIdea} onPromote={onPromote} />
          </div>
        </section>
      </div>
    </div>
  );
}

function IdeaGroup({
  title, stageColor, ideas, slots, onChange, onPromote,
}: {
  title: string;
  stageColor: string;
  ideas: WeekIdea[];
  slots: WeekSlot[];
  onChange: (id: string, patch: Partial<WeekIdea>) => void;
  onPromote: (ideaId: string, contentItemId: string) => void;
}) {
  return (
    <div className={`border ${stageColor} bg-[#0f1116] rounded-sm`}>
      <div className="px-2.5 py-1.5 border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="divide-y divide-white/5">
        {ideas.map((idea) => (
          <IdeaRow key={idea.id} idea={idea} slots={slots} onChange={onChange} onPromote={onPromote} />
        ))}
      </div>
    </div>
  );
}

function IdeaRow({
  idea, slots, onChange, onPromote,
}: {
  idea: WeekIdea;
  slots: WeekSlot[];
  onChange: (id: string, patch: Partial<WeekIdea>) => void;
  onPromote: (ideaId: string, contentItemId: string) => void;
}) {
  const [text, setText] = useState(idea.text ?? "");
  const [ct, setCt] = useState(idea.matched_creative_type ?? "");
  useEffect(() => { setText(idea.text ?? ""); setCt(idea.matched_creative_type ?? ""); }, [idea.id, idea.text, idea.matched_creative_type]);

  const promoted = !!idea.promoted_item_id;

  return (
    <div className={`p-2 ${promoted ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-muted-foreground w-5 pt-1.5 text-center shrink-0">#{idea.position}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== idea.text && onChange(idea.id, { text })}
            placeholder={idea.stage === "mof" ? "Warm follower angle — story, proof, CTA…" : "Cold-scroll hook — pattern break, insight, identity…"}
            rows={2}
            className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-1.5 text-xs resize-none focus:outline-none focus:border-fuchsia-500/40"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={ct}
              onChange={(e) => { setCt(e.target.value); onChange(idea.id, { matched_creative_type: e.target.value || null }); }}
              className="h-6 px-1.5 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-[10px] outline-none focus:border-fuchsia-500/40"
            >
              <option value="">Creative type…</option>
              {CREATIVE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {promoted ? (
              <span className="text-[10px] text-fuchsia-400 inline-flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> Promoted
              </span>
            ) : slots.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">No {idea.stage.toUpperCase()} slots</span>
            ) : (
              <PromoteMenu ideaText={text} slots={slots} onPromote={(slotId) => onPromote(idea.id, slotId)} disabled={!text.trim()} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoteMenu({
  slots, onPromote, disabled,
}: { ideaText: string; slots: WeekSlot[]; onPromote: (slotId: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="h-6 px-2 rounded-sm border border-fuchsia-500/40 text-[10px] text-fuchsia-300 hover:bg-fuchsia-500/10 inline-flex items-center gap-0.5 disabled:opacity-40"
      >
        Promote <ArrowRight className="h-2.5 w-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 min-w-[220px] border border-[#1f2530] bg-[#0f1116] rounded-sm shadow-lg">
            {slots.map(s => (
              <button
                key={s.id}
                onClick={() => { onPromote(s.id); setOpen(false); }}
                className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-[#141821] border-b border-white/5 last:border-0"
              >
                <div className="font-mono text-[10px] text-muted-foreground">{s.scheduled_date}</div>
                <div className="line-clamp-1">{s.hook}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
